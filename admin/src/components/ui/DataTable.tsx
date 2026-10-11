import type { ReactNode } from 'react';

// Building blocks without server-only code, so server pages AND client components can use them (the Live page's
// recordings and schedule lists are client components). Primitives.tsx re-exports them: import from either.

export type Tone = 'neutral' | 'gold' | 'success' | 'warn' | 'danger' | 'info';

/**
 * An amount already formatted (lib/format.ts formatMoney), kept in its own left-to-right island: Arabic formats a dollar
 * amount as "41.50 US$", which a right-to-left line turned into "$US 41.50" (review 04 finding 22).
 */
export function Money({ children }: { children: ReactNode }) {
  return <bdi dir="ltr" className="money">{children}</bdi>;
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

// ---------------------------------------------------------------- data table

export type Column<Row> = {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** The first, most important cell: becomes the card title on phones. */
  primary?: boolean;
  align?: 'end';
  className?: string;
};

export function DataTable<Row>({ caption, columns, rows, rowKey, rowClass }: { caption: string; columns: Column<Row>[]; rows: Row[]; rowKey: (row: Row) => string; rowClass?: (row: Row) => string | undefined }) {
  return (
    // Scrollable when wide: it must be reachable with the keyboard (and named for screen readers).
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === 'end' ? 'is-end' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClass?.(row)}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} className={[c.primary ? 'is-primary' : '', c.align === 'end' ? 'is-end' : '', c.key === 'actions' ? 'cell-actions' : '', c.className ?? ''].join(' ').trim() || undefined}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
