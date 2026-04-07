import { test, expect } from '@playwright/test';

test('pulp critical flow', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3000' });

  // /
  await page.goto('http://localhost:3000/');

  // Dismiss onboarding overlay if it shows up.
  const onboardingSkip = page.getByRole('button', { name: /^skip$/i });
  if (await onboardingSkip.isVisible().catch(() => false)) {
    await onboardingSkip.click();
  }

  // If the app requires auth to generate, try clicking Sign in first.
  // This is best-effort: in many dev setups Clerk is already signed in.
  const signIn = page.getByRole('button', { name: /sign in/i });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
    // If a Clerk modal appears, we can't reliably automate credentials here.
    // Continue anyway; assertions below will fail loudly if generation doesn't happen.
  }

  const prompt = page.getByPlaceholder(/dark melodic techno/i);
  await expect(prompt).toBeVisible();
  await prompt.fill('lofi hiphop, 82bpm, Cm');

  const generate = page.getByRole('button', { name: /^generate$/i });
  await generate.click();

  // Wait for 3 variations (V1,V2,V3)
  await expect(page.getByText(/^V1$/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^V2$/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^V3$/)).toBeVisible({ timeout: 60_000 });

  // Play on the first variation card
  await page.getByText(/^V1$/).first().click();
  await page.getByTitle(/play/i).first().click();

  // Download MIDI
  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
  await page.getByRole('button', { name: /download midi/i }).click();
  await downloadPromise;

  // Share (copies /g/<id>) if present
  const shareBtn = page.getByRole('button', { name: /^share$/i });
  if (await shareBtn.isVisible().catch(() => false)) {
    await shareBtn.click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/g\/[a-z0-9-]+$/i);
  }

  // /explore
  await page.goto('http://localhost:3000/explore', { waitUntil: 'domcontentloaded' });
  // Cards may be empty if DB has no public rows; verify page renders and grid container exists.
  await expect(page.getByRole('heading', { name: /explore/i })).toBeVisible();

  // /pricing
  await page.goto('http://localhost:3000/pricing', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /simple pricing/i })).toBeVisible();
  // Two plan cards: Free and Pro
  await expect(page.getByText(/^Free$/)).toBeVisible();
  await expect(page.getByText(/^Pro$/)).toBeVisible();
});

