'use client';

/** Three pulsing dots for button loading (fixed footprint; use inside min-height buttons). */
export function ButtonLoadingDots({ label = 'Generating' }: { label?: string }) {
  return (
    <span className="btn-loading-dots-wrap inline-flex items-center justify-center gap-1" role="status" aria-live="polite" aria-label={label}>
      <span className="btn-loading-dots">
        <span className="btn-loading-dots__dot" />
        <span className="btn-loading-dots__dot" />
        <span className="btn-loading-dots__dot" />
      </span>
    </span>
  );
}
