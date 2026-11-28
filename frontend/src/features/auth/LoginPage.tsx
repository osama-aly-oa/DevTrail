import { useState } from 'react';
import type { FormEvent } from 'react';
import { signIn } from '../../app/api';
import { authActions, useAppDispatch } from '../../app/store';
import { containsUnsupportedText } from '../../shared/domain';
import { Field, focusInvalid } from '../../shared/ui';
import { Brand } from '../../app/Brand';

export function LoginPage({ expired }: { expired: boolean }) {
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = username.trim();
    const usernameError = !name ? 'Enter your username.' :
      /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(name) ? undefined : 'Enter a valid owner username.';
    const passwordError = !password ? 'Enter your password.' :
      Array.from(password).length > 256 || containsUnsupportedText(password) ? 'Enter a valid password.' : undefined;
    setErrors({ username: usernameError, password: passwordError });
    setFailure('');
    if (usernameError || passwordError) {
      focusInvalid(event.currentTarget);
      return;
    }

    setBusy(true);
    try {
      const { data } = await signIn({ username: name, password });
      dispatch(authActions.signedIn(data));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-layout">
      <aside className="login-brand">
        <Brand />
        <div className="login-intro">
          <p>Your development journal</p>
          <span>Record what you worked on, what you learned, and where to go next.</span>
        </div>
        <div className="trail-art" aria-hidden="true"><i /><i /><i /><i /></div>
      </aside>
      <section className="login-content" aria-labelledby="login-title">
        <div className="login-form">
          <h1 id="login-title">Sign in</h1>
          <p className="page-description">Access your private DevTrail workspace.</p>
          {expired && <p className="inline-error" role="status">Your session ended. Sign in to continue.</p>}
          <form className="form-stack" onSubmit={event => void submit(event)} noValidate>
            <Field label="Username" error={errors.username}>
              {binding => <input {...binding} autoComplete="username" autoCapitalize="none" spellCheck={false} required
                name="username" value={username} onChange={event => setUsername(event.target.value)} />}
            </Field>
            <Field label="Password" error={errors.password}>
              {binding => <input {...binding} type="password" autoComplete="current-password" required
                name="password" value={password} onChange={event => setPassword(event.target.value)} />}
            </Field>
            {failure && <p className="inline-error" role="alert">{failure}</p>}
            <button type="submit" className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
