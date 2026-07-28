<script setup lang="ts">
import { useAuth } from '@level-up/auth'
import { LuThemeProvider, WButton } from '@level-up/ui'
import { useRouter } from 'vue-router'

const { isAuthenticated, logout } = useAuth()
const router = useRouter()

async function onLogout() {
  await logout()
  router.push('/')
}
</script>

<template>
  <LuThemeProvider>
    <header>
      <strong>Level Up — Admin</strong>
      <WButton v-if="isAuthenticated" quaternary @click="onLogout">Chiqish</WButton>
    </header>
    <main>
      <RouterView />
    </main>
  </LuThemeProvider>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}
main {
  max-width: 42rem;
  margin: 2rem auto;
  padding: 0 1.5rem;
}
</style>
