import { api } from '../../app/api';
import type { Page, Resource } from '../../shared/api';
import { pageSize } from '../../shared/domain';

export interface SessionInput {
  projectId: string;
  sessionDate: string;
  workSummary: string;
  workFocus: string | null;
  learningNotes: string | null;
  difficulties: string | null;
  nextSteps: string | null;
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
}

export function getSessions(filters: SessionFilters, offset: number, signal: AbortSignal) {
  return api<Page<DevelopmentSession>>({
    url: '/sessions', params: { ...filters, offset, limit: pageSize }, signal,
  });
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
