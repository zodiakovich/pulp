# pulp — AI MIDI Generator

## Stack
Next.js 15, TypeScript, Tailwind CSS, Clerk auth, Supabase, Framer Motion

## Brand colors
#09090B background, #FF6D3F primary, #00B894 success, #E94560 hot

## Rules
- NEVER touch music-engine.ts, midi-writer.ts, audio-engine.ts
- All spacing on 8px scale only
- Run npm run build after every change

## File structure
- src/lib/music-engine.ts — rule-based MIDI engine (don't touch)
- src/lib/midi-writer.ts — .mid file generator (don't touch)
- src/lib/audio-engine.ts — Web Audio API (don't touch)
- src/app/api/parse-prompt — Haiku API route
- src/lib/supabase.ts — Supabase client

## Approach
- Think before acting. Read existing files before writing code.
- Prefer editing over rewriting whole files.
- Do not re-read files already read unless they may have changed.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct. No over-engineering.
- No abstractions for single-use operations.
- No speculative features or "you might also want..."
- State bugs and fixes directly. Stop there.
- User instructions always override this file.
