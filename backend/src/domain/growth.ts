import type { RequestHandler, Router } from 'express';
import { z } from 'zod';
import type { Database } from '../database.ts';
import { HttpError } from '../middleware/error-handler.ts';
import { rejectBody } from '../middleware/security.ts';
import {
  calendarDate, containsText, emptyObject, id, idPath, labels, linkedSessionIds, links,
  optionalText, pageFields, parse, requiredText,
} from '../validation.ts';
import { dateForDatabase, sessionDateForWrite, shiftCalendarDate, startOfIstanbulDate, todayInIstanbul } from './date.ts';
import { domainOperation, labelVariants, pageResult } from './repositories.ts';

export interface DomainMiddleware {
  read: RequestHandler[];
  write: RequestHandler[];
  writeJson: RequestHandler[];
}

const optionalDate = calendarDate.nullable().optional();
const progress = z.enum(['planned', 'active', 'completed']);
const challengeStatus = z.enum(['open', 'in_progress', 'resolved']);
const reportKind = z.enum(['daily', 'weekly', 'monthly', 'project', 'learning', 'challenges', 'retrospective']);
const commonFields = { title: requiredText(160), projectId: id.nullable().optional() };
const related = { sessionIds: linkedSessionIds.optional() };
const notes = optionalText(5_000).optional();
const milestone = z.strictObject({
  ...commonFields, projectId: id, description: notes, targetDate: optionalDate, completedDate: optionalDate,
  criteria: notes, status: progress.optional(), ...related,
});
const challenge = z.strictObject({
  ...commonFields, projectId: id, description: requiredText(5_000), rootCause: notes, investigation: notes,
  solution: notes, lessons: notes, status: challengeStatus.optional(), resolvedDate: optionalDate,
  technologies: labels.optional(), tags: labels.optional(), references: links.optional(), ...related,
});
const goal = z.strictObject({
  ...commonFields, technology: requiredText(80), notes, evidence: links.optional(),
  understanding: z.enum(['exploring', 'practicing', 'comfortable']).nullable().optional(),
  status: progress.optional(), targetDate: optionalDate, ...related,
});
const report = z.strictObject({
  ...commonFields, kind: reportKind, content: requiredText(30_000), from: optionalDate, to: optionalDate,
});
const insight = z.strictObject({
  ...commonFields, kind: requiredText(80), content: requiredText(30_000), ...related,
});
const reflection = z.strictObject({
  projectId: id.nullable().optional(), question: requiredText(5_000), answer: requiredText(8_000),
  feedback: optionalText(8_000).optional(), ...related,
});

const listInput = z.strictObject({
  ...pageFields, q: requiredText(160).optional(), projectId: id.optional(), status: requiredText(80).optional(),
  from: calendarDate.optional(), to: calendarDate.optional(), kind: requiredText(80).optional(),
  technology: requiredText(80).optional(), sessionId: id.optional(),
}).refine(({ from, to }) => !from || !to || from <= to);
type GrowthFilters = z.infer<typeof listInput>;

const order = [{ createdAt: 'desc' }, { id: 'desc' }] as const;
const withSessions = { sessions: { select: { id: true }, orderBy: { id: 'asc' } } } as const;
type GrowthRow = { id: bigint; projectId: bigint | null; sessions?: { id: bigint }[] };

function growthDto({ id, projectId, sessions, ...row }: GrowthRow) {
  const wire: Record<string, unknown> = { ...row, id: id.toString(), projectId: projectId?.toString() ?? null };
  if (sessions) wire.sessionIds = sessions.map(session => session.id.toString());
  for (const field of ['targetDate', 'completedDate', 'resolvedDate', 'from', 'to']) {
    if (wire[field] instanceof Date) wire[field] = wire[field].toISOString().slice(0, 10);
  }
  return wire;
}

function partial<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial().refine(value => Object.keys(value).length > 0);
}

function atDate(value: string | null | undefined) {
  return value ? dateForDatabase(value) : value;
}

function milestoneDate(status: string | undefined, value: string | null | undefined, terminal: string, current?: Date | null) {
  if (status && status !== terminal) {
    if (value) throw new HttpError(400, 'INVALID_INPUT', 'A completion date requires a completed record.');
    return null;
  }
  if (value) return sessionDateForWrite(value);
  if (status === terminal) return current ?? dateForDatabase(todayInIstanbul());
  return value;
}

function sessionConnect(ids?: bigint[]) {
  return ids && { connect: ids.map(id => ({ id })) };
}

function sessionReplace(ids?: bigint[]) {
  return ids && { set: ids.map(id => ({ id })) };
}

function paging(filters: GrowthFilters) {
  return { skip: filters.offset, take: filters.limit + 1, orderBy: [...order] };
}

function matches<K extends string>(q: string | undefined, ...fields: K[]) {
  return q && fields.map(field => ({ [field]: containsText(q) }) as Record<K, ReturnType<typeof containsText>>) || undefined;
}

function dateRange({ from, to }: GrowthFilters, timestamp = false) {
  if (!from && !to) return;
  return timestamp ? {
    gte: from && startOfIstanbulDate(from),
    lt: to && startOfIstanbulDate(shiftCalendarDate(to, 1)),
  } : { gte: from && dateForDatabase(from), lte: to && dateForDatabase(to) };
}

function linked(id?: bigint) {
  return id ? { some: { id } } : undefined;
}

interface Resource<Create, Update> {
  route: string;
  name: string;
  create: z.ZodType<Create>;
  update: z.ZodType<Update>;
  list: (filters: GrowthFilters) => PromiseLike<GrowthRow[]>;
  add: (input: Create) => PromiseLike<GrowthRow>;
  get: (id: bigint) => PromiseLike<GrowthRow>;
  edit: (id: bigint, input: Update) => PromiseLike<GrowthRow>;
  remove: (id: bigint) => PromiseLike<unknown>;
}

function mountResource<Create, Update>(router: Router, { read, write, writeJson }: DomainMiddleware, resource: Resource<Create, Update>) {
  const path = '/' + resource.route;
  router.get(path, ...read, async (request, response) => {
    const filters = parse(listInput, request.query, 'query');
    response.json(pageResult(await resource.list(filters), filters, growthDto));
  });
  router.post(path, ...writeJson, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const input = parse(resource.create, request.body, 'body');
    const item = await domainOperation(() => resource.add(input), resource.name, 'write');
    response.status(201).location('/api/v1' + path + '/' + item.id).json({ data: growthDto(item) });
  });
  router.get(path + '/:id', ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    const item = await domainOperation(() => resource.get(id), resource.name, 'read');
    response.json({ data: growthDto(item) });
  });
  router.patch(path + '/:id', ...writeJson, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    const input = parse(resource.update, request.body, 'body');
    const item = await domainOperation(() => resource.edit(id, input), resource.name, 'write');
    response.json({ data: growthDto(item) });
  });
  router.delete(path + '/:id', ...write, rejectBody, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    await domainOperation(() => resource.remove(id), resource.name, 'delete');
    response.status(204).end();
  });
}

export function mountGrowth(router: Router, database: Database, middleware: DomainMiddleware) {
  const { prisma } = database;
  mountResource(router, middleware, {
    route: 'milestones', name: 'milestone', create: milestone, update: partial(milestone),
    list: filters => prisma.milestone.findMany({
      ...paging(filters), include: withSessions,
      where: {
        projectId: filters.projectId, status: filters.status, sessions: linked(filters.sessionId),
        OR: matches(filters.q, 'title', 'description', 'criteria'),
        AND: dateRange(filters) ? [{
          OR: [
            { completedDate: dateRange(filters) },
            { completedDate: null, targetDate: dateRange(filters) },
            { completedDate: null, targetDate: null, createdAt: dateRange(filters, true) },
          ],
        }] : undefined,
      },
    }),
    add: ({ sessionIds, targetDate, completedDate, ...data }) => prisma.milestone.create({
      data: {
        ...data, targetDate: atDate(targetDate), completedDate: milestoneDate(data.status, completedDate, 'completed'),
        sessions: sessionConnect(sessionIds),
      }, include: withSessions,
    }),
    get: id => prisma.milestone.findUniqueOrThrow({ where: { id }, include: withSessions }),
    edit: (id, { sessionIds, targetDate, completedDate, ...data }) => prisma.$transaction(async tx => {
      const current = data.status === 'completed' && await tx.milestone.findUniqueOrThrow({ where: { id }, select: { completedDate: true } });
      return tx.milestone.update({
        where: { id }, data: {
          ...data, targetDate: atDate(targetDate),
          completedDate: milestoneDate(data.status, completedDate, 'completed', current ? current.completedDate : null),
          sessions: sessionReplace(sessionIds),
        }, include: withSessions,
      });
    }, { isolationLevel: 'Serializable' }),
    remove: id => prisma.milestone.delete({ where: { id } }),
  });

  mountResource(router, middleware, {
    route: 'challenges', name: 'challenge', create: challenge, update: partial(challenge),
    list: async filters => prisma.challenge.findMany({
      ...paging(filters), include: withSessions,
      where: {
        projectId: filters.projectId, status: filters.status, sessions: linked(filters.sessionId),
        technologies: await labelVariants(database, 'challenge', 'technologies', filters.technology),
        OR: matches(filters.q, 'title', 'description', 'rootCause', 'investigation', 'solution', 'lessons'),
        AND: dateRange(filters) ? [{
          OR: [{ resolvedDate: dateRange(filters) }, { resolvedDate: null, createdAt: dateRange(filters, true) }],
        }] : undefined,
      },
    }),
    add: ({ sessionIds, resolvedDate, ...data }) => prisma.challenge.create({
      data: { ...data, resolvedDate: milestoneDate(data.status, resolvedDate, 'resolved'), sessions: sessionConnect(sessionIds) },
      include: withSessions,
    }),
    get: id => prisma.challenge.findUniqueOrThrow({ where: { id }, include: withSessions }),
    edit: (id, { sessionIds, resolvedDate, ...data }) => prisma.$transaction(async tx => {
      const current = data.status === 'resolved' && await tx.challenge.findUniqueOrThrow({ where: { id }, select: { resolvedDate: true } });
      return tx.challenge.update({
        where: { id }, data: {
          ...data, resolvedDate: milestoneDate(data.status, resolvedDate, 'resolved', current ? current.resolvedDate : null),
          sessions: sessionReplace(sessionIds),
        }, include: withSessions,
      });
    }, { isolationLevel: 'Serializable' }),
    remove: id => prisma.challenge.delete({ where: { id } }),
  });

  mountResource(router, middleware, {
    route: 'learning-goals', name: 'learning goal', create: goal, update: partial(goal),
    list: filters => prisma.learningGoal.findMany({
      ...paging(filters), include: withSessions, where: {
        projectId: filters.projectId, status: filters.status, sessions: linked(filters.sessionId),
        technology: filters.technology ? { equals: filters.technology, mode: 'insensitive' } : undefined,
        targetDate: dateRange(filters), OR: matches(filters.q, 'technology', 'title', 'notes'),
      },
    }),
    add: ({ sessionIds, targetDate, ...data }) => prisma.learningGoal.create({
      data: { ...data, targetDate: atDate(targetDate), sessions: sessionConnect(sessionIds) }, include: withSessions,
    }),
    get: id => prisma.learningGoal.findUniqueOrThrow({ where: { id }, include: withSessions }),
    edit: (id, { sessionIds, targetDate, ...data }) => prisma.learningGoal.update({
      where: { id }, data: { ...data, targetDate: atDate(targetDate), sessions: sessionReplace(sessionIds) }, include: withSessions,
    }),
    remove: id => prisma.learningGoal.delete({ where: { id } }),
  });

  mountResource(router, middleware, {
    route: 'reports', name: 'report', create: report, update: partial(report),
    list: filters => prisma.report.findMany({
      ...paging(filters), where: {
        projectId: filters.projectId, kind: filters.kind, createdAt: dateRange(filters, true),
        OR: matches(filters.q, 'title', 'content'),
      },
    }),
    add: ({ from, to, ...data }) => prisma.report.create({ data: { ...data, from: atDate(from), to: atDate(to) } }),
    get: id => prisma.report.findUniqueOrThrow({ where: { id } }),
    edit: (id, { from, to, ...data }) => prisma.report.update({ where: { id }, data: { ...data, from: atDate(from), to: atDate(to) } }),
    remove: id => prisma.report.delete({ where: { id } }),
  });

  mountResource(router, middleware, {
    route: 'insights', name: 'insight', create: insight, update: partial(insight),
    list: filters => prisma.insight.findMany({
      ...paging(filters), include: withSessions, where: {
        projectId: filters.projectId, kind: filters.kind, sessions: linked(filters.sessionId),
        createdAt: dateRange(filters, true), OR: matches(filters.q, 'title', 'content'),
      },
    }),
    add: ({ sessionIds, ...data }) => prisma.insight.create({
      data: { ...data, sessions: sessionConnect(sessionIds) }, include: withSessions,
    }),
    get: id => prisma.insight.findUniqueOrThrow({ where: { id }, include: withSessions }),
    edit: (id, { sessionIds, ...data }) => prisma.insight.update({
      where: { id }, data: { ...data, sessions: sessionReplace(sessionIds) }, include: withSessions,
    }),
    remove: id => prisma.insight.delete({ where: { id } }),
  });

  mountResource(router, middleware, {
    route: 'reflections', name: 'reflection', create: reflection, update: partial(reflection),
    list: filters => prisma.reflection.findMany({
      ...paging(filters), include: withSessions, where: {
        projectId: filters.projectId, sessions: linked(filters.sessionId),
        createdAt: dateRange(filters, true), OR: matches(filters.q, 'question', 'answer', 'feedback'),
      },
    }),
    add: ({ sessionIds, ...data }) => prisma.reflection.create({
      data: { ...data, sessions: sessionConnect(sessionIds) }, include: withSessions,
    }),
    get: id => prisma.reflection.findUniqueOrThrow({ where: { id }, include: withSessions }),
    edit: (id, { sessionIds, ...data }) => prisma.reflection.update({
      where: { id }, data: { ...data, sessions: sessionReplace(sessionIds) }, include: withSessions,
    }),
    remove: id => prisma.reflection.delete({ where: { id } }),
  });
}
