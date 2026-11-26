import { useCallback, useState } from 'react';
import { CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../shared/api';
import { displayDate, isId } from '../../shared/domain';
import { ConfirmDelete, Failure, Loading, Notice, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProject } from '../projects/api';
import { deleteSession, getSession } from './api';
import type { DevelopmentSession } from './api';

function SessionDetail({ session }: { session: DevelopmentSession }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const loadProject = useCallback((signal: AbortSignal) => getProject(session.projectId, signal), [session.projectId]);
  const { result: project } = useResource(loadProject);
  const notes = [
    { label: 'Work summary', text: session.workSummary },
    { label: 'Learning notes', text: session.learningNotes },
    { label: 'Difficulties', text: session.difficulties },
    { label: 'Next steps', text: session.nextSteps },
  ];

  async function remove() {
    await deleteSession(session.id);
    void navigate('/timeline', { replace: true, state: { notice: 'Session deleted.' } });
  }

  return (
    <>
      <PageHeader title={session.workFocus ?? 'Development session'}
        overline={<Link className="back-link" to="/timeline">Daily Timeline</Link>}
        actions={(
          <>
            <Link className="button secondary" to={'/sessions/' + session.id + '/edit'}><Pencil aria-hidden="true" size={16} /> Edit session</Link>
            <button className="button danger-outline" type="button" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" size={16} /> Delete session
            </button>
          </>
        )} />
      <Notice />
      <div className="session-meta">
        <span><CalendarDays aria-hidden="true" size={18} /> <time dateTime={session.sessionDate}>{displayDate(session.sessionDate)}</time></span>
        <Link className="project-tag" to={'/projects/' + session.projectId}>
          {project.status === 'ready' ? project.data.name : 'View project'}
        </Link>
      </div>
      <div className="surface detail-panel">
        {notes.filter(note => note.text).map(note => (
          <section key={note.label}>
            <h2>{note.label}</h2>
            <p className="prose-text">{note.text}</p>
          </section>
        ))}
      </div>
      {confirming && <ConfirmDelete title="Delete session?" action="Delete session"
        message={'Permanently delete this session from ' + displayDate(session.sessionDate) + '?'}
        onConfirm={remove} onDismiss={() => setConfirming(false)} />}
    </>
  );
}

export function SessionPage() {
  const { sessionId = '' } = useParams();
  const load = useCallback((signal: AbortSignal) => {
    if (!isId(sessionId)) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Development session not found.'));
    return getSession(sessionId, signal);
  }, [sessionId]);
  const { result, retry } = useResource(load);

  if (result.status === 'ready') return <SessionDetail key={result.data.id} session={result.data} />;
  return (
    <>
      <PageHeader title="Development session" overline={<Link className="back-link" to="/timeline">Daily Timeline</Link>} />
      {result.status === 'loading'
        ? <Loading>Loading session…</Loading>
        : <Failure message={result.error.message} retry={result.error.status === 404 ? undefined : retry} />}
    </>
  );
}
