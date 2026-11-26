import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../shared/api';
import { isId, optionalText, textError } from '../../shared/domain';
import { Failure, Field, focusInvalid, Loading, PageHeader } from '../../shared/ui';
import { useResource } from '../../shared/useResource';
import { getProject, saveProject } from './api';
import type { Project } from './api';

function ProjectForm({ project }: { project?: Project }) {
  const navigate = useNavigate();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const returnUrl = project ? '/projects/' + project.id : '/projects';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const nameError = textError(name, 'Project name', 120, true);
    const descriptionError = textError(description, 'Description', 2_000);
    setErrors({ name: nameError, description: descriptionError });
    setFailure('');
    if (nameError || descriptionError) {
      focusInvalid(form);
      return;
    }

    setBusy(true);
    try {
      const saved = await saveProject({ name: name.trim(), description: optionalText(description) }, project?.id);
      if (form.isConnected) {
        void navigate('/projects/' + saved.id, {
          replace: true, state: { notice: project ? 'Project updated.' : 'Project created.' },
        });
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PROJECT_NAME_TAKEN') {
        setErrors({ name: error.message });
        focusInvalid(form);
      } else {
        setFailure(error instanceof Error ? error.message : 'The project could not be saved. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="surface form-panel form-stack" onSubmit={event => void submit(event)} noValidate>
      <Field label="Project name" error={errors.name}>
        {binding => <input {...binding} name="name" required value={name} onChange={event => setName(event.target.value)} />}
      </Field>
      <Field label="Description" error={errors.description} optional>
        {binding => <textarea {...binding} name="description" rows={5} value={description}
          onChange={event => setDescription(event.target.value)} />}
      </Field>
      {failure && <p className="inline-error" role="alert">{failure}</p>}
      <div className="form-actions">
        <Link className="button secondary" to={returnUrl}>Cancel</Link>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </button>
      </div>
    </form>
  );
}

export function NewProjectPage() {
  return (
    <>
      <PageHeader title="New project" description="Create a project to group your development sessions."
        overline={<Link className="back-link" to="/projects">Projects</Link>} />
      <ProjectForm />
    </>
  );
}

export function EditProjectPage() {
  const { projectId = '' } = useParams();
  const load = useCallback((signal: AbortSignal) => {
    if (!isId(projectId)) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Project not found.'));
    return getProject(projectId, signal);
  }, [projectId]);
  const { result, retry } = useResource(load);

  return (
    <>
      <PageHeader title="Edit project" overline={<Link className="back-link" to="/projects">Projects</Link>} />
      {result.status === 'loading' && <Loading>Loading project…</Loading>}
      {result.status === 'error' && <Failure message={result.error.message}
        retry={result.error.status === 404 ? undefined : retry} />}
      {result.status === 'ready' && <ProjectForm key={result.data.id} project={result.data} />}
    </>
  );
}
