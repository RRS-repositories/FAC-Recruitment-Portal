/**
 * Consistent heading for every step, so the flow feels like one thing.
 *
 * The role used to be repeated here as an eyebrow and a chip. It is now named
 * once, above the progress bar, which is where the prototype puts it — saying
 * it three times on one screen was noise.
 */
export function StepHeader({ title, sub }) {
  return (
    <header className="mb-4">
      <h1 className="text-[1.3rem] font-bold tracking-tight text-ink">{title}</h1>
      {sub ? <p className="mt-2 text-[0.97rem] leading-[1.7] text-body">{sub}</p> : null}
    </header>
  );
}

export default StepHeader;
