import { useCallback, useState } from 'react';
import { ArrowUpRight, GitCommitHorizontal, GitBranch, GitPullRequest, Link2, RefreshCw, Unlink } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../app/api';
import type { Resource } from '../../shared/api';
import { displayTimestamp, isId, pageOffset } from '../../shared/domain';
import { ConfirmDelete, Empty, Failure, Field, Loading, PageHeader, Pagination } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { listAll } from '../overview/data';
import type { ProjectRecord } from '../overview/data';
import { getIntegrationStatus } from '../github/api';
import type { GitHubActivity, GitHubRepository } from '../github/api';
import { externalUrl, failureMessage } from '../v2/format';

const syncLabels = {
  idle: 'Awaiting first sync', syncing: 'Syncing', synced: 'Synced', partial: 'Partial import', failed: 'Sync failed',
};

function GitHubEntry({ activity }: { activity: GitHubActivity }) {
  const commit = activity.kind === 'commit';
  const Icon = commit ? GitCommitHorizontal : GitPullRequest;
  const href = externalUrl(activity.url);
  return <div className="github-activity-row">
    <span className="activity-icon"><Icon size={17} aria-hidden="true" /></span>
    <div><strong>{activity.title}</strong><small>{commit ? 'Commit ' + activity.externalId.slice(0, 8) : 'Pull request #' + activity.externalId}
      {activity.author ? ' · ' + activity.author : ''} · {displayTimestamp(activity.occurredAt)}</small></div>
    {href && <a className="icon-button" href={href} target="_blank" rel="noreferrer" aria-label="Open activity on GitHub"><ArrowUpRight size={17} /></a>}
  </div>;
}

function ActivityDetail({ id }: { id: string }) {
  const { result, retry } = useResource(useCallback(async (signal: AbortSignal) =>
    (await api<Resource<GitHubActivity>>({ url: '/github/activity/' + id, signal })).data, [id]));
  if (result.status === 'loading') return <Loading>Loading GitHub activity…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  return <section className="surface metric-panel github-repo">
    <div className="metric-heading"><h2>Selected activity</h2><Link className="text-link" to="/github">All activity</Link></div>
    <GitHubEntry activity={result.data} />
    <Link className="text-link metric-link" to={'/projects/' + result.data.projectId}>Open related project <ArrowUpRight size={14} /></Link>
  </section>;
}

export function GitHubPage() {
  const [params, setParams] = useSearchParams();
  const activityId = params.get('activity') ?? '';
  const selected = params.get('projectId') ?? '';
  const kind = params.get('kind') ?? '';
  const offset = pageOffset(params.get('offset'));
  const limit = 20;
  const [linkProject, setLinkProject] = useState(() => isId(selected) ? selected : '');
  const [githubPath, setGitHubPath] = useState('');
  const [busy, setBusy] = useState('');
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [unlink, setUnlink] = useState<GitHubRepository>();
  const repositories = useResource(useCallback(async (signal: AbortSignal) =>
    (await api<Resource<GitHubRepository[]>>({ url: '/github/repositories', signal })).data, []));
  const projects = useResource(useCallback((signal: AbortSignal) => listAll<ProjectRecord>('/projects', signal), []));
  const integration = useResource(getIntegrationStatus);
  const activity = useResource(useCallback((signal: AbortSignal) => api<{
    data: GitHubActivity[]; pagination: { offset: number; limit: number; total: number; hasMore: boolean };
  }>({
    url: '/github/activity', params: {
      projectId: isId(selected) ? selected : undefined, kind: kind === 'commit' || kind === 'pull_request' ? kind : undefined, offset, limit,
    }, signal,
  }), [selected, kind, offset]));
  const connections = repositories.result.status === 'ready' ? repositories.result.data : [];
  const projectList = projects.result.status === 'ready' ? projects.result.data : [];
  const available = projectList.filter(project => !connections.some(repo => repo.projectId === project.id));

  function refresh() {
    repositories.retry();
    activity.retry();
  }

  async function connect() {
    setFailure(''); setNotice('');
    const match = /^(?:https:\/\/github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/i.exec(githubPath.trim());
    const [, owner, repository] = match ?? [];
    if (!owner || !repository || !linkProject) { setFailure('Choose a project and enter a repository as owner/name.'); return; }
    setBusy('connect');
    try {
      await api<Resource<GitHubRepository>>({
        url: '/github/repositories', method: 'post', data: { projectId: linkProject, owner, name: repository.replace(/\.git$/i, '') },
      });
      setLinkProject(''); setGitHubPath('');
      setNotice('Repository connected. Run a sync to import activity.');
      refresh();
    } catch (error) {
      setFailure(failureMessage(error));
    } finally {
      setBusy('');
    }
  }

  async function sync(projectId: string) {
    setBusy(projectId); setFailure(''); setNotice('');
    try {
      const { data } = await api<Resource<GitHubRepository>>({
        url: '/github/repositories/' + projectId + '/sync', method: 'post', timeout: 45_000,
      });
      if (data.syncStatus === 'failed') setFailure(data.syncMessage ?? 'GitHub synchronization failed.');
      else if (data.syncStatus === 'synced' || data.syncStatus === 'partial') {
        setNotice(data.syncMessage ?? (data.syncStatus === 'synced' ? 'GitHub activity synced.' : 'Recent GitHub activity imported.'));
      }
    } catch (error) {
      setFailure(failureMessage(error));
    } finally {
      setBusy(''); refresh();
    }
  }

  return <>
    <PageHeader title="GitHub" description="Connect project repositories and bring commits and pull requests into your development records."
      actions={integration.result.status === 'ready' && <span className="status-pill">
        <span />{integration.result.data.github.authenticated ? 'Token configured' : 'Public repository access'}
      </span>} />
    {failure && <p className="inline-error integration-notice" role="alert">{failure}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="metric-grid secondary-metric-grid">
      <section className="surface metric-panel github-repo">
        <div className="metric-heading"><h2>Connected repositories</h2><GitBranch size={17} /></div>
        {repositories.result.status === 'loading' && <Loading>Loading connections…</Loading>}
        {repositories.result.status === 'error' && <Failure message={repositories.result.error.message} retry={repositories.retry} />}
        {repositories.result.status === 'ready' && !connections.length && <Empty title="No repositories connected." />}
        <ul className="repository-list">
          {connections.map(repo => {
            const external = externalUrl(repo.url);
            const name = repo.owner + '/' + repo.name;
            return <li key={repo.projectId}>
              <div className="repository-heading">
                {external ? <a href={external} target="_blank" rel="noreferrer">{name} <ArrowUpRight size={14} /></a> : <strong>{name}</strong>}
                <span className="status-pill" data-state={repo.syncStatus}><span />{syncLabels[repo.syncStatus]}</span>
              </div>
              <p className="muted">{repo.isPrivate ? 'Private' : 'Public'}{repo.defaultBranch ? ' · ' + repo.defaultBranch : ''}
                {repo.lastSyncAt ? ' · Last successful import ' + displayTimestamp(repo.lastSyncAt) : ''}</p>
              {repo.description && <p>{repo.description}</p>}
              {repo.syncMessage && <p className="muted">{repo.syncMessage}</p>}
              <div className="filter-actions">
                <button type="button" className="button secondary" disabled={!!busy} onClick={() => void sync(repo.projectId)}>
                  <RefreshCw size={15} /> {busy === repo.projectId ? 'Syncing…' : 'Sync now'}</button>
                <Link className="button secondary" to={'/projects/' + repo.projectId}>{projectList.find(project => project.id === repo.projectId)?.name ?? 'Project'}</Link>
                <button type="button" className="icon-button" disabled={!!busy} aria-label={'Disconnect ' + name} onClick={() => setUnlink(repo)}><Unlink size={16} /></button>
              </div>
            </li>;
          })}
        </ul>
      </section>
      <section className="surface metric-panel github-repo">
        <div className="metric-heading"><h2>Connect a repository</h2><Link2 size={17} /></div>
        <form className="form-stack" onSubmit={event => { event.preventDefault(); void connect(); }}>
          <Field label="Project">{bind => <select {...bind} value={linkProject} required onChange={event => setLinkProject(event.target.value)}>
            <option value="">Choose a project</option>{available.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>}</Field>
          <Field label="GitHub repository">{bind => <input {...bind} value={githubPath} placeholder="owner/repository" maxLength={240} required
            onChange={event => setGitHubPath(event.target.value)} />}</Field>
          <button type="submit" className="button primary" disabled={!!busy || !available.length}>{busy === 'connect' ? 'Connecting…' : 'Connect repository'}</button>
          {projects.result.status === 'ready' && !available.length && <p className="muted">Create a project or choose one with no connected repository.</p>}
          {projects.result.status === 'error' && <Failure message={projects.result.error.message} retry={projects.retry} />}
        </form>
      </section>
    </div>
    {isId(activityId) && <ActivityDetail id={activityId} />}
    <section className="surface metric-panel github-activity">
      <div className="metric-heading"><h2>Imported activity</h2></div>
      <div className="form-grid">
        <Field label="Activity project">{bind => <select {...bind} value={selected} onChange={event => setParams({
          ...(event.target.value ? { projectId: event.target.value } : {}), ...(kind ? { kind } : {}),
        })}><option value="">All repositories</option>{connections.map(repo => <option key={repo.projectId} value={repo.projectId}>{repo.owner}/{repo.name}</option>)}</select>}</Field>
        <Field label="Activity type">{bind => <select {...bind} value={kind} onChange={event => setParams({
          ...(selected ? { projectId: selected } : {}), ...(event.target.value ? { kind: event.target.value } : {}),
        })}><option value="">All activity</option><option value="commit">Commits</option><option value="pull_request">Pull requests</option></select>}</Field>
      </div>
      {activity.result.status === 'loading' && <Loading>Loading imported activity…</Loading>}
      {activity.result.status === 'error' && <Failure message={activity.result.error.message} retry={activity.retry} />}
      {activity.result.status === 'ready' && (activity.result.data.data.length
        ? <ul className="repository-list">{activity.result.data.data.map(item => <li key={item.id}><GitHubEntry activity={item} /></li>)}</ul>
        : <p className="quiet-empty">No imported activity matches these filters.</p>)}
      {activity.result.status === 'ready' && <Pagination pagination={{
        offset, limit, hasMore: activity.result.data.pagination.hasMore ?? offset + limit < activity.result.data.pagination.total,
      }} url={value => '/github?' + new URLSearchParams({
        ...(selected ? { projectId: selected } : {}), ...(kind ? { kind } : {}), ...(value ? { offset: String(value) } : {}),
      })} />}
    </section>
    {unlink && <ConfirmDelete title="Disconnect GitHub repository?" message="Imported activity and its links to sessions will be removed from DevTrail."
      action="Disconnect repository" onDismiss={() => setUnlink(undefined)} onConfirm={async () => {
        await api<void>({ url: '/github/repositories/' + unlink.projectId, method: 'delete' });
        setUnlink(undefined); setParams({}); refresh();
      }} />}
  </>;
}
