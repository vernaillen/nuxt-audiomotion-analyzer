<template>
  <div>
    <button @click="isPlaying ? audio?.pause() : audio?.play()">
      {{ isPlaying ? 'Pause' : 'Play' }}
    </button>
    <br><br>
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
    <button @click="isFullscreen = !isFullscreen">
      Fullscreen
    </button><br>
    Radial <input
      v-model="options.radial"
      type="checkbox"
    >
  </div>
</template>

<script setup lang="ts">
import type { Options } from 'audiomotion-analyzer'

const options = ref<Options>({
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
})

const audio = ref<HTMLMediaElement>()
const isPlaying = ref(false)
const isFullscreen = ref(false)
onMounted(() => {
  audio.value = document.getElementById('audio') as HTMLMediaElement
  audio.value.onplaying = () => {
    isPlaying.value = true
  }
  audio.value.onpause = () => {
    isPlaying.value = false
  }
})
</script>
