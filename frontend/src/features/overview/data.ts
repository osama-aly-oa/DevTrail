import { api } from '../../app/api';
import type { Page, Resource } from '../../shared/api';
import { todayInIstanbul } from '../../shared/domain';

export type Filter = string | number | undefined;
export type Filters = Record<string, Filter>;
export type Dated = { date: string; sessions: number; durationMinutes: number };
export type Breakdown = { id?: string; label: string; sessions: number; durationMinutes: number };
export type EventCount = { date: string; count: number };

export type Metrics = {
  totals: { sessions: number; durationMinutes: number; activeProjects: number; completedProjects: number;
    challengesSolved: number; currentStreak: number; longestStreak: number; technologies: number };
  previous: { sessions: number; durationMinutes: number } | null;
  days: Dated[];
  byProject: Breakdown[];
  byTechnology: Breakdown[];
  byCategory: Breakdown[];
  learningDays: Dated[];
  challengeDays: EventCount[];
  githubDays: EventCount[];
  milestoneDays: EventCount[];
  milestones: { planned: number; active: number; completed: number };
};

export interface ProjectRecord { id: string; name: string; status: string; description: string | null }
export interface SessionRecord {
  id: string; projectId: string; sessionDate: string; title: string | null; workSummary: string;
  workFocus: string | null; learningNotes: string | null; difficulties: string | null; solutions: string | null;
  nextSteps: string | null; technologies: string[]; categories: string[]; durationMinutes: number | null; status: string;
}
export interface MilestoneRecord {
  id: string; projectId: string; title: string; description: string | null; targetDate: string | null;
  completedDate: string | null; createdAt: string; status: string; criteria: string | null;
}
export interface ChallengeRecord {
  id: string; projectId: string; title: string; description: string; solution: string | null; resolvedDate: string | null;
  technologies: string[]; createdAt: string; status: string;
}
export interface GitHubRecord {
  id: string; projectId: string; kind: 'commit' | 'pull_request'; title: string; url: string;
  occurredAt: string; author: string | null;
}

export async function listAll<T>(url: string, signal?: AbortSignal, params: Filters = {}) {
  const records: T[] = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const page = await api<Page<T> & { pagination: { total?: number } }>({ url, signal, params: { ...params, limit, offset } });
    records.push(...page.data);
    offset += page.data.length;
    if (!page.data.length || !(page.pagination.hasMore ?? offset < (page.pagination.total ?? 0))) return records;
  }
}

export function listPage<T>(url: string, signal?: AbortSignal, params: Filters = {}) {
  return api<Page<T>>({ url, signal, params });
}

export async function metrics(filters: Filters, signal: AbortSignal) {
  return (await api<Resource<Metrics>>({ url: '/analytics', params: filters, signal })).data;
}

export function shiftDate(value: string, by: number) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + by);
  return date.toISOString().slice(0, 10);
}

export function weekStart(value: string) {
  const day = new Date(value + 'T00:00:00Z').getUTCDay();
  return shiftDate(value, -((day + 6) % 7));
}

export const shortDay = new Intl.DateTimeFormat('en', { timeZone: 'UTC', month: 'short', day: 'numeric' });
export const shortMonth = new Intl.DateTimeFormat('en', { timeZone: 'UTC', month: 'short' });

export function dateLabel(value: string, format = shortDay) {
  return format.format(new Date(value + 'T00:00:00Z'));
}

export const presets = [
  { label: 'Day', days: 1 }, { label: 'Week', days: 7 }, { label: 'Month', days: 30 }, { label: 'Year', days: 365 },
];

export function dateRange(days: number) {
  const to = todayInIstanbul();
  return { from: shiftDate(to, 1 - days), to };
}

export function formatDuration(minutes: number) {
  if (!minutes) return '0m';
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? hours + 'h ' + remainder + 'm' : hours + 'h';
}

export function groupActivity(data: Dated[], from: string, to: string) {
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const grouping = span > 110 ? 'month' : span > 37 ? 'week' : 'day';
  const bucket = (date: string) => grouping === 'month' ? date.slice(0, 7) + '-01' : grouping === 'week' ? weekStart(date) : date;
  const values = new Map<string, Dated>();
  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    const key = bucket(date);
    if (!values.has(key)) values.set(key, { date: key, durationMinutes: 0, sessions: 0 });
  }
  for (const day of data) {
    const current = values.get(bucket(day.date));
    if (current) {
      current.durationMinutes += day.durationMinutes;
      current.sessions += day.sessions;
    }
  }
  return { grouping, values: [...values.values()] };
}

export function timelineLink(params: Record<string, string>) {
  return '/timeline?' + new URLSearchParams(params).toString();
}
