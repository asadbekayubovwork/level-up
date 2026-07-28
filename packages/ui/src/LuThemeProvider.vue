<script setup lang="ts">
import { WConfigProvider, WGlobalStyle, WMessageProvider } from '@webaseltd/ui'
import { themeOverrides } from './theme'
</script>

<template>
  <!-- Har app root'da shuni o'raydi — theme bitta joydan keladi, app'lar bir xil ko'rinadi -->
  <WConfigProvider :theme-overrides="themeOverrides">
    <WGlobalStyle />
    <WMessageProvider>
      <slot />
    </WMessageProvider>
  </WConfigProvider>
</template>
