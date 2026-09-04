import { cn } from '@/lib/cn';
import { Icon } from './Icon';

/**
 * One answer in the assessment.
 *
 * A real <button> with `aria-pressed`, not a styled div: it is reachable by
 * keyboard, announces its selected state, and works with a screen reader
 * without extra scaffolding. Selection is shown by border, fill AND a tick —
 * three signals, so it does not depend on colour alone.
 */
export function OptionCard({ selected, multi, onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-panel border p-4 text-left',
        'transition-[border-color,background,transform] duration-200 ease-brand',
        'hover:border-violet-soft active:scale-[0.995] motion-reduce:active:scale-100',
        selected
          ? 'border-2 border-violet bg-lav-soft font-semibold text-ink'
          : 'border-[1.5px] border-line bg-white text-body',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center border-2 transition-colors',
          // A checkbox is square, a radio is round — the shape tells you
          // whether you may pick more than one before you try.
          multi ? 'rounded-[6px]' : 'rounded-full',
          selected ? 'border-violet bg-violet text-white' : 'border-slate-300 bg-white',
        )}
      >
        {selected ? <Icon name="check" size={12} strokeWidth={3} /> : null}
      </span>
      <span className="text-[0.92rem] leading-relaxed">{children}</span>
    </button>
  );
}

export default OptionCard;
