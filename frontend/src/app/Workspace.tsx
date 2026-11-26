import { useEffect, useRef, useState } from 'react';
import { CalendarDays, FolderKanban, LogOut, Plus } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { signOut } from './api';
import { authActions, useAppDispatch } from './store';
import { Brand } from './Brand';
import { ApiError } from '../shared/api';

export function Workspace({ owner }: { owner: string }) {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      main.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  async function logout() {
    setBusy(true);
    setFailure('');
    try {
      await signOut();
      dispatch(authActions.signedOut(false));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') {
        dispatch(authActions.signedOut(false));
      } else {
        setFailure(error instanceof Error ? error.message : 'Sign-out failed. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link to="/timeline" aria-label="DevTrail home" className="brand-link"><Brand /></Link>
        <nav className="app-nav" aria-label="Workspace">
          <NavLink to="/timeline"><CalendarDays aria-hidden="true" size={19} /> Daily Timeline</NavLink>
          <NavLink to="/projects"><FolderKanban aria-hidden="true" size={19} /> Projects</NavLink>
        </nav>
        <Link to="/sessions/new" className="button primary sidebar-action"><Plus aria-hidden="true" size={18} /> Log session</Link>
        <div className="sidebar-account">
          <span className="account-avatar" aria-hidden="true">{owner.slice(0, 1).toUpperCase()}</span>
          <span className="account-name" title={owner}>{owner}</span>
          <button type="button" className="icon-button" aria-label="Sign out" title="Sign out" disabled={busy}
            onClick={() => void logout()}><LogOut aria-hidden="true" size={18} /></button>
        </div>
        {failure && <p className="inline-error" role="alert">{failure}</p>}
      </aside>
      <main ref={main} id="main-content" className="workspace-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
