import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { adminSignIn } from '@/lib/api';

/**
 * The gate in front of the applicant list.
 *
 * This is a real boundary, not a UI nicety: everything behind it is candidates'
 * names, emails, phone numbers and CVs. The check that matters happens on the
 * server — every admin request carries a bearer token and is refused without
 * one — so this component's only job is to obtain that token and hand it over.
 * Hiding the page without the server check would protect nothing.
 *
 * Cloudflare Access is meant to replace this. When it does, this file goes and
 * the rest of the dashboard does not change.
 */
export function AdminSignIn({ onSignedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    try {
      const result = await adminSignIn(username.trim(), password);
      onSignedIn(result.email);
    } catch (failure) {
      // The server deliberately gives one message for a wrong username and a
      // wrong password alike. Passing it through keeps that property.
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-lav-soft px-5 py-10">
      <Card className="w-full max-w-sm animate-pop-in motion-reduce:animate-none">
        <div className="mb-5 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-lav text-violet-deep"
          >
            <Icon name="shield" size={20} />
          </span>
          <h1 className="mt-3 text-[1.25rem] font-bold text-ink">Recruitment dashboard</h1>
          <p className="mt-1 text-[0.86rem] text-muted">
            Sign in with your Fast Action Claims manager account.
          </p>
        </div>

        <form onSubmit={submit} noValidate className="grid gap-4">
          {/* Focusable and announced, so the failure reaches a screen reader
              rather than only appearing on screen. */}
          {error ? (
            <p
              role="alert"
              tabIndex={-1}
              className="rounded-panel border border-danger/30 bg-red-50 px-3.5 py-2.5 text-[0.85rem] font-medium text-danger"
            >
              {error}
            </p>
          ) : null}

          <Field label="Username or email" required>
            {(props) => (
              <TextInput
                {...props}
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            )}
          </Field>

          <Field label="Password" required>
            {(props) => (
              <TextInput
                {...props}
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>

          <Button type="submit" disabled={busy || !username.trim() || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-[0.78rem] leading-relaxed text-muted">
          This page holds candidates&rsquo; personal data. Do not share your sign-in — every
          decision is recorded against the person who made it.
        </p>
      </Card>
    </div>
  );
}

export default AdminSignIn;
