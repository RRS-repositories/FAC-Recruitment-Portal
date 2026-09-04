import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

/**
 * Back and continue for each step.
 *
 * Continue is disabled until the step is complete, and `hint` says WHY —
 * a disabled button with no explanation just looks broken.
 */
export function StepNav({ onBack, onNext, nextLabel = 'Continue', disabled, hint, busy }) {
  return (
    <div className="mt-8 border-t border-line pt-6">
      {disabled && hint ? (
        <p className="mb-3 text-[0.83rem] font-medium text-warn" role="status">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          <Icon name="arrowLeft" size={16} />
          Back
        </Button>
        <Button onClick={onNext} disabled={disabled || busy} aria-busy={busy || undefined}>
          {busy ? 'Sending…' : nextLabel}
          {!busy ? <Icon name="arrowRight" size={16} /> : null}
        </Button>
      </div>
    </div>
  );
}

export default StepNav;
