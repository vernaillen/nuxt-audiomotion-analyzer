export default defineNuxtConfig({
  modules: ['../src/module'],
  nuxtAudiomotionAnalyzer: {
    defaultOptions: {
      height: 400
    }
  },
  compatibilityDate: '2026-04-25',
  devtools: { enabled: true },
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-kit',
        '@vue/devtools-core',
        'audiomotion-analyzer'
      ]
    }
  }
})
