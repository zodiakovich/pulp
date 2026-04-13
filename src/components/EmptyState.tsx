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
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
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
            color: 'rgba(255,255,255,0.04)',
            transform: 'translateY(6px)',
            userSelect: 'none',
          }}
        >
          P
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 520, padding: '0 16px' }}>
        <div
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: 'rgba(240,240,255,0.50)',
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
              color: 'rgba(240,240,255,0.42)',
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
                  color: 'rgba(240,240,255,0.55)',
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
                  color: 'rgba(240,240,255,0.55)',
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

