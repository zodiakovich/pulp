/** Site URL for canonical, sitemap, robots, JSON-LD (no trailing slash). */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pulp.bypapaya.com').replace(/\/$/, '');

/** Prefer WebP for smaller OG payload; PNG kept for legacy sharers. */
export const ogImagePath = '/og-image.webp';

export const defaultDescription =
  'pulp turns text prompts into editable MIDI: melody, chords, bass, and drums with key and tempo controls, piano roll editing, and DAW-ready export.';

/** Resolved page title for subpages: "Segment — pulp | AI MIDI Generator" */
export function pageTitle(segment: string): string {
  return `${segment} — pulp | AI MIDI Generator`;
}

/** Trim to a single line and cap length for meta descriptions. */
export function clipDescription(s: string, max = 160): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}
