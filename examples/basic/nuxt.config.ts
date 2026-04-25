// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    'nuxt-audiomotion-analyzer',
    '@nuxt/eslint',
    '@nuxt/ui'
  ],
  devtools: { enabled: true },
  compatibilityDate: '2026-04-25',
  css: ['~/assets/css/main.css'],
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-kit',
        '@vue/devtools-core',
        'audiomotion-analyzer'
      ]
    }
  },
  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    },
    checker: {
      lintOnStart: true,
      fix: true,
      eslintPath: 'eslint'
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
