import { defineNuxtModule, createResolver, addComponent } from '@nuxt/kit'
import type { ModuleOptions } from './types'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-audiomotion-analyzer',
    configKey: 'nuxtAudiomotionAnalyzer'
  },
  defaults: {
    defaultOptions: {
      height: 500
    }
  },
  setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    const resolveRuntimeModule = (path: string) => resolve('./runtime', path)

    const publicConfig: ModuleOptions = {
      defaultOptions: options.defaultOptions
    }
    nuxt.options.runtimeConfig.public.nuxtAudiomotionAnalyzer = publicConfig

    addComponent({ name: 'NuxtAudioMotionAnalyzer', filePath: resolveRuntimeModule('./components/NuxtAudioMotionAnalyzer') })
  }
})

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    nuxtAudiomotionAnalyzer: ModuleOptions
  }
}
