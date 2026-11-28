import { useCallback, useState } from 'react';
import { ArrowUpRight, FileText, GitFork, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../shared/api';
import { displayTimestamp, isId } from '../../shared/domain';
import { ConfirmDelete, Empty, Failure, Field, Loading, Notice, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { ChallengeWorkspace, LearningPractice, LearningWorkspace, MilestoneWorkspace } from '../growth/GrowthPages';
import { dateRange, formatDuration, listPage, metrics } from '../overview/data';
import type { Breakdown } from '../overview/data';
import { SessionHistory } from '../sessions/SessionHistory';
import { getGitHubActivity, getGitHubRepository } from '../github/api';
import { GitHubActivityLinks } from '../github/GitHubPicker';
import { externalUrl } from '../v2/format';
import { Markdown } from '../v2/Markdown';
import { deleteProject, getProject, projectStatuses } from './api';
import type { Project } from './api';
import '../v2/features.css';

const tabs = {
  journey: 'Journey', analytics: 'Analytics', milestones: 'Roadmap', challenges: 'Challenges',
  learning: 'Learning outcomes', github: 'GitHub', insights: 'Insights',
} as const;

function ProjectSummary({ project, onDelete }: { project: Project; onDelete: () => void }) {
  const load = useCallback((signal: AbortSignal) => metrics({ projectId: project.id }, signal), [project.id]);
  const { result, retry } = useResource(load);
  const repository = project.repositoryUrl && externalUrl(project.repositoryUrl);
  const milestoneCounts = result.status === 'ready' ? result.data.milestones : undefined;
  const milestoneTotal = milestoneCounts ? milestoneCounts.planned + milestoneCounts.active + milestoneCounts.completed : 0;
  return <section className="v2-feature-panel v2-project-overview" aria-label="Project overview">
    <div className="v2-project-summary-head">
      <div className="v2-chips">
        {project.status && <span className={'v2-chip ' + (project.status === 'completed' ? 'v2-chip-positive' : 'v2-chip-accent')}>
          {projectStatuses[project.status]}</span>}
        <span className="v2-chip">Created {displayTimestamp(project.createdAt)}</span>
      </div>
      {repository && <a className="text-link v2-inline-link" href={repository} target="_blank" rel="noreferrer">
        <GitFork size={15} aria-hidden="true" /> Repository <ArrowUpRight size={13} aria-hidden="true" /></a>}
    </div>
    {project.description && <Markdown text={project.description} />}
    {Boolean(project.technologies?.length) && <div className="v2-chips" aria-label="Technology stack">
      {project.technologies?.map(technology => <span className="v2-chip" key={technology}>{technology}</span>)}
    </div>}
    {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
    {result.status === 'ready' && <div className="v2-metric-strip">
      <div><strong>{formatDuration(result.data.totals.durationMinutes)}</strong><span>Recorded development time</span></div>
      <div><strong>{result.data.totals.sessions}</strong><span>Finalized sessions</span></div>
      <div><strong>{milestoneCounts?.completed ?? 0} / {milestoneTotal}</strong><span>Milestones completed</span>
        {milestoneTotal > 0 && <progress value={milestoneCounts?.completed ?? 0} max={milestoneTotal} aria-label="Milestones completed" />}
      </div>
    </div>}
    <div className="v2-project-summary-foot">
      <Link className="text-link v2-inline-link" to={'/timeline?projectId=' + project.id}>View on timeline <ArrowUpRight size={14} aria-hidden="true" /></Link>
      <button type="button" className="button danger-outline" onClick={onDelete}>
        <Trash2 aria-hidden="true" size={16} /> Delete project
      </button>
    </div>
  </section>;
}

function ActivityBreakdown({ title, rows, projectId, filter }: {
  title: string; rows: Breakdown[]; projectId: string; filter: 'technology' | 'category';
}) {
  const scale = Math.max(1, ...rows.map(row => row.durationMinutes));
  return <section className="v2-feature-panel v2-project-breakdown">
    <h3>{title}</h3>
    {!rows.length && <p className="v2-help">Nothing recorded for this range.</p>}
    {rows.map(row => <div className="v2-bar-row" key={row.label}>
      {row.label === 'Unspecified' ? <span>{row.label}</span> : <Link className="text-link" to={'/sessions?' +
        new URLSearchParams({ projectId, [filter]: row.label, status: 'final' })}>{row.label}</Link>}
      <span aria-hidden="true"><i style={{ width: (row.durationMinutes / scale * 100) + '%' }} /></span>
      <strong>{formatDuration(row.durationMinutes)}</strong>
    </div>)}
  </section>;
}

function ProjectAnalytics({ projectId }: { projectId: string }) {
  const [period, setPeriod] = useState('all');
  const load = useCallback((signal: AbortSignal) => metrics({
    projectId, ...(period === 'all' ? {} : dateRange(Number(period))),
  }, signal), [projectId, period]);
  const { result, retry } = useResource(load);
  return <section className="v2-page-sections">
    <div className="v2-growth-toolbar">
      <Field label="Activity period">
        {binding => <select {...binding} value={period} onChange={event => setPeriod(event.target.value)}>
          <option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option>
          <option value="365">Last 365 days</option>
        </select>}
      </Field>
    </div>
    {result.status === 'loading' && <Loading>Loading project analytics…</Loading>}
    {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
    {result.status === 'ready' && <>
      <div className="v2-metric-strip">
        <div><strong>{formatDuration(result.data.totals.durationMinutes)}</strong><span>Recorded development time</span></div>
        <div><strong>{result.data.totals.sessions}</strong><span>Finalized sessions</span></div>
        <div><strong>{result.data.totals.challengesSolved}</strong><span>Challenges solved</span></div>
      </div>
      <div className="v2-project-breakdowns">
        <ActivityBreakdown title="Time by technology" rows={result.data.byTechnology} projectId={projectId} filter="technology" />
        <ActivityBreakdown title="Time by activity" rows={result.data.byCategory} projectId={projectId} filter="category" />
      </div>
    </>}
  </section>;
}

function ProjectGitHub({ projectId }: { projectId: string }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const repo = await getGitHubRepository(projectId, signal);
    const entries = repo ? (await getGitHubActivity(projectId, signal, 0, 12)).data : [];
    return { repo, entries };
  }, [projectId]);
  const { result, retry } = useResource(load);
  if (result.status === 'loading') return <Loading>Loading GitHub activity…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  const { repo, entries } = result.data;
  if (!repo) return <Empty title="This project has no connected GitHub repository.">
    <Link className="button primary" to={'/github?projectId=' + projectId}>Connect a repository</Link>
  </Empty>;
  const url = externalUrl(repo.url);
  return <section className="v2-feature-panel form-stack">
    <h2 className="v2-panel-title"><GitFork size={19} aria-hidden="true" /> {repo.owner}/{repo.name}</h2>
    {repo.description && <p>{repo.description}</p>}
    <p className="v2-help">{repo.lastSyncAt ? 'Last successful sync ' + displayTimestamp(repo.lastSyncAt) : 'Never synchronized successfully'}
      {' · '}{repo.syncStatus}</p>
    {repo.syncMessage && <p className="v2-feature-notice">{repo.syncMessage}</p>}
    <div className="v2-row-actions">
      {url && <a className="button secondary" href={url} target="_blank" rel="noreferrer">Open repository <ArrowUpRight size={14} aria-hidden="true" /></a>}
      <Link className="button secondary" to={'/github?projectId=' + projectId}>Manage synchronization</Link>
    </div>
    {entries.length > 0 ? <GitHubActivityLinks entries={entries} /> : <p className="v2-help">There is no imported activity available.</p>}
  </section>;
}

function ProjectInsights({ projectId }: { projectId: string }) {
  const load = useCallback((signal: AbortSignal) => listPage<{ id: string; title: string; updatedAt: string }>(
    '/insights', signal, { projectId, limit: 8 }), [projectId]);
  const { result, retry } = useResource(load);
  return <section className="v2-feature-panel form-stack">
    <h2 className="v2-panel-title"><FileText size={19} aria-hidden="true" /> Project insights</h2>
    <div className="v2-row-actions">
      <Link className="button primary" to={'/insights?projectId=' + projectId}>Open insights workspace</Link>
      <Link className="button secondary" to={'/reports?projectId=' + projectId}>Create a project report</Link>
    </div>
    {result.status === 'loading' && <Loading>Loading saved insights…</Loading>}
    {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
    {result.status === 'ready' && (result.data.data.length
      ? <ul className="v2-record-list">{result.data.data.map(insight => <li key={insight.id}>
        <Link className="text-link" to={'/insights?record=' + insight.id}>{insight.title}</Link>
        <small>{displayTimestamp(insight.updatedAt)}</small>
      </li>)}</ul>
      : <p className="v2-help">No insights have been saved for this project.</p>)}
  </section>;
}

function ProjectDetail({ project }: { project: Project }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const requested = search.get('tab') ?? '';
  const tab = Object.hasOwn(tabs, requested) ? requested as keyof typeof tabs : 'journey';
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
      <nav className="v2-project-tabs" aria-label="Project workspace">
        {Object.entries(tabs).map(([key, label]) => <Link key={key} to={key === 'journey' ? path : path + '?tab=' + key}
          aria-current={tab === key ? 'page' : undefined}>{label}</Link>)}
      </nav>
      {tab === 'journey' && <>
        <ProjectSummary project={project} onDelete={() => setConfirming(true)} />
        <section aria-labelledby="journey-heading" className="journey">
          <h2 id="journey-heading" className="section-heading">Project Journey Review</h2>
          <SessionHistory project={project} />
        </section>
      </>}
      {tab === 'analytics' && <ProjectAnalytics projectId={project.id} />}
      {tab === 'milestones' && <MilestoneWorkspace projectId={project.id} />}
      {tab === 'challenges' && <ChallengeWorkspace projectId={project.id} />}
      {tab === 'learning' && <div className="v2-page-sections">
        <LearningPractice projectId={project.id} />
        <section><h2 className="section-heading">Learning goals</h2><LearningWorkspace projectId={project.id} /></section>
      </div>}
      {tab === 'github' && <ProjectGitHub projectId={project.id} />}
      {tab === 'insights' && <ProjectInsights projectId={project.id} />}
      {confirming && <ConfirmDelete title="Delete project?" action="Delete project"
        message={'Permanently delete “' + project.name + '”? Remove its sessions, milestones, and challenges first.'}
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
