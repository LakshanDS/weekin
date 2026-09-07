import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Only unit tests run here; integration tests hit a dev server over HTTP.
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
