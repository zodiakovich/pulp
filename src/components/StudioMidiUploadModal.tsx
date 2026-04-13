'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { GenerationParams, GenerationResult } from '@/lib/music-engine';
import type { PlanType } from '@/lib/credits';

export type MidiUploadSuccessPayload = {
  prompt: string;
  params: GenerationParams;
  variations: { result: GenerationResult; params: GenerationParams }[];
  credits: { credits_used: number; limit: number; is_pro: boolean; plan_type: PlanType };
  variationIds: (string | null)[];
};

const PANEL = 'var(--surface)';
const BORDER = 'var(--border)';
const DASH = 'rgba(255,255,255,0.12)';
const ACCENT = '#FF6D3F';
const MUTED = 'var(--muted)';
const CTA_TEXT = 'var(--on-accent)';
const MAX_BYTES = 2 * 1024 * 1024;

type Mode = 'continue' | 'vary';

function extOk(name: string) {
  const l = name.toLowerCase();
  return l.endsWith('.mid') || l.endsWith('.midi');
}

export function StudioMidiUploadModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: MidiUploadSuccessPayload) => void;
}) {
  const [mode, setMode] = useState<Mode>('continue');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setMode('continue');
    setDragOver(false);
    setFileName(null);
    setFileBase64(null);
    setError(null);
    setLoading(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const ingestFile = useCallback((file: File) => {
    setError(null);
    if (!extOk(file.name)) {
      setError('Use a .mid or .midi file.');
      setFileName(null);
      setFileBase64(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Max file size is 2 MB.');
      setFileName(null);
      setFileBase64(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      if (typeof res !== 'string') {
        setError('Could not read file.');
        return;
      }
      const i = res.indexOf('base64,');
      const b64 = i >= 0 ? res.slice(i + 7) : res;
      setFileBase64(b64);
      setFileName(file.name);
    };
    reader.onerror = () => setError('Read failed.');
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) ingestFile(f);
    },
    [ingestFile],
  );

  const onGenerate = async () => {
    if (!fileBase64) {
      setError('Drop a MIDI file first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/midi-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, mode }),
      });
      const data = (await res.json().catch(() => ({}))) as MidiUploadSuccessPayload & { error?: string };
      if (res.status === 401) {
        window.location.href = '/sign-in';
        return;
      }
      if (res.status === 403) {
        setError('Studio plan required.');
        return;
      }
      if (res.status === 429) {
        setError(data.error === 'Monthly limit reached' ? 'Monthly limit reached.' : 'Rate limited. Try again later.');
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Upload failed.');
        return;
      }
      if (!data.variations?.length) {
        setError('Invalid response.');
        return;
      }
      onSuccess(data);
      handleClose();
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[85]"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            aria-hidden
          />
          <motion.div
            className="fixed left-1/2 top-1/2 z-[86] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
            style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 16 }}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="midi-upload-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 id="midi-upload-title" className="text-lg font-bold" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                Upload MIDI
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-2 py-1 text-sm"
                style={{ color: MUTED, background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div
              className="mb-5 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
              style={{
                borderColor: dragOver ? ACCENT : DASH,
                background: 'rgba(9,9,11,0.35)',
              }}
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.mid,.midi,audio/midi,audio/x-midi';
                input.onchange = () => {
                  const f = input.files?.[0];
                  if (f) ingestFile(f);
                };
                input.click();
              }}
            >
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: MUTED }}>
                Drag & drop .mid / .midi (max 2 MB)
              </p>
              {fileName && (
                <p className="mt-2 text-sm font-medium" style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text)' }}>
                  {fileName}
                </p>
              )}
            </div>

            <p className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ fontFamily: 'DM Sans, sans-serif', color: MUTED }}>
              Mode
            </p>
            <div className="mb-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  background: mode === 'continue' ? ACCENT : 'transparent',
                  color: mode === 'continue' ? CTA_TEXT : MUTED,
                  border: mode === 'continue' ? `1px solid ${ACCENT}` : `1px solid ${DASH}`,
                }}
                onClick={() => setMode('continue')}
              >
                Continue
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
                style={{
                  fontFamily: 'DM Sans, sans-serif',
                  background: mode === 'vary' ? ACCENT : 'transparent',
                  color: mode === 'vary' ? CTA_TEXT : MUTED,
                  border: mode === 'vary' ? `1px solid ${ACCENT}` : `1px solid ${DASH}`,
                }}
                onClick={() => setMode('vary')}
              >
                Vary
              </button>
            </div>

            {error && (
              <p className="mb-4 text-sm" style={{ fontFamily: 'DM Sans, sans-serif', color: ACCENT }}>
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={loading || !fileBase64}
              className="w-full rounded-xl py-4 text-base font-semibold transition-opacity disabled:opacity-40"
              style={{ background: ACCENT, color: CTA_TEXT, fontFamily: 'DM Sans, sans-serif' }}
              onClick={() => void onGenerate()}
            >
              {loading ? 'Generating…' : 'Generate'}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
