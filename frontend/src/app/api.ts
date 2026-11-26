import { createTransport } from '../shared/api';
import type { AuthSession, Resource } from '../shared/api';
import { authActions, store } from './store';

export const api = createTransport({
  token: () => {
    const auth = store.getState().auth;
    return auth.status === 'signedIn' ? auth.session.csrfToken : undefined;
  },
  expired: () => { store.dispatch(authActions.signedOut(true)); },
  refreshed: session => { store.dispatch(authActions.signedIn(session)); },
});

export function restoreSession(signal: AbortSignal) {
  return api<Resource<AuthSession>>({ url: '/auth/me', signal }, false);
}

export function signIn(data: { username: string; password: string }) {
  return api<Resource<AuthSession>>({ url: '/auth/login', method: 'post', data }, false);
}

export function signOut() {
  return api<void>({ url: '/auth/logout', method: 'post' });
}
