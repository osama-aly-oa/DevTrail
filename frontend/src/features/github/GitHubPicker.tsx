import { useCallback, useState } from 'react';
import { GitCommit, GitPullRequest } from 'lucide-react';
import { displayTimestamp } from '../../shared/domain';
import { Failure, Loading } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getGitHubActivity } from './api';
import type { GitHubActivity } from './api';
import { externalUrl } from '../v2/format';

export function GitHubActivityLabel({ entry }: { entry: GitHubActivity }) {
  const Icon = entry.kind === 'commit' ? GitCommit : GitPullRequest;
  return <span className="v2-activity-label">
    <Icon aria-hidden="true" size={16} />
    <span><strong dir="auto">{entry.title}</strong><small>
      {entry.kind === 'commit' ? 'Commit' : 'Pull request'} · {displayTimestamp(entry.occurredAt)}
      {entry.author && ' · ' + entry.author}
    </small></span>
  </span>;
}

export function GitHubActivityLinks({ entries }: { entries: GitHubActivity[] }) {
  return <ul className="v2-record-list">{entries.map(entry => {
    const href = externalUrl(entry.url);
    return <li key={entry.id}>
      {href
        ? <a href={href} target="_blank" rel="noreferrer"><GitHubActivityLabel entry={entry} /></a>
        : <GitHubActivityLabel entry={entry} />}
    </li>;
  })}</ul>;
}

export function GitHubPicker({ projectId, selected, onChange, max = 10 }: {
  projectId: string; selected: string[]; onChange: (selected: string[]) => void; max?: number;
}) {
  const [offset, setOffset] = useState(0);
  const load = useCallback((signal: AbortSignal) => getGitHubActivity(projectId, signal, offset, 8), [projectId, offset]);
  const { result, retry } = useResource(load);
  if (result.status === 'loading') return <Loading>Loading synchronized activity…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  const { data, pagination } = result.data;
  if (!data.length) return <p className="v2-help">No synchronized GitHub activity is available for this project.</p>;
  return <>
    <p className="v2-help" aria-live="polite">{selected.length} of {max} selected</p>
    <div className="v2-source-picker">{data.map(entry => <label key={entry.id}>
      <input type="checkbox" checked={selected.includes(entry.id)} disabled={!selected.includes(entry.id) && selected.length >= max}
        onChange={event => onChange(event.target.checked ? [...selected, entry.id] : selected.filter(id => id !== entry.id))} />
      <GitHubActivityLabel entry={entry} />
    </label>)}</div>
    {(offset > 0 || offset + pagination.limit < pagination.total) && <div className="v2-row-actions">
      <button className="button secondary" type="button" disabled={offset === 0}
        onClick={() => setOffset(previous => Math.max(0, previous - pagination.limit))}>Previous</button>
      <button className="button secondary" type="button" disabled={offset + pagination.limit >= pagination.total}
        onClick={() => setOffset(previous => previous + pagination.limit)}>Next</button>
    </div>}
  </>;
}
