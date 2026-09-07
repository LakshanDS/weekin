import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

// Only unit tests run here; integration tests hit a dev server over HTTP.
export default defineConfig({
  // bun auto-loads .env, but vitest workers run on node — pass it through explicitly
  test: {
    env: loadEnv('test', process.cwd(), ''),
  },
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
