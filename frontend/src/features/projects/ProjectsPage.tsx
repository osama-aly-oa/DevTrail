import { useCallback } from 'react';
import { Folder, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { displayTimestamp, pageOffset } from '../../shared/domain';
import { Empty, Failure, Loading, Notice, PageHeader, Pagination } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProjects } from './api';

function projectsUrl(offset: number) {
  return offset ? '/projects?offset=' + offset : '/projects';
}

export function ProjectsPage() {
  const [search] = useSearchParams();
  const offset = pageOffset(search.get('offset'));
  const load = useCallback((signal: AbortSignal) => getProjects(offset, signal), [offset]);
  const { result, retry } = useResource(load);

  return (
    <>
      <PageHeader title="Projects" description="Organize your development work and review each project’s journey."
        actions={<Link to="/projects/new" className="button primary"><Plus aria-hidden="true" size={18} /> New project</Link>} />
      <Notice />
      {result.status === 'loading' && <Loading>Loading projects…</Loading>}
      {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
      {result.status === 'ready' && (
        <>
          {result.data.data.length ? (
            <ul className="project-grid">
              {result.data.data.map(project => (
                <li className="project-card" key={project.id}>
                  <span className="resource-icon"><Folder aria-hidden="true" size={22} /></span>
                  <h2><Link to={'/projects/' + project.id}>{project.name}</Link></h2>
                  {project.description && <p className="card-preview">{project.description}</p>}
                  <span className="project-meta">Created <time dateTime={project.createdAt}>{displayTimestamp(project.createdAt)}</time></span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title={offset ? 'No projects on this page.' : 'No projects yet.'}>
              {offset
                ? <Link to="/projects" className="button secondary">First page</Link>
                : <Link to="/projects/new" className="button secondary">Create a project</Link>}
            </Empty>
          )}
          <Pagination pagination={result.data.pagination} url={projectsUrl} />
        </>
      )}
    </>
  );
}
