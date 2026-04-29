'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { matchSounds, type MatchedSample, type MatchLayer } from '@/lib/match-sounds';
import { setAfroHouseOverride } from '@/lib/afro-house-samples';
import { getAudioContext } from '@/lib/audio-context';
import { stopAllAppAudio, subscribeToAudioStop } from '@/lib/audio-control';

const LAYER_TABS: { key: MatchLayer; label: string }[] = [
  { key: 'melody', label: 'Melody' },
  { key: 'chords', label: 'Chords' },
  { key: 'bass',   label: 'Bass' },
  { key: 'drums',  label: 'Drums' },
];

const CATEGORY_COLOR: Record<string, string> = {
  kick:  '#FF6D3F',
  snare: '#00B894',
  hat:   '#8A8A9A',
  bass:  '#E94560',
  synth: '#A855F7',
  perc:  '#F59E0B',
  clap:  '#38BDF8',
};

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 1v2M6.5 10v2M1 6.5h2M10 6.5h2M2.93 2.93l1.41 1.41M8.66 8.66l1.41 1.41M2.93 10.07l1.41-1.41M8.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" fill="none" aria-hidden>
      <path d="M1.5 1.5l8 4-8 4V1.5z" fill="currentColor"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="currentColor"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

export function MatchSoundsPanel({
  genre,
  onClose,
}: {
  genre: string;
  onClose: () => void;
}) {
  const [activeLayer, setActiveLayer] = useState<MatchLayer>('melody');
  const [samples, setSamples] = useState<MatchedSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [usedUrls, setUsedUrls] = useState<Set<string>>(new Set());

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferCache = useRef(new Map<string, AudioBuffer>());

  const isAfroHouse = genre === 'afro_house' || genre === 'afro-house';

  const stopCurrent = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already ended */ }
      sourceRef.current = null;
    }
    setPlayingUrl(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    stopCurrent();
    setLoading(true);
    setSamples([]);
    matchSounds(genre, activeLayer, 8).then(results => {
      if (!cancelled) {
        setSamples(results);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [genre, activeLayer, stopCurrent]);

  // Stop on unmount
  useEffect(() => {
    return () => {
      stopCurrent();
    };
  }, [stopCurrent]);

  useEffect(() => subscribeToAudioStop(stopCurrent), [stopCurrent]);

  const handlePreview = useCallback(async (sample: MatchedSample) => {
    if (playingUrl === sample.url) {
      stopAllAppAudio();
      return;
    }
    stopAllAppAudio();
    setPlayingUrl(sample.url);

    try {
      let buffer = bufferCache.current.get(sample.url);
      if (!buffer) {
        const res = await fetch(sample.url);
        if (!res.ok) throw new Error('fetch failed');
        const ab = await res.arrayBuffer();
        const ctx = getAudioContext();
        buffer = await ctx.decodeAudioData(ab);
        bufferCache.current.set(sample.url, buffer);
      }
      const ctx = getAudioContext();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start();
      src.onended = () => setPlayingUrl(prev => prev === sample.url ? null : prev);
      sourceRef.current = src;
    } catch {
      setPlayingUrl(null);
    }
  }, [playingUrl, stopCurrent]);

  const handleUse = useCallback((sample: MatchedSample) => {
    if (!isAfroHouse || !sample.afroHouseSlot) return;
    setAfroHouseOverride(sample.afroHouseSlot, sample.filename);
    setUsedUrls(prev => new Set(prev).add(sample.url));
  }, [isAfroHouse]);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 60,
          backdropFilter: 'blur(2px)',
        }}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Match Sounds"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 61,
          width: '92vw',
          maxWidth: 560,
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0D0D12',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#FF6D3F' }}><SparkleIcon /></span>
            <span
              style={{
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '-0.01em',
                color: 'rgba(255,255,255,0.92)',
              }}
            >
              Match Sounds
            </span>
            {!isAfroHouse && (
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.35)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                preview only
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'border-color 120ms, color 120ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            <XIcon />
          </button>
        </div>

        {/* Layer tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '12px 20px 0',
            flexShrink: 0,
          }}
        >
          {LAYER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveLayer(tab.key)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                padding: '6px 12px',
                borderRadius: 8,
                border: activeLayer === tab.key
                  ? '1px solid rgba(255,109,63,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                background: activeLayer === tab.key
                  ? 'rgba(255,109,63,0.12)'
                  : 'transparent',
                color: activeLayer === tab.key ? '#FF6D3F' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer',
                transition: 'border-color 120ms, color 120ms, background 120ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sample list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              Loading samples…
            </div>
          )}

          {!loading && samples.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.30)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              No samples found
            </div>
          )}

          {!loading && samples.map(sample => {
            const isPlaying = playingUrl === sample.url;
            const isUsed = usedUrls.has(sample.url);
            const canUse = isAfroHouse && !!sample.afroHouseSlot;
            const catColor = CATEGORY_COLOR[sample.category] ?? '#8A8A9A';

            return (
              <div
                key={sample.url}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  marginBottom: 4,
                  background: isPlaying ? 'rgba(255,109,63,0.07)' : 'rgba(255,255,255,0.025)',
                  border: isPlaying
                    ? '1px solid rgba(255,109,63,0.25)'
                    : '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 120ms, border-color 120ms',
                }}
              >
                {/* Play/Stop */}
                <button
                  onClick={() => void handlePreview(sample)}
                  aria-label={isPlaying ? 'Stop' : 'Preview'}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: `1px solid ${isPlaying ? 'rgba(255,109,63,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    background: isPlaying ? 'rgba(255,109,63,0.15)' : 'rgba(255,255,255,0.04)',
                    color: isPlaying ? '#FF6D3F' : 'rgba(255,255,255,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'border-color 120ms, color 120ms, background 120ms',
                  }}
                >
                  {isPlaying ? <StopIcon /> : <PlayIcon />}
                </button>

                {/* Category pill */}
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: catColor,
                    background: `${catColor}18`,
                    border: `1px solid ${catColor}35`,
                    borderRadius: 4,
                    padding: '2px 5px',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  {sample.category}
                </span>

                {/* Name */}
                <span
                  style={{
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.75)',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={sample.displayName}
                >
                  {sample.displayName}
                </span>

                {/* Use button */}
                <button
                  onClick={() => handleUse(sample)}
                  disabled={!canUse}
                  title={canUse ? 'Use this sound' : 'Switch to Afro House to slot this sound'}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: isUsed
                      ? '1px solid rgba(0,184,148,0.5)'
                      : canUse
                        ? '1px solid rgba(255,109,63,0.4)'
                        : '1px solid rgba(255,255,255,0.08)',
                    background: isUsed
                      ? 'rgba(0,184,148,0.12)'
                      : canUse
                        ? 'rgba(255,109,63,0.10)'
                        : 'transparent',
                    color: isUsed
                      ? '#00B894'
                      : canUse
                        ? '#FF6D3F'
                        : 'rgba(255,255,255,0.20)',
                    cursor: canUse ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                    transition: 'border-color 120ms, color 120ms, background 120ms',
                  }}
                >
                  {isUsed ? '✓ Used' : 'Use'}
                </button>
              </div>
            );
          })}

          {!loading && !isAfroHouse && samples.length > 0 && (
            <p
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: 'rgba(255,255,255,0.28)',
                textAlign: 'center',
                marginTop: 16,
              }}
            >
              Switch to Afro House genre to slot these sounds directly into layers.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
