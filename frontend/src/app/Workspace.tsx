import { Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUpRight, BookOpen, CalendarDays, ChartNoAxesCombined, ChevronRight, CircleHelp,
  ClipboardList, Files, Flag, FolderKanban, GitBranch, LayoutDashboard, List, LogOut,
  Menu, NotebookPen, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { signOut } from './api';
import { authActions, useAppDispatch } from './store';
import { Brand } from './Brand';
import { ApiError } from '../shared/api';
import { usePreference } from '../shared/preferences';
import { Loading } from '../shared/ui';

const sections = [
  { name: 'Workspace', links: [
    { to: '/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/sessions', label: 'Sessions', icon: List },
    { to: '/timeline', label: 'Timeline', icon: CalendarDays },
    { to: '/roadmap', label: 'Roadmap', icon: Flag },
  ] },
  { name: 'Developer growth', links: [
    { to: '/learning', label: 'Learning & Skills', icon: BookOpen },
    { to: '/challenges', label: 'Challenges', icon: ClipboardList },
    { to: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
    { to: '/insights', label: 'Insights', icon: BookOpen },
    { to: '/reflection', label: 'Reflection', icon: CircleHelp },
    { to: '/reports', label: 'Reports', icon: Files },
  ] },
  { name: 'Tools', links: [
    { to: '/github', label: 'GitHub', icon: GitBranch },
    { to: '/settings', label: 'Settings', icon: Settings2 },
  ] },
];

const commands = [
  { to: '/sessions/new', label: 'Log a session', icon: List },
  { to: '/projects/new', label: 'Create a project', icon: Plus },
  ...sections.flatMap(section => section.links),
  { to: '/search', label: 'Search records', icon: Search },
];

function readSidebar(): 'expanded' | 'collapsed' {
  try { return localStorage.getItem('devtrail.sidebar') === 'collapsed' ? 'collapsed' : 'expanded'; }
  catch { return 'expanded'; }
}

function CommandPalette({ close }: { close: () => void }) {
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const destination = '/search?' + new URLSearchParams({ q: query.trim() });
  const relevant = commands.filter(command => command.label.toLowerCase().includes(query.trim().toLowerCase()));
  const options = query.trim() ? [{ to: destination, label: 'Search records for “' + query.trim() + '”', icon: Search }, ...relevant] : relevant;

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    input.current?.focus();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  function choose(to: string) {
    close();
    void navigate(to);
  }

  return <dialog ref={dialog} className="command-dialog" aria-label="Command palette"
    onCancel={event => { event.preventDefault(); close(); }}>
    <form className="command-input" onSubmit={event => { event.preventDefault(); choose(options[active]?.to ?? destination); }}>
      <Search size={20} aria-hidden="true" />
      <input ref={input} type="search" aria-label="Search records or jump to a page" placeholder="Search records or jump to a page"
        value={query} maxLength={100} onChange={event => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const index = (active + step + options.length) % options.length;
            setActive(index);
            dialog.current?.querySelector('[data-command="' + index + '"]')?.scrollIntoView({ block: 'nearest' });
          }
        }} />
      <button className="keyboard-key" type="button" onClick={close} aria-label="Close command palette">Esc</button>
    </form>
    <div className="command-options">
      {options.map(({ to, label, icon: Icon }, index) => <button type="button" data-command={index} key={to}
        className={index === active ? 'active' : ''} onClick={() => choose(to)}>
        <Icon size={17} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={15} aria-hidden="true" />
      </button>)}
    </div>
    <div className="command-footer"><span><ArrowDown size={13} /> Navigate</span><span><kbd>Enter</kbd> Open</span></div>
  </dialog>;
}

export function Workspace({ owner }: { owner: string }) {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [sidebar, setSidebar] = usePreference('sidebar', readSidebar);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const current = commands.find(item => pathname === item.to) ??
    sections.flatMap(section => section.links).find(item => pathname.startsWith(item.to + '/'));
  const section = sections.find(group => group.links.some(item => item.to === current?.to));

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      main.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(open => !open);
      }
      if (event.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, []);

  async function logout() {
    setBusy(true);
    setFailure('');
    try {
      await signOut();
      dispatch(authActions.signedOut(false));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') dispatch(authActions.signedOut(false));
      else setFailure(error instanceof Error ? error.message : 'Sign-out failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="workspace" data-sidebar={sidebar} data-mobile-open={mobileOpen}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileOpen && <button type="button" className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className="sidebar" id="workspace-navigation">
      <div className="sidebar-brand-row">
        <Link to="/overview" aria-label="DevTrail home" className="brand-link" onClick={() => setMobileOpen(false)}><Brand /></Link>
        <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)} type="button">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <Link to="/sessions/new" title="Log a session" aria-label="Log a session" className="button primary sidebar-action" onClick={() => setMobileOpen(false)}>
        <NotebookPen size={16} aria-hidden="true" /><span>Log a session</span><Plus size={15} className="sidebar-action-plus" aria-hidden="true" />
      </Link>
      <nav className="app-nav" aria-label="Workspace navigation">
        {sections.map(group => <div className="nav-group" key={group.name}>
          <div className="nav-group-title">{group.name}</div>
          {group.links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} title={label} aria-label={label} onClick={() => setMobileOpen(false)}>
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
          </NavLink>)}
        </div>)}
      </nav>
      <div className="sidebar-account">
        <span className="account-avatar" aria-hidden="true">{owner.slice(0, 1).toUpperCase()}</span>
        <span className="account-name" title={owner}>{owner}</span>
        <button type="button" className="icon-button" aria-label="Sign out" title="Sign out" disabled={busy}
          onClick={() => void logout()}><LogOut aria-hidden="true" size={17} /></button>
      </div>
      {failure && <p className="inline-error" role="alert">{failure}</p>}
    </aside>
    <div className="workspace-content">
      <header className="workspace-topbar">
        <button type="button" className="icon-button desktop-collapse" aria-label={sidebar === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
          onClick={() => setSidebar(sidebar === 'expanded' ? 'collapsed' : 'expanded')}>
          {sidebar === 'expanded' ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
        </button>
        <button type="button" className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="workspace-navigation"
          onClick={() => setMobileOpen(true)}><Menu size={20} aria-hidden="true" /></button>
        <div className="breadcrumbs">
          <span>{section?.name ?? 'Workspace'}</span><ChevronRight size={12} aria-hidden="true" /><strong>{current?.label ?? 'DevTrail'}</strong>
        </div>
        <button type="button" className="top-search" aria-label="Open global search and command palette" onClick={() => setCommandOpen(true)}>
          <Search size={16} aria-hidden="true" /><span>Search anything</span><kbd>Ctrl K</kbd>
        </button>
      </header>
      <main ref={main} id="main-content" className="workspace-main" tabIndex={-1}><Suspense fallback={<Loading>Loading workspace…</Loading>}><Outlet /></Suspense></main>
    </div>
    {commandOpen && <CommandPalette close={() => setCommandOpen(false)} />}
  </div>;
}
