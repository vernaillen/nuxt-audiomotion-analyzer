<template>
  <div ref="audioMotionAnalyzerRef" />
</template>

<script setup lang="ts">
import { onMounted, onUpdated, ref, watch } from 'vue'
import type { ConstructorOptions, GradientOptions } from 'audiomotion-analyzer'
import AudioMotionAnalyzer from 'audiomotion-analyzer'
import { useRuntimeConfig } from '#app'

const config = useRuntimeConfig()
const defaultOptions = config.public.nuxtAudiomotionAnalyzer.defaultOptions

const props = defineProps<{
  id?: string
  options?: ConstructorOptions
  gradient?: GradientOptions
  source: HTMLMediaElement | AudioNode | undefined
  fullScreen?: boolean
}>()
const audioMotionAnalyzerRef = ref<HTMLElement>()
let audioMotionAnalyzer: AudioMotionAnalyzer | null = null

onMounted(async () => {
  if (props.source) {
    initAnalyzer()
  } else {
    // wait for source to be available onUpdated
  }
})
onUpdated(() => {
  if (!audioMotionAnalyzer && props.source) {
    initAnalyzer()
  } else if (audioMotionAnalyzer && props.source) {
    const allOptions = { ...defaultOptions, source: props.source, ...props.options }
    audioMotionAnalyzer.setOptions(allOptions)
  } else {
    console.error('no audio source available')
    initAnalyzer()
  }
  if (audioMotionAnalyzer && props.fullScreen !== audioMotionAnalyzer.isFullscreen) {
    audioMotionAnalyzer.toggleFullscreen()
  }
})
const initAnalyzer = () => {
  try {
    const allOptions = { ...defaultOptions, source: props.source, ...props.options }
    audioMotionAnalyzer = new AudioMotionAnalyzer(audioMotionAnalyzerRef.value, allOptions)
    if (props.gradient) {
      audioMotionAnalyzer.registerGradient('custom-gradient', props.gradient)
      audioMotionAnalyzer.setOptions({ gradient: 'custom-gradient' })
    }
  } catch (e) {
    console.error('error mounting NuxtAudioMotionAnalyzer: ', e)
  }
}

if (props.options) {
  const options = ref(props.options)
  watch(options.value, async (newOptions) => {
    if (audioMotionAnalyzer) audioMotionAnalyzer.setOptions(newOptions)
  })
}
</script>
