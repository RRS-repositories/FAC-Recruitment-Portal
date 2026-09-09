/**
 * The applicants table, column by column.
 *
 * Shared by the header and the rows so the two cannot drift — a header that
 * hides at a different width from its cells produces a table with the values
 * under the wrong names, which is worse than either choice on its own.
 *
 * Eight columns will not fit on a narrow window, and a horizontal scrollbar
 * hides the Decision buttons, which are the whole point of the screen. So the
 * columns drop away in reverse order of how much they decide something:
 *
 *   Name, Score, Status, Decision   always — the row is useless without them
 *   Interview        from  640px
 *   AI check         from  768px
 *   Email            from 1024px
 *   Time taken       from 1280px
 *
 * Nothing is lost by hiding one: every value here is also in the panel that
 * opens when the row is expanded.
 */
export const COLUMNS = [
  { key: 'name', label: 'Name', cell: '', width: 'w-[18%]' },
  { key: 'email', label: 'Email', cell: 'hidden lg:table-cell', width: 'w-[18%]' },
  { key: 'score', label: 'Score', cell: '', width: 'w-[9%]' },
  { key: 'ai', label: 'AI check', cell: 'hidden md:table-cell', width: 'w-[9%]' },
  { key: 'duration', label: 'Time taken', cell: 'hidden xl:table-cell', width: 'w-[8%]' },
  { key: 'status', label: 'Status', cell: '', width: 'w-[10%]' },
  { key: 'interview', label: 'Interview', cell: 'hidden sm:table-cell', width: 'w-[13%]' },
  { key: 'decision', label: 'Decision', cell: '', width: 'w-[10%]' },
];

/**
 * The chevron column, which has a header but no label.
 *
 * It needs a declared width like every other column. The table is `table-fixed`,
 * so a column with no width gets whatever is left — and when the eight above
 * summed to 104% there was nothing left, giving the chevron zero width. The
 * accordion still worked; the control that opens it was simply invisible, which
 * reads as the feature having been removed.
 *
 * The eight above now total 95%, leaving exactly this 5%.
 */
export const CHEVRON_WIDTH = 'w-[5%]';

/** Looked up by key, so a cell cannot accidentally take another's rules. */
export const COL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.cell]));

/** Every column, plus the chevron, for the row that spans the whole table. */
export const COLUMN_COUNT = COLUMNS.length + 1;

export default COLUMNS;
