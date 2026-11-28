import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, Filter, NotebookPen, Plus } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { displayDate, isCalendarDate, isId, pageOffset } from '../../shared/domain';
import { Empty, Failure, Field, focusInvalid, Loading, Notice, PageHeader, Pagination } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProjectOptions } from '../projects/api';
import type { Project } from '../projects/api';
import { categories, getSessions, sessionTitle } from './api';
import type { DevelopmentSession, SessionFilters } from './api';
import { formatDuration } from '../overview/data';
import '../v2/features.css';

function historyUrl(path: string, filters: SessionFilters, offset = 0, tab?: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (tab) params.set('tab', tab);
  if (offset) params.set('offset', String(offset));
  return params.size ? path + '?' + params.toString() : path;
}

function FilterForm({ initial, projects, path, tab }: { initial: SessionFilters; projects?: Project[]; path: string; tab?: string }) {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(initial.projectId ?? '');
  const [from, setFrom] = useState(initial.from ?? '');
  const [to, setTo] = useState(initial.to ?? '');
  const [q, setQuery] = useState(initial.q ?? '');
  const [status, setStatus] = useState(initial.status ?? '');
  const [technology, setTechnology] = useState(initial.technology ?? '');
  const [category, setCategory] = useState(initial.category ?? '');
  const [sort, setSort] = useState(initial.sort ?? 'newest');
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({});

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fromError = from && !isCalendarDate(from) ? 'Enter a valid from date.' : undefined;
    let toError = to && !isCalendarDate(to) ? 'Enter a valid to date.' : undefined;
    if (!fromError && !toError && from && to && from > to) toError = 'To date must be on or after from date.';
    setErrors({ from: fromError, to: toError });
    if (fromError || toError) {
      focusInvalid(event.currentTarget);
      return;
    }
    void navigate(historyUrl(path, {
      projectId: projectId || undefined, from: from || undefined, to: to || undefined,
      q: q.trim() || undefined, status: status === 'draft' || status === 'final' ? status : undefined,
      technology: technology.trim() || undefined, category: category || undefined, sort: sort === 'oldest' ? sort : undefined,
    }, 0, tab));
  }

  return (
    <form className="surface filters v2-session-filters" aria-label="Filter development sessions" onSubmit={apply} noValidate>
      <div className="filter-fields">
        <Field label="Search sessions">
          {binding => <input {...binding} type="search" value={q} onChange={event => setQuery(event.target.value)}
            placeholder="Title, work or notes" maxLength={120} />}
        </Field>
        {projects && (
          <Field label="Project">
            {binding => (
              <select {...binding} value={projectId} onChange={event => setProjectId(event.target.value)}>
                <option value="">All projects</option>
                {projectId && !projects.some(project => project.id === projectId) &&
                  <option value={projectId}>Unavailable project</option>}
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label="From date" error={errors.from}>
          {binding => <input {...binding} type="date" min="0001-01-01" max="9999-12-31" value={from}
            onChange={event => setFrom(event.target.value)} />}
        </Field>
        <Field label="To date" error={errors.to}>
          {binding => <input {...binding} type="date" min="0001-01-01" max="9999-12-31" value={to}
            onChange={event => setTo(event.target.value)} />}
        </Field>
        <Field label="Session status">
          {binding => <select {...binding} value={status} onChange={event => setStatus(event.target.value as typeof status)}>
            <option value="">All sessions</option><option value="draft">Drafts</option><option value="final">Finalized</option>
          </select>}
        </Field>
        <Field label="Sort by">
          {binding => <select {...binding} value={sort} onChange={event => setSort(event.target.value as typeof sort)}>
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
          </select>}
        </Field>
        <Field label="Technology">
          {binding => <input {...binding} value={technology} onChange={event => setTechnology(event.target.value)}
            placeholder="e.g. PostgreSQL" maxLength={80} />}
        </Field>
        <Field label="Activity category">
          {binding => <select {...binding} value={category} onChange={event => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map(value => <option key={value} value={value}>{value}</option>)}
          </select>}
        </Field>
      </div>
      <div className="filter-actions">
        <button className="button secondary" type="submit"><Filter aria-hidden="true" size={16} /> Apply filters</button>
        {Object.values(initial).some(Boolean) &&
          <Link className="text-link" to={historyUrl(path, {}, 0, tab)}>Clear filters</Link>}
      </div>
    </form>
  );
}

function SessionGroups({ sessions, projectNames }: {
  sessions: DevelopmentSession[]; projectNames?: ReadonlyMap<string, string>;
}) {
  const days = new Map<string, DevelopmentSession[]>();
  for (const session of sessions) {
    const group = days.get(session.sessionDate);
    if (group) group.push(session);
    else days.set(session.sessionDate, [session]);
  }
  const DayHeading = projectNames ? 'h2' : 'h3';
  return (
    <div className="session-groups">
      {[...days].map(([day, entries]) => (
        <section className="session-day" key={day} aria-labelledby={'day-' + day}>
          <DayHeading id={'day-' + day} className="day-heading">
            <span className="day-icon"><CalendarDays aria-hidden="true" size={17} /></span>
            <time dateTime={day}>{displayDate(day)}</time>
          </DayHeading>
          <ul className="session-list">
            {entries.map(session => (
              <li key={session.id} className="session-card">
                <div className="min-w-0">
                  {projectNames && <Link className="project-tag" to={'/projects/' + session.projectId}>
                    {projectNames.get(session.projectId) ?? 'Project'}
                  </Link>}
                  {(session.title || session.workFocus) && <p className="font-semibold" dir="auto">{sessionTitle(session)}</p>}
                  {session.workSummary && <p className="card-preview session-summary" dir="auto">{session.workSummary}</p>}
                  <div className="v2-chips">
                    {session.status === 'draft' && <span className="v2-chip v2-chip-accent">Draft</span>}
                    {session.durationMinutes && <span className="v2-chip">{formatDuration(session.durationMinutes)}</span>}
                    {session.categories?.slice(0, 2).map(value => <span className="v2-chip" key={value}>{value}</span>)}
                  </div>
                </div>
                <Link className="button secondary session-link" to={'/sessions/' + session.id}
                  aria-label={'View session: ' + (session.title || Array.from(session.workSummary).slice(0, 80).join('') || sessionTitle(session))}>
                  <NotebookPen aria-hidden="true" size={16} /> View session
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SessionHistory({ project, projects }: { project?: Project; projects?: Project[] }) {
  const [search] = useSearchParams();
  const { pathname } = useLocation();
  const offset = pageOffset(search.get('offset'));
  const queryProject = search.get('projectId') ?? '';
  const projectId = project?.id ?? (isId(queryProject) ? queryProject : undefined);
  const queryFrom = search.get('from') ?? '';
  const queryTo = search.get('to') ?? '';
  const ordered = !queryFrom || !queryTo || queryFrom <= queryTo;
  const from = ordered && isCalendarDate(queryFrom) ? queryFrom : undefined;
  const to = ordered && isCalendarDate(queryTo) ? queryTo : undefined;
  const q = search.get('q')?.trim().slice(0, 120) || undefined;
  const queryStatus = search.get('status');
  const status = queryStatus === 'draft' || queryStatus === 'final' ? queryStatus : undefined;
  const technology = search.get('technology')?.trim().slice(0, 80) || undefined;
  const category = categories.find(value => value === search.get('category'));
  const sort = search.get('sort') === 'oldest' ? 'oldest' : undefined;
  const tab = project ? search.get('tab') ?? undefined : undefined;
  const load = useCallback((signal: AbortSignal) => getSessions({ projectId, from, to, q, status, technology, category, sort }, offset, signal),
    [projectId, from, to, q, status, technology, category, sort, offset]);
  const { result, retry } = useResource(load);
  const visibleFilters: SessionFilters = { projectId: project ? undefined : projectId, from, to, q, status, technology, sort, category };
  const hasFilters = Object.values(visibleFilters).some(Boolean);
  const logUrl = projectId ? '/sessions/new?projectId=' + projectId : '/sessions/new';

  return (
    <>
      <FilterForm key={search.toString()} initial={visibleFilters} projects={projects} path={pathname} tab={tab} />
      {result.status === 'loading' && <Loading>Loading development sessions…</Loading>}
      {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
      {result.status === 'ready' && (
        <>
          {result.data.data.length ? (
            <SessionGroups sessions={result.data.data} projectNames={projects &&
              new Map(projects.map(item => [item.id, item.name]))} />
          ) : (
            <Empty title={offset ? 'No sessions on this page.' : hasFilters ? 'No sessions match these filters.' : 'No development sessions yet.'}>
              {offset
                ? <Link className="button secondary" to={historyUrl(pathname, visibleFilters, 0, tab)}>First page</Link>
                : hasFilters
                  ? <Link className="button secondary" to={historyUrl(pathname, {}, 0, tab)}>Clear filters</Link>
                  : <Link className="button secondary" to={logUrl}>Record a session</Link>}
            </Empty>
          )}
          <Pagination pagination={result.data.pagination} url={next => historyUrl(pathname, visibleFilters, next, tab)} />
        </>
      )}
    </>
  );
}

export function SessionsPage() {
  const { result, retry } = useResource(getProjectOptions);
  return (
    <>
      <PageHeader title="Sessions" description="Find drafts and finalized development work by project, date, or technology."
        actions={<>
          <Link className="button secondary" to="/sessions/new"><Plus aria-hidden="true" size={18} /> Log session</Link>
        </>} />
      <Notice />
      {result.status === 'loading' && <Loading>Loading projects…</Loading>}
      {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
      {result.status === 'ready' && <SessionHistory projects={result.data} />}
    </>
  );
}
