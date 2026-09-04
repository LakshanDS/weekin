import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

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
      titleTemplate: (title) => (title ? `${title} · WeekLog` : 'WeekLog'),
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap',
        },
      ],
    },
  },
})
