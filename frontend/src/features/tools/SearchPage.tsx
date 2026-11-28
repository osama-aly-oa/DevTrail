import { useCallback, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Code2, FileText, Flag, FolderKanban, GitBranch, ListChecks, Search, Target } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../app/api';
import type { Resource } from '../../shared/api';
import { Empty, Failure, Loading, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { externalUrl } from '../v2/format';

const groups = {
  projects: { label: 'Projects', icon: FolderKanban },
  sessions: { label: 'Development sessions', icon: ListChecks },
  learning: { label: 'Learning notes and goals', icon: BookOpen },
  technologies: { label: 'Technologies', icon: Code2 },
  challenges: { label: 'Challenges and solutions', icon: Target },
  milestones: { label: 'Milestones', icon: Flag },
  reports: { label: 'Reports', icon: FileText },
  github: { label: 'GitHub activity', icon: GitBranch },
};
type Group = keyof typeof groups;
const groupKeys = Object.keys(groups) as Group[];
type Match = { id: string; title: string; excerpt: string | null; projectId?: string; url?: string };

function SearchResults({ query, type }: { query: string; type?: Group }) {
  const resultsRef = useRef<HTMLDivElement>(null);
  const { result, retry } = useResource(useCallback(async (signal: AbortSignal) =>
    (await api<Resource<Record<Group, Match[]>>>({ url: '/search', signal, params: { q: query, type } })).data, [query, type]));
  if (result.status === 'loading') return <Loading>Searching records…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  const matches = groupKeys.flatMap(group => result.data[group]?.length ? [{ group, items: result.data[group] }] : []);
  if (!matches.length) return <Empty title="No records match this search." />;
  return <div ref={resultsRef} className="search-results" onKeyDown={event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const links = [...(resultsRef.current?.querySelectorAll('a') ?? [])];
    const active = links.indexOf(document.activeElement as HTMLAnchorElement);
    const target = links[(active + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length];
    if (target) { event.preventDefault(); target.focus(); }
  }}>
    {matches.map(({ group, items }) => {
      const { label, icon: Icon } = groups[group];
      return <section className="surface search-group" key={group}>
        <div className="metric-heading"><h2><Icon size={17} aria-hidden="true" /> {label}</h2></div>
        <ul>{items.map(item => {
          const fallback = group === 'projects' || group === 'sessions' ? '/' + group + '/' + item.id : '/' + group + '?record=' + item.id;
          const to = group === 'github' ? '/github?activity=' + item.id : item.url ?? fallback;
          const external = externalUrl(to);
          const content = <><div><strong>{item.title}</strong>{item.excerpt && <small>{item.excerpt}</small>}</div><ArrowUpRight size={15} /></>;
          return <li key={item.id}>{external
            ? <a href={external} rel="noreferrer" target="_blank">{content}</a>
            : <Link to={to}>{content}</Link>}</li>;
        })}</ul>
      </section>;
    })}
  </div>;
}

function SearchForm({ query, type, onSearch }: { query: string; type: string; onSearch: (value: string, group: string) => void }) {
  const [value, setValue] = useState(query);
  const [group, setGroup] = useState(type);
  return <form className="surface search-form" onSubmit={event => { event.preventDefault(); onSearch(value.trim(), group); }}>
    <label className="search-input"><Search size={18} aria-hidden="true" />
      <input type="search" aria-label="Search DevTrail records" placeholder="Search by title, notes, or technology" value={value}
        maxLength={100} onChange={event => setValue(event.target.value)} /></label>
    <select aria-label="Record type" value={group} onChange={event => setGroup(event.target.value)}>
      <option value="">All record types</option>
      {groupKeys.map(key => <option key={key} value={key}>{groups[key].label}</option>)}
    </select>
    <button className="button primary">Search</button>
  </form>;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const type = (params.get('type') ?? '') as Group;
  return <>
    <PageHeader title="Global search" description="Find engineering notes and related records across your workspace." />
    <SearchForm key={query + '|' + type} query={query} type={Object.hasOwn(groups, type) ? type : ''} onSearch={(q, group) =>
      setParams({ ...(q ? { q } : {}), ...(group ? { type: group } : {}) })} />
    {query ? <SearchResults query={query} type={Object.hasOwn(groups, type) ? type : undefined} />
      : <Empty title="Enter a search term to find your work." />}
  </>;
}
