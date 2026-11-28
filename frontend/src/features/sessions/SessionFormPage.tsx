import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../shared/api';
import { isId } from '../../shared/domain';
import { Empty, Failure, Loading, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProjectOptions } from '../projects/api';
import type { Project } from '../projects/api';
import { failureMessage } from '../v2/format';
import { getSession, saveSession } from './api';
import type { DevelopmentSession, SessionInput } from './api';
import { makeSessionDraft, SessionEditor } from './SessionEditor';

function SessionForm({ projects, session, initialProject }: {
  projects: Project[]; session?: DevelopmentSession; initialProject?: string;
}) {
  const navigate = useNavigate();
  const projectId = projects.some(project => project.id === initialProject) ? initialProject : undefined;
  const [draft, setDraft] = useState(() => makeSessionDraft(session, projectId));
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const returnUrl = session ? '/sessions/' + session.id : projectId ? '/projects/' + projectId : '/sessions';

  async function save(data: SessionInput) {
    setBusy(true);
    setFailure('');
    try {
      const saved = await saveSession(data, session?.id);
      void navigate('/sessions/' + saved.id, {
        replace: true, state: { notice: data.status === 'draft' ? 'Draft saved.' : session ? 'Session updated.' : 'Session recorded.' },
      });
    } catch (error) {
      setFailure(failureMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <div className="surface form-panel">
    <SessionEditor projects={projects} draft={draft} onEdit={setDraft} onSave={data => void save(data)}
      busy={busy} error={failure} editing={Boolean(session)} returnUrl={returnUrl} />
  </div>;
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
  return <>
    <PageHeader title="Log a session" description="Record your work, decisions, and what you learned."
      overline={<Link className="back-link" to="/sessions">Sessions</Link>} />
    <SessionFormWithProjects key={initialProject} initialProject={initialProject} />
  </>;
}

export function EditSessionPage() {
  const { sessionId = '' } = useParams();
  const load = useCallback((signal: AbortSignal) => {
    if (!isId(sessionId)) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Development session not found.'));
    return getSession(sessionId, signal);
  }, [sessionId]);
  const { result, retry } = useResource(load);

  return <>
    <PageHeader title="Edit session" overline={<Link className="back-link" to="/sessions">Sessions</Link>} />
    {result.status === 'loading' && <Loading>Loading session…</Loading>}
    {result.status === 'error' && <Failure message={result.error.message}
      retry={result.error.status === 404 ? undefined : retry} />}
    {result.status === 'ready' && <SessionFormWithProjects key={result.data.id} session={result.data} />}
  </>;
}
