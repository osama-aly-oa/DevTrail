import { useCallback, useState } from 'react';
import { Download, GitFork, Paperclip, Plus, Trash2 } from 'lucide-react';
import { api } from '../../app/api';
import type { Resource } from '../../shared/api';
import { ConfirmDelete, Failure, Field, Loading } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getSessionActivity, setSessionActivity } from '../github/api';
import { GitHubActivityLinks, GitHubPicker } from '../github/GitHubPicker';
import { failureMessage } from '../v2/format';

type Attachment = { id: string; name: string; mediaType: string; size: number; createdAt: string };
const fileTypes: Record<string, string> = {
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', csv: 'text/csv', json: 'application/json',
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
};

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' && reader.result.split(',', 2)[1];
      if (result) resolve(result);
      else reject(new Error('Could not read the selected file.'));
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function Attachments({ sessionId }: { sessionId: string }) {
  const url = '/sessions/' + sessionId + '/attachments';
  const load = useCallback(async (signal: AbortSignal) => (await api<Resource<Attachment[]>>({ url, signal })).data, [url]);
  const { result, retry } = useResource(load);
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<Attachment>();

  async function upload(form: HTMLFormElement) {
    if (!file || busy) return;
    const suffix = file.name.toLowerCase().split('.').at(-1) ?? '';
    const mediaType = Object.hasOwn(fileTypes, suffix) ? fileTypes[suffix] : undefined;
    if (!mediaType || file.size > 160 * 1024 || !file.size) {
      setError('Choose a supported file between 1 byte and 160 KiB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const content = await readBase64(file);
      await api<Resource<Attachment>>({ url, method: 'post', data: { name: file.name, mediaType, content } });
      form.reset();
      setFile(undefined);
      retry();
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <p className="v2-help">Up to five attachments. PDF, PNG, JPEG, JSON, CSV, Markdown and plain text, up to 160 KiB each.</p>
    {result.status === 'loading' && <Loading>Loading attachments…</Loading>}
    {result.status === 'error' && <Failure message={result.error.message} retry={retry} />}
    {result.status === 'ready' && <>
      {result.data.length > 0 && <ul className="v2-record-list">
        {result.data.map(item => <li className="v2-evidence-row" key={item.id}>
          <a className="v2-inline-link text-link" href={'/api/v1' + url + '/' + item.id} download={item.name}>
            <Download size={16} aria-hidden="true" /> {item.name}</a>
          <span className="v2-help">{Math.ceil(item.size / 1024)} KiB</span>
          <button type="button" className="button danger-outline v2-icon-action" aria-label={'Delete ' + item.name}
            onClick={() => setConfirming(item)}><Trash2 size={15} aria-hidden="true" /></button>
        </li>)}
      </ul>}
      {result.data.length < 5 && <form className="v2-evidence-upload" onSubmit={event => {
        event.preventDefault();
        void upload(event.currentTarget);
      }}>
        <Field label="Select file">
          {binding => <input {...binding} type="file" accept={Object.keys(fileTypes).map(ext => '.' + ext).join(',')}
            onChange={event => { setError(''); setFile(event.target.files?.[0]); }} />}
        </Field>
        <button type="submit" className="button secondary" disabled={!file || busy}>
          <Plus size={16} aria-hidden="true" /> {busy ? 'Uploading…' : 'Add attachment'}
        </button>
      </form>}
    </>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {confirming && <ConfirmDelete title="Delete attachment?" message={'Permanently delete ' + confirming.name + '?'}
      action="Delete attachment" onDismiss={() => setConfirming(undefined)} onConfirm={async () => {
        await api<void>({ url: url + '/' + confirming.id, method: 'delete' });
        setConfirming(undefined);
        retry();
      }} />}
  </>;
}

function LinkedActivity({ sessionId, projectId }: { sessionId: string; projectId: string }) {
  const load = useCallback((signal: AbortSignal) => getSessionActivity(sessionId, signal), [sessionId]);
  const { result, retry } = useResource(load);
  const [selection, setSelection] = useState<string[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!selection || busy) return;
    setBusy(true);
    setError('');
    try {
      await setSessionActivity(sessionId, selection);
      setSelection(undefined);
      retry();
    } catch (failure) {
      setError(failureMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (result.status === 'loading') return <Loading>Loading links…</Loading>;
  if (result.status === 'error') return <Failure message={result.error.message} retry={retry} />;
  if (selection) return <>
    <GitHubPicker projectId={projectId} selected={selection} onChange={setSelection} max={50} />
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="v2-row-actions">
      <button type="button" className="button secondary" disabled={busy}
        onClick={() => { setSelection(undefined); setError(''); }}>Cancel</button>
      <button type="button" className="button primary" disabled={busy}
        onClick={() => void save()}>{busy ? 'Saving…' : 'Save links'}</button>
    </div>
  </>;
  return <>
    {result.data.length ? <GitHubActivityLinks entries={result.data} /> : <p className="v2-help">No commits or pull requests linked.</p>}
    <button className="button secondary" type="button" onClick={() => setSelection(result.data.map(item => item.id))}>
      Manage links
    </button>
  </>;
}

export function SessionEvidence({ sessionId, projectId }: { sessionId: string; projectId: string }) {
  const [showAttachments, setShowAttachments] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  return <aside className="v2-session-evidence" aria-label="Session evidence">
    <details className="v2-feature-panel v2-collapsible" onToggle={event => {
      if (event.currentTarget.open) setShowAttachments(true);
    }}>
      <summary><Paperclip size={17} aria-hidden="true" /> Attachments</summary>
      {showAttachments && <Attachments sessionId={sessionId} />}
    </details>
    <details className="v2-feature-panel v2-collapsible" onToggle={event => {
      if (event.currentTarget.open) setShowActivity(true);
    }}>
      <summary><GitFork size={17} aria-hidden="true" /> Linked GitHub activity</summary>
      {showActivity && <LinkedActivity sessionId={sessionId} projectId={projectId} />}
    </details>
  </aside>;
}
