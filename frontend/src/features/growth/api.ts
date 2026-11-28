import { api } from '../../app/api';
import type { Page, Resource } from '../../shared/api';
import { maxOffset } from '../../shared/domain';

export const progressLabels = { planned: 'Planned', active: 'In progress', completed: 'Completed' } as const;
export const challengeLabels = { open: 'Open', in_progress: 'Investigating', resolved: 'Resolved' } as const;
export const understandingLabels = { exploring: 'Exploring', practicing: 'Practicing', comfortable: 'Comfortable' } as const;
export type ProgressStatus = keyof typeof progressLabels;
export type ChallengeStatus = keyof typeof challengeLabels;
export type Understanding = keyof typeof understandingLabels;

type RecordMeta = { id: string; createdAt: string; updatedAt: string };

export type MilestoneInput = {
  projectId: string; title: string; description: string | null; targetDate: string | null;
  status: ProgressStatus; completedDate: string | null; criteria: string | null; sessionIds: string[];
};
export type ChallengeInput = {
  projectId: string; title: string; description: string; rootCause: string | null; investigation: string | null;
  solution: string | null; lessons: string | null; status: ChallengeStatus; resolvedDate: string | null;
  technologies: string[]; tags: string[]; references: string[]; sessionIds: string[];
};
export type LearningGoalInput = {
  projectId: string | null; technology: string; title: string; notes: string | null; evidence: string[];
  understanding: Understanding | null; status: ProgressStatus; targetDate: string | null; sessionIds: string[];
};
export type ReflectionInput = {
  question: string; answer: string; feedback: string | null; projectId: string | null; sessionIds: string[];
};
export type Milestone = MilestoneInput & RecordMeta;
export type Challenge = ChallengeInput & RecordMeta;
export type LearningGoal = LearningGoalInput & RecordMeta;
export type Reflection = ReflectionInput & RecordMeta;

export type GrowthRecord = Milestone | Challenge | LearningGoal | Reflection;
export type GrowthResource = 'milestones' | 'challenges' | 'learning-goals' | 'reflections';
export type GrowthFilters = { q?: string; projectId?: string; status?: string; technology?: string };

export function listGrowth<T extends GrowthRecord>(
  resource: GrowthResource, signal: AbortSignal, filters: GrowthFilters = {}, offset = 0, limit = 20,
) {
  return api<Page<T>>({ url: '/' + resource, params: { ...filters, offset, limit }, signal });
}

export async function getGrowth<T extends GrowthRecord>(resource: GrowthResource, id: string, signal: AbortSignal) {
  return (await api<Resource<T>>({ url: '/' + resource + '/' + id, signal })).data;
}

export async function allGrowth<T extends GrowthRecord>(resource: GrowthResource, signal: AbortSignal, filters: GrowthFilters = {}) {
  const records = new Map<string, T>();
  let offset = 0;
  do {
    const page = await listGrowth<T>(resource, signal, filters, offset, 100);
    for (const record of page.data) records.set(record.id, record);
    if (!page.pagination.hasMore) break;
    offset = page.pagination.offset + page.pagination.limit;
  } while (offset <= maxOffset);
  return [...records.values()];
}

export async function saveGrowth<T extends GrowthRecord>(resource: GrowthResource, data: Omit<T, keyof RecordMeta>, id?: string) {
  return (await api<Resource<T>>({
    url: '/' + resource + (id ? '/' + id : ''), method: id ? 'patch' : 'post', data,
  })).data;
}

export function deleteGrowth(resource: GrowthResource, id: string) {
  return api<void>({ url: '/' + resource + '/' + id, method: 'delete' });
}
