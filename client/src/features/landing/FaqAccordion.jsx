import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/**
 * FAQ list.
 *
 * Real <button> elements inside the heading, with `aria-expanded` and
 * `aria-controls` — so a screen reader announces each question as a control
 * and says whether it is open. A <details> element would be simpler but styles
 * inconsistently across browsers and animates poorly.
 *
 * The panel is height-animated rather than mounted and unmounted, so opening
 * one does not jump the page.
 */
function FaqItem({ question, answer, isOpen, onToggle, id }) {
  return (
    <div className="border-b border-line last:border-0">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="flex w-full items-center justify-between gap-4 py-5 text-left"
        >
          <span className="text-[1rem] font-semibold text-ink">{question}</span>
          <span
            aria-hidden="true"
            className={cn(
              'grid h-8 w-8 flex-shrink-0 place-items-center rounded-full transition-all duration-300 ease-brand',
              isOpen ? 'rotate-45 bg-violet text-white' : 'bg-lav text-violet-deep',
            )}
          >
            <Icon name="plus" size={16} strokeWidth={2.4} />
          </span>
        </button>
      </h3>

      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        className={cn(
          'grid transition-all duration-300 ease-brand',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-5 pr-12 text-[0.94rem] leading-relaxed text-muted">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion({ items }) {
  // One open at a time: a wall of open answers is harder to scan than a list
  // of questions, which is the point of collapsing them.
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="mx-auto max-w-3xl rounded-card bg-white px-6 shadow-card sm:px-8">
      {items.map((item, index) => (
        <FaqItem
          key={item.q}
          id={`faq-${index}`}
          question={item.q}
          answer={item.a}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
        />
      ))}
    </div>
  );
}

export default FaqAccordion;
