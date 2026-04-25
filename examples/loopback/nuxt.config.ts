// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    'nuxt-audiomotion-analyzer'
  ],
  devtools: { enabled: true },
  compatibilityDate: '2024-04-03',
  nitro: {
    experimental: {
      websocket: true
    }
  },
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
      mode: 5,
      barSpace: 0.25,
      gradient: 'rainbow',
      ledBars: false,
      lumiBars: false,
      radial: false,
      reflexAlpha: 0.25,
      reflexBright: 1,
      reflexFit: true,
      reflexRatio: 0.3,
      showBgColor: false,
      showPeaks: true,
      overlay: false
    }
  }
})
