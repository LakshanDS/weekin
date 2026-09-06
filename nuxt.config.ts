import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  // Baseline security headers. A full CSP would break Nuxt's inline
  // styles/scripts — report-only CSP is territory for later.
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "frame-ancestors 'none'",
        // Only enforced over HTTPS; harmless on localhost dev.
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      },
    },
  },

  components: [{ path: '~/components', pathPrefix: false }],

  runtimeConfig: {
    databaseUrl: '',
    jwtSecret: '',
    // AI assistant (any OpenAI-compatible API). Key empty = offline mode.
    aiApiKey: '',
    aiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'gpt-4o-mini',
  },

  app: {
    head: {
      titleTemplate: (title) => (title ? `${title} · WeekIn` : 'WeekIn'),
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=IBM+Plex+Mono:wght@400;500;600&family=Public+Sans:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
})
