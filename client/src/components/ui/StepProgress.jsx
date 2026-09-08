import { cn } from '@/lib/cn';

/**
 * Step progress for the application flow, as the prototype draws it: one short
 * bar per step with its name underneath, rather than a single bar and a
 * percentage.
 *
 * It says more than a percentage did — somebody on step two can see that the
 * assessment is still ahead of them, which is the question people actually
 * have when they are deciding whether to start now or come back later.
 *
 * The bars are decorative. The position is carried for assistive tech by a
 * real progressbar role with a label, and visibly by the current step's name
 * being the one in violet — never by colour alone, since each step is also
 * named in text.
 */
export function StepProgress({ steps, current, className }) {
  return (
    <div
      className={cn('w-full', className)}
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuetext={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}
    >
      <ol className="flex gap-1.5">
        {steps.map((label, i) => (
          <li key={label} className="flex-1">
            <div
              aria-hidden="true"
              className={cn(
                'h-1 rounded-full transition-colors duration-300 ease-brand motion-reduce:transition-none',
                i <= current ? 'bg-violet' : 'bg-lav',
              )}
            />
            <span
              className={cn(
                'mt-1.5 block text-[0.72rem] font-semibold',
                i === current ? 'text-violet-deep' : 'text-muted',
              )}
            >
              {label}
              {i === current ? <span className="sr-only"> (current step)</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default StepProgress;
