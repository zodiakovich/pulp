import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Ensure E2E bypass mode is enabled for auth-gated flows (Windows-friendly).
    command: 'cmd /c "set NEXT_PUBLIC_E2E=1&& npm run build&& npm run start -- -p 3000"',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 300_000,
  },
});

