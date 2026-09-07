// Copies .env to .dev.vars so `bun run dev:cf` (wrangler) uses the same
// variables as the Nuxt dev server. Single source of truth: .env
import { readFileSync, writeFileSync } from 'node:fs'

const env = readFileSync('.env', 'utf8')
const lines = env
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith('#'))

writeFileSync('.dev.vars', lines.join('\n') + '\n')
console.log(`synced ${lines.length} variables from .env to .dev.vars`)
