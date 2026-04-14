import { redirect } from 'next/navigation';

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const prompt = typeof sp.prompt === 'string' ? sp.prompt : undefined;
  const history = typeof sp.history === 'string' ? sp.history : undefined;

  const qs = new URLSearchParams();
  qs.set('mode', 'generate');
  if (prompt) qs.set('prompt', prompt);
  if (history) qs.set('history', history);

  redirect(`/?${qs.toString()}`);
}

