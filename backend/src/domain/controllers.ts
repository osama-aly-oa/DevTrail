import { Router } from 'express';
import { z } from 'zod';
import type { SessionInfrastructure } from '../auth/session.ts';
import type { Config } from '../config.ts';
import type { Database } from '../database.ts';
import {
  noStore, parseJson, rejectBody, requireAuthentication, requireCsrf, requireHttps, requireJson, requireOrigin,
} from '../middleware/security.ts';
import { activityCategories, boundedText, calendarDate, emptyObject, id, idPath, labels, links, optionalText, pageFields, parse, requiredText, webUrl } from '../validation.ts';
import { sessionDateForWrite } from './date.ts';
import { createDevelopmentSessionRepository, createProjectRepository, domainOperation, projectDto, sessionDto } from './repositories.ts';
import { mountAttachments } from './attachments.ts';
import { mountGrowth } from './growth.ts';
import { mountViews } from './views.ts';

const projectStatus = z.enum(['planned', 'active', 'on_hold', 'completed', 'archived']);
const sessionStatus = z.enum(['draft', 'final']);
const projectBody = z.strictObject({
  name: requiredText(120), description: optionalText(2_000).optional(), status: projectStatus.optional(),
  repositoryUrl: webUrl.nullable().optional(), technologies: labels.optional(),
});
const projectPatch = projectBody.partial().refine(value => Object.keys(value).length > 0);
const projectList = z.strictObject({ ...pageFields, q: requiredText(160).optional(), status: projectStatus.optional() });

const sessionBody = z.strictObject({
  projectId: id,
  sessionDate: calendarDate,
  title: optionalText(160).optional(),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  status: sessionStatus.optional(),
  workSummary: boundedText(5_000),
  workFocus: optionalText(240).optional(),
  learningNotes: optionalText(5_000).optional(),
  difficulties: optionalText(5_000).optional(),
  solutions: optionalText(5_000).optional(),
  nextSteps: optionalText(5_000).optional(),
  technologies: labels.optional(),
  tags: labels.optional(),
  categories: z.array(activityCategories).max(9).transform(values => [...new Set(values)]).optional(),
  references: links.optional(),
});
const sessionPatch = sessionBody.partial().refine(value => Object.keys(value).length > 0);
const sessionCreate = sessionBody.extend({ workSummary: sessionBody.shape.workSummary.default('') })
  .refine(value => value.status === 'draft' || value.workSummary.length > 0);
const sessionList = z.strictObject({
  ...pageFields, projectId: id.optional(), from: calendarDate.optional(), to: calendarDate.optional(),
  q: requiredText(160).optional(), status: sessionStatus.optional(), technology: requiredText(80).optional(),
  category: activityCategories.optional(), tag: requiredText(80).optional(), sort: z.enum(['newest', 'oldest']).optional(),
}).refine(({ from, to }) => !from || !to || from <= to);

export function createDomainRouter(config: Config, database: Database, sessions: SessionInfrastructure) {
  const router = Router();
  const projects = createProjectRepository(database.prisma);
  const developmentSessions = createDevelopmentSessionRepository(database);
  const transport = config.secureCookies ? [noStore, requireHttps] : [noStore];
  const read = [...transport, sessions.middleware, requireAuthentication, rejectBody];
  const write = [...transport, requireOrigin(config.origin), sessions.middleware, requireAuthentication, requireCsrf];
  const writeJson = [...write, requireJson, parseJson];

  router.get('/projects', ...read, async (request, response) => {
    response.json(await projects.list(parse(projectList, request.query, 'query')));
  });
  router.post('/projects', ...writeJson, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const data = parse(projectBody, request.body, 'body');
    const project = await domainOperation(() => projects.create(data), 'project', 'write');
    response.status(201).location('/api/v1/projects/' + project.id).json({ data: projectDto(project) });
  });
  router.get('/projects/:id', ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    const project = await domainOperation(() => projects.get(id), 'project', 'read');
    response.json({ data: projectDto(project) });
  });
  router.patch('/projects/:id', ...writeJson, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    const data = parse(projectPatch, request.body, 'body');
    const project = await domainOperation(() => projects.update(id, data), 'project', 'write');
    response.json({ data: projectDto(project) });
  });
  router.delete('/projects/:id', ...write, rejectBody, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    await domainOperation(() => projects.delete(id), 'project', 'delete');
    response.status(204).end();
  });

  router.get('/sessions', ...read, async (request, response) => {
    response.json(await developmentSessions.list(parse(sessionList, request.query, 'query')));
  });
  router.post('/sessions', ...writeJson, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { sessionDate, ...fields } = parse(sessionCreate, request.body, 'body');
    const data = { ...fields, sessionDate: sessionDateForWrite(sessionDate) };
    const session = await domainOperation(() => developmentSessions.create(data), 'session', 'write');
    response.status(201).location('/api/v1/sessions/' + session.id).json({ data: sessionDto(session) });
  });
  router.get('/sessions/:id', ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    const session = await domainOperation(() => developmentSessions.get(id), 'session', 'read');
    response.json({ data: sessionDto(session) });
  });
  router.patch('/sessions/:id', ...writeJson, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    const { sessionDate, ...fields } = parse(sessionPatch, request.body, 'body');
    const data = { ...fields, sessionDate: sessionDate && sessionDateForWrite(sessionDate) };
    const session = await domainOperation(() => developmentSessions.update(id, data), 'session', 'write');
    response.json({ data: sessionDto(session) });
  });
  router.delete('/sessions/:id', ...write, rejectBody, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    await domainOperation(() => developmentSessions.delete(id), 'session', 'delete');
    response.status(204).end();
  });

  mountAttachments(router, database.prisma, { read, write, writeJson });
  mountGrowth(router, database, { read, write, writeJson });
  mountViews(router, database, read);

  return router;
}
