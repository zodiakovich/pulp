'use client';

import { useState } from 'react';

export type CompareRow = { name: string; free: string; pro: string };

function TableCell({ value, proColumn }: { value: string; proColumn?: boolean }) {
  if (value === '✓') {
    return <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#00B894' }}>✓</span>;
  }
  if (value === '✗') {
    return <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--foreground-muted)' }}>✗</span>;
  }
  return (
    <span
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: proColumn ? 700 : 400,
        color: proColumn ? 'var(--foreground)' : 'var(--foreground-muted)',
      }}
    >
      {value}
    </span>
  );
}

export function PricingComparisonTable({ topRows, restRows }: { topRows: CompareRow[]; restRows: CompareRow[] }) {
  const [showRest, setShowRest] = useState(false);
  const rows = showRest ? [...topRows, ...restRows] : topRows;

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th
                className="px-5 py-5"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                Feature
              </th>
              <th
                className="px-5 py-5 text-center"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                Free
              </th>
              <th
                className="px-5 py-5 text-center"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                Pro
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.name}
                style={{
                  background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
                }}
              >
                <td className="px-5 py-4 align-middle" style={{ color: 'var(--foreground-muted)', fontSize: 14 }}>
                  {row.name}
                </td>
                <td className="px-5 py-4 text-center align-middle">
                  <TableCell value={row.free} />
                </td>
                <td className="px-5 py-4 text-center align-middle">
                  <TableCell value={row.pro} proColumn />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {restRows.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            className="text-sm font-medium px-6 py-3 rounded-xl transition-colors"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              border: '1px solid var(--border)',
              color: 'var(--foreground-muted)',
              background: 'var(--surface)',
            }}
            onClick={() => setShowRest(v => !v)}
            aria-expanded={showRest}
          >
            {showRest ? 'Hide extended comparison' : 'Show full comparison'}
          </button>
        </div>
      )}
    </div>
  );
}
