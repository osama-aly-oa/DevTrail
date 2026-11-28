import pg from 'pg';
import { Prisma } from '../generated/prisma/client.ts';
import type { DevelopmentSession, Project } from '../generated/prisma/client.ts';
import type { Database } from '../database.ts';
import { dateForDatabase } from './date.ts';
import { HttpError } from '../middleware/error-handler.ts';
import { containsText } from '../validation.ts';

export interface Page {
  offset: number;
  limit: number;
}

interface SessionFilters extends Page {
  projectId?: bigint;
  from?: string;
  to?: string;
  q?: string;
  status?: string;
  technology?: string;
  category?: string;
  tag?: string;
  sort?: 'newest' | 'oldest';
}

export function pageResult<T, U>(rows: T[], { offset, limit }: Page, toDto: (row: T) => U) {
  return { data: rows.slice(0, limit).map(toDto), pagination: { offset, limit, hasMore: rows.length > limit } };
}

export function projectDto(row: Project) {
  return { ...row, id: row.id.toString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export function sessionDto(row: DevelopmentSession) {
  return {
    ...row,
    id: row.id.toString(),
    projectId: row.projectId.toString(),
    sessionDate: row.sessionDate.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createProjectRepository(prisma: Database['prisma']) {
  return {
    async list(page: Page & { q?: string; status?: string }) {
      const query = page.q && containsText(page.q);
      const rows = await prisma.project.findMany({
        where: {
          status: page.status,
          OR: query ? [{ name: query }, { description: query }] : undefined,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.offset, take: page.limit + 1,
      });
      return pageResult(rows, page, projectDto);
    },
    get: (id: bigint) => prisma.project.findUniqueOrThrow({ where: { id } }),
    create: (data: Prisma.ProjectCreateInput) => prisma.project.create({ data }),
    update: (id: bigint, data: Prisma.ProjectUpdateInput) => prisma.project.update({ where: { id }, data }),
    delete: (id: bigint) => prisma.project.delete({ where: { id } }),
  };
}

export async function labelVariants(
  database: Database, table: 'development_session' | 'challenge', column: 'technologies' | 'tags', label: string | undefined,
) {
  if (label === undefined) return undefined;
  const schema = pg.escapeIdentifier(database.schema);
  const { rows } = await database.pool.query<{ label: string }>(
    `SELECT DISTINCT label FROM ${schema}.${table}, unnest(${column}) AS labels(label)
      WHERE lower(label) = lower($1)`,
    [label.normalize('NFC')],
  );
  return { hasSome: rows.map(row => row.label) };
}

export function createDevelopmentSessionRepository(database: Database) {
  const { prisma } = database;
  return {
    async list(filters: SessionFilters) {
      const query = filters.q && containsText(filters.q);
      const direction = filters.sort === 'oldest' ? 'asc' : 'desc';
      const [technologies, tags] = await Promise.all([
        labelVariants(database, 'development_session', 'technologies', filters.technology),
        labelVariants(database, 'development_session', 'tags', filters.tag),
      ]);
      const rows = await prisma.developmentSession.findMany({
        where: {
          projectId: filters.projectId,
          status: filters.status,
          technologies,
          tags,
          categories: filters.category ? { has: filters.category } : undefined,
          OR: query ? [
            { title: query }, { workSummary: query }, { workFocus: query }, { learningNotes: query },
            { difficulties: query }, { solutions: query }, { nextSteps: query },
          ] : undefined,
          sessionDate: {
            gte: filters.from && dateForDatabase(filters.from),
            lte: filters.to && dateForDatabase(filters.to),
          },
        },
        orderBy: [{ sessionDate: direction }, { createdAt: direction }, { id: direction }],
        skip: filters.offset,
        take: filters.limit + 1,
      });
      return pageResult(rows, filters, sessionDto);
    },
    get: (id: bigint) => prisma.developmentSession.findUniqueOrThrow({ where: { id } }),
    create: (data: Prisma.DevelopmentSessionUncheckedCreateInput) => prisma.developmentSession.create({ data }),
    update(id: bigint, data: Prisma.DevelopmentSessionUncheckedUpdateInput) {
      if (typeof data.projectId !== 'bigint') return prisma.developmentSession.update({ where: { id }, data });
      return prisma.$transaction(async transaction => {
        const current = await transaction.developmentSession.findUniqueOrThrow({
          where: { id }, select: { projectId: true },
        });
        if (current.projectId !== data.projectId) {
          await transaction.githubSessionLink.deleteMany({ where: { sessionId: id } });
        }
        return transaction.developmentSession.update({ where: { id }, data });
      }, { isolationLevel: 'Serializable' });
    },
    delete: (id: bigint) => prisma.developmentSession.delete({ where: { id } }),
  };
}

export async function domainOperation<T>(operation: () => PromiseLike<T>, resource: string, action: 'read' | 'write' | 'delete') {
  try {
    return await operation();
  } catch (error) {
    const known = error instanceof Prisma.PrismaClientKnownRequestError ? error : undefined;
    const adapter = (known?.meta?.driverAdapterError ?? error) as {
      name?: unknown;
      cause?: { originalCode?: unknown; constraint?: { index?: unknown } };
    } | undefined;
    const adapterCause = adapter?.name === 'DriverAdapterError' ? adapter.cause : undefined;
    if (adapterCause?.originalCode === '23514') {
      throw new HttpError(400, 'CONSTRAINT_VIOLATION', 'The data does not satisfy a database constraint.');
    }
    if (!known) throw error;
    const label = resource === 'session' ? 'Development session' : resource[0].toUpperCase() + resource.slice(1);
    if (known.code === 'P2034') throw new HttpError(409, 'CONCURRENT_UPDATE', 'The record changed during this request. Retry the update.');
    if (['P2025', 'P2018'].includes(known.code)) {
      throw new HttpError(404, 'NOT_FOUND', label + ' not found.');
    }
    if (known.code === 'P2002' && action === 'write') {
      if (resource === 'project') throw new HttpError(409, 'PROJECT_NAME_TAKEN', 'A project already uses that name.');
      if (resource === 'challenge') throw new HttpError(409, 'CHALLENGE_EXISTS', 'This project already has a challenge with that title.');
    }
    if (known.code === 'P2003') {
      if (action === 'write' && resource !== 'project') throw new HttpError(404, 'NOT_FOUND', 'Project not found.');
      if (resource === 'project' && action === 'delete') {
        const constraint = adapterCause?.constraint?.index;
        if (constraint === 'milestone_projectId_fkey' || constraint === 'challenge_projectId_fkey') {
          throw new HttpError(409, 'PROJECT_HAS_GROWTH_RECORDS', 'Remove the project’s milestones and challenges before deleting it.');
        }
        throw new HttpError(409, 'PROJECT_HAS_SESSIONS', 'A project with development sessions cannot be deleted.');
      }
    }
    if (['P2000', 'P2003', 'P2004', 'P2011'].includes(known.code)) {
      throw new HttpError(400, 'CONSTRAINT_VIOLATION', 'The data does not satisfy a database constraint.');
    }
    throw error;
  }
}
