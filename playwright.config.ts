import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5180',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npm run dev -- --port 5180',
    port: 5180,
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
