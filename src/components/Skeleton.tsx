'use client';

import type { CSSProperties, HTMLAttributes } from 'react';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  style?: CSSProperties;
};

/** Base block with animated shimmer (#1A1A2E → #222230, see `.skeleton` in globals.css). */
export function Skeleton({ className = '', style, ...rest }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={style}
      aria-hidden
      {...rest}
    />
  );
}

/** One or more shimmering text lines. */
export function SkeletonText({
  lines = 1,
  gap = 8,
  className = '',
  lastLineWidth = '72%',
}: {
  lines?: number;
  gap?: number;
  className?: string;
  /** Width of the last line when there are multiple lines */
  lastLineWidth?: string;
}) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          style={{
            height: 14,
            width: lines > 1 && i === lines - 1 ? lastLineWidth : '100%',
            borderRadius: 4,
          }}
        />
      ))}
    </div>
  );
}

/** Card-shaped placeholder matching explore / history list items. */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 16,
        padding: 24,
        background: '#111118',
        border: '1px solid #1A1A2E',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton style={{ height: 16, width: '100%', marginBottom: 12, borderRadius: 4 }} />
          <div className="flex flex-wrap gap-2">
            <Skeleton style={{ height: 26, width: 88, borderRadius: 6 }} />
            <Skeleton style={{ height: 26, width: 72, borderRadius: 6 }} />
            <Skeleton style={{ height: 26, width: 64, borderRadius: 6 }} />
          </div>
        </div>
        <Skeleton style={{ height: 12, width: 48, flexShrink: 0, borderRadius: 4 }} />
      </div>
    </div>
  );
}

/** Button / control placeholder (e.g. filter dropdown, play). */
export function SkeletonButton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <Skeleton className={className} style={{ height: 40, width: 128, borderRadius: 10, ...style }} />;
}
