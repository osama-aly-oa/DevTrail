import { useState } from 'react';
import { Download, GitBranch, Laptop, Moon, Sun, UserRound } from 'lucide-react';
import { api } from '../../app/api';
import { useAppSelector } from '../../app/store';
import type { Resource } from '../../shared/api';
import { readTheme, usePreference } from '../../shared/preferences';
import { Failure, Loading, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { listAll } from '../overview/data';
import { getIntegrationStatus } from '../github/api';
import type { GitHubRepository } from '../github/api';
import { failureMessage } from '../v2/format';
import { downloadFile } from './download';

const themes = [{ key: 'light', label: 'Light', icon: Sun }, { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Laptop }] as const;

const collections = [
  ['projects', '/projects'], ['sessions', '/sessions'], ['learningGoals', '/learning-goals'],
  ['challenges', '/challenges'], ['milestones', '/milestones'], ['insights', '/insights'],
  ['reports', '/reports'], ['reflections', '/reflections'], ['githubActivity', '/github/activity'],
] as const;

export function SettingsPage() {
  const auth = useAppSelector(state => state.auth);
  const [theme, setTheme] = usePreference('theme', readTheme);
  const integration = useResource(getIntegrationStatus);
  const [exporting, setExporting] = useState(false);
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState(false);

  async function exportData() {
    setExporting(true); setFailure(''); setSuccess(false);
    try {
      const [records, repositories] = await Promise.all([
        Promise.all(collections.map(async ([key, route]) => [key, await listAll(route)])),
        api<Resource<GitHubRepository[]>>({ url: '/github/repositories' }),
      ]);
      const exportedAt = new Date().toISOString();
      const bundle = { version: 2, exportedAt, ...Object.fromEntries(records), githubRepositories: repositories.data };
      downloadFile('devtrail-' + exportedAt.slice(0, 10) + '.json', JSON.stringify(bundle, null, 2), 'application/json');
      setSuccess(true);
    } catch (error) {
      setFailure(failureMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return <>
    <PageHeader title="Settings" description="Manage workspace appearance, integration status, and data export." />
    <div className="settings-layout">
      <section className="surface settings-section">
        <div><h2>Owner account</h2><p>The account used to access this workspace.</p></div>
        <div className="settings-account"><span className="activity-icon"><UserRound size={17} /></span>
          <strong>{auth.status === 'signedIn' ? auth.session.owner.username : 'Owner'}</strong></div>
      </section>
      <section className="surface settings-section">
        <div><h2>Appearance</h2><p>Choose the theme for this browser.</p></div>
        <div className="theme-choices" aria-label="Color theme">
          {themes.map(({ key, label, icon: Icon }) => <button type="button" key={key} className="button secondary"
            aria-pressed={theme === key} onClick={() => setTheme(key)}><Icon size={17} />{label}</button>)}
        </div>
      </section>
      <section className="surface settings-section">
        <div><h2>Integrations</h2><p>Server configuration for the GitHub connection.</p></div>
        {integration.result.status === 'loading' && <Loading>Checking configuration…</Loading>}
        {integration.result.status === 'error' && <Failure message={integration.result.error.message} retry={integration.retry} />}
        {integration.result.status === 'ready' && <div className="integration-status-list">
          <span><GitBranch size={16} /><strong>GitHub</strong><small>{integration.result.data.github.authenticated ? 'Token configured' : 'Public access only'}</small></span>
        </div>}
      </section>
      <section className="surface settings-section">
        <div><h2>Export workspace data</h2><p>Download records and integration metadata as JSON. Attachments can be downloaded from the related session.</p></div>
        <div>
          <button type="button" className="button secondary" disabled={exporting} onClick={() => void exportData()}><Download size={15} />
            {exporting ? 'Preparing export…' : 'Download JSON'}</button>
          {failure && <p className="inline-error" role="alert">{failure}</p>}
          {success && <p className="muted" role="status">Export ready.</p>}
        </div>
      </section>
    </div>
  </>;
}
