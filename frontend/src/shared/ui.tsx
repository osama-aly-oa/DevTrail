import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import type { Page } from './api';
import { maxOffset } from './domain';

export function PageHeader({ title, description, actions, overline }: {
  title: string; description?: string; actions?: ReactNode; overline?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        {overline}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

export function Loading({ children = 'Loading…' }: { children?: ReactNode }) {
  return <p className="state-panel" role="status"><LoaderCircle aria-hidden="true" size={20} /> {children}</p>;
}

export function Failure({ message, retry, children }: { message: string; retry?: () => void; children?: ReactNode }) {
  return (
    <div className="state-panel state-error">
      <p role="alert"><AlertCircle aria-hidden="true" size={19} /> {message}</p>
      {retry && <button className="button secondary" type="button" onClick={retry}>Try again</button>}
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Inbox aria-hidden="true" size={24} /></span>
      <p className="font-semibold">{title}</p>
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

export function Notice() {
  const { state } = useLocation();
  const notice: unknown = state?.notice;
  return typeof notice === 'string' && (
    <p className="notice" role="status"><CheckCircle2 aria-hidden="true" size={18} /> {notice}</p>
  );
}

export function Pagination({ pagination, url }: { pagination: Page<unknown>['pagination']; url: (offset: number) => string }) {
  const { offset, limit, hasMore } = pagination;
  const next = offset + limit;
  if (!offset && !hasMore) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>Page {Math.floor(offset / limit) + 1}</span>
      <div className="flex flex-wrap gap-2">
        {offset > 0 && <Link className="button secondary" to={url(Math.max(0, offset - limit))}>Previous page</Link>}
        {hasMore && next <= maxOffset && <Link className="button secondary" to={url(next)}>Next page</Link>}
      </div>
    </nav>
  );
}

type FieldBinding = { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string };

export function Field({ label, error, optional, children }: {
  label: string; error?: string; optional?: boolean; children: (binding: FieldBinding) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="optional">Optional</span>}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? id + '-error' : undefined })}
      {error && <p id={id + '-error'} className="field-error">{error}</p>}
    </div>
  );
}

export function focusInvalid(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

export function ConfirmDelete({ title, message, action, onDismiss, onConfirm }: {
  title: string; message: string; action: string; onDismiss: () => void; onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Deletion could not be completed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="confirmation"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); if (!busy) onDismiss(); }}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId} className="muted">{message}</p>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="form-actions">
        <button ref={cancel} type="button" className="button secondary" disabled={busy} onClick={onDismiss}>Cancel</button>
        <button type="button" className="button danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Deleting…' : action}</button>
      </div>
    </dialog>
  );
}
