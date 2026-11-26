import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, Filter, NotebookPen, Plus } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { displayDate, isCalendarDate, isId, pageOffset } from '../../shared/domain';
import { Empty, Failure, Field, focusInvalid, Loading, Notice, PageHeader, Pagination } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProjectOptions } from '../projects/api';
import type { Project } from '../projects/api';
import { getSessions } from './api';
import type { DevelopmentSession, SessionFilters } from './api';

function historyUrl(path: string, filters: SessionFilters, offset = 0) {
  const params = new URLSearchParams();
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (offset) params.set('offset', String(offset));
  return params.size ? path + '?' + params.toString() : path;
}

function FilterForm({ initial, projects, path }: { initial: SessionFilters; projects?: Project[]; path: string }) {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState(initial.projectId ?? '');
  const [from, setFrom] = useState(initial.from ?? '');
  const [to, setTo] = useState(initial.to ?? '');
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
    void navigate(historyUrl(path, { projectId: projectId || undefined, from: from || undefined, to: to || undefined }));
  }

  return (
    <form className="surface filters" aria-label="Filter development sessions" onSubmit={apply} noValidate>
      <div className="filter-fields">
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
      </div>
      <div className="filter-actions">
        <button className="button secondary" type="submit"><Filter aria-hidden="true" size={16} /> Apply filters</button>
        {(initial.projectId || initial.from || initial.to) && <Link className="text-link" to={path}>Clear filters</Link>}
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
                  {session.workFocus && <p className="font-semibold">{session.workFocus}</p>}
                  <p className="card-preview session-summary">{session.workSummary}</p>
                </div>
                <Link className="button secondary session-link" to={'/sessions/' + session.id}
                  aria-label={'View session: ' + Array.from(session.workSummary).slice(0, 80).join('')}>
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
  const load = useCallback((signal: AbortSignal) => getSessions({ projectId, from, to }, offset, signal),
    [projectId, from, to, offset]);
  const { result, retry } = useResource(load);
  const visibleFilters = { projectId: project ? undefined : projectId, from, to };
  const hasFilters = Boolean(visibleFilters.projectId || from || to);
  const logUrl = projectId ? '/sessions/new?projectId=' + projectId : '/sessions/new';

  return (
    <>
      <FilterForm key={search.toString()} initial={visibleFilters} projects={projects} path={pathname} />
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
                ? <Link className="button secondary" to={historyUrl(pathname, visibleFilters)}>First page</Link>
                : hasFilters
                  ? <Link className="button secondary" to={pathname}>Clear filters</Link>
                  : <Link className="button secondary" to={logUrl}>Record a session</Link>}
            </Empty>
          )}
          <Pagination pagination={result.data.pagination} url={next => historyUrl(pathname, visibleFilters, next)} />
        </>
      )}
    </>
  );
}

export function TimelinePage() {
  const { result, retry } = useResource(getProjectOptions);
  return (
    <>
      <PageHeader title="Daily Timeline" description="Review your development sessions, grouped by date."
        actions={<Link className="button primary" to="/sessions/new"><Plus aria-hidden="true" size={18} /> Log session</Link>} />
      <Notice />
      {result.status === 'loading' && <Loading>Loading projects…</Loading>}
      {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
      {result.status === 'ready' && <SessionHistory projects={result.data} />}
    </>
  );
}
