import { api } from '../../app/api';
import type { Page, Resource } from '../../shared/api';
import { maxOffset, pageSize } from '../../shared/domain';

export const categories = [
  'Feature Development', 'Bug Fixing', 'Learning', 'Refactoring', 'Testing', 'Architecture & System Design',
  'Documentation', 'DevOps & Deployment', 'Code Review',
] as const;

export interface SessionInput {
  projectId: string;
  sessionDate: string;
  workSummary: string;
  workFocus: string | null;
  learningNotes: string | null;
  difficulties: string | null;
  nextSteps: string | null;
  title?: string | null;
  durationMinutes?: number | null;
  solutions?: string | null;
  status?: 'draft' | 'final';
  technologies?: string[];
  tags?: string[];
  categories?: string[];
  references?: string[];
}

export interface DevelopmentSession extends SessionInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionFilters {
  projectId?: string;
  from?: string;
  to?: string;
  q?: string;
  status?: 'draft' | 'final';
  technology?: string;
  category?: string;
  sort?: 'newest' | 'oldest';
}

export function getSessions(filters: SessionFilters, offset: number, signal: AbortSignal, limit = pageSize) {
  return api<Page<DevelopmentSession>>({
    url: '/sessions', params: { ...filters, offset, limit }, signal,
  });
}

export async function getAllSessions(filters: SessionFilters, signal: AbortSignal) {
  const sessions = new Map<string, DevelopmentSession>();
  let offset = 0;
  do {
    const page = await getSessions(filters, offset, signal, 100);
    for (const session of page.data) sessions.set(session.id, session);
    if (!page.pagination.hasMore) break;
    offset = page.pagination.offset + page.pagination.limit;
  } while (offset <= maxOffset);
  return [...sessions.values()];
}

export function sessionTitle(session: DevelopmentSession) {
  return session.title ?? session.workFocus ?? 'Development session';
}

export async function getSession(id: string, signal: AbortSignal) {
  return (await api<Resource<DevelopmentSession>>({ url: '/sessions/' + id, signal })).data;
}

export async function saveSession(data: SessionInput, id?: string) {
  const request = id
    ? { url: '/sessions/' + id, method: 'patch' }
    : { url: '/sessions', method: 'post' };
  return (await api<Resource<DevelopmentSession>>({ ...request, data })).data;
}

export function deleteSession(id: string) {
  return api<void>({ url: '/sessions/' + id, method: 'delete' });
}
