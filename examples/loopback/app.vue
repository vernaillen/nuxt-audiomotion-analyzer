<script setup lang="ts">
useHead({
  title: 'Nuxt AudioMotion Analyzer - Loopback Capture',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <div id="app">
    <header>
      <h1>Nuxt AudioMotion Analyzer - Loopback Capture</h1>
    </header>
    <main>
      <NuxtPage />
    </main>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #1a1a2e;
  color: #eee;
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  padding: 1rem;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
}

header h1 {
  font-size: 1.25rem;
  font-weight: 500;
}

main {
  flex: 1;
  padding: 1rem;
}
</style>
