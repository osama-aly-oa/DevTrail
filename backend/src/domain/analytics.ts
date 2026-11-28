import type { Database } from '../database.ts';
import { dateForDatabase, shiftCalendarDate, startOfIstanbulDate, todayInIstanbul } from './date.ts';

type Window = { from?: string; to?: string };
type Filters = Window & { projectId?: bigint; technology?: string; category?: string };
type Day = { date: string; sessions: number; durationMinutes: number };
type Amount = { label: string; sessions: number; durationMinutes: number; id?: string };
type SessionAggregate = {
  projectId: bigint;
  sessionDate: Date;
  durationMinutes: number | null;
  technologies: string[];
  categories: string[];
  learningNotes: string | null;
};
const dayMs = 86_400_000;

function dateText(date: Date) {
  return date.toISOString().slice(0, 10);
}

function calendarWindow({ from, to }: Window) {
  return { gte: from && dateForDatabase(from), lte: to && dateForDatabase(to) };
}

function timestampWindow({ from, to }: Window) {
  return { gte: from && startOfIstanbulDate(from), lt: to && startOfIstanbulDate(shiftCalendarDate(to, 1)) };
}

function previousWindow({ from, to }: Window) {
  if (!from || !to) return null;
  const length = (dateForDatabase(to).valueOf() - dateForDatabase(from).valueOf()) / dayMs + 1;
  const start = dateForDatabase(from).valueOf() - length * dayMs;
  return {
    from: dateText(new Date(Math.max(start, dateForDatabase('0001-01-01').valueOf()))),
    to: shiftCalendarDate(from, -1),
  };
}

function addDay(map: Map<string, Day>, date: string, durationMinutes: number) {
  const row = map.get(date) ?? { date, sessions: 0, durationMinutes: 0 };
  row.sessions++;
  row.durationMinutes += durationMinutes;
  map.set(date, row);
}

function addAmount(map: Map<string, Amount>, key: string, label: string, durationMinutes: number, id?: string) {
  const row = map.get(key) ?? { label, sessions: 0, durationMinutes: 0, id };
  row.sessions++;
  row.durationMinutes += durationMinutes;
  map.set(key, row);
}

function distribute(map: Map<string, Amount>, labels: string[], durationMinutes: number) {
  if (!labels.length) {
    addAmount(map, '', 'Unspecified', durationMinutes);
    return;
  }
  const share = Math.floor(durationMinutes / labels.length);
  labels.forEach((label, index) => addAmount(
    map, label.normalize('NFC').toLowerCase(), label, share + Number(index < durationMinutes % labels.length),
  ));
}

function countByDate(dates: string[]) {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
}

export function streaks(dates: string[], today = todayInIstanbul()) {
  let previous: string | undefined;
  let longestStreak = 0;
  let consecutive = 0;
  for (const date of [...new Set(dates)].sort()) {
    consecutive = previous && shiftCalendarDate(previous, 1) === date ? consecutive + 1 : 1;
    longestStreak = Math.max(longestStreak, consecutive);
    previous = date;
  }
  const currentStreak = previous === today || previous === shiftCalendarDate(today, -1) ? consecutive : 0;
  return { currentStreak, longestStreak };
}

function sessionTotals(sessions: SessionAggregate[]) {
  return {
    sessions: sessions.length,
    durationMinutes: sessions.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0),
  };
}

export async function getAnalytics(prisma: Database['prisma'], filters: Filters) {
  const { projectId, technology, category } = filters;
  const technologyKey = technology?.normalize('NFC').toLowerCase();
  const prior = previousWindow(filters);
  const select = {
    projectId: true, sessionDate: true, durationMinutes: true, technologies: true, categories: true, learningNotes: true,
  } as const;
  const scopedSessions = { projectId, status: 'final', categories: category ? { has: category } : undefined };
  const [projects, allCurrent, allPrevious, resolved, milestones, github] = await prisma.$transaction([
    prisma.project.findMany({ where: { id: projectId }, select: { id: true, name: true, status: true } }),
    prisma.developmentSession.findMany({ where: { ...scopedSessions, sessionDate: calendarWindow(filters) }, select }),
    prisma.developmentSession.findMany({
      where: { ...scopedSessions, sessionDate: prior ? calendarWindow(prior) : { lt: dateForDatabase('0001-01-01') } }, select,
    }),
    prisma.challenge.findMany({
      where: {
        projectId, status: 'resolved', resolvedDate: calendarWindow(filters),
      }, select: { resolvedDate: true, technologies: true },
    }),
    prisma.milestone.findMany({
      where: { projectId }, select: { status: true, completedDate: true, targetDate: true },
    }),
    prisma.githubActivity.findMany({
      where: { projectId, occurredAt: timestampWindow(filters) }, select: { occurredAt: true },
    }),
  ], { isolationLevel: 'RepeatableRead' });
  const matchesTechnology = ({ technologies }: { technologies: string[] }) => !technologyKey ||
    technologies.some(label => label.normalize('NFC').toLowerCase() === technologyKey);
  const sessions = allCurrent.filter(matchesTechnology);
  const previous = prior && sessionTotals(allPrevious.filter(matchesTechnology));
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const byProject = new Map<string, Amount>();
  const byTechnology = new Map<string, Amount>();
  const byCategory = new Map<string, Amount>();
  const days = new Map<string, Day>();
  const learningDays = new Map<string, Day>();

  for (const session of sessions) {
    const date = dateText(session.sessionDate);
    const minutes = session.durationMinutes ?? 0;
    const project = projectsById.get(session.projectId);
    const key = session.projectId.toString();
    addDay(days, date, minutes);
    if (session.learningNotes || session.categories.includes('Learning')) addDay(learningDays, date, minutes);
    addAmount(byProject, key, project?.name ?? key, minutes, key);
    distribute(byTechnology, session.technologies, minutes);
    distribute(byCategory, session.categories, minutes);
  }

  const isInRange = (date: Date) => (!filters.from || dateText(date) >= filters.from) &&
    (!filters.to || dateText(date) <= filters.to);
  const sortedAmounts = (map: Map<string, Amount>) => [...map.values()].sort((a, b) =>
    b.durationMinutes - a.durationMinutes || b.sessions - a.sessions || a.label.localeCompare(b.label),
  );
  const sortedDays = (map: Map<string, Day>) => [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  const challenges = resolved.filter(matchesTechnology);
  const plannedMilestones = milestones.filter(milestone => {
    const date = milestone.completedDate ?? milestone.targetDate;
    return date ? isInRange(date) : true;
  });
  return {
    totals: {
      ...sessionTotals(sessions),
      activeProjects: projects.filter(project => project.status === 'active').length,
      completedProjects: projects.filter(project => project.status === 'completed').length,
      challengesSolved: challenges.length,
      technologies: byTechnology.size - Number(byTechnology.has('')),
      ...streaks([...days.keys()]),
    },
    previous,
    days: sortedDays(days),
    learningDays: sortedDays(learningDays),
    byProject: sortedAmounts(byProject),
    byTechnology: sortedAmounts(byTechnology),
    byCategory: sortedAmounts(byCategory),
    challengeDays: countByDate(challenges.flatMap(challenge => challenge.resolvedDate ? [dateText(challenge.resolvedDate)] : [])),
    githubDays: countByDate(github.map(activity => todayInIstanbul(activity.occurredAt))),
    milestoneDays: countByDate(plannedMilestones.flatMap(milestone => milestone.completedDate ? [dateText(milestone.completedDate)] : [])),
    milestones: {
      planned: plannedMilestones.filter(milestone => milestone.status === 'planned').length,
      active: plannedMilestones.filter(milestone => milestone.status === 'active').length,
      completed: plannedMilestones.filter(milestone => milestone.status === 'completed').length,
    },
  };
}
