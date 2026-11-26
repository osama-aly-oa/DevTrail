import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { readConfig } from '../src/config.ts';
import { createDatabase } from '../src/database.ts';
import { errorHandler } from '../src/middleware/error-handler.ts';

const config = readConfig({
  APP_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://127.0.0.1:1/unused',
  SESSION_SECRET: 'a'.repeat(64),
  NODE_ENV: 'test',
});
const database = createDatabase(config.database);
const application = createApp(config, database);
const app = application.app;

afterAll(async () => {
  await application.close();
  await database.close();
});

describe('DevTrail API', () => {
  it('returns the health check as JSON', async () => {
    await request(app)
      .get('/api/v1/health')
      .expect('Content-Type', /application\/json/)
      .expect(200, { status: 'ok' });
  });

  it('returns the JSON error envelope for an unknown route', async () => {
    await request(app)
      .get('/api/v1/unknown')
      .expect('Content-Type', /application\/json/)
      .expect(404, {
        error: { code: 'NOT_FOUND', message: 'Route not found.' },
      });
  });

  it('leaves unknown paths under known API prefixes as JSON 404s', async () => {
    await request(app).get('/api/v1/projects/1/unknown').expect(404, {
      error: { code: 'NOT_FOUND', message: 'Route not found.' },
    });
  });
});

describe('errorHandler', () => {
  it.each(['synchronous throw', 'rejected promise'])('logs a %s and returns a safe JSON 500', async (failure) => {
    const fixture = express();
    const internalError = new Error('Synthetic private error detail');

    fixture.get('/failure', () => {
      if (failure === 'rejected promise') {
        return Promise.reject(internalError);
      }
      throw internalError;
    });
    fixture.use(errorHandler);

    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await request(fixture)
        .get('/failure')
        .expect('Content-Type', /application\/json/)
        .expect(500, {
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
        });

      expect(log).toHaveBeenCalledExactlyOnceWith('Unhandled request error.');
    } finally {
      log.mockRestore();
    }
  });

  it('delegates a sanitized error after headers are sent and closes the response', async () => {
    const fixture = express();
    fixture.set('env', 'test');
    const terminal = vi.fn();
    fixture.get('/partial', (_request, response, next) => {
      response.write('partial');
      setImmediate(() => next(new Error('Synthetic session and credential details')));
    });
    fixture.use(errorHandler);
    const observe: express.ErrorRequestHandler = (error, _request, response, next) => {
      terminal(error, response.headersSent);
      next(error);
    };
    fixture.use(observe);

    await expect(request(fixture).get('/partial')).rejects.toThrow(/aborted|socket hang up/);
    expect(terminal).toHaveBeenCalledExactlyOnceWith('An unexpected error occurred after the response started.', true);
  });
});
