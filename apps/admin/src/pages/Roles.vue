<script setup lang="ts">
import { api } from '@level-up/auth'
import { WCard } from '@level-up/ui'
import { onMounted, ref } from 'vue'

const roles = ref<string[]>([])
const error = ref('')

onMounted(async () => {
  try {
    roles.value = (await api<{ roles: string[] }>('/api/admin/roles')).roles
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Xatolik'
  }
})
</script>

<template>
  <WCard title="Rollar">
    <p v-if="error" role="alert">{{ error }}</p>
    <ul>
      <li v-for="role in roles" :key="role">{{ role }}</li>
    </ul>
  </WCard>
</template>
