'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { useToast } from '@/components/toast/useToast';

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

type Props = {
  isPro: boolean;
  currentPeriodEnd: number | null;
};

export function ProfileAccountClient({ isPro, currentPeriodEnd }: Props) {
  const { signOut } = useClerk();
  const { toast } = useToast();
  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelledAt, setCancelledAt] = useState<number | null>(null);

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to open billing portal');
      }
      router.push(data.url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to open billing portal', 'danger');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/cancel', { method: 'POST' });
      const data = await res.json() as { success?: boolean; cancel_at?: number; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Something went wrong');
      }
      setCancelledAt(data.cancel_at ?? currentPeriodEnd ?? null);
      setShowModal(false);
      toast('Plan cancellation scheduled. You keep access until the end of the billing period.', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to cancel plan', 'danger');
    } finally {
      setLoading(false);
    }
  }

  const endDate = cancelledAt ?? currentPeriodEnd;

  return (
    <>
      <div
        className="rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 flex-wrap"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex flex-col gap-3 min-w-0">
          <p
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Billing
          </p>
          <h2
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              lineHeight: 1.2,
            }}
          >
            Plan and account access
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                border: '1px solid var(--border)',
                color: isPro ? '#00B894' : 'var(--foreground-muted)',
                background: isPro ? 'rgba(0, 184, 148, 0.12)' : 'transparent',
              }}
            >
              {isPro ? 'Pro' : 'Free'}
            </span>
            {isPro && endDate ? (
              cancelledAt ? (
                <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
                  Access ends <strong style={{ color: 'var(--text)' }}>{formatDate(endDate)}</strong>. You can resubscribe anytime.
                </span>
              ) : (
                <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
                  Renews on <strong style={{ color: 'var(--text)' }}>{formatDate(endDate)}</strong>
                </span>
              )
            ) : isPro ? (
              <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>Manage invoices, payment method, and cancellation in Stripe.</span>
            ) : (
              <span style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
                Free plan includes starter usage windows. Upgrade when pulp becomes part of your workflow.
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {isPro ? (
            <>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={handlePortal}
                disabled={portalLoading}
              >
                {portalLoading ? 'Loading...' : 'Manage billing'}
              </button>
              {!cancelledAt && (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}
                  onClick={() => setShowModal(true)}
                >
                  Cancel plan
                </button>
              )}
            </>
          ) : (
            <Link
              href="/pricing"
              className="btn-primary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Upgrade plan
            </Link>
          )}
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => void signOut({ redirectUrl: '/' })}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
          >
            <h2
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                color: 'var(--text)',
                marginBottom: 12,
              }}
            >
              Cancel your plan?
            </h2>
            <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
              {endDate
                ? <>You&apos;ll keep Pro access until <strong style={{ color: 'var(--text)' }}>{formatDate(endDate)}</strong>. After that you&apos;ll move to the Free plan.</>
                : <>You&apos;ll keep Pro access until the end of your billing period. After that you&apos;ll move to the Free plan.</>
              }
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={() => setShowModal(false)}
                disabled={loading}
              >
                Keep my plan
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                style={{ flex: 1, color: 'var(--muted)' }}
                onClick={handleCancel}
                disabled={loading}
              >
                {loading ? 'Cancelling...' : 'Cancel plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
