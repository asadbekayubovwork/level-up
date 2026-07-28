<script setup lang="ts">
import { ref } from 'vue'
import { LuButton, LuCard } from '@level-up/ui'

const count = ref(0)
</script>

<template>
  <main style="max-width: 40rem; margin: 3rem auto; font-family: system-ui">
    <h1>Level Up — Web</h1>
    <LuCard title="@level-up/ui workspace paketidan">
      <p>Bosildi: {{ count }}</p>
      <LuButton @click="count++">Primary</LuButton>
      <LuButton variant="ghost" @click="count = 0">Reset</LuButton>
    </LuCard>
  </main>
</template>
