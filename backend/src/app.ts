import express from 'express';
import { errorHandler, notFound } from './middleware/error-handler.ts';

export const app = express();

app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.use(notFound);
app.use(errorHandler);
