import React from 'react';

export const AVATAR_COLORS = [
  '#FF6D3F', // papaya orange (brand primary)
  '#00B894', // emerald green (success)
  '#7C3AED', // violet
  '#2563EB', // blue
  '#DC2626', // red
  '#D97706', // amber
  '#059669', // teal
  '#8A8A9A', // slate
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** Deterministic color from userId — same ID always gets the same color. */
export function deriveAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash * 31) + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] as string;
}

export interface UserAvatarProps {
  userId?: string;
  name?: string;
  imageUrl?: string | null;
  /** Persisted color override. Falls back to deriveAvatarColor(userId). */
  avatarColor?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function UserAvatar({
  userId,
  name,
  imageUrl,
  avatarColor,
  size = 32,
  className,
  style,
}: UserAvatarProps) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const color = avatarColor ?? (userId ? deriveAvatarColor(userId) : AVATAR_COLORS[0]);
  const fontSize = Math.round(size * 0.38);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name ?? 'Avatar'}
        width={size}
        height={size}
        className={className}
        style={{
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      className={className}
      aria-label={name ?? 'Avatar'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `${color}20`,
        border: `1.5px solid ${color}55`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color,
        fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
        fontWeight: 700,
        fontSize,
        letterSpacing: '-0.01em',
        userSelect: 'none',
        ...style,
      }}
    >
      {initial}
    </div>
  );
}
