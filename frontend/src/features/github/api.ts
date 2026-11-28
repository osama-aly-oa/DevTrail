import { api } from '../../app/api';
import type { Resource } from '../../shared/api';

export async function getIntegrationStatus(signal: AbortSignal) {
  return (await api<Resource<{
    github: { authenticated: boolean };
  }>>({ url: '/integrations/status', signal })).data;
}

export interface GitHubActivity {
  id: string;
  projectId: string;
  kind: 'commit' | 'pull_request';
  externalId: string;
  title: string;
  url: string;
  author: string | null;
  occurredAt: string;
  details: string | null;
}
export interface GitHubRepository {
  projectId: string;
  owner: string;
  name: string;
  defaultBranch: string | null;
  description: string | null;
  isPrivate: boolean | null;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'partial' | 'failed';
  syncMessage: string | null;
  url: string;
}

export function getGitHubActivity(projectId: string, signal: AbortSignal, offset = 0, limit = 20) {
  return api<{ data: GitHubActivity[]; pagination: { offset: number; limit: number; total: number } }>({
    url: '/github/activity', params: { projectId, offset, limit }, signal,
  });
}

export async function getGitHubRepository(projectId: string, signal: AbortSignal) {
  return (await api<Resource<GitHubRepository | null>>({ url: '/github/repositories/' + projectId, signal })).data;
}

export async function getSessionActivity(id: string, signal: AbortSignal) {
  return (await api<Resource<GitHubActivity[]>>({ url: '/github/sessions/' + id + '/activity', signal })).data;
}

export async function setSessionActivity(id: string, activityIds: string[]) {
  return (await api<Resource<GitHubActivity[]>>({
    url: '/github/sessions/' + id + '/activity', method: 'put', data: { activityIds },
  })).data;
}
