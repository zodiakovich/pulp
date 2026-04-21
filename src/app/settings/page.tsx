'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/toast/useToast';

type Tab = 'profile' | 'account' | 'billing' | 'notifications' | 'danger';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account & Security' },
  { id: 'billing', label: 'Billing' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'danger', label: 'Danger Zone' },
];

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: 12 }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: 'var(--muted)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 16,
      }}
    >
      {children}
    </p>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: 'var(--muted)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        display: 'block',
        width: '100%',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        fontSize: 14,
        color: 'var(--foreground)',
        outline: 'none',
        boxSizing: 'border-box',
        opacity: disabled ? 0.5 : 1,
      }}
    />
  );
}

function ProfileSection() {
  const { user } = useUser();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await user.update({ firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined });
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save profile', 'danger');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      await user.setProfileImage({ file });
      toast('Profile photo updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to upload photo', 'danger');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const email = user?.emailAddresses?.[0]?.emailAddress ?? '';
  const displayInitial = (user?.firstName?.[0] ?? email[0] ?? '?').toUpperCase();

  return (
    <div className="space-y-3">
      {/* Avatar */}
      <SectionCard>
        <SectionLabel>Profile photo</SectionLabel>
        <div className="flex items-center gap-5">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="Profile"
              width={72}
              height={72}
              className="rounded-full flex-shrink-0"
              style={{ border: '1px solid var(--border)', objectFit: 'cover' }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0 font-bold text-xl"
              style={{
                width: 72,
                height: 72,
                border: '1px solid var(--border)',
                background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                color: 'var(--accent)',
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              }}
            >
              {displayInitial}
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Upload new photo'}
            </button>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              JPG, PNG, GIF up to 10 MB
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Display name */}
      <SectionCard>
        <SectionLabel>Display name</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <FieldLabel htmlFor="firstName">First name</FieldLabel>
            <TextInput id="firstName" value={firstName} onChange={setFirstName} placeholder="First name" />
          </div>
          <div>
            <FieldLabel htmlFor="lastName">Last name</FieldLabel>
            <TextInput id="lastName" value={lastName} onChange={setLastName} placeholder="Last name" />
          </div>
        </div>
        {user?.username && (
          <div className="mb-5">
            <FieldLabel>Username</FieldLabel>
            <TextInput value={`@${user.username}`} onChange={() => {}} disabled />
          </div>
        )}
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </SectionCard>
    </div>
  );
}

function AccountSection() {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const { toast } = useToast();
  const router = useRouter();
  const [signingOutAll, setSigningOutAll] = useState(false);

  const email = user?.emailAddresses?.[0]?.emailAddress ?? '—';
  const connectedAccounts = user?.externalAccounts ?? [];
  const hasTwoFactor = user?.twoFactorEnabled ?? false;

  async function handleSignOutAll() {
    setSigningOutAll(true);
    try {
      await signOut({ redirectUrl: '/' });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to sign out', 'danger');
      setSigningOutAll(false);
    }
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap' as const,
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
    fontSize: 14,
    color: 'var(--foreground)',
    fontWeight: 500,
  };
  const valueStyle: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 13,
    color: 'var(--muted)',
  };

  return (
    <div className="space-y-3">
      {/* Clerk account portal CTA */}
      <SectionCard>
        <SectionLabel>Account settings</SectionLabel>
        <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Manage your email, password, two-factor authentication, and active sessions in one place.
        </p>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => openUserProfile()}
        >
          Open account settings
        </button>
      </SectionCard>

      {/* Email & connected accounts */}
      <SectionCard>
        <SectionLabel>Email & connected accounts</SectionLabel>
        <div>
          <div style={{ ...rowStyle, paddingTop: 0 }}>
            <span style={labelStyle}>Primary email</span>
            <span style={valueStyle}>{email}</span>
          </div>
          <div style={{ ...rowStyle, borderBottom: connectedAccounts.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <span style={labelStyle}>Two-factor authentication</span>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 20,
                border: `1px solid ${hasTwoFactor ? '#00B89433' : 'var(--border)'}`,
                color: hasTwoFactor ? '#00B894' : 'var(--muted)',
                background: hasTwoFactor ? 'rgba(0,184,148,0.1)' : 'transparent',
              }}
            >
              {hasTwoFactor ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {connectedAccounts.map((acct, i) => (
            <div
              key={acct.id}
              style={{ ...rowStyle, borderBottom: i < connectedAccounts.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i === connectedAccounts.length - 1 ? 0 : 14 }}
            >
              <span style={labelStyle}>
                {acct.provider.charAt(0).toUpperCase() + acct.provider.slice(1)}
              </span>
              <span style={valueStyle}>{acct.emailAddress ?? acct.username ?? 'Connected'}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Sessions */}
      <SectionCard>
        <SectionLabel>Sessions</SectionLabel>
        <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          View and manage your active sessions from the account settings modal, or sign out all devices at once.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => openUserProfile()}
          >
            View active sessions
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            style={{ color: 'var(--muted)' }}
            onClick={handleSignOutAll}
            disabled={signingOutAll}
          >
            {signingOutAll ? 'Signing out…' : 'Sign out all devices'}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

type CreditsData = {
  credits_used: number;
  limit: number;
  is_pro: boolean;
  plan_type: string;
  allowed: boolean;
};

function BillingSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    fetch('/api/credits')
      .then(r => r.json())
      .then(d => setCredits(d as CreditsData))
      .catch(() => {});
  }, []);

  async function handlePortal() {
    setLoadingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to open billing portal');
      router.push(data.url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to open portal', 'danger');
      setLoadingPortal(false);
    }
  }

  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetLabel = nextReset.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  const planLabel = credits?.plan_type === 'studio' ? 'Studio' : credits?.is_pro ? 'Pro' : 'Free';
  const planColor = credits?.is_pro ? '#00B894' : 'var(--muted)';
  const used = credits?.credits_used ?? 0;
  const limit = credits?.limit ?? 20;
  const pct = limit > 0 ? Math.min(1, used / limit) : 0;
  const barColor = pct < 0.5 ? '#00B894' : pct < 0.8 ? '#FF6D3F' : '#E94560';

  return (
    <div className="space-y-3">
      {/* Plan overview */}
      <SectionCard>
        <SectionLabel>Current plan</SectionLabel>
        <div className="flex items-center gap-3 mb-5">
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              padding: '4px 12px',
              borderRadius: 20,
              border: `1px solid ${planColor}33`,
              color: planColor,
              background: credits?.is_pro ? 'rgba(0,184,148,0.1)' : 'transparent',
            }}
          >
            {credits ? planLabel : '—'}
          </span>
        </div>

        {/* Usage bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--foreground)' }}>
              Generations this month
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--muted)' }}>
              {credits ? `${used} / ${limit}` : '—'}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pct * 100}%`,
                background: barColor,
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            Resets on {resetLabel}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          {credits?.is_pro ? (
            <>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={handlePortal}
                disabled={loadingPortal}
              >
                {loadingPortal ? 'Loading…' : 'Manage subscription'}
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handlePortal}
                disabled={loadingPortal}
              >
                View billing history
              </button>
            </>
          ) : (
            <a
              href="/pricing"
              className="btn-primary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Upgrade plan
            </a>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

const NOTIF_STORAGE_KEY = 'pulp_notification_prefs';

type NotifPrefs = {
  low_gen_warning: boolean;
  new_features: boolean;
  tips: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  low_gen_warning: true,
  new_features: true,
  tips: false,
};

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s ease',
        }}
      />
    </button>
  );
}

function NotificationsSection() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (stored) setPrefs(JSON.parse(stored) as NotifPrefs);
    } catch { /* ignore */ }
  }, []);

  function toggle(key: keyof NotifPrefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
    setDirty(true);
  }

  function handleSave() {
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(prefs));
      setDirty(false);
      toast('Notification preferences saved', 'success');
      // TODO: persist to Supabase user_settings table when available
    } catch {
      toast('Failed to save preferences', 'danger');
    }
  }

  const rows: { key: keyof NotifPrefs; label: string; description: string }[] = [
    {
      key: 'low_gen_warning',
      label: 'Low generation warning',
      description: 'Email me when I\'m running low on generations this month',
    },
    {
      key: 'new_features',
      label: 'New genres & features',
      description: 'Email me about new genres, updates, and product releases',
    },
    {
      key: 'tips',
      label: 'Tips & tutorials',
      description: 'Occasional emails with beat-making tips and tutorials',
    },
  ];

  return (
    <div className="space-y-3">
      <SectionCard>
        <SectionLabel>Email notifications</SectionLabel>
        <div>
          {rows.map((row, i) => (
            <div
              key={row.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                paddingTop: i === 0 ? 0 : 16,
                paddingBottom: i < rows.length - 1 ? 16 : 0,
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div>
                <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--foreground)', fontWeight: 500, marginBottom: 4 }}>
                  {row.label}
                </p>
                <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {row.description}
                </p>
              </div>
              <Toggle
                id={`notif-${row.key}`}
                checked={prefs[row.key]}
                onChange={() => toggle(row.key)}
              />
            </div>
          ))}
        </div>
        <div className="mt-5">
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={handleSave}
            disabled={!dirty}
            style={{ opacity: dirty ? 1 : 0.5 }}
          >
            Save preferences
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function DangerSection() {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!user || confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await user.delete();
      router.push('/');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete account', 'danger');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <SectionCard>
        <SectionLabel>Danger Zone</SectionLabel>
        <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Permanently delete your account, all generations, and cancel any active subscription. This action cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            padding: '9px 18px',
            borderRadius: 10,
            border: '1px solid rgba(233,69,96,0.4)',
            background: 'rgba(233,69,96,0.08)',
            color: '#E94560',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(233,69,96,0.14)'); }}
          onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(233,69,96,0.08)'); }}
        >
          Delete my account
        </button>
      </SectionCard>

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
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={e => { if (e.target === e.currentTarget && !deleting) setShowModal(false); }}
        >
          <div
            className="rounded-2xl p-8 w-full max-w-md"
            style={{ background: 'var(--surface)', border: '1px solid rgba(233,69,96,0.3)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          >
            <h2
              style={{
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: '-0.02em',
                color: '#E94560',
                marginBottom: 12,
              }}
            >
              Delete your account?
            </h2>
            <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              This will permanently delete your account, all generations, and cancel your subscription. <strong style={{ color: 'var(--foreground)' }}>This cannot be undone.</strong>
            </p>
            <div className="mb-6">
              <FieldLabel htmlFor="deleteConfirm">Type DELETE to confirm</FieldLabel>
              <TextInput
                id="deleteConfirm"
                value={confirmText}
                onChange={setConfirmText}
                placeholder="DELETE"
                disabled={deleting}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setShowModal(false); setConfirmText(''); }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmText !== 'DELETE' || deleting}
                onClick={handleDelete}
                style={{
                  flex: 1,
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1px solid rgba(233,69,96,0.4)',
                  background: confirmText === 'DELETE' ? '#E94560' : 'rgba(233,69,96,0.08)',
                  color: confirmText === 'DELETE' ? '#fff' : '#E94560',
                  cursor: confirmText === 'DELETE' ? 'pointer' : 'not-allowed',
                  opacity: deleting ? 0.6 : 1,
                  transition: 'background 0.15s',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push('/');
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="settings" />
      <main className="pt-24 pb-16 px-4 sm:px-8">
        <div className="max-w-[860px] mx-auto">
          <h1
            style={{
              fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: '-0.02em',
              marginBottom: 32,
              color: 'var(--foreground)',
            }}
          >
            Settings
          </h1>

          {/* Tab bar */}
          <div
            className="flex gap-0 flex-wrap mb-8"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontSize: 14,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? 'var(--foreground)' : 'var(--muted)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  marginBottom: -1,
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          {activeTab === 'profile' && <ProfileSection />}
          {activeTab === 'account' && <AccountSection />}
          {activeTab === 'billing' && <BillingSection />}
          {activeTab === 'notifications' && <NotificationsSection />}
          {activeTab === 'danger' && <DangerSection />}
        </div>
      </main>
    </div>
  );
}

