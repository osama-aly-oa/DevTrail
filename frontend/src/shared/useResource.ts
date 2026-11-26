import { useEffect, useState } from 'react';
import { ApiError } from './api';

type Result<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: ApiError };

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ load: typeof load; attempt: number; result: Result<T> }>();

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(
      data => {
        if (!controller.signal.aborted) setSettled({ load, attempt, result: { status: 'ready', data } });
      },
      error => {
        if (!controller.signal.aborted) {
          const failure = error instanceof ApiError
            ? error
            : new ApiError(0, 'UNKNOWN', 'The request could not be completed. Try again.');
          setSettled({ load, attempt, result: { status: 'error', error: failure } });
        }
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  const result: Result<T> = settled?.load === load && settled.attempt === attempt
    ? settled.result
    : { status: 'loading' };

  return { result, retry: () => setAttempt(current => current + 1) };
}
