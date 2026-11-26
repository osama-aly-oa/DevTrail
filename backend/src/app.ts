import express from 'express';
import { createAuthRouter } from './auth/controller.ts';
import { createSessionInfrastructure } from './auth/session.ts';
import type { Config } from './config.ts';
import type { Database } from './database.ts';
import { createDomainRouter } from './domain/controllers.ts';
import { errorHandler, notFound } from './middleware/error-handler.ts';

export function createApp(config: Config, database: Database) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustedProxies.length ? config.trustedProxies : false);
  const sessions = createSessionInfrastructure(config, database);

  app.get('/api/v1/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });
  app.use('/api/v1/auth', createAuthRouter(config, database, sessions));
  app.use('/api/v1', createDomainRouter(config, database, sessions));
  app.use(notFound);
  app.use(errorHandler);

  return { app, close: () => sessions.store.close() };
}
