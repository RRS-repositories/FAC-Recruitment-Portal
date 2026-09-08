import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import {
  adminAddTeamMember,
  adminChangePassword,
  adminTeam,
  adminUpdateTeamMember,
} from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Who can sign in, and what each of them may do. Spec §8.1.
 *
 * Until this existed, adding a colleague meant server access, a hash generated
 * by hand and a restart — and removing one meant the same. With one manager
 * that was tolerable. With three it is the difference between a portal a firm
 * can run and one that needs a developer every time somebody joins.
 *
 * Two roles, and the line is drawn where the damage is: a reviewer works with
 * candidates, an administrator can also change how the portal behaves. Someone
 * hired to screen CVs should not also be able to switch the public pages off.
 */

const ROLE_COPY = {
  reviewer: {
    label: 'Reviewer',
    blurb: 'Applications, decisions, CVs, the calendar and attendance.',
  },
  administrator: {
    label: 'Administrator',
    blurb: 'All of that, plus settings, what is switched on, retention and this team.',
  },
};

/** The two panels below both sit on the settings screen. */
export function TeamPanel({ you, onError }) {
  const [team, setTeam] = useState(null);
  const [bootstrap, setBootstrap] = useState(false);
  const [busy, setBusy] = useState('');
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState('');
  const [reset, setReset] = useState(null);

  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: 'reviewer',
  });
  const [newPassword, setNewPassword] = useState('');

  const announce = (message) => {
    setSaved(message);
    setTimeout(() => setSaved(''), 4000);
  };

  const load = useCallback(async () => {
    try {
      const result = await adminTeam();
      setTeam(result.admins);
      setBootstrap(result.bootstrap);
    } catch (failure) {
      onError?.(failure.message);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setBusy('add');
    try {
      await adminAddTeamMember(form);
      announce(`${form.username} can now sign in.`);
      setForm({ username: '', email: '', fullName: '', password: '', role: 'reviewer' });
      setAdding(false);
      await load();
    } catch (failure) {
      onError?.(failure.message);
    } finally {
      setBusy('');
    }
  };

  const update = async (id, body, message) => {
    setBusy(`row-${id}`);
    try {
      await adminUpdateTeamMember(id, body);
      announce(message);
      await load();
    } catch (failure) {
      onError?.(failure.message);
    } finally {
      setBusy('');
    }
  };

  const setSomeonesPassword = async () => {
    setBusy('reset');
    try {
      await adminUpdateTeamMember(reset.id, { password: newPassword });
      announce(`${reset.username} has a new password. Tell them what it is.`);
      setReset(null);
      setNewPassword('');
    } catch (failure) {
      onError?.(failure.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.1rem] font-bold text-ink">Who can sign in</h2>
          <p className="mt-1 text-[0.86rem] leading-relaxed text-muted">
            Everyone signs in as themselves, so every decision is recorded against a real person.
          </p>
        </div>
        {!adding ? (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} />
            Add someone
          </Button>
        ) : null}
      </div>

      {saved ? (
        <p
          role="status"
          className="mt-4 rounded-panel border border-emerald-300 bg-emerald-50 px-4 py-3 text-[0.86rem] font-medium text-emerald-900"
        >
          {saved}
        </p>
      ) : null}

      {/* While the accounts table is empty the sign-in still comes from the
          server configuration. Saying so is the difference between "set this
          up properly" and everyone assuming it already is. */}
      {bootstrap ? (
        <p className="mt-4 rounded-panel border border-amber-300 bg-amber-50 p-4 text-[0.86rem] leading-relaxed text-amber-900">
          <b className="font-semibold">Nobody has a proper account yet.</b> Sign-in is still coming
          from the server configuration, which means it takes a developer to add or remove anyone.
          Add the first person below and that stops being true.
        </p>
      ) : null}

      {adding ? (
        <div className="mt-5 rounded-panel border border-line bg-lav-soft/60 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" hint="They can sign in with this or their email" required>
              {(props) => (
                <TextInput
                  {...props}
                  value={form.username}
                  autoComplete="off"
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Email" hint="Recorded against their decisions" required>
              {(props) => (
                <TextInput
                  {...props}
                  type="email"
                  value={form.email}
                  autoComplete="off"
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Full name">
              {(props) => (
                <TextInput
                  {...props}
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Role" required>
              {(props) => (
                <Select
                  {...props}
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="reviewer">Reviewer</option>
                  <option value="administrator">Administrator</option>
                </Select>
              )}
            </Field>
          </div>

          <Field
            label="Their first password"
            hint="At least 12 characters. Tell it to them yourself — it is not emailed."
            required
            className="mt-4"
          >
            {(props) => (
              <TextInput
                {...props}
                value={form.password}
                autoComplete="new-password"
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            )}
          </Field>

          <p className="mt-3 text-[0.82rem] leading-relaxed text-muted">
            {ROLE_COPY[form.role].blurb}
          </p>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAdding(false)}
              disabled={Boolean(busy)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={add}
              disabled={
                Boolean(busy) ||
                !form.username.trim() ||
                !form.email.trim() ||
                form.password.length < 12
              }
            >
              {busy === 'add' ? 'Adding…' : 'Add them'}
            </Button>
          </div>
        </div>
      ) : null}

      {team ? (
        <ul className="mt-5 grid gap-1 border-t border-line pt-4">
          {team.map((member) => {
            const isYou = member.id === you?.id;
            return (
              <li
                key={member.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-panel px-2 py-2.5',
                  !member.active && 'opacity-60',
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-lav text-[0.72rem] font-bold text-violet-deep"
                >
                  {(member.full_name || member.username).slice(0, 2).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[0.92rem] font-semibold text-ink">
                    {member.full_name || member.username}
                    {isYou ? (
                      <span className="ml-1.5 text-[0.78rem] font-normal text-muted">(you)</span>
                    ) : null}
                  </b>
                  <span className="block truncate text-[0.82rem] text-muted">{member.email}</span>
                </span>

                <span className="flex flex-wrap items-center gap-2">
                  {member.active ? (
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wide',
                        member.role === 'administrator'
                          ? 'bg-violet text-white'
                          : 'bg-lav text-violet-deep',
                      )}
                    >
                      {ROLE_COPY[member.role]?.label ?? member.role}
                    </span>
                  ) : (
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wide text-slate-600">
                      No access
                    </span>
                  )}

                  {member.active ? (
                    <>
                      <Button
                        variant="quiet"
                        size="sm"
                        disabled={busy === `row-${member.id}` || isYou}
                        title={isYou ? 'You cannot change your own role' : undefined}
                        onClick={() =>
                          update(
                            member.id,
                            {
                              role: member.role === 'administrator' ? 'reviewer' : 'administrator',
                            },
                            `${member.username} is now a ${member.role === 'administrator' ? 'reviewer' : 'administrator'}.`,
                          )
                        }
                      >
                        {member.role === 'administrator' ? 'Make reviewer' : 'Make administrator'}
                      </Button>
                      <Button variant="quiet" size="sm" onClick={() => setReset(member)}>
                        Set password
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy === `row-${member.id}` || isYou}
                        title={isYou ? 'You cannot remove your own access' : undefined}
                        onClick={() =>
                          update(
                            member.id,
                            { active: false },
                            `${member.username} can no longer sign in.`,
                          )
                        }
                      >
                        Remove access
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === `row-${member.id}`}
                      onClick={() =>
                        update(member.id, { active: true }, `${member.username} can sign in again.`)
                      }
                    >
                      Restore access
                    </Button>
                  )}
                </span>

                <span className="w-full pl-12 text-[0.76rem] text-muted">
                  {member.last_seen_at
                    ? `Last signed in ${formatDateTime(member.last_seen_at)}`
                    : 'Has not signed in yet'}
                  {member.created_by_email ? ` · added by ${member.created_by_email}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="mt-4 text-[0.78rem] leading-relaxed text-muted">
        Access is removed rather than deleted, so somebody&rsquo;s name still makes sense against
        the decisions they made. Removing access takes effect on their next click, not when their
        sign-in expires.
      </p>

      {reset ? (
        <Modal
          titleId="reset-title"
          className="max-w-md"
          onClose={() => (busy ? null : setReset(null))}
        >
          <h2 id="reset-title" className="text-[1.15rem] font-bold text-ink">
            Set a password for {reset.username}
          </h2>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">
            They are not emailed it, so tell them yourself. They can change it once they are in.
          </p>
          <Field label="New password" hint="At least 12 characters" required className="mt-4">
            {(props) => (
              <TextInput
                {...props}
                value={newPassword}
                autoComplete="new-password"
                onChange={(e) => setNewPassword(e.target.value)}
              />
            )}
          </Field>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReset(null)} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button
              onClick={setSomeonesPassword}
              disabled={Boolean(busy) || newPassword.length < 12}
            >
              {busy === 'reset' ? 'Saving…' : 'Set it'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}

/** Your own password. Separate because everyone gets this, not just admins. */
export function PasswordPanel({ you, onError }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const change = async () => {
    setBusy(true);
    try {
      await adminChangePassword(current, next);
      setCurrent('');
      setNext('');
      setDone('Your password has been changed.');
      setTimeout(() => setDone(''), 4000);
    } catch (failure) {
      onError?.(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="text-[1.1rem] font-bold text-ink">Your password</h2>
      <p className="mt-1 text-[0.86rem] text-muted">
        Signed in as <b className="font-semibold text-ink">{you?.email}</b>.
      </p>

      {you?.source !== 'database' ? (
        <p className="mt-4 rounded-panel border border-amber-300 bg-amber-50 p-4 text-[0.86rem] leading-relaxed text-amber-900">
          This sign-in comes from the server configuration rather than an account, so it cannot be
          changed here. Add yourself above and the change will be yours to make.
        </p>
      ) : (
        <>
          {done ? (
            <p
              role="status"
              className="mt-4 rounded-panel border border-emerald-300 bg-emerald-50 px-4 py-3 text-[0.86rem] font-medium text-emerald-900"
            >
              {done}
            </p>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Current password" required>
              {(props) => (
                <TextInput
                  {...props}
                  type="password"
                  value={current}
                  autoComplete="current-password"
                  onChange={(e) => setCurrent(e.target.value)}
                />
              )}
            </Field>
            <Field label="New password" hint="At least 12 characters" required>
              {(props) => (
                <TextInput
                  {...props}
                  type="password"
                  value={next}
                  autoComplete="new-password"
                  onChange={(e) => setNext(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Button
            className="mt-4"
            variant="secondary"
            onClick={change}
            disabled={busy || !current || next.length < 12}
          >
            {busy ? 'Changing…' : 'Change password'}
          </Button>
        </>
      )}
    </Card>
  );
}

export default TeamPanel;
