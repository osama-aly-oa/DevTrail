import { Router } from 'express';
import type { ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { SessionInfrastructure } from '../auth/session.ts';
import type { Config } from '../config.ts';
import type { Database } from '../database.ts';
import { HttpError } from '../middleware/error-handler.ts';
import {
  noStore, parseJson, rejectBody, requireAuthentication, requireCsrf, requireHttps, requireJson, requireOrigin,
} from '../middleware/security.ts';
import { emptyObject, idPath, parse } from '../validation.ts';
import { createGithubClient, GithubRateLimitError } from './github-api.ts';
import { activityQuery, connectionBody, createGithubWorkspace, linkBody, repositoryPath, sessionPath } from './github.ts';

function integrationLimit(identifier: string, limit: number, windowMs: number) {
  return rateLimit({
    identifier, limit, windowMs, keyGenerator: request => request.session.login?.username ?? 'owner',
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_request, _response, next) => next(new HttpError(429, 'INTEGRATION_RATE_LIMITED', 'Too many integration requests. Wait before retrying.')),
  });
}

export function createIntegrationRouter(config: Config, database: Database, sessions: Pick<SessionInfrastructure, 'middleware'>) {
  const router = Router();
  const github = createGithubWorkspace(database, createGithubClient(config.githubToken));
  const transport = config.secureCookies ? [noStore, requireHttps] : [noStore];
  const read = [...transport, sessions.middleware, requireAuthentication, rejectBody];
  const write = [...transport, requireOrigin(config.origin), sessions.middleware, requireAuthentication, requireCsrf];
  const writeJson = [...write, requireJson, parseJson];
  const limitGithub = integrationLimit('github-per-owner', 8, 60_000);

  router.get('/integrations/status', ...read, (request, response) => {
    parse(emptyObject, request.query, 'query');
    response.json({ data: {
      github: { authenticated: Boolean(config.githubToken) },
    } });
  });

  router.get('/github/repositories', ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    response.json({ data: await github.listRepositories() });
  });
  router.get('/github/repositories/:projectId', ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { projectId } = parse(repositoryPath, request.params, 'path');
    response.json({ data: await github.getRepository(projectId) });
  });
  router.post('/github/repositories', ...writeJson, limitGithub, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const repository = await github.connect(parse(connectionBody, request.body, 'body'));
    response.status(201).location(`/api/v1/github/repositories/${repository.projectId}`).json({ data: repository });
  });
  router.delete('/github/repositories/:projectId', ...write, rejectBody, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { projectId } = parse(repositoryPath, request.params, 'path');
    await github.disconnect(projectId);
    response.status(204).end();
  });
  router.post('/github/repositories/:projectId/sync', ...write, rejectBody, limitGithub, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { projectId } = parse(repositoryPath, request.params, 'path');
    response.json({ data: await github.synchronize(projectId) });
  });
  router.get('/github/activity', ...read, async (request, response) => {
    response.json(await github.listActivity(parse(activityQuery, request.query, 'query')));
  });
  router.get('/github/activity/:id', ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { id } = parse(idPath, request.params, 'path');
    response.json({ data: await github.getActivity(id) });
  });
  router.get('/github/sessions/:sessionId/activity', ...read, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { sessionId } = parse(sessionPath, request.params, 'path');
    response.json({ data: await github.activityForSession(sessionId) });
  });
  router.put('/github/sessions/:sessionId/activity', ...writeJson, async (request, response) => {
    parse(emptyObject, request.query, 'query');
    const { sessionId } = parse(sessionPath, request.params, 'path');
    const { activityIds } = parse(linkBody, request.body, 'body');
    response.json({ data: await github.replaceSessionActivity(sessionId, activityIds) });
  });

  const githubRetryHeader: ErrorRequestHandler = (error: unknown, _request, response, next) => {
    if (error instanceof GithubRateLimitError) response.set('Retry-After', String(error.retryAfter));
    next(error);
  };
  router.use(githubRetryHeader);
  return router;
}
