import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.ts';
import { errorHandler } from '../src/middleware/error-handler.ts';

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

      expect(log).toHaveBeenCalledExactlyOnceWith('Unhandled error during GET request', internalError);
    } finally {
      log.mockRestore();
    }
  });
});
