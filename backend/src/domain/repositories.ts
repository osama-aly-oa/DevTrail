import { Prisma } from '../generated/prisma/client.ts';
import type { DevelopmentSession, Project } from '../generated/prisma/client.ts';
import type { Database } from '../database.ts';
import { dateForDatabase } from './date.ts';
import { HttpError } from '../middleware/error-handler.ts';

export interface Page {
  offset: number;
  limit: number;
}

interface SessionFilters extends Page {
  projectId?: bigint;
  from?: string;
  to?: string;
}

function pageResult<T, U>(rows: T[], { offset, limit }: Page, toDto: (row: T) => U) {
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
    async list(page: Page) {
      const rows = await prisma.project.findMany({
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

export function createDevelopmentSessionRepository(prisma: Database['prisma']) {
  return {
    async list(filters: SessionFilters) {
      const rows = await prisma.developmentSession.findMany({
        where: {
          projectId: filters.projectId,
          sessionDate: {
            gte: filters.from && dateForDatabase(filters.from),
            lte: filters.to && dateForDatabase(filters.to),
          },
        },
        orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: filters.offset,
        take: filters.limit + 1,
      });
      return pageResult(rows, filters, sessionDto);
    },
    get: (id: bigint) => prisma.developmentSession.findUniqueOrThrow({ where: { id } }),
    create: (data: Prisma.DevelopmentSessionUncheckedCreateInput) => prisma.developmentSession.create({ data }),
    update: (id: bigint, data: Prisma.DevelopmentSessionUncheckedUpdateInput) => prisma.developmentSession.update({ where: { id }, data }),
    delete: (id: bigint) => prisma.developmentSession.delete({ where: { id } }),
  };
}

export async function domainOperation<T>(operation: () => PromiseLike<T>, resource: 'project' | 'session', action: 'read' | 'write' | 'delete') {
  try {
    return await operation();
  } catch (error) {
    const knownError = error instanceof Prisma.PrismaClientKnownRequestError ? error : undefined;
    // Prisma model operations wrap unclassified PostgreSQL errors in P2039.
    const adapterError = knownError?.code === 'P2039' ? knownError.meta?.driverAdapterError : error;
    if (adapterError instanceof Error && adapterError.name === 'DriverAdapterError' &&
        typeof adapterError.cause === 'object' && adapterError.cause !== null &&
        'kind' in adapterError.cause && adapterError.cause.kind === 'postgres' &&
        'code' in adapterError.cause && adapterError.cause.code === '23514') {
      throw new HttpError(400, 'CONSTRAINT_VIOLATION', 'The data does not satisfy a database constraint.');
    }
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
    const project = resource === 'project';
    if (error.code === 'P2025') {
      throw new HttpError(404, 'NOT_FOUND', project ? 'Project not found.' : 'Development session not found.');
    }
    if (error.code === 'P2002' && project && action === 'write') {
      throw new HttpError(409, 'PROJECT_NAME_TAKEN', 'A project already uses that name.');
    }
    if (error.code === 'P2003') {
      if (!project && action === 'write') throw new HttpError(404, 'NOT_FOUND', 'Project not found.');
      if (project && action === 'delete') {
        throw new HttpError(409, 'PROJECT_HAS_SESSIONS', 'A project with development sessions cannot be deleted.');
      }
    }
    if (['P2000', 'P2003', 'P2004', 'P2011'].includes(error.code)) {
      throw new HttpError(400, 'CONSTRAINT_VIOLATION', 'The data does not satisfy a database constraint.');
    }
    throw error;
  }
}
