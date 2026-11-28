import { api } from '../../app/api';
import type { Page, Resource } from '../../shared/api';
import { maxOffset, pageSize } from '../../shared/domain';

export interface ProjectInput {
  name: string;
  description: string | null;
  status?: ProjectStatus;
  repositoryUrl?: string | null;
  technologies?: string[];
}

export const projectStatuses = {
  planned: 'Planned', active: 'Active', on_hold: 'On hold', completed: 'Completed', archived: 'Archived',
} as const;
export type ProjectStatus = keyof typeof projectStatuses;

export interface Project extends ProjectInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export function getProjects(offset: number, signal: AbortSignal, limit = pageSize, filters?: { q?: string; status?: ProjectStatus }) {
  return api<Page<Project>>({ url: '/projects', params: { ...filters, offset, limit }, signal });
}

export async function getProjectOptions(signal: AbortSignal) {
  const projects = new Map<string, Project>();
  let offset = 0;
  do {
    const page = await getProjects(offset, signal, 100);
    for (const project of page.data) projects.set(project.id, project);
    if (!page.pagination.hasMore) break;
    offset = page.pagination.offset + page.pagination.limit;
  } while (offset <= maxOffset);
  return [...projects.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function getProject(id: string, signal: AbortSignal) {
  return (await api<Resource<Project>>({ url: '/projects/' + id, signal })).data;
}

export async function saveProject(data: ProjectInput, id?: string) {
  const request = id
    ? { url: '/projects/' + id, method: 'patch' }
    : { url: '/projects', method: 'post' };
  return (await api<Resource<Project>>({ ...request, data })).data;
}

export function deleteProject(id: string) {
  return api<void>({ url: '/projects/' + id, method: 'delete' });
}
