'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { useToast } from '@/components/toast/useToast';
import { UserAvatar, AVATAR_COLORS } from '@/components/UserAvatar';
import { UsageDashboard } from '@/components/UsageDashboard';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { GENRES, NOTE_NAMES, SCALE_INTERVALS } from '@/lib/music-engine';

type Tab = 'profile' | 'account' | 'billing' | 'usage' | 'preferences' | 'notifications' | 'danger';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account & Security' },
  { id: 'billing', label: 'Billing' },
  { id: 'usage', label: 'Usage' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'danger', label: 'Danger Zone' },
];

type PlanType = 'free' | 'pro' | 'studio';

function planLabel(planType: PlanType | null) {
  if (planType === 'studio') return 'Studio';
  if (planType === 'pro') return 'Pro';
  if (planType === 'free') return 'Free';
  return 'Plan';
}

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
        background: 'color-mix(in srgb, var(--text) 3%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        fontSize: 14,
        color: 'var(--text)',
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
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  const [colorSaving, setColorSaving] = useState(false);

  // Load persisted avatar color
  useEffect(() => {
    fetch('/api/user/avatar')
      .then(r => r.ok ? r.json() : null)
      .then((d: { avatarColor?: string | null } | null) => {
        if (d?.avatarColor) setAvatarColor(d.avatarColor);
      })
      .catch(() => {});
  }, []);

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

  async function handleColorPick(color: string) {
    setAvatarColor(color);
    setColorSaving(true);
    try {
      await fetch('/api/user/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarColor: color }),
      });
    } catch {
      // non-blocking
    } finally {
      setColorSaving(false);
    }
  }

  const email = user?.emailAddresses?.[0]?.emailAddress ?? '';
  const displayName = user?.firstName ?? user?.username ?? email.split('@')[0] ?? 'User';

  return (
    <div className="space-y-3">
      {/* Avatar */}
      <SectionCard>
        <SectionLabel>Profile photo</SectionLabel>
        <div className="flex items-center gap-5">
          <UserAvatar
            userId={user?.id}
            name={displayName}
            imageUrl={user?.imageUrl}
            avatarColor={avatarColor}
            size={72}
            style={{ border: '1px solid var(--border)' }}
          />
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

        {/* Color picker — only shown when no Clerk photo */}
        {!user?.imageUrl && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
              Avatar color {colorSaving && <span style={{ opacity: 0.5 }}>— saving…</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(c => {
                const active = (avatarColor ?? AVATAR_COLORS[0]) === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorPick(c)}
                    aria-label={`Avatar color ${c}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: `${c}22`,
                      border: active ? `2px solid ${c}` : `2px solid ${c}44`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 120ms',
                      transform: active ? 'scale(1.18)' : 'scale(1)',
                      outline: 'none',
                    }}
                  >
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: c, display: 'block' }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
function BillingSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [planType, setPlanType] = useState<PlanType | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPlan() {
      try {
        const res = await fetch('/api/usage', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json() as { plan_type?: PlanType };
        if (!cancelled && data.plan_type) setPlanType(data.plan_type);
      } catch {
        // keep neutral label
      }
    }
    void loadPlan();
    return () => {
      cancelled = true;
    };
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

  return (
    <div className="space-y-3">
      <SectionCard>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <SectionLabel>Current plan</SectionLabel>
            <div className="flex flex-wrap items-center gap-3">
              {planType === null ? (
                <span style={{ display: 'inline-block', width: 64, height: 24, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border)', opacity: 0.5 }} />
              ) : (
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,109,63,0.35)',
                    color: 'var(--text)',
                    background: 'rgba(255,109,63,0.08)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {planLabel(planType)}
                </span>
              )}
              <span style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)' }}>
                Billing is managed through Stripe. Usage limits are based on daily and monthly cost windows.
              </span>
            </div>
          </div>
          <a
            href="/pricing"
            className="btn-secondary btn-sm"
            style={{ textDecoration: 'none', alignSelf: 'flex-start' }}
          >
            Compare plans
          </a>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={handlePortal}
            disabled={loadingPortal}
          >
            {loadingPortal ? 'Loading...' : 'Manage billing'}
          </button>
          <a
            href="/pricing"
            className="btn-secondary btn-sm"
            style={{ textDecoration: 'none' }}
          >
            Change plan
          </a>
        </div>
      </SectionCard>
    </div>
  );
}

function SelectField({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        display: 'block',
        width: '100%',
        background: 'color-mix(in srgb, var(--text) 3%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        fontSize: 14,
        color: 'var(--text)',
        outline: 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: '#1A1A1E' }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const GENRE_OPTIONS = Object.entries(GENRES).map(([key, g]) => ({ value: key, label: g.name }));
const KEY_OPTIONS = NOTE_NAMES.map(n => ({ value: n, label: n }));
const SCALE_OPTIONS = Object.keys(SCALE_INTERVALS).map(s => ({
  value: s,
  label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}));
const BARS_OPTIONS = [2, 4, 8, 16].map(n => ({ value: String(n), label: `${n} bars` }));

function SavedBadge({ visible }: { visible: boolean }) {
  return (
    <span
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: '#00B894',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        marginLeft: 8,
      }}
    >
      Saved
    </span>
  );
}

function PreferencesSection() {
  const { prefs, update, saved } = useUserPreferences();

  return (
    <div className="space-y-3">
      {/* Generation Defaults */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Generation defaults</SectionLabel>
          <SavedBadge visible={saved} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="pref-genre">Genre</FieldLabel>
            <SelectField
              id="pref-genre"
              value={prefs.defaultGenre}
              onChange={v => update({ defaultGenre: v })}
              options={GENRE_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel htmlFor="pref-key">Key</FieldLabel>
            <SelectField
              id="pref-key"
              value={prefs.defaultKey}
              onChange={v => update({ defaultKey: v })}
              options={KEY_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel htmlFor="pref-scale">Scale</FieldLabel>
            <SelectField
              id="pref-scale"
              value={prefs.defaultScale}
              onChange={v => update({ defaultScale: v })}
              options={SCALE_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel htmlFor="pref-bars">Default bars</FieldLabel>
            <SelectField
              id="pref-bars"
              value={String(prefs.defaultBars)}
              onChange={v => update({ defaultBars: parseInt(v, 10) })}
              options={BARS_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel htmlFor="pref-bpm">Default BPM override</FieldLabel>
            <input
              id="pref-bpm"
              type="number"
              min={60}
              max={200}
              value={prefs.defaultBpm ?? ''}
              placeholder="Use genre default"
              onChange={e => {
                const v = e.target.value;
                update({ defaultBpm: v === '' ? null : Math.max(60, Math.min(200, parseInt(v, 10))) });
              }}
              style={{
                display: 'block',
                width: '100%',
                background: 'color-mix(in srgb, var(--text) 3%, transparent)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 14px',
                fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                fontSize: 14,
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
              Leave blank to use the genre&apos;s default
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Playback */}
      <SectionCard>
        <SectionLabel>Playback</SectionLabel>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Master volume</FieldLabel>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>
                {prefs.masterVolume}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={prefs.masterVolume}
              onChange={e => update({ masterVolume: parseInt(e.target.value, 10) })}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
              Volume preference is saved but audio wiring is applied at playback time
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--foreground)', fontWeight: 500, marginBottom: 4 }}>
                Auto-play after generation
              </p>
              <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                Automatically start playback when a generation finishes
              </p>
            </div>
            <Toggle id="pref-autoplay" checked={prefs.autoPlay} onChange={v => update({ autoPlay: v })} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--foreground)', fontWeight: 500, marginBottom: 4 }}>
                Metronome
              </p>
              <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                Play a click track alongside generated patterns
              </p>
            </div>
            <Toggle id="pref-metronome" checked={prefs.metronome} onChange={v => update({ metronome: v })} />
          </div>
        </div>
      </SectionCard>

      {/* Export */}
      <SectionCard>
        <SectionLabel>Export</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <FieldLabel htmlFor="pref-format">Default format</FieldLabel>
            <SelectField
              id="pref-format"
              value={prefs.exportFormat}
              onChange={v => update({ exportFormat: v as 'midi' | 'wav' })}
              options={[
                { value: 'midi', label: 'MIDI (.mid)' },
                { value: 'wav', label: 'WAV (rendered audio)' },
              ]}
            />
          </div>
          <div>
            <FieldLabel htmlFor="pref-prefix">Custom filename prefix</FieldLabel>
            <TextInput
              id="pref-prefix"
              value={prefs.customPrefix}
              onChange={v => update({ customPrefix: v })}
              placeholder="e.g. myproject"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="pref-pattern">Filename pattern</FieldLabel>
            <TextInput
              id="pref-pattern"
              value={prefs.filenamePattern}
              onChange={v => update({ filenamePattern: v })}
              placeholder="pulp-{genre}-{bpm}"
            />
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
              Variables: {'{genre}'} {'{bpm}'} {'{key}'} {'{scale}'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--foreground)', fontWeight: 500, marginBottom: 4 }}>
              Include tempo track
            </p>
            <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Embed BPM information in exported MIDI files
            </p>
          </div>
          <Toggle id="pref-tempo" checked={prefs.includeTempoTrack} onChange={v => update({ includeTempoTrack: v })} />
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
  weekly_digest: boolean;
  badge_emails: boolean;
  inapp_generation_complete: boolean;
  inapp_badge_earned: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  low_gen_warning: true,
  new_features: true,
  tips: false,
  weekly_digest: false,
  badge_emails: true,
  inapp_generation_complete: true,
  inapp_badge_earned: true,
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
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (stored) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(stored) as Partial<NotifPrefs>) });
    } catch { /* ignore */ }
  }, []);

  function toggle(key: keyof NotifPrefs) {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      if (flashRef.current) clearTimeout(flashRef.current);
      setSaved(true);
      flashRef.current = setTimeout(() => setSaved(false), 1500);
      return next;
    });
  }

  const emailRows: { key: keyof NotifPrefs; label: string; description: string }[] = [
    { key: 'low_gen_warning', label: 'Usage warning', description: 'Alert when approaching a usage limit' },
    { key: 'new_features', label: 'New genres & features', description: 'Product updates, new genres, and releases' },
    { key: 'tips', label: 'Tips & tutorials', description: 'Occasional beat-making tips and tutorials' },
    { key: 'weekly_digest', label: 'Weekly digest', description: 'A weekly summary of your activity and trending patterns' },
    { key: 'badge_emails', label: 'Badge earned', description: 'Email when you unlock a new achievement badge' },
  ];

  const inappRows: { key: keyof NotifPrefs; label: string; description: string }[] = [
    { key: 'inapp_generation_complete', label: 'Generation complete', description: 'In-app toast when a pattern finishes generating' },
    { key: 'inapp_badge_earned', label: 'Badge earned', description: 'In-app toast when you unlock a new badge' },
  ];

  function renderRows(rows: typeof emailRows) {
    return rows.map((row, i) => (
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
        <Toggle id={`notif-${row.key}`} checked={prefs[row.key]} onChange={() => toggle(row.key)} />
      </div>
    ));
  }

  return (
    <div className="space-y-3">
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Email notifications</SectionLabel>
          <SavedBadge visible={saved} />
        </div>
        <div>{renderRows(emailRows)}</div>
      </SectionCard>

      <SectionCard>
        <SectionLabel>In-app notifications</SectionLabel>
        <div>{renderRows(inappRows)}</div>
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

function UsageSection() {
  return (
    <div className="space-y-3">
      <SectionCard>
        <UsageDashboard />
      </SectionCard>
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
              color: 'var(--text)',
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
          {activeTab === 'usage' && <UsageSection />}
          {activeTab === 'preferences' && <PreferencesSection />}
          {activeTab === 'notifications' && <NotificationsSection />}
          {activeTab === 'danger' && <DangerSection />}

          {/* Help & Support — always visible */}
          <div style={{ marginTop: 40 }}>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 40 }} />
            <SectionCard>
              <SectionLabel>Help &amp; Support</SectionLabel>
              <p style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Have a question or need help? Chat with our support team directly.
              </p>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  try {
                    window.$crisp?.push(['do', 'chat:show']);
                    window.$crisp?.push(['do', 'chat:open']);
                  } catch { /* ignore */ }
                }}
              >
                Chat with support
              </button>
            </SectionCard>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}


