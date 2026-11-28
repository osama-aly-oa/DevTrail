import { useCallback, useState } from 'react';
import { ArrowUpRight, CalendarDays, Clock3, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../shared/api';
import { displayDate, isId } from '../../shared/domain';
import { ConfirmDelete, Failure, Loading, Notice, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProject } from '../projects/api';
import { deleteSession, getSession, sessionTitle } from './api';
import type { DevelopmentSession } from './api';
import { Markdown } from '../v2/Markdown';
import { formatDuration } from '../overview/data';
import { externalUrl } from '../v2/format';
import { SessionEvidence } from './SessionEvidence';

function SessionDetail({ session }: { session: DevelopmentSession }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const loadProject = useCallback((signal: AbortSignal) => getProject(session.projectId, signal), [session.projectId]);
  const { result: project } = useResource(loadProject);
  const notes = [
    { label: 'Work summary', text: session.workSummary },
    ...(session.workFocus && session.title ? [{ label: 'Work focus', text: session.workFocus }] : []),
    { label: 'Learning notes', text: session.learningNotes },
    { label: 'Difficulties', text: session.difficulties },
    { label: 'Solutions and lessons learned', text: session.solutions },
    { label: 'Next steps', text: session.nextSteps },
  ];

  async function remove() {
    await deleteSession(session.id);
    void navigate('/sessions', { replace: true, state: { notice: 'Session deleted.' } });
  }

  return (
    <>
      <PageHeader title={sessionTitle(session)}
        overline={<Link className="back-link" to="/sessions">Sessions</Link>}
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
        {session.durationMinutes && <span><Clock3 aria-hidden="true" size={17} /> {formatDuration(session.durationMinutes)}</span>}
        {session.status === 'draft' && <strong className="v2-chip v2-chip-accent">Draft</strong>}
        <Link className="project-tag" to={'/projects/' + session.projectId}>
          {project.status === 'ready' ? project.data.name : 'View project'}
        </Link>
      </div>
      <div className="v2-session-detail">
        <div className="surface detail-panel">
          {!notes.some(note => note.text) && <p className="muted">This draft does not have any notes yet.</p>}
          {notes.map(note => note.text && <section key={note.label}>
            <h2>{note.label}</h2>
            <Markdown text={note.text} />
          </section>)}
          {[
            { label: 'Technologies', values: session.technologies }, { label: 'Tags', values: session.tags },
            { label: 'Categories', values: session.categories },
          ].map(({ label, values }) => Boolean(values?.length) && <section key={label}>
            <h2>{label}</h2><div className="v2-chips">{values?.map(value => <span className="v2-chip" key={value}>{value}</span>)}</div>
          </section>)}
          {Boolean(session.references?.length) && <section>
            <h2>References</h2>
            <ul className="v2-value-list">{session.references?.map(value => {
              const href = externalUrl(value);
              return href && <li key={value}><a className="v2-inline-link text-link" href={href} target="_blank" rel="noreferrer">
                {value} <ArrowUpRight size={15} aria-hidden="true" />
              </a></li>;
            })}</ul>
          </section>}
          <section className="v2-row-actions">
            <Link className="button secondary" to={'/reflection?projectId=' + session.projectId + '&sessionId=' + session.id}>Reflect on this session</Link>
            <Link className="button secondary" to={'/challenges?projectId=' + session.projectId + '&sessionId=' + session.id}>Extract a challenge</Link>
          </section>
        </div>
        <SessionEvidence sessionId={session.id} projectId={session.projectId} />
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
      <PageHeader title="Development session" overline={<Link className="back-link" to="/sessions">Sessions</Link>} />
      {result.status === 'loading'
        ? <Loading>Loading session…</Loading>
        : <Failure message={result.error.message} retry={result.error.status === 404 ? undefined : retry} />}
    </>
  );
}
