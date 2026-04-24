import { LoopsClient } from 'loops';

export function getLoopsClient(): LoopsClient | null {
  const key = process.env.LOOPS_API_KEY;
  if (!key) return null;
  return new LoopsClient(key);
}
