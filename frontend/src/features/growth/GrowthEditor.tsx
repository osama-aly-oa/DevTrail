import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Save } from 'lucide-react';
import { Link } from 'react-router';
import { displayDate, isCalendarDate, textError, todayInIstanbul } from '../../shared/domain';
import { Failure, Field, focusInvalid, Loading } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import type { Project } from '../projects/api';
import { getAllSessions, sessionTitle } from '../sessions/api';
import { externalUrl, splitList } from '../v2/format';

export type FormValue = Record<string, string>;
export type GrowthField = {
  key: string; label: string; type?: 'text' | 'long' | 'date' | 'list' | 'links';
  required?: boolean; options?: Record<string, string>; max?: number; when?: (values: FormValue) => boolean;
};

export function SessionSelection({ projectId, selection, onChange, max = 100 }: {
  projectId: string; selection: string[]; onChange: (value: string[]) => void; max?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const load = useCallback((signal: AbortSignal) => expanded
    ? getAllSessions({ projectId: projectId || undefined }, signal)
    : Promise.resolve([]), [expanded, projectId]);
  const { result, retry } = useResource(load);
  const matches = result.status === 'ready' ? result.data.filter(session =>
    !query.trim() || (sessionTitle(session) + ' ' + session.workSummary).toLowerCase().includes(query.trim().toLowerCase())) : [];
  return <details className="v2-collapsible" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Related sessions{selection.length > 0 && ' · ' + selection.length}</summary>
    <div className="v2-chips">{selection.map(id => <span className="v2-chip" key={id}>
      <Link to={'/sessions/' + id}>Session {id}</Link>
      <button type="button" aria-label={'Remove session ' + id} onClick={() => onChange(selection.filter(value => value !== id))}>×</button>
    </span>)}</div>
    {expanded && <Field label="Find related sessions">
      {binding => <input {...binding} type="search" value={query} placeholder="Search by title or work summary"
        onChange={event => setQuery(event.target.value)} />}
    </Field>}
    {expanded && result.status === 'loading' && <Loading>Loading sessions…</Loading>}
    {expanded && result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
    {expanded && result.status === 'ready' && (
      matches.length ? <div className="v2-source-picker">{matches.slice(0, 40).map(session => <label key={session.id}>
        <input type="checkbox" checked={selection.includes(session.id)}
          disabled={!selection.includes(session.id) && selection.length >= max}
          onChange={event => onChange(event.target.checked ? [...selection, session.id] : selection.filter(id => id !== session.id))} />
        <span><strong>{sessionTitle(session)}</strong><small>{displayDate(session.sessionDate)}</small></span>
      </label>)}</div> : <p className="v2-help">No sessions match.</p>
    )}
    {expanded && matches.length > 40 && <p className="v2-help">Showing the first 40 matches. Search for an older session.</p>}
  </details>;
}

export function GrowthEditor({ fields, projects, initial, initialProject = '', initialSessions = [], fixedProject, requiredProject,
  onCancel, onSave, heading }: {
  fields: GrowthField[]; projects: Project[]; initial: FormValue;
  initialProject?: string; initialSessions?: string[]; fixedProject?: string; requiredProject?: boolean;
  onCancel: () => void; onSave: (values: FormValue, projectId: string, sessionIds: string[]) => Promise<void>;
  heading: string;
}) {
  const [values, setValues] = useState(initial);
  const [projectId, setProject] = useState(fixedProject || initialProject);
  const [sessionIds, setSessionIds] = useState(initialSessions);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const visible = fields.filter(field => !field.when || field.when(values));

  function edit(key: string, value: string) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const nextErrors: typeof errors = {};
    if (requiredProject && !projectId) nextErrors.projectId = 'Choose a project.';
    for (const field of visible) {
      const value = values[field.key] ?? '';
      if (field.type === 'date' && value) {
        if (!isCalendarDate(value)) nextErrors[field.key] = 'Enter a valid date.';
        if (['completedDate', 'resolvedDate'].includes(field.key) && value > todayInIstanbul()) {
          nextErrors[field.key] = 'Choose today or an earlier date.';
        }
      } else if (field.type === 'links') {
        const links = splitList(value, 'links');
        if (links.length > 24 || links.some(link => !externalUrl(link) || link.length > 2048)) {
          nextErrors[field.key] = 'Enter up to 24 HTTP or HTTPS links, one per line.';
        }
      } else if (field.type === 'list') {
        const entries = splitList(value);
        if (entries.length > 24 || entries.some(item => textError(item, field.label, 80))) {
          nextErrors[field.key] = 'Enter up to 24 values with at most 80 characters each.';
        }
      } else if (!field.options) {
        nextErrors[field.key] = textError(value, field.label, field.max ?? (field.type === 'long' ? 5_000 : 160), field.required);
      }
    }
    setErrors(nextErrors);
    setFailure('');
    if (Object.values(nextErrors).some(Boolean)) {
      focusInvalid(event.currentTarget);
      return;
    }
    setBusy(true);
    try {
      await onSave(values, projectId, sessionIds);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Could not save this record.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="v2-feature-panel form-stack" onSubmit={event => void submit(event)} noValidate>
    <h2>{heading}</h2>
    {!fixedProject && <Field label="Project" optional={!requiredProject} error={errors.projectId}>
      {binding => <select {...binding} value={projectId} onChange={event => {
        setProject(event.target.value); setSessionIds([]);
      }}>
        <option value="">{requiredProject ? 'Choose a project' : 'No project'}</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>}
    </Field>}
    {visible.map(field => <Field key={field.key} label={field.label} error={errors[field.key]} optional={!field.required && !field.options}>
      {binding => {
        const value = values[field.key] ?? '';
        if (field.options) return <select {...binding} value={value} onChange={event => edit(field.key, event.target.value)}>
          {Object.entries(field.options).map(([option, label]) => <option key={option} value={option}>{label}</option>)}
        </select>;
        if (field.type === 'long' || field.type === 'links') {
          return <textarea {...binding} value={value} rows={field.type === 'links' ? 2 : 3} dir="auto"
            placeholder={field.type === 'links' ? 'One URL per line' : undefined} onChange={event => edit(field.key, event.target.value)} />;
        }
        return <input {...binding} type={field.type === 'date' ? 'date' : 'text'} value={value} dir="auto"
          min={field.type === 'date' ? '0001-01-01' : undefined} onChange={event => edit(field.key, event.target.value)}
          placeholder={field.type === 'list' ? 'Separate values with commas' : undefined} />;
      }}
    </Field>)}
    <SessionSelection projectId={projectId} selection={sessionIds} onChange={setSessionIds} />
    {failure && <p className="inline-error" role="alert">{failure}</p>}
    <div className="form-actions">
      <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="submit" className="button primary" disabled={busy}><Save size={16} aria-hidden="true" />
        {busy ? 'Saving…' : 'Save record'}</button>
    </div>
  </form>;
}
