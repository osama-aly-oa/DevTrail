import type { ErrorRequestHandler, RequestHandler } from 'express';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next('An unexpected error occurred after the response started.');
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof Error && 'type' in error) {
    switch (error.type) {
      case 'entity.parse.failed':
      case 'request.aborted':
      case 'request.size.invalid':
        response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid request body.' } });
        return;
      case 'entity.too.large':
        response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
        return;
      case 'charset.unsupported':
      case 'encoding.unsupported':
        response.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported request body encoding.' } });
        return;
    }
  }

  if (error instanceof URIError) {
    response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Invalid request path.' } });
    return;
  }

  console.error('Unhandled request error.');

  response.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
  });
};
