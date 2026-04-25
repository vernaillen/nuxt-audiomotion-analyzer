# nuxt-audiomotion-analyzer

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

A Nuxt 4 module that wraps [audioMotion-analyzer](https://audiomotion.dev/) — a high-resolution real-time audio spectrum analyzer based on the Web Audio API — and exposes it as a ready-to-use `<NuxtAudioMotionAnalyzer>` component.

Point it at any `HTMLMediaElement` (e.g. `<audio>`, `<video>`) or Web Audio `AudioNode` and you get a reactive, configurable spectrum visualizer with gradients, radial mode, fullscreen toggling, and all the options the underlying library supports.

## Features

- 🎚️ Drop-in `<NuxtAudioMotionAnalyzer>` component, auto-imported
- 🎨 Full access to audioMotion-analyzer options (modes, gradients, reflex, peaks, …)
- 🔁 Reactive — change `options` and the analyzer updates live
- 🖥️ Reactive `fullScreen` prop
- 🌈 Custom gradient registration via the `gradient` prop
- ⚙️ Project-wide defaults via `nuxt.config.ts`

## Installation

```bash
pnpm add nuxt-audiomotion-analyzer
# or
npx nuxi module add nuxt-audiomotion-analyzer
```

Add it to your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['nuxt-audiomotion-analyzer'],

  // optional — defaults applied to every analyzer instance
  nuxtAudiomotionAnalyzer: {
    defaultOptions: {
      height: 500
    }
  }
})
```

## Usage

```vue
<template>
  <div>
    <button @click="isPlaying ? audio?.pause() : audio?.play()">
      {{ isPlaying ? 'Pause' : 'Play' }}
    </button>

    <audio
      id="audio"
      ref="audioRef"
      src="https://ice2.somafm.com/beatblender-128-mp3"
      crossorigin="anonymous"
    />

    <NuxtAudioMotionAnalyzer
      :source="audio"
      :options="options"
      :full-screen="isFullscreen"
    />

    <button @click="isFullscreen = !isFullscreen">Fullscreen</button>
    <label>
      Radial <input v-model="options.radial" type="checkbox">
    </label>
  </div>
</template>

<script setup lang="ts">
import type { Options } from 'audiomotion-analyzer'

const options = ref<Options>({
  mode: 5,
  barSpace: 0.25,
  gradient: 'rainbow',
  radial: false,
  reflexAlpha: 0.25,
  reflexRatio: 0.3,
  showPeaks: true
})

const audio = ref<HTMLMediaElement>()
const isPlaying = ref(false)
const isFullscreen = ref(false)

onMounted(() => {
  audio.value = document.getElementById('audio') as HTMLMediaElement
  audio.value.onplaying = () => (isPlaying.value = true)
  audio.value.onpause = () => (isPlaying.value = false)
})
</script>
```

## Component API

### `<NuxtAudioMotionAnalyzer>`

| Prop         | Type                                       | Description                                                                  |
| ------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `source`     | `HTMLMediaElement \| AudioNode \| undefined` | Audio source to analyze. Required (the analyzer initializes once it exists). |
| `options`    | `ConstructorOptions`                       | audioMotion-analyzer options. Reactive — updates are applied live.           |
| `gradient`   | `GradientOptions`                          | Custom gradient, registered as `'custom-gradient'` and applied automatically. |
| `fullScreen` | `boolean`                                  | Toggle the analyzer's fullscreen mode.                                       |
| `id`         | `string`                                   | Optional DOM id for the wrapper element.                                     |

See the [audioMotion-analyzer docs](https://audiomotion.dev/#/?id=options-object) for the full list of supported options.

## Module Options

```ts
interface ModuleOptions {
  defaultOptions?: import('audiomotion-analyzer').Options
}
```

Defaults are merged with the per-component `options` prop (component options win on conflict).

## Development

```bash
# Install dependencies
pnpm install

# Generate type stubs
pnpm dev:prepare

# Develop with the playground
pnpm dev

# Build the playground
pnpm dev:build

# Lint / typecheck / test
pnpm lint
pnpm typecheck
pnpm test
```

## License

[MIT](./LICENSE) — built on top of [audioMotion-analyzer](https://github.com/hvianna/audioMotion-analyzer) by Henrique Vianna.

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/nuxt-audiomotion-analyzer/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/nuxt-audiomotion-analyzer

[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-audiomotion-analyzer.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npmjs.com/package/nuxt-audiomotion-analyzer

[license-src]: https://img.shields.io/npm/l/nuxt-audiomotion-analyzer.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/nuxt-audiomotion-analyzer

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
