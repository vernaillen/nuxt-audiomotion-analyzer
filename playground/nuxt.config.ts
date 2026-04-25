export default defineNuxtConfig({
  modules: ['../src/module'],
  devtools: { enabled: true },
  compatibilityDate: '2026-04-25',
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-kit',
        '@vue/devtools-core',
        'audiomotion-analyzer'
      ]
    }
  },
  nuxtAudiomotionAnalyzer: {
    defaultOptions: {
      height: 400
    }
  }
})
