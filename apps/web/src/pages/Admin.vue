<script setup lang="ts">
import { api } from '@level-up/auth'
import { WButton, WCard } from '@level-up/ui'
import { ref } from 'vue'

const roles = ref<string[]>([])
const error = ref('')

async function load() {
  error.value = ''
  try {
    roles.value = (await api<{ roles: string[] }>('/api/admin/roles')).roles
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Xatolik'
  }
}
</script>

<template>
  <WCard title="Admin">
    <p>Bu sahifaga faqat <code>role.manage</code> huquqi borlar kiradi (route guard).</p>
    <WButton type="primary" @click="load">Rollarni yuklash</WButton>
    <p v-if="error" role="alert">{{ error }}</p>
    <ul v-if="roles.length">
      <li v-for="role in roles" :key="role">{{ role }}</li>
    </ul>
    <p class="hint">
      Server ham alohida tekshiradi — guard'ni brauzerda chetlab o'tsangiz ham
      <code>/api/admin/roles</code> 403 qaytaradi.
    </p>
  </WCard>
</template>

<style scoped>
.hint {
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
