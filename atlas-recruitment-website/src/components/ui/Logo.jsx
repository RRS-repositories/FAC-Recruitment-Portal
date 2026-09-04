import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

function AtlasMark({ className }) {
  return (
    <svg
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="22" cy="22" r="20" fill="#d4a84b" />
      <path
        d="M22 9L34 35h-6.2l-2.4-5.6h-6.8L16.2 35H10L22 9zm0 8.4l-2.6 6.4h5.2L22 17.4z"
        fill="#0c1a3a"
      />
      <path d="M6 27h32" stroke="#0c1a3a" strokeWidth="1.6" opacity=".35" />
      <path d="M4.5 22C10 25.5 34 25.5 39.5 22" stroke="#0c1a3a" strokeWidth="1.4" opacity=".35" />
    </svg>
  );
}

/**
 * Wordmark + globe mark, linking home. The mark is decorative because the
 * adjacent text already reads "Atlas Recruitment".
 */
export function Logo({ className, markClassName, onClick }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={cn(
        'group flex flex-shrink-0 items-center gap-2.5 text-white no-underline',
        className,
      )}
    >
      <AtlasMark
        className={cn(
          'h-9 w-9 flex-shrink-0 transition-transform duration-500 ease-brand group-hover:rotate-[18deg] motion-reduce:transition-none motion-reduce:group-hover:rotate-0',
          markClassName,
        )}
      />
      <span className="font-display text-[1.25rem] font-bold leading-none tracking-[0.01em]">
        Atlas <em className="not-italic text-gold">Recruitment</em>
      </span>
    </Link>
  );
}

export default Logo;
