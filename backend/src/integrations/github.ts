import { z } from 'zod';
import type { Database } from '../database.ts';
import { shiftCalendarDate, startOfIstanbulDate } from '../domain/date.ts';
import type { GithubActivity, GithubRepository, Prisma } from '../generated/prisma/client.ts';
import { HttpError } from '../middleware/error-handler.ts';
import { calendarDate, containsText, id, pageFields, requiredText } from '../validation.ts';
import { repositoryName, repositoryOwner, repositoryUrl } from './github-api.ts';
import type { GithubClient } from './github-api.ts';

const syncLeaseMs = 60_000;
const missingRepository = () => new HttpError(404, 'GITHUB_NOT_CONNECTED', 'Connect a GitHub repository to this project first.');
const missingProject = () => new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
const missingSession = () => new HttpError(404, 'SESSION_NOT_FOUND', 'Development session not found.');
const syncRunning = () => new HttpError(409, 'GITHUB_SYNC_RUNNING', 'This repository is already synchronizing.');

export const connectionBody = z.strictObject({ projectId: id, owner: repositoryOwner, name: repositoryName });
export const repositoryPath = z.strictObject({ projectId: id });
export const sessionPath = z.strictObject({ sessionId: id });
export const linkBody = z.strictObject({ activityIds: z.array(id).max(50) });
export const activityQuery = z.strictObject({
  ...pageFields, projectId: id.optional(), sessionId: id.optional(), kind: z.enum(['commit', 'pull_request']).optional(),
  q: requiredText(120).optional(), from: calendarDate.optional(), to: calendarDate.optional(),
}).refine(({ from, to }) => !from || !to || from <= to);

function repositoryDto(repository: GithubRepository) {
  const { projectId, syncStartedAt, syncStatus, ...data } = repository;
  const interrupted = syncStatus === 'syncing' && (!syncStartedAt || +syncStartedAt + syncLeaseMs <= Date.now());
  return { ...data, projectId: String(projectId), url: repositoryUrl(repository),
    syncStatus: interrupted ? 'failed' : syncStatus,
    syncMessage: interrupted ? 'The last synchronization was interrupted. Refresh to retry.' : data.syncMessage };
}

function activityDto({ id, projectId, ...data }: GithubActivity) {
  return { ...data, id: String(id), projectId: String(projectId) };
}

export function createGithubWorkspace(database: Database, github: GithubClient) {
  const { prisma } = database;

  async function listRepositories() {
    const repositories = await prisma.githubRepository.findMany({ orderBy: { projectId: 'asc' } });
    return repositories.map(repositoryDto);
  }

  async function getRepository(projectId: bigint) {
    const repository = await prisma.githubRepository.findUnique({ where: { projectId } });
    return repository ? repositoryDto(repository) : null;
  }

  async function connect(input: z.infer<typeof connectionBody>) {
    const { projectId, owner, name } = input;
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw missingProject();
    const metadata = await github.metadata({ owner, name }, AbortSignal.timeout(8_000));
    let repository: GithubRepository;
    try {
      repository = await prisma.githubRepository.upsert({
        where: { projectId }, create: { projectId, ...metadata }, update: {},
      });
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error)) throw error;
      if (error.code === 'P2003') throw missingProject();
      if (error.code !== 'P2002') throw error;
      const concurrentRepository = await prisma.githubRepository.findUnique({ where: { projectId } });
      if (!concurrentRepository) {
        throw new HttpError(409, 'GITHUB_REPOSITORY_IN_USE', 'This GitHub repository is already connected to a different project.');
      }
      repository = concurrentRepository;
    }
    if (repository.owner.toLowerCase() !== metadata.owner.toLowerCase() || repository.name.toLowerCase() !== metadata.name.toLowerCase()) {
      throw new HttpError(409, 'GITHUB_ALREADY_CONNECTED', 'Disconnect the current repository before connecting another repository to this project.');
    }
    return repositoryDto(repository);
  }

  async function disconnect(projectId: bigint) {
    const staleBefore = new Date(Date.now() - syncLeaseMs);
    const removed = await prisma.githubRepository.deleteMany({ where: { projectId, OR: [
      { syncStatus: { not: 'syncing' } }, { syncStartedAt: null }, { syncStartedAt: { lte: staleBefore } },
    ] } });
    if (removed.count) return;
    const repository = await prisma.githubRepository.findUnique({ where: { projectId }, select: { projectId: true } });
    if (repository) throw syncRunning();
    throw missingRepository();
  }

  async function synchronize(projectId: bigint) {
    const startedAt = new Date();
    const staleBefore = new Date(+startedAt - syncLeaseMs);
    const started = await prisma.githubRepository.updateMany({
      where: { projectId, OR: [{ syncStatus: { not: 'syncing' } }, { syncStartedAt: null }, { syncStartedAt: { lte: staleBefore } }] },
      data: { syncStartedAt: startedAt, syncStatus: 'syncing', syncMessage: null },
    });
    const repository = await prisma.githubRepository.findUnique({ where: { projectId } });
    if (!repository) throw missingRepository();
    if (!started.count) throw syncRunning();

    const lease = { projectId, syncStartedAt: startedAt, syncStatus: 'syncing' };
    try {
      const signal = AbortSignal.timeout(25_000);
      const metadata = await github.metadata(repository, signal);
      const result = await github.activity(metadata, signal);
      const saved = await prisma.$transaction(async transaction => {
        const updated = await transaction.githubRepository.updateMany({ where: lease, data: {
          ...metadata, syncStartedAt: null, lastSyncAt: new Date(),
          syncStatus: result.truncated ? 'partial' : 'synced',
          syncMessage: result.truncated ? 'Imported recent activity. Older items remain outside the synchronization window.' : null,
        } });
        if (!updated.count) throw new HttpError(409, 'GITHUB_SYNC_SUPERSEDED', 'The repository changed. Refresh to synchronize again.');
        for (const data of result.activity) {
          const { kind, externalId, ...changes } = data;
          await transaction.githubActivity.upsert({
            where: { projectId_kind_externalId: { projectId, kind, externalId } },
            create: { projectId, ...data }, update: changes,
          });
        }
        return transaction.githubRepository.findUniqueOrThrow({ where: { projectId } });
      }, { timeout: 12_000 });
      return repositoryDto(saved);
    } catch (error) {
      const failureMessage = error instanceof HttpError ? error.message : 'Synchronization failed. Try again.';
      await prisma.githubRepository.updateMany({ where: lease,
        data: { syncStartedAt: null, syncStatus: 'failed', syncMessage: failureMessage } });
      throw error;
    }
  }

  async function listActivity(input: z.infer<typeof activityQuery>) {
    const { projectId, sessionId, kind, q, from, to, offset, limit } = input;
    const search = q && containsText(q);
    const where: Prisma.GithubActivityWhereInput = {
      projectId, kind, sessions: sessionId ? { some: { sessionId } } : undefined,
      occurredAt: { gte: from ? startOfIstanbulDate(from) : undefined,
        lt: to ? startOfIstanbulDate(shiftCalendarDate(to, 1)) : undefined },
      OR: search ? [{ title: search }, { details: search }, { author: search }, { externalId: search }] : undefined,
    };
    const [rows, total] = await prisma.$transaction([
      prisma.githubActivity.findMany({ where, skip: offset, take: limit, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] }),
      prisma.githubActivity.count({ where }),
    ], { isolationLevel: 'RepeatableRead' });
    return { data: rows.map(activityDto), pagination: { offset, limit, total, hasMore: offset + rows.length < total } };
  }

  async function getActivity(activityId: bigint) {
    const activity = await prisma.githubActivity.findUnique({ where: { id: activityId } });
    if (!activity) throw new HttpError(404, 'GITHUB_ACTIVITY_NOT_FOUND', 'GitHub activity not found.');
    return activityDto(activity);
  }

  async function activityForSession(sessionId: bigint) {
    const session = await prisma.developmentSession.findUnique({ where: { id: sessionId }, select: {
      githubLinks: { include: { activity: true }, orderBy: [{ activity: { occurredAt: 'desc' } }, { activityId: 'desc' }] },
    } });
    if (!session) throw missingSession();
    return session.githubLinks.map(link => activityDto(link.activity));
  }

  async function replaceSessionActivity(sessionId: bigint, activityIds: bigint[]) {
    const ids = [...new Set(activityIds)];
    try {
      return await prisma.$transaction(async transaction => {
        const session = await transaction.developmentSession.findUnique({ where: { id: sessionId }, select: { projectId: true } });
        if (!session) throw missingSession();
        const activity = await transaction.githubActivity.findMany({ where: { id: { in: ids }, projectId: session.projectId },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] });
        if (activity.length !== ids.length) {
          throw new HttpError(400, 'GITHUB_ACTIVITY_INVALID', 'Select GitHub activity from the session’s project.');
        }
        await transaction.githubSessionLink.deleteMany({ where: { sessionId, activityId: { notIn: ids } } });
        if (ids.length) await transaction.githubSessionLink.createMany({
          data: ids.map(activityId => ({ sessionId, activityId })), skipDuplicates: true,
        });
        return activity.map(activityDto);
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && ['P2034', 'P2003'].includes(String(error.code))) {
        throw new HttpError(409, 'GITHUB_LINK_CONFLICT', 'The session or GitHub activity changed. Review the selection and try again.');
      }
      throw error;
    }
  }

  return { listRepositories, getRepository, connect, disconnect, synchronize, listActivity, getActivity, activityForSession, replaceSessionActivity };
}
