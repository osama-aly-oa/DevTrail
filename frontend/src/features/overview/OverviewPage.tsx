import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Clock3, Code2, Flame, Flag,
  FolderKanban, ListChecks, Plus, FileText, Target, Zap,
} from 'lucide-react';
import { Link } from 'react-router';
import { isCalendarDate, todayInIstanbul } from '../../shared/domain';
import { Empty, Failure, Field, Loading, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { categories } from '../sessions/api';
import {
  dateLabel, dateRange, formatDuration, groupActivity, listAll, listPage, metrics, presets, shiftDate,
  shortMonth, timelineLink, weekStart,
} from './data';
import type { Breakdown, ChallengeRecord, Dated, EventCount, Metrics, MilestoneRecord, ProjectRecord, SessionRecord } from './data';

const dateLimit = 366;
const number = new Intl.NumberFormat('en');

function Stat({ icon: Icon, label, value, detail, change }: {
  icon: typeof Clock3; label: string; value: string | number; detail?: string; change?: number;
}) {
  return <div className="overview-stat">
    <div className="stat-label"><Icon size={15} aria-hidden="true" />{label}</div>
    <strong>{value}</strong>
    {change !== undefined && change !== 0
      ? <small className={change > 0 ? 'positive' : 'muted'}>{change > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {Math.abs(change).toLocaleString('en')}% vs previous period</small>
      : <small>{detail}</small>}
  </div>;
}

function change(current: number, previous: number | undefined) {
  return previous ? Math.round((current - previous) / previous * 100) : undefined;
}

function Trend({ days, from, to, projectId, count = false, style = 'bars', type }: {
  days: Dated[]; from: string; to: string; projectId?: string; count?: boolean;
  style?: 'bars' | 'area' | 'line'; type?: 'learning' | 'challenge' | 'github';
}) {
  const { grouping, values } = groupActivity(days, from, to);
  const [selected, setSelected] = useState<string>();
  const highest = Math.max(1, ...values.map(day => count ? day.sessions : day.durationMinutes));
  const active = values.find(value => value.date === selected);
  const caption = grouping === 'month' ? 'Monthly' : grouping === 'week' ? 'Weekly' : 'Daily';
  const points = values.map((day, index) => {
    const x = (index + .5) * 600 / values.length;
    const y = 130 - (count ? day.sessions : day.durationMinutes) * 126 / highest;
    return x + ',' + y;
  }).join(' ');
  return <>
    <div className="chart-meta"><span><i />{caption} {count ? 'sessions' : 'development time'}</span>
      <span>{active ? dateLabel(active.date) + ' · ' + (count ? active.sessions : formatDuration(active.durationMinutes)) : dateLabel(from) + ' – ' + dateLabel(to)}</span></div>
    <div className="trend-chart">
      <div className="trend-grid" aria-hidden="true"><span>{count ? highest : formatDuration(highest)}</span><span>{count ? Math.round(highest / 2) : formatDuration(Math.round(highest / 2))}</span><span>0</span></div>
      <div className="trend-columns" data-style={style} aria-label={caption + ' activity'}>
        {style !== 'bars' && <svg className="trend-series" viewBox="0 0 600 132" preserveAspectRatio="none" aria-hidden="true">
          {style === 'area' && <polygon points={'0,132 ' + points + ' 600,132'} />}
          <polyline points={points} vectorEffect="non-scaling-stroke" />
        </svg>}
        {values.map(day => {
          const quantity = count ? day.sessions : day.durationMinutes;
          const rangeEnd = grouping === 'month'
            ? new Date(Date.UTC(Number(day.date.slice(0, 4)), Number(day.date.slice(5, 7)), 0)).toISOString().slice(0, 10)
            : grouping === 'week' ? shiftDate(day.date, 6) : day.date;
          const label = dateLabel(day.date) + ', ' + (count ? day.sessions + ' sessions' : formatDuration(quantity));
          return <Link key={day.date} aria-label={label} title={label}
            to={timelineLink({ from: day.date < from ? from : day.date, to: rangeEnd > to ? to : rangeEnd,
              ...(projectId ? { projectId } : {}), ...(type ? { type } : {}) })}
            onMouseEnter={() => setSelected(day.date)} onMouseLeave={() => setSelected(undefined)}
            onFocus={() => setSelected(day.date)} onBlur={() => setSelected(undefined)}>
            {style === 'bars' && quantity > 0 && <span style={{ height: Math.max(1.5, quantity * 100 / highest) + '%' }} />}
          </Link>;
        })}
      </div>
    </div>
    <div className="chart-labels" aria-hidden="true">{values.filter((_, index) =>
      index % Math.max(1, Math.ceil(values.length / 5)) === 0 || index === values.length - 1).map(day =>
      <span key={day.date}>{dateLabel(day.date, grouping === 'month' ? shortMonth : undefined)}</span>)}</div>
  </>;
}

function Heatmap({ days, to, from, projectId }: { days: Dated[]; to: string; from: string; projectId?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [from, to]);
  const byDay = new Map(days.map(day => [day.date, day]));
  const start = weekStart(from);
  const last = shiftDate(weekStart(to), 6);
  const cells: string[] = [];
  for (let day = start; day <= last; day = shiftDate(day, 1)) cells.push(day);
  const peak = Math.max(1, ...days.map(day => day.sessions));
  const size = String(cells.length / 7);
  return <div ref={scroller} className="heatmap-scroller" tabIndex={0} aria-label="Contribution calendar">
    <div className="heatmap-wrap" style={{ '--weeks': size } as React.CSSProperties}>
      <div className="heatmap-months" aria-hidden="true">{cells.filter((_, index) => index % 7 === 0).map((week, index) =>
        <span key={week}>{(index === 0 ? Number(week.slice(-2)) <= 15 : cells[index * 7 - 7]?.slice(0, 7) !== week.slice(0, 7))
          ? dateLabel(week, shortMonth) : ''}</span>)}</div>
      <div className="heatmap">{cells.map(date => {
        if (date > to || date < from) return <span key={date} className="heat-cell blank" />;
        const sessions = byDay.get(date)?.sessions ?? 0;
        const level = sessions ? Math.max(1, Math.ceil(sessions * 4 / peak)) : 0;
        const label = dateLabel(date) + ', ' + sessions + (sessions === 1 ? ' session' : ' sessions');
        return <Link className="heat-cell" key={date} data-level={level} title={label} aria-label={label}
          to={timelineLink({ from: date, to: date, ...(projectId ? { projectId } : {}) })} />;
      })}</div>
    </div>
  </div>;
}

function Distribution({ rows, type, from, to, projectId }: {
  rows: Breakdown[]; type: 'projectId' | 'technology' | 'category'; from: string; to: string; projectId?: string;
}) {
  const sorted = [...rows].sort((a, b) => b.durationMinutes - a.durationMinutes || b.sessions - a.sessions);
  const peak = Math.max(1, ...sorted.map(row => row.durationMinutes));
  if (!sorted.length) return <p className="quiet-empty">No time in this period.</p>;
  return <ol className="rank-list">
    {sorted.slice(0, 7).map(row => <li key={row.id ?? row.label}>
      {row.label === 'Unspecified' && !row.id ? <div className="rank-entry">
        <span>{row.label}</span><strong>{formatDuration(row.durationMinutes)}</strong>
        <div className="rank-track" aria-hidden="true"><i style={{ width: row.durationMinutes * 100 / peak + '%' }} /></div>
      </div> : <Link to={timelineLink({ from, to, ...(projectId ? { projectId } : {}), [type]: row.id ?? row.label })}>
        <span>{row.label}</span><strong>{formatDuration(row.durationMinutes)}</strong>
        <div className="rank-track" aria-hidden="true"><i style={{ width: row.durationMinutes * 100 / peak + '%' }} /></div>
      </Link>}
    </li>)}
  </ol>;
}

function Panel({ title, detail, children, className = '' }: {
  title: string; detail?: string; children: React.ReactNode; className?: string;
}) {
  return <section className={'surface metric-panel ' + className}>
    <div className="metric-heading"><h2>{title}</h2>{detail && <span>{detail}</span>}</div>{children}
  </section>;
}

function eventsAsDays(days: EventCount[]) {
  return days.map(day => ({ date: day.date, sessions: day.count, durationMinutes: 0 }));
}

function AnalyticsPanels({ data, from, to, projectId, dedicated, technology, category }: {
  data: Metrics; from: string; to: string; projectId?: string; dedicated: boolean; technology?: string; category?: string;
}) {
  const { totals } = data;
  const milestoneTotal = data.milestones.completed + data.milestones.active + data.milestones.planned;
  const completedShare = data.milestones.completed * 100 / Math.max(1, milestoneTotal);
  const activeShare = data.milestones.active * 100 / Math.max(1, milestoneTotal);
  const [metric, setMetric] = useState<'time' | 'sessions'>('time');
  const [distribution, setDistribution] = useState<'projectId' | 'technology' | 'category'>('projectId');
  const distributions = [
    { id: 'projectId', label: 'Projects', rows: data.byProject },
    { id: 'technology', label: 'Technologies', rows: data.byTechnology },
    { id: 'category', label: 'Categories', rows: data.byCategory },
  ] as const;
  const heat = useResource(useCallback((signal: AbortSignal) => metrics({
    from: shiftDate(to, -363), to, projectId, technology, category,
  }, signal), [to, projectId, technology, category]));

  return <>
    <div className="surface overview-stats">
      <Stat icon={Clock3} label="Development time" value={formatDuration(totals.durationMinutes)}
        detail="Finalized sessions" change={change(totals.durationMinutes, data.previous?.durationMinutes)} />
      <Stat icon={ListChecks} label="Sessions" value={number.format(totals.sessions)}
        detail={data.previous ? number.format(data.previous.sessions) + ' in previous period' : 'Finalized sessions'}
        change={change(totals.sessions, data.previous?.sessions)} />
      <Stat icon={FolderKanban} label="Active projects" value={number.format(totals.activeProjects)} detail={totals.completedProjects + ' completed'} />
      <Stat icon={Flame} label="Current streak" value={totals.currentStreak + (totals.currentStreak === 1 ? ' day' : ' days')}
        detail={'Longest · ' + totals.longestStreak + (totals.longestStreak === 1 ? ' day' : ' days')} />
      <Stat icon={Target} label="Challenges solved" value={number.format(totals.challengesSolved)} detail="Resolved in period" />
      <Stat icon={Code2} label="Technologies" value={number.format(totals.technologies)} detail="Practiced in period" />
    </div>
    <div className="metric-grid">
      <Panel title="Development activity" className="metric-wide">
        <div className="metric-controls"><div className="segmented" aria-label="Activity measurement">
          <button type="button" aria-pressed={metric === 'time'} onClick={() => setMetric('time')}>Time</button>
          <button type="button" aria-pressed={metric === 'sessions'} onClick={() => setMetric('sessions')}>Sessions</button>
        </div></div>
        <Trend days={data.days} from={from} to={to} projectId={projectId} count={metric === 'sessions'} style={dedicated ? 'area' : 'bars'} />
      </Panel>
      <Panel title="Time distribution">
        <div className="segmented distribution-controls" aria-label="Time breakdown">
          {distributions.map(item => <button type="button" key={item.id} aria-pressed={distribution === item.id}
            onClick={() => setDistribution(item.id)}>{item.label}</button>)}
        </div>
        <Distribution rows={distributions.find(item => item.id === distribution)?.rows ?? []}
          type={distribution} from={from} to={to} projectId={projectId} />
      </Panel>
    </div>
    <Panel title="Contribution calendar" detail="Past 52 weeks ending on the selected date">
      {heat.result.status === 'ready' && <Heatmap days={heat.result.data.days} from={shiftDate(to, -363)} to={to} projectId={projectId} />}
      {heat.result.status === 'loading' && <div className="metric-skeleton" role="status">Loading contributions…</div>}
      {heat.result.status === 'error' && <Failure message={heat.result.error.message} retry={heat.retry} />}
      <div className="heat-legend"><span>Fewer sessions</span>{[0, 1, 2, 3, 4].map(level => <i className="heat-cell" data-level={level} key={level} />)}<span>More sessions</span></div>
    </Panel>
    {dedicated && <>
      <div className="metric-grid secondary-metric-grid">
        <Panel title="Learning activity" detail="Sessions with learning notes"><Trend days={data.learningDays} from={from} to={to} projectId={projectId} count style="line" type="learning" /></Panel>
        <Panel title="Milestone progress" detail="By recorded milestone status">
          <div className="milestone-progress">
            <div className="milestone-ring" aria-hidden="true"
              style={{ background: 'conic-gradient(var(--color-chart) ' + completedShare + '%, var(--color-heat-one) ' +
                completedShare + '% ' + (completedShare + activeShare) + '%, var(--color-panel) ' + (completedShare + activeShare) + '%)' }}>
              <span>{milestoneTotal}</span>
            </div>
            <div className="milestone-metrics">
            <span><strong>{data.milestones.completed}</strong>Completed</span>
            <span><strong>{data.milestones.active}</strong>Active</span>
            <span><strong>{data.milestones.planned}</strong>Planned</span>
            </div>
          </div>
          <Link className="text-link metric-link" to="/roadmap">View roadmap <ArrowRight size={14} /></Link>
        </Panel>
        <Panel title="Challenges resolved"><Trend days={eventsAsDays(data.challengeDays)} from={from} to={to} projectId={projectId} count type="challenge" /></Panel>
        <Panel title="GitHub activity"><Trend days={eventsAsDays(data.githubDays)} from={from} to={to} projectId={projectId} count style="line" type="github" /></Panel>
      </div>
    </>}
  </>;
}

function OverviewActivity({ from, to, projectId }: { from: string; to: string; projectId?: string }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const [sessions, challenges, milestones, insights] = await Promise.all([
      listPage<SessionRecord>('/sessions', signal, { from, to, projectId, status: 'final', limit: 5 }),
      listPage<ChallengeRecord>('/challenges', signal, { from, to, projectId, status: 'resolved', limit: 4 }),
      listAll<MilestoneRecord>('/milestones', signal, { projectId }),
      listPage<{ id: string; title: string; content: string }>('/insights', signal, { projectId, limit: 1 }),
    ]);
    return { sessions: sessions.data, challenges: challenges.data, milestones, insight: insights.data[0] };
  }, [from, to, projectId]);
  const { result, retry } = useResource(load);
  if (result.status === 'loading') return <Loading>Loading recent work…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  const { sessions, challenges, milestones, insight } = result.data;
  const upcoming = milestones.filter(item => item.status !== 'completed' && item.targetDate && item.targetDate >= todayInIstanbul())
    .sort((a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? '')).slice(0, 4);
  const completed = milestones.filter(item => item.completedDate && item.completedDate >= from && item.completedDate <= to);
  const achievements = [
    ...challenges.map(item => ({ key: 'challenge-' + item.id, to: '/challenges?record=' + item.id, title: item.title,
      date: item.resolvedDate, label: 'Challenge resolved' })),
    ...completed.map(item => ({ key: 'milestone-' + item.id, to: '/roadmap?record=' + item.id, title: item.title,
      date: item.completedDate, label: 'Milestone completed' })),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 4);
  return <div className="metric-grid secondary-metric-grid">
    <Panel title="Recent sessions">
      {sessions.length ? <ul className="activity-rows">{sessions.map(session => <li key={session.id}>
        <Link to={'/sessions/' + session.id}><span className="activity-icon"><ListChecks size={15} /></span>
          <div><strong>{session.title || session.workSummary}</strong><small>{dateLabel(session.sessionDate)}</small></div>
          <small>{session.durationMinutes !== null ? formatDuration(session.durationMinutes) : ''}</small><ArrowUpRight size={14} />
        </Link></li>)}</ul> : <p className="quiet-empty">No finalized sessions in this period.</p>}
      <Link className="text-link metric-link" to="/sessions">All sessions <ArrowRight size={14} /></Link>
    </Panel>
    <Panel title="Upcoming milestones">
      {upcoming.length ? <ul className="activity-rows">{upcoming.map(item => <li key={item.id}>
        <Link to={'/roadmap?record=' + item.id}><span className="activity-icon"><Flag size={15} /></span>
          <div><strong>{item.title}</strong><small>{item.targetDate && dateLabel(item.targetDate)}</small></div><ArrowUpRight size={14} />
        </Link></li>)}</ul> : <p className="quiet-empty">No milestones with upcoming target dates.</p>}
      <Link className="text-link metric-link" to="/roadmap">View roadmap <ArrowRight size={14} /></Link>
    </Panel>
    <Panel title="Recent achievements">
      {achievements.length ? <ul className="activity-rows">{achievements.map(item => <li key={item.key}><Link to={item.to}>
        <span className="activity-icon"><Zap size={15} /></span><div><strong>{item.title}</strong><small>{item.label}{item.date ? ' · ' + dateLabel(item.date) : ''}</small></div><ArrowUpRight size={14} />
      </Link></li>)}</ul> : <p className="quiet-empty">Completed milestones and resolved challenges appear here.</p>}
    </Panel>
    <Panel title="Insights">
      {insight && <div className="overview-insight"><strong>{insight.title}</strong><p>{insight.content.slice(0, 230)}</p></div>}
      {!insight && <p className="quiet-empty">Generate a reflection from your recorded development activity.</p>}
      <Link className="text-link metric-link" to={insight ? '/insights?record=' + insight.id : '/insights'}><FileText size={14} /> Open insights <ArrowRight size={14} /></Link>
    </Panel>
  </div>;
}

export function OverviewPage({ dedicated = false }: { dedicated?: boolean }) {
  const [period, setPeriod] = useState(30);
  const [draft, setDraft] = useState(() => ({ ...dateRange(30), projectId: '', technology: '', category: '' }));
  const [filters, setFilters] = useState(draft);
  const [error, setError] = useState('');
  const params = { ...filters, projectId: filters.projectId || undefined, technology: filters.technology || undefined, category: filters.category || undefined };
  const { from, to, projectId, technology, category } = params;
  const result = useResource(useCallback((signal: AbortSignal) => metrics({ from, to, projectId, technology, category }, signal),
    [from, to, projectId, technology, category]));
  const projects = useResource(useCallback((signal: AbortSignal) => listAll<ProjectRecord>('/projects', signal), []));
  return <>
    <PageHeader title={dedicated ? 'Developer analytics' : 'Overview'}
      description={dedicated ? 'Compare development time, learning activity, and project progress.' : 'Your development activity and progress across projects.'}
      actions={!dedicated && <><Link to="/projects/new" className="button secondary"><Plus size={15} /> New project</Link>
        <Link to="/sessions/new" className="button primary"><Plus size={15} /> Log session</Link></>} />
    <form className="overview-filters" onSubmit={event => {
      event.preventDefault();
      if (!isCalendarDate(draft.from) || !isCalendarDate(draft.to) || draft.to < draft.from ||
          draft.to > todayInIstanbul() || draft.from < shiftDate(draft.to, 1 - dateLimit)) {
        setError('Select an inclusive date range of up to 366 days ending today or earlier.');
        return;
      }
      setError(''); setPeriod(0); setFilters(draft);
    }}>
      <div className="segmented" aria-label="Activity date range">{presets.map(preset => <button type="button" key={preset.days}
        aria-pressed={period === preset.days} onClick={() => {
          const next = { ...draft, ...dateRange(preset.days) };
          setDraft(next); setFilters(next); setPeriod(preset.days); setError('');
        }}>{preset.label}</button>)}</div>
      <details className="filter-popover">
        <summary className="button secondary"><CalendarDays size={15} /> Filter <span className="muted">{dateLabel(from)} – {dateLabel(to)}</span></summary>
        <div className="surface filter-popover-panel">
          <div className="form-grid">
            <Field label="From date">{bind => <input {...bind} type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} />}</Field>
            <Field label="To date">{bind => <input {...bind} type="date" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} />}</Field>
          </div>
          <Field label="Project">{bind => <select {...bind} value={draft.projectId} onChange={event => setDraft({ ...draft, projectId: event.target.value })}>
            <option value="">All projects</option>{projects.result.status === 'ready' && projects.result.data.map(item =>
              <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>}</Field>
          <div className="form-grid">
            <Field label="Technology">{bind => <input {...bind} value={draft.technology} onChange={event => setDraft({ ...draft, technology: event.target.value })} />}</Field>
            <Field label="Activity category">{bind => <select {...bind} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>
              <option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}
            </select>}</Field>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="button primary">Apply filters</button>
        </div>
      </details>
    </form>
    <div className="overview-content">
      {result.result.status === 'loading' && <div className="surface metric-skeleton" role="status">Loading activity…</div>}
      {result.result.status === 'error' && <Failure message={result.result.error.message} retry={result.retry} />}
      {result.result.status === 'ready' && <>
        <AnalyticsPanels data={result.result.data} from={from} to={to} projectId={projectId} technology={technology} category={category} dedicated={dedicated} />
        {!dedicated && <OverviewActivity from={from} to={to} projectId={projectId} />}
        {!result.result.data.totals.sessions && <Empty title="Start with a development session">
          <Link to="/sessions/new" className="button secondary">Log a session</Link>
        </Empty>}
      </>}
    </div>
  </>;
}
