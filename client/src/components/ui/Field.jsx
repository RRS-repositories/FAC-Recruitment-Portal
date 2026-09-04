import { useId } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-control border-[1.5px] bg-white px-4 py-3 text-[0.95rem] text-body ' +
  'transition-colors duration-200 placeholder:text-slate-400 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50';

const stateRing = (invalid) =>
  invalid ? 'border-danger focus:border-danger' : 'border-line focus:border-violet';

/**
 * Label + control + help + error, wired together with the ids assistive tech
 * needs.
 *
 * The label is always visible — a placeholder disappears the moment someone
 * types, which leaves them with no way to check what a field was asking for.
 * `aria-describedby` points at the hint and the error together, so both are
 * announced rather than only the last one set.
 */
export function Field({ label, hint, error, required, children, className }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[0.82rem] font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-[0.75rem] font-normal text-muted">optional</span>
        )}
      </label>

      {hint ? (
        <p id={hintId} className="mb-2 text-[0.8rem] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? 'true' : undefined,
        'aria-required': required || undefined,
      })}

      {error ? (
        <p id={errorId} className="mt-1.5 text-[0.8rem] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ error, className, ...props }) {
  return <input className={cn(CONTROL, stateRing(error), className)} {...props} />;
}

export function TextArea({ error, className, ...props }) {
  return (
    <textarea className={cn(CONTROL, stateRing(error), 'min-h-[140px] resize-y', className)} {...props} />
  );
}

export function Select({ error, className, children, ...props }) {
  return (
    <select className={cn(CONTROL, stateRing(error), 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
}

export default Field;
