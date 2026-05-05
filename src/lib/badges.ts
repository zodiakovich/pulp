import { supabaseAdmin } from './supabase-admin';

export type BadgeId =
  | 'first_note'
  | 'genre_explorer'
  | 'export_master'
  | 'week_streak'
  | 'prolific'
  | 'collaborator'
  | 'studio_session';

export type BadgeDef = {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
};

export const BADGE_DEFS: BadgeDef[] = [
  { id: 'first_note',     name: 'First Note',      description: 'Generate your first MIDI',          icon: '🎵' },
  { id: 'genre_explorer', name: 'Genre Explorer',   description: 'Try 5 different genres',            icon: '🗺️' },
  { id: 'export_master',  name: 'Export Master',    description: 'Generate 10 MIDIs',                 icon: '💾' },
  { id: 'week_streak',    name: 'Week Streak',      description: 'Generate on 7 different days',      icon: '🔥' },
  { id: 'prolific',       name: 'Prolific',         description: 'Generate 50 MIDIs total',           icon: '⚡' },
  { id: 'collaborator',   name: 'Collaborator',     description: 'Share a generation publicly',       icon: '🤝' },
  { id: 'studio_session', name: 'Studio Session',   description: 'Generate 5 MIDIs in one day',       icon: '🎹' },
];

export const BADGE_MAP: Record<BadgeId, BadgeDef> = Object.fromEntries(
  BADGE_DEFS.map(b => [b.id, b]),
) as Record<BadgeId, BadgeDef>;

export type EarnedBadge = BadgeDef & { earned_at: string };

/** Check all conditions and award any newly earned badges. Returns newly awarded badges. */
export async function checkAndAwardBadges(userId: string): Promise<BadgeDef[]> {
  if (!supabaseAdmin) return [];

  // Fetch already-earned badges
  const { data: earned, error: earnedError } = await supabaseAdmin
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);

  if (earnedError) {
    console.error('[badges] failed to fetch earned badges', earnedError);
    return [];
  }

  const earnedSet = new Set<string>((earned ?? []).map((r: { badge_id: string }) => r.badge_id));
  const unearned = BADGE_DEFS.filter(b => !earnedSet.has(b.id));
  if (!unearned.length) return [];

  // Fetch generation data needed for condition checks
  const { data: gens, error: gensError } = await supabaseAdmin
    .from('generations')
    .select('genre, created_at')
    .eq('user_id', userId);

  if (gensError || !gens) {
    console.error('[badges] failed to fetch generation data', gensError);
    return [];
  }

  const totalCount = gens.length;
  const distinctGenres = new Set(gens.map((g: { genre: string }) => g.genre)).size;
  const distinctDates = new Set(
    gens.map((g: { created_at: string }) => g.created_at.slice(0, 10)),
  ).size;

  const perDay = new Map<string, number>();
  for (const g of gens) {
    const day = (g as { created_at: string }).created_at.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const maxPerDay = perDay.size > 0 ? Math.max(...perDay.values()) : 0;

  const toAward: BadgeId[] = [];
  for (const badge of unearned) {
    let met = false;
    switch (badge.id) {
      case 'first_note':      met = totalCount >= 1;     break;
      case 'genre_explorer':  met = distinctGenres >= 5; break;
      case 'export_master':   met = totalCount >= 10;    break;
      case 'week_streak':     met = distinctDates >= 7;  break;
      case 'prolific':        met = totalCount >= 50;    break;
      case 'collaborator':    met = totalCount >= 1;     break; // every gen gets a public URL
      case 'studio_session':  met = maxPerDay >= 5;      break;
    }
    if (met) toAward.push(badge.id);
  }

  if (!toAward.length) return [];

  // Upsert and confirm persistence before telling the UI a badge was earned.
  const { error: upsertError } = await supabaseAdmin
    .from('user_badges')
    .upsert(
      toAward.map(id => ({ user_id: userId, badge_id: id })),
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
    );

  if (upsertError) {
    console.error('[badges] failed to persist badges', upsertError);
    return [];
  }

  const { data: persisted, error: persistedError } = await supabaseAdmin
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)
    .in('badge_id', toAward);

  if (persistedError) {
    console.error('[badges] failed to confirm persisted badges', persistedError);
    return [];
  }

  const persistedSet = new Set((persisted ?? []).map((r: { badge_id: string }) => r.badge_id));
  return toAward.filter(id => persistedSet.has(id)).map(id => BADGE_MAP[id]);
}
/** Fetch all badges for a user with earned timestamps. */
export async function getUserBadges(userId: string): Promise<EarnedBadge[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', userId)
    .order('earned_at', { ascending: true });

  return (data ?? []).map((r: { badge_id: string; earned_at: string }) => ({
    ...BADGE_MAP[r.badge_id as BadgeId],
    earned_at: r.earned_at,
  })).filter(b => b.id);
}

