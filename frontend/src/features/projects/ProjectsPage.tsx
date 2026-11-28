import { useCallback, useState } from 'react';
import { Folder, Plus, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { displayTimestamp, pageOffset } from '../../shared/domain';
import { Empty, Failure, Field, Loading, Notice, PageHeader, Pagination } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProjects, projectStatuses } from './api';
import type { ProjectStatus } from './api';
import '../v2/features.css';

function projectFilters(q: string, status: string, offset = 0) {
  const next = new URLSearchParams();
  if (q) next.set('q', q);
  if (status) next.set('status', status);
  if (offset) next.set('offset', String(offset));
  return next;
}

function ProjectFilters({ q, status, onChange }: { q: string; status: string; onChange: (next: URLSearchParams) => void }) {
  const [query, setQuery] = useState(q);
  const [activeStatus, setActiveStatus] = useState(status);
  return <form className="surface filters" onSubmit={event => {
    event.preventDefault();
    onChange(projectFilters(query.trim(), activeStatus));
  }}>
    <div className="filter-fields">
      <Field label="Search projects">
        {binding => <input {...binding} type="search" maxLength={120} value={query} placeholder="Name or description"
          onChange={event => setQuery(event.target.value)} />}
      </Field>
      <Field label="Status">
        {binding => <select {...binding} value={activeStatus} onChange={event => setActiveStatus(event.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(projectStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>}
      </Field>
    </div>
    <button type="submit" className="button secondary"><Search size={16} aria-hidden="true" /> Search</button>
  </form>;
}

export function ProjectsPage() {
  const [search, setSearch] = useSearchParams();
  const offset = pageOffset(search.get('offset'));
  const q = search.get('q')?.trim().slice(0, 120) ?? '';
  const queryStatus = search.get('status') ?? '';
  const status = Object.hasOwn(projectStatuses, queryStatus) ? queryStatus as ProjectStatus : undefined;
  const load = useCallback((signal: AbortSignal) => getProjects(offset, signal, undefined,
    { q: q || undefined, status }), [offset, q, status]);
  const { result, retry } = useResource(load);

  return (
    <>
      <PageHeader title="Projects" description="Organize your development work and review each project’s journey."
        actions={<Link to="/projects/new" className="button primary"><Plus aria-hidden="true" size={18} /> New project</Link>} />
      <Notice />
      <ProjectFilters key={q + ':' + status} q={q} status={status ?? ''} onChange={setSearch} />
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
                  {project.status && <span className={'v2-chip' + (project.status === 'completed' ? ' v2-chip-positive' : '')}>
                    {projectStatuses[project.status]}
                  </span>}
                  {project.description && <p className="card-preview">{project.description}</p>}
                  {Boolean(project.technologies?.length) && <div className="v2-chips">
                    {project.technologies?.slice(0, 4).map(technology => <span className="v2-chip" key={technology}>{technology}</span>)}
                    {(project.technologies?.length ?? 0) > 4 && <span className="v2-chip">+{project.technologies!.length - 4}</span>}
                  </div>}
                  <span className="project-meta">Created <time dateTime={project.createdAt}>{displayTimestamp(project.createdAt)}</time></span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title={offset ? 'No projects on this page.' : q || status ? 'No projects match these filters.' : 'No projects yet.'}>
              {offset
                ? <Link to="/projects" className="button secondary">First page</Link>
                : q || status ? <Link to="/projects" className="button secondary">Clear filters</Link>
                : <Link to="/projects/new" className="button secondary">Create a project</Link>}
            </Empty>
          )}
          <Pagination pagination={result.data.pagination} url={next => {
            const params = projectFilters(q, status ?? '', next);
            return params.size ? '/projects?' + params : '/projects';
          }} />
        </>
      )}
    </>
  );
}
