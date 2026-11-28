import pg from 'pg';
import type { RequestHandler, Router } from 'express';
import { z } from 'zod';
import type { Database } from '../database.ts';
import { activityCategories, calendarDate, containsText, id, parse, requiredText } from '../validation.ts';
import { getAnalytics } from './analytics.ts';

const searchGroups = z.enum(['projects', 'sessions', 'learning', 'technologies', 'challenges', 'milestones', 'reports', 'github']);
const searchQuery = z.strictObject({
  q: requiredText(160), type: searchGroups.optional(), projectId: id.optional(),
});
const analyticsQuery = z.strictObject({
  projectId: id.optional(), from: calendarDate.optional(), to: calendarDate.optional(),
  technology: requiredText(80).optional(), category: activityCategories.optional(),
}).refine(({ from, to }) => !from || !to || from <= to);

type SearchEntry = { id: string; title: string; excerpt: string | null; projectId?: string; url?: string };
type SearchGroup = z.infer<typeof searchGroups>;
const resultLimit = 8;
const recent = { take: resultLimit, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] };

function excerpt(query: string, ...values: (string | null | undefined)[]) {
  const match = values.find(value => value?.toLowerCase().includes(query.toLowerCase()));
  const text = match ?? values.find(value => value?.trim());
  if (!text) return null;
  const index = match ? Math.max(0, text.toLowerCase().indexOf(query.toLowerCase()) - 45) : 0;
  const fragment = Array.from(text.slice(index)).slice(0, 180).join('');
  return (index ? '…' : '') + fragment + (index + fragment.length < text.length ? '…' : '');
}

async function getSearch(database: Database, { q, type, projectId }: z.infer<typeof searchQuery>) {
  const prisma = database.prisma;
  const query = containsText(q);
  const results: Record<SearchGroup, SearchEntry[]> = {
    projects: [], sessions: [], learning: [], technologies: [], challenges: [], milestones: [], reports: [], github: [],
  };
  const searches: Record<SearchGroup, () => Promise<SearchEntry[]>> = {
    async projects() {
      const rows = await prisma.project.findMany({
        ...recent, where: { id: projectId, OR: [{ name: query }, { description: query }, { repositoryUrl: query }] },
      });
      return rows.map(row => ({
        id: row.id.toString(), title: row.name, excerpt: excerpt(q, row.description, row.repositoryUrl), url: '/projects/' + row.id,
      }));
    },
    async sessions() {
      const rows = await prisma.developmentSession.findMany({
        take: resultLimit,
        orderBy: [{ sessionDate: 'desc' }, { id: 'desc' }],
        where: { projectId, OR: [
          { title: query }, { workSummary: query }, { workFocus: query }, { learningNotes: query },
          { difficulties: query }, { solutions: query }, { nextSteps: query },
        ] },
      });
      return rows.map(row => ({
        id: row.id.toString(), title: row.title ?? ('Session · ' + row.sessionDate.toISOString().slice(0, 10)),
        excerpt: excerpt(q, row.workSummary, row.workFocus, row.learningNotes, row.difficulties, row.solutions, row.nextSteps),
        projectId: row.projectId.toString(), url: '/sessions/' + row.id,
      }));
    },
    async learning() {
      const [sessions, goals] = await Promise.all([
        prisma.developmentSession.findMany({ ...recent, where: { projectId, learningNotes: query } }),
        prisma.learningGoal.findMany({ ...recent, where: { projectId, OR: [{ technology: query }, { title: query }, { notes: query }] } }),
      ]);
      return [
        ...goals.map(row => ({
          id: 'goal-' + row.id, title: row.title, excerpt: excerpt(q, row.notes, row.technology),
          projectId: row.projectId?.toString(), url: '/learning?record=' + row.id,
        })),
        ...sessions.map(row => ({
          id: row.id.toString(), title: row.title ?? 'Session learning notes', excerpt: excerpt(q, row.learningNotes),
          projectId: row.projectId.toString(), url: '/sessions/' + row.id,
        })),
      ].slice(0, resultLimit);
    },
    async technologies() {
      const schema = pg.escapeIdentifier(database.schema);
      const rows = await database.pool.query<{ label: string }>(`
        SELECT MIN(label) AS label
        FROM (
          SELECT unnest(technologies) AS label FROM ${schema}.development_session WHERE ($2::bigint IS NULL OR "projectId" = $2)
          UNION ALL
          SELECT unnest(technologies) AS label FROM ${schema}.project WHERE ($2::bigint IS NULL OR id = $2)
          UNION ALL
          SELECT unnest(technologies) AS label FROM ${schema}.challenge WHERE ($2::bigint IS NULL OR "projectId" = $2)
          UNION ALL
          SELECT technology AS label FROM ${schema}.learning_goal WHERE ($2::bigint IS NULL OR "projectId" = $2)
        ) AS technologies
        WHERE label ILIKE $1
        GROUP BY lower(label) ORDER BY lower(label) LIMIT $3
      `, ['%' + query.contains + '%', projectId?.toString() ?? null, resultLimit]);
      return rows.rows.map(({ label }) => ({
        id: label, title: label, excerpt: null, url: '/learning?technology=' + encodeURIComponent(label),
      }));
    },
    async challenges() {
      const rows = await prisma.challenge.findMany({
        ...recent, where: { projectId, OR: [
          { title: query }, { description: query }, { rootCause: query }, { investigation: query }, { solution: query }, { lessons: query },
        ] },
      });
      return rows.map(row => ({
        id: row.id.toString(), title: row.title,
        excerpt: excerpt(q, row.description, row.rootCause, row.investigation, row.solution, row.lessons),
        projectId: row.projectId.toString(), url: '/challenges?record=' + row.id,
      }));
    },
    async milestones() {
      const rows = await prisma.milestone.findMany({
        ...recent, where: { projectId, OR: [{ title: query }, { description: query }, { criteria: query }] },
      });
      return rows.map(row => ({
        id: row.id.toString(), title: row.title, excerpt: excerpt(q, row.description, row.criteria),
        projectId: row.projectId.toString(), url: '/roadmap?record=' + row.id,
      }));
    },
    async reports() {
      const rows = await prisma.report.findMany({ ...recent, where: { projectId, OR: [{ title: query }, { content: query }] } });
      return rows.map(row => ({
        id: row.id.toString(), title: row.title, excerpt: excerpt(q, row.content),
        projectId: row.projectId?.toString(), url: '/reports?record=' + row.id,
      }));
    },
    async github() {
      const rows = await prisma.githubActivity.findMany({
        take: resultLimit, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        where: { projectId, OR: [{ title: query }, { author: query }, { externalId: query }, { details: query }] },
      });
      return rows.map(row => ({
        id: row.id.toString(), title: row.title, excerpt: excerpt(q, row.details, row.author, row.externalId),
        projectId: row.projectId.toString(), url: '/github?activity=' + row.id,
      }));
    },
  };
  await Promise.all((type ? [type] : searchGroups.options).map(async group => {
    results[group] = await searches[group]();
  }));
  return results;
}

export function mountViews(router: Router, database: Database, read: RequestHandler[]) {
  router.get('/analytics', ...read, async (request, response) => {
    const filters = parse(analyticsQuery, request.query, 'query');
    response.json({ data: await getAnalytics(database.prisma, filters) });
  });
  router.get('/search', ...read, async (request, response) => {
    const query = parse(searchQuery, request.query, 'query');
    response.json({ data: await getSearch(database, query) });
  });
}
