import type { ReactNode } from 'react';
import { cn } from './utils.ts';

export interface TableColumn<T> {
  /** Stable column id. */
  id: string;
  header: ReactNode;
  /** Numeric columns get `tabular-nums` + right alignment (prices, times…). */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
  render: (row: T, rowIndex: number) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  /** Alternate row shading using the `border`/`bg` tokens. */
  zebra?: boolean;
  getRowKey?: (row: T, index: number) => string;
  caption?: ReactNode;
  className?: string;
}

function alignClass(col: TableColumn<unknown>): string {
  const a = col.align ?? (col.numeric ? 'right' : 'left');
  return a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';
}

/**
 * Data table. Numeric columns render with `tabular-nums` so prices/times align.
 * Header row + body rows separated by the `border` token; optional zebra
 * striping.
 */
export function Table<T>({ columns, rows, zebra, getRowKey, caption, className }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-base text-text', className)}>
        {caption ? <caption className="mb-2 text-sm text-text-secondary text-left">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  'px-3 py-2 text-sm font-semibold text-text-secondary',
                  alignClass(col as TableColumn<unknown>),
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={getRowKey ? getRowKey(row, rowIndex) : rowIndex}
              className={cn(
                'border-b border-border',
                zebra && rowIndex % 2 === 1 && 'bg-bg',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cn(
                    'px-3 py-2',
                    alignClass(col as TableColumn<unknown>),
                    col.numeric && 'tabular-nums',
                  )}
                >
                  {col.render(row, rowIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
