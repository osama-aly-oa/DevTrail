import { useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Save } from 'lucide-react';
import { Link } from 'react-router';
import { isCalendarDate, optionalText, textError, todayInIstanbul } from '../../shared/domain';
import { Field, focusInvalid } from '../../shared/ui';
import type { Project } from '../projects/api';
import { externalUrl, splitList } from '../v2/format';
import { categories } from './api';
import type { DevelopmentSession, SessionInput } from './api';
import '../v2/features.css';

export const sessionTextFields = [
  { name: 'title', label: 'Session title', max: 160 },
  { name: 'workSummary', label: 'Work summary', max: 5_000 },
  { name: 'workFocus', label: 'Work focus', max: 240 },
  { name: 'learningNotes', label: 'Learning notes', max: 5_000 },
  { name: 'difficulties', label: 'Difficulties', max: 5_000 },
  { name: 'solutions', label: 'Solutions and lessons learned', max: 5_000 },
  { name: 'nextSteps', label: 'Next steps', max: 5_000 },
] as const;

type SessionTextField = typeof sessionTextFields[number]['name'];
export type SessionDraft = Record<SessionTextField, string> & {
  projectId: string; sessionDate: string; durationMinutes: string;
  technologies: string; tags: string; categories: string[]; references: string;
};

export function makeSessionDraft(session?: DevelopmentSession, projectId = ''): SessionDraft {
  return {
    projectId: session?.projectId ?? projectId,
    sessionDate: session?.sessionDate ?? todayInIstanbul(),
    durationMinutes: session?.durationMinutes?.toString() ?? '',
    title: session?.title ?? '',
    workFocus: session?.workFocus ?? '',
    workSummary: session?.workSummary ?? '',
    learningNotes: session?.learningNotes ?? '',
    difficulties: session?.difficulties ?? '',
    solutions: session?.solutions ?? '',
    nextSteps: session?.nextSteps ?? '',
    technologies: session?.technologies?.join(', ') ?? '',
    tags: session?.tags?.join(', ') ?? '',
    categories: session?.categories ?? [],
    references: session?.references?.join('\n') ?? '',
  };
}

export function SessionEditor({ projects, draft, onEdit, onSave, busy, error, editing, returnUrl }: {
  projects: Project[]; draft: SessionDraft; onEdit: (draft: SessionDraft) => void;
  onSave: (data: SessionInput) => void; busy: boolean; error: string; editing?: boolean; returnUrl?: string;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof SessionDraft, string>>>({});
  function edit<K extends keyof SessionDraft>(field: K, value: SessionDraft[K]) {
    onEdit({ ...draft, [field]: value });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const status = submitter instanceof HTMLButtonElement && submitter.value === 'draft' ? 'draft' : 'final';
    const durationMinutes = draft.durationMinutes.trim() ? Number(draft.durationMinutes) : null;
    const references = splitList(draft.references, 'links');
    const technologies = splitList(draft.technologies);
    const tags = splitList(draft.tags);
    const nextErrors: typeof errors = {
      projectId: projects.some(project => project.id === draft.projectId) ? undefined : 'Choose a project.',
      sessionDate: !isCalendarDate(draft.sessionDate) ? 'Enter a valid session date.' :
        draft.sessionDate > todayInIstanbul() ? 'Choose today or an earlier date in Europe/Istanbul.' : undefined,
      durationMinutes: durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)
        ? 'Enter a whole number from 1 to 1440.' : undefined,
      references: references.length > 24 || references.some(value => !externalUrl(value) || value.length > 2048)
        ? 'Enter up to 24 HTTP or HTTPS links, one per line.' : undefined,
      technologies: technologies.length > 24 || technologies.some(value => textError(value, 'Technology', 80))
        ? 'Enter up to 24 technologies with at most 80 characters each.' : undefined,
      tags: tags.length > 24 || tags.some(value => textError(value, 'Tag', 80))
        ? 'Enter up to 24 tags with at most 80 characters each.' : undefined,
    };
    for (const { name, label, max } of sessionTextFields) {
      nextErrors[name] = textError(draft[name], label, max, name === 'workSummary' && status === 'final');
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      focusInvalid(event.currentTarget);
      return;
    }
    onSave({
      projectId: draft.projectId, sessionDate: draft.sessionDate, durationMinutes, status, references, technologies, tags,
      title: optionalText(draft.title), workSummary: draft.workSummary.trim(), workFocus: optionalText(draft.workFocus),
      learningNotes: optionalText(draft.learningNotes), difficulties: optionalText(draft.difficulties),
      solutions: optionalText(draft.solutions), nextSteps: optionalText(draft.nextSteps), categories: draft.categories,
    });
  }

  return <form className="form-stack v2-session-editor" onSubmit={submit} noValidate>
    <div className="form-grid">
      <Field label="Project" error={errors.projectId}>
        {binding => <select {...binding} name="projectId" required value={draft.projectId}
          onChange={event => edit('projectId', event.target.value)}>
          <option value="">Choose a project</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>}
      </Field>
      <Field label="Session date" error={errors.sessionDate}>
        {binding => <input {...binding} type="date" name="sessionDate" min="0001-01-01" max={todayInIstanbul()} required
          value={draft.sessionDate} onChange={event => edit('sessionDate', event.target.value)} />}
      </Field>
      <Field label="Session title" error={errors.title} optional>
        {binding => <input {...binding} name="title" dir="auto" value={draft.title} onChange={event => edit('title', event.target.value)} />}
      </Field>
      <Field label="Duration in minutes" error={errors.durationMinutes} optional>
        {binding => <input {...binding} name="durationMinutes" type="number" min={1} max={1440} step={1}
          value={draft.durationMinutes} onChange={event => edit('durationMinutes', event.target.value)} />}
      </Field>
    </div>
    {sessionTextFields.filter(field => field.name !== 'title').map(({ name, label }) => <Field key={name}
      label={label} error={errors[name]} optional={name !== 'workSummary'}>
      {binding => name === 'workFocus'
        ? <input {...binding} name={name} dir="auto" value={draft[name]} onChange={event => edit(name, event.target.value)} />
        : <>
          <textarea {...binding} name={name} rows={name === 'workSummary' ? 5 : 3} dir="auto"
            aria-describedby={name === 'workSummary'
              ? [binding.id + '-hint', binding['aria-describedby']].filter(Boolean).join(' ')
              : binding['aria-describedby']}
            value={draft[name]} onChange={event => edit(name, event.target.value)} />
          {name === 'workSummary' && <p id={binding.id + '-hint'} className="v2-help">
            Required for a final session. You can leave it blank when saving a draft.
          </p>}
        </>}
    </Field>)}
    <p className="v2-help">Notes support Markdown links, lists, and fenced code snippets.</p>
    <div className="form-grid">
      <Field label="Technologies" error={errors.technologies} optional>
        {binding => <input {...binding} name="technologies" placeholder="React, PostgreSQL" value={draft.technologies}
          onChange={event => edit('technologies', event.target.value)} />}
      </Field>
      <Field label="Tags" error={errors.tags} optional>
        {binding => <input {...binding} name="tags" placeholder="accessibility, testing" value={draft.tags}
          onChange={event => edit('tags', event.target.value)} />}
      </Field>
    </div>
    <fieldset className="v2-option-field">
      <legend>Activity categories</legend>
      <div className="v2-option-chips">{categories.map(category => <label key={category}>
        <input type="checkbox" checked={draft.categories.includes(category)} onChange={event => edit('categories',
          event.target.checked ? [...draft.categories, category] : draft.categories.filter(value => value !== category))} />
        <span>{category}</span>
      </label>)}</div>
    </fieldset>
    <Field label="Reference links" error={errors.references} optional>
      {binding => <textarea {...binding} name="references" placeholder="One URL per line"
        value={draft.references} rows={2} onChange={event => edit('references', event.target.value)} />}
    </Field>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="form-actions">
      {returnUrl && <Link className="button secondary" to={returnUrl}>Cancel</Link>}
      <button className="button secondary" type="submit" value="draft" disabled={busy}>
        <FileText size={16} aria-hidden="true" /> Save draft
      </button>
      <button className="button primary" type="submit" value="final" disabled={busy}>
        <Save size={16} aria-hidden="true" /> {busy ? 'Saving…' : editing ? 'Save changes' : 'Save session'}
      </button>
    </div>
  </form>;
}
