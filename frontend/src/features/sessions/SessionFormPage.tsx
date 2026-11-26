import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../shared/api';
import { isCalendarDate, isId, optionalText, textError, todayInIstanbul } from '../../shared/domain';
import { Empty, Failure, Field, focusInvalid, Loading, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProjectOptions } from '../projects/api';
import type { Project } from '../projects/api';
import { getSession, saveSession } from './api';
import type { DevelopmentSession } from './api';

const noteFields = [
  { name: 'learningNotes', label: 'Learning notes' },
  { name: 'difficulties', label: 'Difficulties' },
  { name: 'nextSteps', label: 'Next steps' },
] as const;

type SessionDraft = {
  projectId: string;
  sessionDate: string;
  workFocus: string;
  workSummary: string;
  learningNotes: string;
  difficulties: string;
  nextSteps: string;
};

function SessionForm({ projects, session, initialProject }: {
  projects: Project[]; session?: DevelopmentSession; initialProject?: string;
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SessionDraft>(() => ({
    projectId: session?.projectId ?? (projects.some(project => project.id === initialProject) ? initialProject ?? '' : ''),
    sessionDate: session?.sessionDate ?? todayInIstanbul(),
    workFocus: session?.workFocus ?? '',
    workSummary: session?.workSummary ?? '',
    learningNotes: session?.learningNotes ?? '',
    difficulties: session?.difficulties ?? '',
    nextSteps: session?.nextSteps ?? '',
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof SessionDraft, string>>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const returnUrl = session ? '/sessions/' + session.id :
    initialProject && projects.some(project => project.id === initialProject) ? '/projects/' + initialProject : '/timeline';

  function edit(field: keyof SessionDraft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const nextErrors = {
      projectId: projects.some(project => project.id === draft.projectId) ? undefined : 'Choose a project.',
      sessionDate: !isCalendarDate(draft.sessionDate) ? 'Enter a valid session date.' :
        draft.sessionDate > todayInIstanbul() ? 'Choose today or an earlier date in Europe/Istanbul.' : undefined,
      workFocus: textError(draft.workFocus, 'Work focus', 240),
      workSummary: textError(draft.workSummary, 'Work summary', 5_000, true),
      learningNotes: textError(draft.learningNotes, 'Learning notes', 5_000),
      difficulties: textError(draft.difficulties, 'Difficulties', 5_000),
      nextSteps: textError(draft.nextSteps, 'Next steps', 5_000),
    };
    setErrors(nextErrors);
    setFailure('');
    if (Object.values(nextErrors).some(Boolean)) {
      focusInvalid(form);
      return;
    }

    setBusy(true);
    try {
      const saved = await saveSession({
        projectId: draft.projectId,
        sessionDate: draft.sessionDate,
        workSummary: draft.workSummary.trim(),
        workFocus: optionalText(draft.workFocus),
        learningNotes: optionalText(draft.learningNotes),
        difficulties: optionalText(draft.difficulties),
        nextSteps: optionalText(draft.nextSteps),
      }, session?.id);
      if (form.isConnected) {
        void navigate('/sessions/' + saved.id, {
          replace: true, state: { notice: session ? 'Session updated.' : 'Session recorded.' },
        });
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The session could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="surface form-panel form-stack" onSubmit={event => void submit(event)} noValidate>
      <div className="form-grid">
        <Field label="Project" error={errors.projectId}>
          {binding => (
            <select {...binding} name="projectId" required value={draft.projectId} onChange={event => edit('projectId', event.target.value)}>
              <option value="">Choose a project</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Session date" error={errors.sessionDate}>
          {binding => <input {...binding} type="date" name="sessionDate" min="0001-01-01" max={todayInIstanbul()} required
            value={draft.sessionDate} onChange={event => edit('sessionDate', event.target.value)} />}
        </Field>
      </div>
      <Field label="Work focus" error={errors.workFocus} optional>
        {binding => <input {...binding} name="workFocus" value={draft.workFocus}
          onChange={event => edit('workFocus', event.target.value)} />}
      </Field>
      <Field label="Work summary" error={errors.workSummary}>
        {binding => <textarea {...binding} rows={5} name="workSummary" required value={draft.workSummary}
          onChange={event => edit('workSummary', event.target.value)} />}
      </Field>
      {noteFields.map(({ name, label }) => (
        <Field key={name} label={label} error={errors[name]} optional>
          {binding => <textarea {...binding} name={name} rows={3} value={draft[name]}
            onChange={event => edit(name, event.target.value)} />}
        </Field>
      ))}
      {failure && <p className="inline-error" role="alert">{failure}</p>}
      <div className="form-actions">
        <Link className="button secondary" to={returnUrl}>Cancel</Link>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : session ? 'Save changes' : 'Save session'}
        </button>
      </div>
    </form>
  );
}

function SessionFormWithProjects({ session, initialProject }: { session?: DevelopmentSession; initialProject?: string }) {
  const { result, retry } = useResource(getProjectOptions);
  if (result.status === 'loading') return <Loading>Loading projects…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  if (!result.data.length) {
    return <Empty title="Create a project before recording a session.">
      <Link className="button primary" to="/projects/new">New project</Link>
    </Empty>;
  }
  return <SessionForm projects={result.data} session={session} initialProject={initialProject} />;
}

export function NewSessionPage() {
  const [search] = useSearchParams();
  const initialProject = search.get('projectId') ?? undefined;
  return (
    <>
      <PageHeader title="Log a session" description="Record your work and capture what you want to remember."
        overline={<Link className="back-link" to="/timeline">Daily Timeline</Link>} />
      <SessionFormWithProjects key={initialProject} initialProject={initialProject} />
    </>
  );
}

export function EditSessionPage() {
  const { sessionId = '' } = useParams();
  const load = useCallback((signal: AbortSignal) => {
    if (!isId(sessionId)) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Development session not found.'));
    return getSession(sessionId, signal);
  }, [sessionId]);
  const { result, retry } = useResource(load);

  return (
    <>
      <PageHeader title="Edit session" overline={<Link className="back-link" to="/timeline">Daily Timeline</Link>} />
      {result.status === 'loading' && <Loading>Loading session…</Loading>}
      {result.status === 'error' && <Failure message={result.error.message} retry={result.error.status === 404 ? undefined : retry} />}
      {result.status === 'ready' && <SessionFormWithProjects key={result.data.id} session={result.data} />}
    </>
  );
}
