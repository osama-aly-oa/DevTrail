import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, ChevronDown, Flag, GitCommitHorizontal, ListChecks, Plus, Target, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { displayDate, isCalendarDate, isId, pageOffset, pageSize, todayInIstanbul } from '../../shared/domain';
import { Empty, Failure, Field, Loading, Notice, PageHeader, Pagination } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { categories } from '../sessions/api';
import { dateLabel, formatDuration, listAll, timelineLink, weekStart } from './data';
import type { ChallengeRecord, Filters, GitHubRecord, MilestoneRecord, ProjectRecord, SessionRecord } from './data';

const eventTypes = {
  session: { label: 'Session', icon: ListChecks },
  milestone: { label: 'Milestone', icon: Flag },
  challenge: { label: 'Challenge', icon: Target },
  learning: { label: 'Learning', icon: BookOpen },
  github: { label: 'GitHub', icon: GitCommitHorizontal },
};

type EventType = keyof typeof eventTypes;
type TimelineFilters = { projectId: string; from: string; to: string; q: string; technology: string; category: string; group: string; type: string };
type TimelineEvent = {
  id: string; type: EventType; date: string; title: string; description: string | null;
  projectId: string; to: string; detail?: string;
};

function EventDrawer({ item, project, dismiss }: { item: TimelineEvent; project?: ProjectRecord; dismiss: () => void }) {
  const { label, icon: Icon } = eventTypes[item.type];
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return <dialog ref={dialog} className="confirmation timeline-drawer" aria-labelledby="timeline-drawer-title"
    onCancel={event => { event.preventDefault(); dismiss(); }}>
    <div className="drawer-heading"><span className="activity-icon"><Icon size={17} aria-hidden="true" /></span>
      <span className="muted">{label}</span><button type="button" className="icon-button" aria-label="Close event details" onClick={dismiss}><X size={18} /></button>
    </div>
    <h2 id="timeline-drawer-title">{item.title}</h2>
    <p className="muted">{displayDate(item.date)}{item.detail ? ' · ' + item.detail : ''}</p>
    {item.description && <p className="prose-text drawer-description">{item.description}</p>}
    <div className="filter-actions">
      <Link className="button primary" to={item.to}>Open {label.toLowerCase()} <ArrowUpRight size={14} /></Link>
      {project && <Link className="button secondary" to={'/projects/' + project.id}>{project.name}</Link>}
    </div>
  </dialog>;
}

async function loadTimeline(filters: Filters, type: string, signal: AbortSignal) {
  const { from, to, projectId, q, technology, category } = filters;
  const shared = { from, to, projectId, q };
  const [sessions, milestones, challenges, github] = await Promise.all([
    !type || type === 'session' || type === 'learning' ? listAll<SessionRecord>('/sessions', signal, { ...filters, status: 'final' }) : [],
    (!type || type === 'milestone') && !technology && !category ? listAll<MilestoneRecord>('/milestones', signal, shared) : [],
    (!type || type === 'challenge') && !category ? listAll<ChallengeRecord>('/challenges', signal, shared) : [],
    (!type || type === 'github') && !technology && !category ? listAll<GitHubRecord>('/github/activity', signal, shared) : [],
  ]);
  const entries: TimelineEvent[] = [];
  for (const session of sessions) {
    const title = session.title || session.workSummary;
    const common = { id: session.id, date: session.sessionDate, projectId: session.projectId, to: '/sessions/' + session.id };
    if (type !== 'learning') entries.push({
      ...common, type: 'session', title, description: session.title ? session.workSummary : session.workFocus,
      detail: session.durationMinutes === null ? undefined : formatDuration(session.durationMinutes),
    });
    if ((session.learningNotes || session.categories.includes('Learning')) && (type === 'learning' || !type)) {
      entries.push({ ...common, type: 'learning', title: session.technologies.join(', ') || 'Learning activity',
        description: session.learningNotes || session.workSummary });
    }
  }
  for (const item of milestones) entries.push({
    id: item.id, type: 'milestone', date: item.completedDate ?? item.targetDate ?? todayInIstanbul(new Date(item.createdAt)),
    title: item.title, description: item.description ?? item.criteria, projectId: item.projectId, to: '/roadmap?record=' + item.id,
    detail: item.status === 'completed' ? 'Completed' : item.status === 'active' ? 'Active' : 'Planned',
  });
  for (const item of challenges) {
    if (technology && !item.technologies.some(value => value.toLowerCase() === String(technology).toLowerCase())) continue;
    entries.push({ id: item.id, type: 'challenge', date: item.resolvedDate ?? todayInIstanbul(new Date(item.createdAt)),
      title: item.title, description: item.solution ?? item.description, projectId: item.projectId, to: '/challenges?record=' + item.id,
      detail: item.status === 'resolved' ? 'Resolved' : undefined });
  }
  for (const item of github) entries.push({
    id: item.id, type: 'github', date: todayInIstanbul(new Date(item.occurredAt)), title: item.title,
    description: item.author, projectId: item.projectId, to: '/github?activity=' + item.id,
    detail: item.kind === 'commit' ? 'Commit' : 'Pull request',
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function groupLabel(date: string, group: string) {
  if (group === 'month') return new Intl.DateTimeFormat('en', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(date + 'T00:00:00Z'));
  if (group === 'week') return 'Week of ' + dateLabel(date);
  return displayDate(date);
}

function TimelineResults({ filters, type, group, offset, projects, pageUrl }: {
  filters: Filters; type: string; group: string; offset: number; projects: ProjectRecord[]; pageUrl: (offset: number) => string;
}) {
  const [active, setActive] = useState<TimelineEvent>();
  const { from, to, projectId, q, technology, category } = filters;
  const { result, retry } = useResource(useCallback((signal: AbortSignal) => loadTimeline({
    from, to, projectId, q, technology, category,
  }, type, signal), [from, to, projectId, q, technology, category, type]));
  if (result.status === 'loading') return <Loading>Loading timeline…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  const groups = new Map<string, TimelineEvent[]>();
  for (const item of result.data.slice(offset, offset + pageSize)) {
    const key = group === 'month' ? item.date.slice(0, 7) + '-01' : group === 'week' ? weekStart(item.date) : item.date;
    const items = groups.get(key) ?? [];
    items.push(item);
    groups.set(key, items);
  }
  return <>
    {!result.data.length && <Empty title="No timeline events match these filters."><Link className="button secondary" to="/timeline">Clear filters</Link></Empty>}
    <div className="session-groups">
      {[...groups].map(([date, items]) => <section key={date} aria-labelledby={'day-' + date}>
        <h2 className="day-heading" id={'day-' + date}><span className="day-icon"><CalendarDays size={17} aria-hidden="true" /></span>{groupLabel(date, group)}</h2>
        <ul className="timeline-list">{items.map(item => {
          const { icon: Icon, label } = eventTypes[item.type];
          const project = projects.find(project => project.id === item.projectId);
          return <li key={item.type + '-' + item.id}>
            <details className="surface timeline-event">
              <summary>
                <span className="activity-icon"><Icon size={15} aria-hidden="true" /></span>
                <div><strong>{item.title}</strong><small>{label}{project ? ' · ' + project.name : ''}{item.detail ? ' · ' + item.detail : ''}</small></div>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="timeline-event-detail">
                {item.description && <p className="prose-text">{item.description}</p>}
                <div className="filter-actions">
                  <button type="button" className="text-link metric-link" onClick={() => setActive(item)}>Event details</button>
                  <Link className="text-link metric-link" to={item.to}>Open {label.toLowerCase()} <ArrowUpRight size={14} /></Link>
                </div>
              </div>
            </details>
          </li>;
        })}</ul>
      </section>)}
    </div>
    <Pagination pagination={{ offset, limit: pageSize, hasMore: offset + pageSize < result.data.length }} url={pageUrl} />
    {active && <EventDrawer item={active} project={projects.find(project => project.id === active.projectId)} dismiss={() => setActive(undefined)} />}
  </>;
}

export function TimelinePage() {
  const [params] = useSearchParams();
  const filters = {
    projectId: params.get('projectId') ?? '', from: params.get('from') ?? '', to: params.get('to') ?? '',
    q: params.get('q') ?? '', technology: params.get('technology') ?? '', category: params.get('category') ?? '',
    group: params.get('group') ?? 'day', type: params.get('type') ?? '',
  };
  const key = Object.values(filters).join('|');
  return <TimelineWorkspace key={key} filters={filters} offset={pageOffset(params.get('offset'))} />;
}

function TimelineWorkspace({ filters, offset }: { filters: TimelineFilters; offset: number }) {
  const [, setParams] = useSearchParams();
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState('');
  const { projectId, q, from, to, technology, category, group, type } = filters;
  const projects = useResource(useCallback((signal: AbortSignal) => listAll<ProjectRecord>('/projects', signal), []));
  const saved = Object.fromEntries(Object.entries(filters).filter(([key, value]) => value && !(key === 'group' && value === 'day')));
  return <>
    <PageHeader title="Daily Timeline" description="Follow sessions, project milestones, learning, and GitHub activity in date order."
      actions={<Link className="button primary" to="/sessions/new"><Plus size={15} /> Log session</Link>} />
    <Notice />
    <form className="surface timeline-filters" noValidate onSubmit={event => {
      event.preventDefault();
      if (draft.from && !isCalendarDate(draft.from) || draft.to && !isCalendarDate(draft.to)) {
        setError('Enter valid calendar dates.'); return;
      }
      if (draft.from && draft.to && draft.from > draft.to) {
        setError('To date must be on or after from date.'); return;
      }
      setError('');
      setParams(Object.fromEntries(Object.entries(draft).filter(([key, value]) => value.trim() && !(key === 'group' && value === 'day'))));
    }}>
      <div className="timeline-filter-inputs">
        <Field label="Search timeline">{bind => <input {...bind} type="search" value={draft.q} maxLength={100} onChange={event => setDraft({ ...draft, q: event.target.value })} />}</Field>
        <Field label="Project">{bind => <select {...bind} value={draft.projectId} onChange={event => setDraft({ ...draft, projectId: event.target.value })}>
          <option value="">All projects</option>{projects.result.status === 'ready' && projects.result.data.map(project =>
            <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>}</Field>
        <Field label="Event type">{bind => <select {...bind} value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}>
          <option value="">All events</option>{Object.entries(eventTypes).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
        </select>}</Field>
        <Field label="Group by">{bind => <select {...bind} value={draft.group} onChange={event => setDraft({ ...draft, group: event.target.value })}>
          <option value="day">Day</option><option value="week">Week</option><option value="month">Month</option>
        </select>}</Field>
        <Field label="From date">{bind => <input {...bind} type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} />}</Field>
        <Field label="To date">{bind => <input {...bind} type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} />}</Field>
        <Field label="Technology">{bind => <input {...bind} value={draft.technology} maxLength={80} onChange={event => setDraft({ ...draft, technology: event.target.value })} />}</Field>
        <Field label="Activity category">{bind => <select {...bind} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>
          <option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}
        </select>}</Field>
      </div>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="filter-actions"><button className="button primary">Apply filters</button>
        {!!Object.keys(saved).length && <Link className="button secondary" to="/timeline">Clear filters</Link>}</div>
    </form>
    {projects.result.status === 'error' && <Failure message={projects.result.error.message} retry={projects.retry} />}
    <TimelineResults filters={{
      from: isCalendarDate(from) ? from : undefined, to: isCalendarDate(to) ? to : undefined,
      projectId: isId(projectId) ? projectId : undefined, q: q.trim() || undefined,
      technology: technology.trim() || undefined, category: categories.find(item => item === category),
    }} type={Object.hasOwn(eventTypes, type) ? type : ''} group={group} offset={offset}
      projects={projects.result.status === 'ready' ? projects.result.data : []}
      pageUrl={value => timelineLink(value ? { ...saved, offset: String(value) } : saved)} />
  </>;
}
