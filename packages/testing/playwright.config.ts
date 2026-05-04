import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list'
})
