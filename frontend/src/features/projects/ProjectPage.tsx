import { useCallback, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../shared/api';
import { displayTimestamp, isId } from '../../shared/domain';
import { ConfirmDelete, Failure, Loading, Notice, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { SessionHistory } from '../sessions/SessionHistory';
import { deleteProject, getProject } from './api';
import type { Project } from './api';

function ProjectDetail({ project }: { project: Project }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const path = '/projects/' + project.id;

  async function remove() {
    await deleteProject(project.id);
    void navigate('/projects', { replace: true, state: { notice: 'Project deleted.' } });
  }

  return (
    <>
      <PageHeader title={project.name} overline={<Link className="back-link" to="/projects">Projects</Link>}
        actions={(
          <>
            <Link to={path + '/edit'} className="button secondary"><Pencil aria-hidden="true" size={16} /> Edit project</Link>
            <Link to={'/sessions/new?projectId=' + project.id} className="button primary"><Plus aria-hidden="true" size={18} /> Log session</Link>
          </>
        )} />
      <Notice />
      <div className="surface project-overview">
        <div className="min-w-0">
          {project.description && <p className="prose-text">{project.description}</p>}
          <p className="muted">Created <time dateTime={project.createdAt}>{displayTimestamp(project.createdAt)}</time></p>
        </div>
        <button type="button" className="button danger-outline" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" size={16} /> Delete project
        </button>
      </div>
      <section aria-labelledby="journey-heading" className="journey">
        <h2 id="journey-heading" className="section-heading">Project Journey Review</h2>
        <SessionHistory project={project} />
      </section>
      {confirming && <ConfirmDelete title="Delete project?" action="Delete project"
        message={'Permanently delete “' + project.name + '”? This is allowed only when the project has no sessions.'}
        onConfirm={remove} onDismiss={() => setConfirming(false)} />}
    </>
  );
}

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const load = useCallback((signal: AbortSignal) => {
    if (!isId(projectId)) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Project not found.'));
    return getProject(projectId, signal);
  }, [projectId]);
  const { result, retry } = useResource(load);

  if (result.status === 'ready') return <ProjectDetail key={result.data.id} project={result.data} />;
  return (
    <>
      <PageHeader title="Project" overline={<Link className="back-link" to="/projects">Projects</Link>} />
      {result.status === 'loading'
        ? <Loading>Loading project…</Loading>
        : <Failure message={result.error.message} retry={result.error.status === 404 ? undefined : retry} />}
    </>
  );
}
