'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Optional SVG or element shown above the copy. Replaces the watermark "P". */
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
      className="relative w-full"
      style={{
        minHeight: 260,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {!icon && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontWeight: 700,
              fontSize: 260,
              lineHeight: 1,
              color: 'color-mix(in srgb, var(--text) 6%, transparent)',
              transform: 'translateY(6px)',
              userSelect: 'none',
            }}
          >
            P
          </div>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 520, padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {icon && (
          <div aria-hidden style={{ opacity: 0.30, marginBottom: 16, color: 'var(--text)' }}>
            {icon}
          </div>
        )}

        <div
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: 'var(--muted)',
            lineHeight: 1.6,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 6,
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 13,
              color: 'var(--text-micro)',
              lineHeight: 1.6,
            }}
          >
            {subtitle}
          </div>
        ) : null}

        {actionLabel ? (
          <div style={{ marginTop: 14 }}>
            {actionHref ? (
              <Link
                href={actionHref}
                className="footer-link"
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 13,
                  color: 'var(--muted)',
                  textDecoration: 'none',
                }}
                onClick={onAction}
              >
                {actionLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onAction}
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 13,
                  color: 'var(--muted)',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                {actionLabel}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
