<script setup lang="ts">
import { api, useAuth } from '@level-up/auth'
import { WButton, WCard } from '@level-up/ui'
import { ref } from 'vue'
import type { User } from '@level-up/auth'

const { user, can } = useAuth()
const fetched = ref<User | null>(null)
const error = ref('')

// Har bosganda /api/me ga boradi. Token muddati tugagan bo'lsa — client
// avval refresh qiladi, keyin so'rov ketadi. Network tab'da ko'rinadi.
async function callMe() {
  error.value = ''
  try {
    fetched.value = await api<User>('/api/me')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Xatolik'
  }
}
</script>

<template>
  <WCard title="Profil">
    <p><strong>{{ user?.name }}</strong> (id: {{ user?.id }})</p>
    <p>Huquqlar: <code>{{ user?.permissions.join(', ') }}</code></p>
    <p>role.manage bormi: <strong>{{ can('role.manage') ? 'ha' : 'yo\'q' }}</strong></p>

    <WButton type="primary" @click="callMe">/api/me ni chaqirish</WButton>
    <p v-if="error" role="alert">{{ error }}</p>
    <pre v-if="fetched">{{ fetched }}</pre>

    <p class="hint">
      Access token TTL — 30 soniya. 30s kutib bu tugmani bosing: Network tab'da avval
      <code>/auth/refresh</code>, keyin <code>/api/me</code> ketadi. Sahifa uzilmaydi.
    </p>
  </WCard>
</template>

<style scoped>
pre {
  background: #f3f4f6;
  padding: 0.75rem;
  border-radius: 6px;
  overflow-x: auto;
}
.hint {
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
