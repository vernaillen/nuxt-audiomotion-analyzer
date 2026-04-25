<script setup lang="ts">
useHead({
  title: 'Nuxt AudioMotion Analyzer',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <div class="text-xl font-bold relative">
          Nuxt AudioMotion Analyzer
        </div>
      </template>
      <template #right>
        <UColorModeButton />
        <UButton
          to="https://github.com/vernaillen/nuxt-audiomotion-analyzer"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UHeader>
    <UMain>
      <NuxtPage />
    </UMain>
    <UFooter>
      <template #left>
        Copyright © {{ new Date().getFullYear() }} - Wouter Vernaillen
      </template>
    </UFooter>
  </UApp>
</template>
