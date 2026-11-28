import { useCallback, useState } from 'react';
import { ArrowRight, Download, FileText, Printer, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../app/api';
import type { Resource } from '../../shared/api';
import { isCalendarDate, isId } from '../../shared/domain';
import { ConfirmDelete, Empty, Failure, Field, Loading, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { dateRange, formatDuration, listAll } from '../overview/data';
import type { ChallengeRecord, MilestoneRecord, ProjectRecord, SessionRecord } from '../overview/data';
import { SessionSelection } from '../growth/GrowthEditor';
import { failureMessage } from '../v2/format';
import { Markdown } from '../v2/Markdown';
import { downloadFile } from './download';

const reports = {
  daily: 'Daily development report', weekly: 'Weekly development report', monthly: 'Monthly development report',
  project: 'Project journey report', learning: 'Learning report', challenges: 'Technical challenge summary',
  retrospective: 'Project retrospective',
};
const insightKinds = {
  development: 'Development patterns', weekly: 'Weekly reflection', project: 'Project retrospective',
  interview: 'Interview preparation', architecture: 'Engineering decisions',
};
type RecordItem = {
  id: string; title: string; kind: string; content: string; projectId: string | null;
  from?: string | null; to?: string | null; sessionIds?: string[]; createdAt: string;
};

const documentLimit = 30_000;

function reportText(kind: string, from: string, to: string, sessions: SessionRecord[], project?: ProjectRecord,
  challenges: ChallengeRecord[] = [], milestones: MilestoneRecord[] = []) {
  const total = sessions.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0);
  const technologies = [...new Set(sessions.flatMap(session => session.technologies))];
  const items = [
    '## Scope',
    from + ' to ' + to + (project ? ' · ' + project.name : ''),
    '## Recorded activity',
    '- Finalized sessions: ' + sessions.length + '\n- Recorded development time: ' + formatDuration(total) +
      '\n- Technologies: ' + (technologies.join(', ') || 'None recorded'),
  ];
  const entries = kind === 'learning' ? sessions.filter(session => session.learningNotes) : sessions;
  if (kind !== 'challenges') {
    items.push('## ' + (kind === 'learning' ? 'Learning notes' : 'Development sessions'));
    for (const session of entries) {
      const section = '### ' + (session.title || 'Session ' + session.id) + '\n' + session.sessionDate + ' · Session ' + session.id +
        (session.durationMinutes !== null ? ' · ' + formatDuration(session.durationMinutes) : '');
      const details = kind === 'learning' ? [session.learningNotes] : [
        session.workSummary, session.difficulties ? '**Difficulty:** ' + session.difficulties : '',
        session.solutions ? '**Solution:** ' + session.solutions : '', session.nextSteps ? '**Next steps:** ' + session.nextSteps : '',
      ];
      items.push(section + '\n\n' + details.filter(Boolean).join('\n\n'));
    }
    if (!entries.length) items.push('No matching notes in this date range.');
  }
  if (['challenges', 'project', 'retrospective'].includes(kind)) {
    items.push('## Technical challenges', ...challenges.map(item =>
      '### ' + item.title + '\n' + item.status.replaceAll('_', ' ') + '\n\n' + item.description +
      (item.solution ? '\n\n**Solution:** ' + item.solution : '')));
    if (!challenges.length) items.push('No matching challenges in this date range.');
  }
  if (['project', 'retrospective'].includes(kind)) {
    items.push('## Milestones', ...milestones.map(item =>
      '- ' + item.title + ' · ' + item.status + (item.completedDate ? ' · ' + item.completedDate : '')));
    if (!milestones.length) items.push('No matching milestones in this date range.');
  }
  let report = '';
  for (const section of items) {
    const next = report ? report + '\n\n' + section : section;
    if (Array.from(next).length > documentLimit - 150) return report + '\n\nSome records exceeded the preview length. Select a shorter date range to include full detail.';
    report = next;
  }
  return report;
}

function DocumentPreview({ title, content }: { title: string; content: string }) {
  return <article className="surface document-preview print-document">
    <div className="document-print-brand">DevTrail</div>
    <h2 dir="auto">{title}</h2>
    <Markdown text={content} />
  </article>;
}

function DocumentStudio({ insights, url, projects, initialProjectId, onSaved }: {
  insights: boolean; url: string; projects: ProjectRecord[]; initialProjectId: string; onSaved: (id: string) => void;
}) {
  const kinds = insights ? insightKinds : reports;
  const [kind, setKind] = useState(insights ? 'development' : 'weekly');
  const [range, setRange] = useState(() => dateRange(7));
  const [projectId, setProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [builtScope, setBuiltScope] = useState<{ kind: string; projectId: string; from: string; to: string }>();
  const [busy, setBusy] = useState<'sources' | 'save'>();
  const [error, setError] = useState('');
  const project = projects.find(item => item.id === projectId);
  const datesValid = isCalendarDate(range.from) && isCalendarDate(range.to) && range.from <= range.to;
  const projectRequired = kind === 'project' || kind === 'retrospective';
  const scopeChanged = builtScope && (builtScope.kind !== kind || builtScope.projectId !== projectId ||
    builtScope.from !== range.from || builtScope.to !== range.to);

  async function buildFromRecords() {
    setError('');
    setBusy('sources');
    try {
      const scope = { ...range, projectId: projectId || undefined };
      const [sessions, challenges, milestones] = await Promise.all([
        listAll<SessionRecord>('/sessions', undefined, { ...scope, status: 'final' }),
        ['challenges', 'project', 'retrospective'].includes(kind) ? listAll<ChallengeRecord>('/challenges', undefined, scope) : [],
        ['project', 'retrospective'].includes(kind) ? listAll<MilestoneRecord>('/milestones', undefined, scope) : [],
      ]);
      const reportTitle = reports[kind as keyof typeof reports] + (project ? ' · ' + project.name : '');
      setTitle(reportTitle.slice(0, 160));
      setContent(reportText(kind, range.from, range.to, sessions, project, challenges, milestones));
      setBuiltScope({ kind, projectId, ...range });
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      setBusy(undefined);
    }
  }

  async function save() {
    setError('');
    setBusy('save');
    try {
      const { data } = await api<Resource<RecordItem>>({
        url, method: 'post', data: { title: title.trim(), content: content.trim(), kind,
          projectId: projectId || null, ...(insights ? { sessionIds } : range) },
      });
      onSaved(data.id);
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      setBusy(undefined);
    }
  }

  const invalidScope = (!insights && !datesValid) || (projectRequired && !projectId);
  return <>
    <section className="surface document-builder non-print">
      <div className="metric-heading"><h2>{insights ? 'Write an insight' : 'Build a report'}</h2></div>
      <div className="document-scope">
        <Field label={insights ? 'Insight type' : 'Report type'}>{bind => <select {...bind} value={kind} disabled={!!busy} onChange={event => {
          const next = event.target.value; setKind(next);
          if (next === 'daily' || next === 'weekly' || next === 'monthly') setRange(dateRange(next === 'daily' ? 1 : next === 'weekly' ? 7 : 30));
        }}>
          {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>}</Field>
        <Field label="Project" error={projectRequired && !projectId ? 'Select a project.' : undefined}>
          {bind => <select {...bind} value={projectId} disabled={!!busy} onChange={event => {
            setProjectId(event.target.value);
            setSessionIds([]);
          }}>
            <option value="">All projects</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>}
        </Field>
        {!insights && <>
          <Field label="From date">{bind => <input {...bind} type="date" value={range.from} disabled={!!busy}
            onChange={event => setRange({ ...range, from: event.target.value })} />}</Field>
          <Field label="To date" error={!datesValid ? 'Enter a valid date range.' : undefined}>
            {bind => <input {...bind} type="date" value={range.to} disabled={!!busy}
              onChange={event => setRange({ ...range, to: event.target.value })} />}
          </Field>
        </>}
      </div>
      {insights
        ? <SessionSelection projectId={projectId} selection={sessionIds} onChange={setSessionIds} />
        : <div className="filter-actions">
          <button type="button" className="button secondary" disabled={!!busy || invalidScope} onClick={() => void buildFromRecords()}>
            {busy === 'sources' ? 'Building…' : 'Build from records'}
          </button>
        </div>}
    </section>
    <div className="document-grid">
      <div className="surface document-builder non-print">
        <div className="metric-heading"><h2>Edit draft</h2></div>
        <Field label="Document title">{bind => <input {...bind} value={title} maxLength={160} disabled={!!busy}
          onChange={event => setTitle(event.target.value)} />}</Field>
        <Field label="Markdown content">{bind => <textarea {...bind} value={content} rows={19} maxLength={documentLimit}
          disabled={!!busy} onChange={event => setContent(event.target.value)} />}</Field>
        {scopeChanged && <p className="inline-error">Rebuild the draft to use the current filters.</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="filter-actions">
          <button type="button" className="button primary" disabled={!!busy || invalidScope || !!scopeChanged || !title.trim() || !content.trim()}
            onClick={() => void save()}>
            {busy === 'save' ? 'Saving…' : 'Save ' + (insights ? 'insight' : 'report')}
          </button>
        </div>
      </div>
      {(title || content) && <DocumentPreview title={title || 'Untitled draft'} content={content} />}
    </div>
    {!!content.trim() && <DocumentActions title={title.trim() || 'Untitled draft'} content={content} />}
  </>;
}

function DocumentActions({ title, content }: { title: string; content: string }) {
  return <div className="filter-actions non-print">
    <button className="button secondary" type="button" onClick={() => downloadFile(
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.md', '# ' + title + '\n\n' + content + '\n', 'text/markdown;charset=utf-8',
    )}><Download size={15} /> Markdown</button>
    <button className="button secondary" type="button" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button>
  </div>;
}

function SavedDocument({ url, id, onDelete }: { url: string; id: string; onDelete: () => void }) {
  const { result, retry } = useResource(useCallback(async (signal: AbortSignal) =>
    (await api<Resource<RecordItem>>({ url: url + '/' + id, signal })).data, [url, id]));
  const [deleting, setDeleting] = useState(false);
  if (result.status === 'loading') return <Loading>Loading document…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  const record = result.data;
  const sessionIds = record.sessionIds ?? [];
  return <>
    <DocumentPreview title={record.title} content={record.content} />
    {!!sessionIds.length && <div className="surface document-builder non-print">
      <h2>Evidence sessions</h2><div className="report-evidence">{sessionIds.map(session => <Link key={session} className="text-link" to={'/sessions/' + session}>Session {session} <ArrowRight size={13} /></Link>)}</div>
    </div>}
    <DocumentActions {...record} />
    <button type="button" className="button danger-outline non-print" onClick={() => setDeleting(true)}><Trash2 size={15} /> Delete document</button>
    {deleting && <ConfirmDelete title="Delete saved document?" message={record.title} action="Delete document" onDismiss={() => setDeleting(false)}
      onConfirm={async () => { await api<void>({ url: url + '/' + id, method: 'delete' }); onDelete(); }} />}
  </>;
}

export function DocumentsPage({ insights = false }: { insights?: boolean }) {
  const [params, setParams] = useSearchParams();
  const record = params.get('record') ?? '';
  const projectParameter = params.get('projectId') ?? '';
  const projectId = isId(projectParameter) ? projectParameter : '';
  const url = insights ? '/insights' : '/reports';
  const projects = useResource(useCallback((signal: AbortSignal) => listAll<ProjectRecord>('/projects', signal), []));
  const saved = useResource(useCallback((signal: AbortSignal) => listAll<RecordItem>(url, signal, { projectId: projectId || undefined }), [url, projectId]));
  return <div className="report-page">
    <PageHeader title={insights ? 'Insights' : 'Reports'}
      description={insights ? 'Write observations about your work and link the sessions that support them.'
        : 'Write a report from scratch or start with a summary of your recorded work.'}
      actions={record && <Link className="button secondary" to={url}><FileText size={15} /> New document</Link>} />
    <div className="report-layout">
      <div className="report-main">
        {isId(record)
          ? <SavedDocument key={record} id={record} url={url} onDelete={() => { saved.retry(); setParams({}); }} />
          : <DocumentStudio key={url + projectId} insights={insights} url={url} initialProjectId={projectId} projects={projects.result.status === 'ready' ? projects.result.data : []}
            onSaved={id => { saved.retry(); setParams({ record: id }); }} />}
        {projects.result.status === 'error' && <Failure message={projects.result.error.message} retry={projects.retry} />}
      </div>
      <aside className="surface document-library non-print">
        <div className="metric-heading"><h2>Saved {insights ? 'insights' : 'reports'}</h2></div>
        {saved.result.status === 'loading' && <Loading>Loading saved documents…</Loading>}
        {saved.result.status === 'error' && <Failure message={saved.result.error.message} retry={saved.retry} />}
        {saved.result.status === 'ready' && (saved.result.data.length ? <ul>
          {saved.result.data.map(item => <li key={item.id}><Link aria-current={record === item.id ? 'page' : undefined}
            to={url + '?record=' + item.id}><FileText size={15} /><span>{item.title}</span><ArrowRight size={14} /></Link></li>)}
        </ul> : <Empty title="No saved documents yet." />)}
      </aside>
    </div>
  </div>;
}
