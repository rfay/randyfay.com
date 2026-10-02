import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')` and `request.get('')`.
     * Defaults to the pre-migration development site (https://randyfay.ddev.site); override to point the exact same suite at a
     * migration target, e.g.:
     *   ddev exec -d /var/www/html/test/playwright 'TEST_BASE_URL=https://migration-a.example.com npx playwright test'
     * (a host-side `TEST_BASE_URL=... ddev playwright ...` is NOT forwarded into the container)
     * See PLAYWRIGHT_TESTING.md for the full strategy. */
    baseURL: process.env.TEST_BASE_URL ?? 'https://randyfay.ddev.site',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Single project by default: the regression-*.spec.ts tiers use Playwright's
   * APIRequestContext (no browser engine involved), so running them once under
   * chromium is enough — running the same HTTP checks again under firefox/webkit would
   * just triple the result count for no signal. visual.spec.ts is deliberately
   * chromium-only too (see PLAYWRIGHT_TESTING.md: cross-browser screenshot diffing is
   * noise, not signal, for a migration baseline). Re-enable firefox/webkit below only if
   * a real cross-browser rendering question comes up. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
