import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronRight, Flag, Plus } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { displayDate, isId, optionalText } from '../../shared/domain';
import { ConfirmDelete, Empty, Failure, Field, Loading, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProjectOptions } from '../projects/api';
import type { Project } from '../projects/api';
import { getAllSessions, sessionTitle } from '../sessions/api';
import { formatDuration, metrics } from '../overview/data';
import { externalUrl, splitList } from '../v2/format';
import { Markdown } from '../v2/Markdown';
import {
  challengeLabels, deleteGrowth, getGrowth, listGrowth, progressLabels, saveGrowth, understandingLabels,
} from './api';
import type {
  Challenge, ChallengeStatus, GrowthRecord, GrowthResource, LearningGoal, Milestone, ProgressStatus, Reflection, Understanding,
} from './api';
import { GrowthEditor } from './GrowthEditor';
import type { FormValue, GrowthField } from './GrowthEditor';
import '../v2/features.css';

type WorkspaceProps = { projectId?: string; initialSession?: string; focusId?: string; initialQuestion?: string };
type Config<T extends GrowthRecord> = {
  resource: GrowthResource; label: string; plural: string; fields: GrowthField[]; defaults: FormValue;
  title: (record: T) => string; statusLabels?: Record<string, string>; projectRequired?: boolean;
  save: (values: FormValue, projectId: string, sessionIds: string[], id?: string) => Promise<T>;
  body: (record: T) => ReactNode;
  summary?: (record: T) => ReactNode;
  order?: (left: T, right: T) => number;
};

function Links({ values }: { values: string[] }) {
  return values.length > 0 && <ul className="v2-value-list">{values.map(value => {
    const href = externalUrl(value);
    return href && <li key={value}><a className="v2-inline-link text-link" href={href} target="_blank" rel="noreferrer">
      {value} <ArrowUpRight size={14} aria-hidden="true" /></a></li>;
  })}</ul>;
}

function DetailText({ label, text }: { label: string; text: string | null }) {
  return text && <div className="v2-record-note"><h4>{label}</h4><Markdown text={text} /></div>;
}

const milestoneConfig: Config<Milestone> = {
  resource: 'milestones', label: 'milestone', plural: 'milestones', title: item => item.title,
  statusLabels: progressLabels, projectRequired: true, defaults: { status: 'planned' },
  fields: [
    { key: 'title', label: 'Milestone title', required: true },
    { key: 'status', label: 'Status', options: progressLabels },
    { key: 'targetDate', label: 'Target date', type: 'date' },
    { key: 'completedDate', label: 'Completion date', type: 'date', when: values => values.status === 'completed' },
    { key: 'description', label: 'Description', type: 'long' },
    { key: 'criteria', label: 'Completion criteria', type: 'long' },
  ],
  save: (values, projectId, sessionIds, id) => saveGrowth('milestones', {
    projectId, sessionIds, title: values.title!.trim(), status: values.status as ProgressStatus,
    description: optionalText(values.description ?? ''), criteria: optionalText(values.criteria ?? ''),
    targetDate: values.targetDate || null, completedDate: values.status === 'completed' ? values.completedDate || null : null,
  }, id),
  summary: item => item.targetDate && <span className="v2-summary-date"><Flag size={14} aria-hidden="true" /> {displayDate(item.targetDate)}</span>,
  order: (left, right) => (left.targetDate ?? '9999-12-31').localeCompare(right.targetDate ?? '9999-12-31'),
  body: item => <>
    <DetailText label="Description" text={item.description} />
    <DetailText label="Completion criteria" text={item.criteria} />
    {item.completedDate && <p className="v2-inline-link"><Check aria-hidden="true" size={16} /> Completed {displayDate(item.completedDate)}</p>}
  </>,
};

const challengeConfig: Config<Challenge> = {
  resource: 'challenges', label: 'challenge', plural: 'challenges', title: item => item.title,
  statusLabels: challengeLabels, projectRequired: true, defaults: { status: 'open' },
  fields: [
    { key: 'title', label: 'Problem title', required: true },
    { key: 'status', label: 'Status', options: challengeLabels },
    { key: 'resolvedDate', label: 'Resolved date', type: 'date', when: values => values.status === 'resolved' },
    { key: 'description', label: 'Problem description', type: 'long', required: true },
    { key: 'rootCause', label: 'Root cause', type: 'long' },
    { key: 'investigation', label: 'Investigation notes', type: 'long' },
    { key: 'solution', label: 'Solution', type: 'long' },
    { key: 'lessons', label: 'Lessons learned', type: 'long' },
    { key: 'technologies', label: 'Technologies', type: 'list' },
    { key: 'tags', label: 'Tags', type: 'list' },
    { key: 'references', label: 'Reference links', type: 'links' },
  ],
  save: (values, projectId, sessionIds, id) => saveGrowth('challenges', {
    projectId, sessionIds, title: values.title!.trim(), description: values.description!.trim(),
    status: values.status as ChallengeStatus, rootCause: optionalText(values.rootCause ?? ''),
    investigation: optionalText(values.investigation ?? ''), solution: optionalText(values.solution ?? ''),
    lessons: optionalText(values.lessons ?? ''), resolvedDate: values.status === 'resolved' ? values.resolvedDate || null : null,
    technologies: splitList(values.technologies ?? ''), tags: splitList(values.tags ?? ''),
    references: splitList(values.references ?? '', 'links'),
  }, id),
  summary: item => item.technologies.length > 0 && <span className="v2-summary-date">{item.technologies.join(' · ')}</span>,
  body: item => <>
    <DetailText label="Problem" text={item.description} /><DetailText label="Root cause" text={item.rootCause} />
    <DetailText label="Investigation" text={item.investigation} /><DetailText label="Solution" text={item.solution} />
    <DetailText label="Lessons learned" text={item.lessons} />
    {item.resolvedDate && <p className="v2-inline-link"><Check aria-hidden="true" size={16} /> Resolved {displayDate(item.resolvedDate)}</p>}
    <div className="v2-chips">{item.tags.map(tag => <span className="v2-chip" key={tag}>{tag}</span>)}</div>
    <Links values={item.references} />
  </>,
};

const learningConfig: Config<LearningGoal> = {
  resource: 'learning-goals', label: 'learning goal', plural: 'learning goals', title: item => item.title,
  statusLabels: progressLabels, defaults: { status: 'planned', understanding: '' },
  fields: [
    { key: 'title', label: 'Learning goal', required: true },
    { key: 'technology', label: 'Technology or skill', max: 80, required: true },
    { key: 'status', label: 'Status', options: progressLabels },
    { key: 'understanding', label: 'Self-assessed understanding', options: { '': 'Unassessed', ...understandingLabels } },
    { key: 'targetDate', label: 'Target date', type: 'date' },
    { key: 'notes', label: 'Learning notes or knowledge gap', type: 'long' },
    { key: 'evidence', label: 'Supporting evidence links', type: 'links' },
  ],
  save: (values, projectId, sessionIds, id) => saveGrowth('learning-goals', {
    projectId: projectId || null, sessionIds, title: values.title!.trim(), technology: values.technology!.trim(),
    status: values.status as ProgressStatus, understanding: (values.understanding || null) as Understanding | null,
    targetDate: values.targetDate || null, notes: optionalText(values.notes ?? ''), evidence: splitList(values.evidence ?? '', 'links'),
  }, id),
  summary: item => <span className="v2-summary-date">{item.technology}
    {item.understanding && ' · Self-assessed: ' + understandingLabels[item.understanding]}</span>,
  body: item => <>
    <DetailText label="Learning notes" text={item.notes} />
    {item.targetDate && <p>Target date {displayDate(item.targetDate)}</p>}
    <Links values={item.evidence} />
  </>,
};

const reflectionConfig: Config<Reflection> = {
  resource: 'reflections', label: 'reflection', plural: 'reflections', title: item => item.question,
  defaults: {},
  fields: [
    { key: 'question', label: 'Reflection question', type: 'long', required: true },
    { key: 'answer', label: 'Your explanation', type: 'long', max: 8_000, required: true },
    { key: 'feedback', label: 'Review notes', type: 'long', max: 8_000 },
  ],
  save: (values, projectId, sessionIds, id) => saveGrowth('reflections', {
    projectId: projectId || null, sessionIds, question: values.question!.trim(), answer: values.answer!.trim(),
    feedback: optionalText(values.feedback ?? ''),
  }, id),
  body: item => <>
    <DetailText label="Your explanation" text={item.answer} />
    <DetailText label="Review notes" text={item.feedback} />
  </>,
};

function formValues(record: GrowthRecord, fields: GrowthField[]): FormValue {
  return Object.fromEntries(fields.map(field => {
    const value: unknown = (record as unknown as Record<string, unknown>)[field.key];
    return [field.key, Array.isArray(value) ? value.join(field.type === 'links' ? '\n' : ', ') : typeof value === 'string' ? value : ''];
  }));
}

function GrowthCard<T extends GrowthRecord>({ item, config, projects, opened, onEdit, onDelete }: {
  item: T; config: Config<T>; projects: Project[]; opened?: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const status = 'status' in item ? item.status : '';
  const project = projects.find(candidate => candidate.id === item.projectId);
  return <details className="v2-growth-record" open={opened ? true : undefined}>
    <summary>
      <ChevronRight className="v2-record-chevron" size={18} aria-hidden="true" />
      <div className="v2-growth-record-title"><strong dir="auto">{config.title(item)}</strong>
        <div className="v2-growth-record-meta">
          {project && <span>{project.name}</span>}{config.summary?.(item)}
        </div>
      </div>
      {status && config.statusLabels && <span className={'v2-chip' + (['completed', 'resolved'].includes(status) ? ' v2-chip-positive' : '')}>
        {config.statusLabels[status]}
      </span>}
    </summary>
    <div className="v2-growth-record-body">
      {config.body(item)}
      {item.sessionIds.length > 0 && <div><h4>Related sessions</h4>
        <div className="v2-chips">{item.sessionIds.map(id => <Link className="v2-chip" key={id} to={'/sessions/' + id}>Session {id}</Link>)}</div>
      </div>}
      <div className="v2-row-actions">
        <button className="button secondary" type="button" onClick={onEdit}>Edit {config.label}</button>
        <button className="button danger-outline" type="button" onClick={onDelete}>Delete {config.label}</button>
      </div>
    </div>
  </details>;
}

function GrowthRecords<T extends GrowthRecord>({ config, projects, projectId, initialSession, focusId, initialQuestion }: WorkspaceProps & {
  config: Config<T>; projects: Project[];
}) {
  const [, setSearch] = useSearchParams();
  const [q, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [technology, setTechnology] = useState('');
  const [offset, setOffset] = useState(0);
  const [editor, setEditor] = useState<T | 'new' | undefined>(initialSession || initialQuestion ? 'new' : undefined);
  const [confirming, setConfirming] = useState<T>();
  const [notice, setNotice] = useState('');
  const load = useCallback((signal: AbortSignal) => focusId
    ? getGrowth<T>(config.resource, focusId, signal).then(item => ({
      data: [item], pagination: { offset: 0, limit: 20, hasMore: false },
    }))
    : listGrowth<T>(config.resource, signal, { projectId: projectId || selectedProject || undefined,
      q: q.trim() || undefined, status: status || undefined, technology: technology.trim() || undefined }, offset),
  [config.resource, projectId, selectedProject, q, status, technology, offset, focusId]);
  const { result, retry } = useResource(load);
  const existing = editor === 'new' ? undefined : editor;
  function clearFocus() {
    setSearch(previous => {
      const next = new URLSearchParams(previous);
      for (const key of ['id', 'record', 'goal']) next.delete(key);
      return next;
    });
  }

  return <section className="v2-growth-workspace" aria-label={config.plural}>
    <div className="v2-growth-toolbar">
      {!focusId && <>
        <Field label={'Search ' + config.plural}>
          {binding => <input {...binding} type="search" value={q} maxLength={160}
            onChange={event => { setQuery(event.target.value); setOffset(0); }} />}
        </Field>
        {!projectId && <Field label="Project filter">
          {binding => <select {...binding} value={selectedProject} onChange={event => {
            setSelectedProject(event.target.value); setOffset(0);
          }}>
            <option value="">All projects</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>}
        </Field>}
        {config.statusLabels && <Field label="Status">
          {binding => <select {...binding} value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}>
            <option value="">All statuses</option>
            {Object.entries(config.statusLabels!).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>}
        </Field>}
        {['challenges', 'learning-goals'].includes(config.resource) && <Field label="Technology filter">
          {binding => <input {...binding} type="search" value={technology} maxLength={80} placeholder="e.g. PostgreSQL"
            onChange={event => { setTechnology(event.target.value); setOffset(0); }} />}
        </Field>}
      </>}
      {focusId && <button type="button" className="button secondary" onClick={clearFocus}>View all {config.plural}</button>}
      {!focusId && !editor && <button type="button" className="button primary" onClick={() => setEditor('new')}>
        <Plus size={16} aria-hidden="true" /> New {config.label}</button>}
    </div>
    {notice && <p className="notice" role="status"><Check size={16} aria-hidden="true" /> {notice}</p>}
    {editor && <GrowthEditor key={existing?.id ?? 'new'} projects={projects} fields={config.fields}
      initial={existing ? formValues(existing, config.fields) : { ...config.defaults, ...(initialQuestion && { question: initialQuestion }) }}
      fixedProject={projectId} requiredProject={config.projectRequired} initialProject={existing ? existing.projectId ?? '' : selectedProject}
      initialSessions={existing?.sessionIds ?? (initialSession ? [initialSession] : [])}
      heading={existing ? 'Edit ' + config.label : 'New ' + config.label}
      onCancel={() => setEditor(undefined)} onSave={async (values, project, sessionIds) => {
        await config.save(values, project, sessionIds, existing?.id);
        setEditor(undefined); setNotice('Saved ' + config.label + '.'); retry();
      }} />}
    {result.status === 'loading' && <Loading>Loading {config.plural}…</Loading>}
    {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
    {result.status === 'ready' && (
      result.data.data.length
        ? <div className={'v2-growth-list' + (config.resource === 'milestones' ? ' v2-roadmap-list' : '')}>
          {(config.order ? [...result.data.data].sort(config.order) : result.data.data).map(item =>
            <GrowthCard key={item.id} item={item} config={config} projects={projects} opened={item.id === focusId}
              onEdit={() => setEditor(item)} onDelete={() => setConfirming(item)} />)}
        </div>
        : <Empty title={q || status || technology || selectedProject ? 'No matching ' + config.plural + '.' : 'No ' + config.plural + ' yet.'} />
    )}
    {result.status === 'ready' && (offset > 0 || result.data.pagination.hasMore) && <div className="pagination">
      <span>Page {Math.floor(offset / result.data.pagination.limit) + 1}</span>
      <div className="v2-row-actions">
        <button className="button secondary" type="button" disabled={!offset}
          onClick={() => setOffset(previous => Math.max(previous - result.data.pagination.limit, 0))}>Previous page</button>
        <button className="button secondary" type="button" disabled={!result.data.pagination.hasMore}
          onClick={() => setOffset(previous => previous + result.data.pagination.limit)}>Next page</button>
      </div>
    </div>}
    {confirming && <ConfirmDelete title={'Delete ' + config.label + '?'} message={'Permanently delete this ' + config.label + '?'}
      action={'Delete ' + config.label} onDismiss={() => setConfirming(undefined)} onConfirm={async () => {
        await deleteGrowth(config.resource, confirming.id);
        setConfirming(undefined); setNotice('Deleted ' + config.label + '.');
        if (focusId) clearFocus();
        else retry();
      }} />}
  </section>;
}

function GrowthWorkspace<T extends GrowthRecord>(props: WorkspaceProps & { config: Config<T> }) {
  const { result, retry } = useResource(getProjectOptions);
  if (result.status === 'loading') return <Loading>Loading projects…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  if (props.config.projectRequired && !result.data.length) {
    return <Empty title={'Create a project before adding ' + props.config.plural + '.'}>
      <Link className="button primary" to="/projects/new">New project</Link>
    </Empty>;
  }
  return <GrowthRecords key={[props.projectId, props.initialSession, props.focusId, props.initialQuestion].join(':')}
    {...props} projects={result.data} />;
}

export function ChallengeWorkspace(props: WorkspaceProps) {
  return <GrowthWorkspace {...props} config={challengeConfig} />;
}

export function MilestoneWorkspace(props: WorkspaceProps) {
  return <GrowthWorkspace {...props} config={milestoneConfig} />;
}

export function LearningWorkspace(props: WorkspaceProps) {
  return <GrowthWorkspace {...props} config={learningConfig} />;
}

function useWorkspaceParams(): WorkspaceProps {
  const [search] = useSearchParams();
  const project = search.get('projectId') ?? '';
  const session = search.get('sessionId') ?? '';
  const record = search.get('id') ?? search.get('record') ?? search.get('goal') ?? '';
  return { projectId: isId(project) ? project : undefined,
    initialSession: isId(session) ? session : undefined, focusId: isId(record) ? record : undefined };
}

export function ChallengesPage() {
  const props = useWorkspaceParams();
  return <>
    <PageHeader title="Challenges & Solutions" description="Keep the investigation, root cause, and fix together with the sessions that support them." />
    <ChallengeWorkspace {...props} />
  </>;
}

export function RoadmapPage() {
  const props = useWorkspaceParams();
  return <>
    <PageHeader title="Roadmap" description="Track project milestones against target dates and explicit completion criteria." />
    <MilestoneWorkspace {...props} />
  </>;
}

export function ReflectionPage() {
  const props = useWorkspaceParams();
  const { state } = useLocation();
  const question = typeof state?.question === 'string' ? state.question : undefined;
  const project = typeof state?.projectId === 'string' && isId(state.projectId) ? state.projectId : props.projectId;
  return <>
    <PageHeader title="Knowledge verification" description="Explain engineering decisions in your own words, then review the trade-offs and open questions." />
    <GrowthWorkspace {...props} projectId={project} initialQuestion={question} config={reflectionConfig} />
  </>;
}

export function LearningPractice({ projectId, technology = '' }: { projectId?: string; technology?: string }) {
  const [active, setActive] = useState(technology.trim().normalize('NFC').toLowerCase());
  const load = useCallback((signal: AbortSignal) => Promise.all([
    getAllSessions({ projectId, status: 'final' }, signal), getProjectOptions(signal), metrics({ projectId }, signal),
  ]), [projectId]);
  const { result, retry } = useResource(load);
  if (result.status === 'loading') return <Loading>Loading practice history…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  const [sessions, projects, analytics] = result.data;
  const allocated = new Map(analytics.byTechnology.map(item => [item.label.normalize('NFC').toLowerCase(), item.durationMinutes]));
  const summary = new Map<string, { title: string; count: number; projects: Set<string> }>();
  for (const session of sessions) {
    for (const title of session.technologies ?? []) {
      const key = title.normalize('NFC').toLowerCase();
      const row = summary.get(key) ?? { title, count: 0, projects: new Set<string>() };
      row.count++;
      row.projects.add(session.projectId);
      summary.set(key, row);
    }
  }
  const sorted = [...summary.entries()].sort((left, right) => right[1].count - left[1].count ||
    left[1].title.localeCompare(right[1].title));
  const current = active && summary.get(active);
  const related = sessions.filter(session => active
    ? session.technologies?.some(label => label.normalize('NFC').toLowerCase() === active)
    : Boolean(session.learningNotes?.trim()) || session.categories?.includes('Learning'));
  const monthly = new Map<string, number>();
  for (const session of related) {
    const month = session.sessionDate.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }
  const trend = [...monthly.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-6);
  const scale = Math.max(1, ...trend.map(([, number]) => number));

  return <section className="v2-feature-panel v2-practice">
    <div className="v2-panel-title"><BookOpen size={19} aria-hidden="true" /><h2>Technology exposure</h2></div>
    <p className="v2-help">Practice time is shared across the technologies in each session. Goals hold your self-assessment and evidence.</p>
    {sorted.length > 0 && <div className="v2-option-chips">
      <button type="button" className="v2-chip" aria-pressed={!active} onClick={() => setActive('')}>Learning activity</button>
      {sorted.map(([key, value]) => <button type="button" className="v2-chip" key={key} aria-pressed={active === key}
        onClick={() => setActive(key)}>{value.title} <span>{value.count}</span></button>)}
    </div>}
    {current && <div className="v2-metric-strip">
      <div><strong>{current.count}</strong><span>Practice sessions</span></div>
      <div><strong>{formatDuration(allocated.get(active) ?? 0)}</strong><span>Allocated practice time</span></div>
      <div><strong>{current.projects.size}</strong><span>Related projects</span></div>
    </div>}
    {trend.length > 0 && <div className="v2-practice-trend" aria-label="Sessions by month">
      <h3>{current ? 'Practice trend' : 'Learning trend'}</h3>
      {trend.map(([month, count]) => <div className="v2-bar-row" key={month}>
        <time dateTime={month}>{month}</time>
        <span aria-hidden="true"><i style={{ width: (count / scale * 100) + '%' }} /></span>
        <strong>{count}</strong>
      </div>)}
    </div>}
    <h3>Related sessions</h3>
    {related.length ? <ul className="v2-record-list">{related.slice(0, 8).map(session => <li key={session.id}>
      <Link className="text-link" to={'/sessions/' + session.id}>{sessionTitle(session)}</Link>
      <small>{projects.find(project => project.id === session.projectId)?.name} · {displayDate(session.sessionDate)}</small>
      {session.learningNotes && <p className="card-preview">{session.learningNotes}</p>}
    </li>)}</ul> : <p className="v2-help">Record a finalized session with a technology or a learning note to build this history.</p>}
  </section>;
}

export function LearningPage() {
  const props = useWorkspaceParams();
  const [search] = useSearchParams();
  const technology = search.get('technology') ?? '';
  return <>
    <PageHeader title="Learning & Skills" description="Review what you practiced, keep evidence of learning, and set goals for what comes next." />
    <div className="v2-page-sections">
      <LearningPractice key={props.projectId + ':' + technology} projectId={props.projectId} technology={technology} />
      <section><h2 className="section-heading">Learning goals</h2><LearningWorkspace {...props} /></section>
    </div>
  </>;
}
