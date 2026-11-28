import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { LoginPage } from '../features/auth/LoginPage';
import { ApiError } from '../shared/api';
import { Failure, Loading } from '../shared/ui';
import { restoreSession } from './api';
import { authActions, useAppDispatch, useAppSelector } from './store';
import { Workspace } from './Workspace';

export function AuthBootstrap() {
  const auth = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (auth.status !== 'checking') return;
    const controller = new AbortController();
    void restoreSession(controller.signal).then(
      ({ data }) => { if (!controller.signal.aborted) dispatch(authActions.signedIn(data)); },
      error => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
          dispatch(authActions.signedOut(false));
        } else {
          dispatch(authActions.unavailable(error instanceof Error ? error.message : 'Session check failed.'));
        }
      },
    );
    return () => controller.abort();
  }, [auth.status, dispatch]);

  if (auth.status === 'checking') {
    return <main className="centered-state"><Loading>Checking your session…</Loading></main>;
  }
  if (auth.status === 'unavailable') {
    return <main className="centered-state"><Failure message={auth.message} retry={() => dispatch(authActions.checking())} /></main>;
  }
  return <Outlet />;
}

export function PrivateWorkspace() {
  const auth = useAppSelector(state => state.auth);
  const location = useLocation();
  if (auth.status !== 'signedIn') {
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Workspace owner={auth.session.owner.username} />;
}

export function OwnerLogin() {
  const auth = useAppSelector(state => state.auth);
  const location = useLocation();
  if (auth.status === 'signedIn') {
    const from: unknown = location.state?.from;
    const safePath = typeof from === 'string' && /^\/(?![\\/])/.test(from) ? from : '/overview';
    return <Navigate to={safePath} replace />;
  }
  return <LoginPage expired={auth.status === 'guest' && auth.expired} />;
}
