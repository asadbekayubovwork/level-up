<script setup lang="ts">
import { useAuth } from '@level-up/auth'
import { WButton, WCard } from '@level-up/ui'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const { loginWithPassword, isAuthenticated, user } = useAuth()
const router = useRouter()
const error = ref('')

async function login(username: string) {
  error.value = ''
  try {
    await loginWithPassword(username, 'demo')
    router.push({ name: 'roles' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Xatolik'
  }
}
</script>

<template>
  <WCard title="Admin panel">
    <p v-if="isAuthenticated">Kirdingiz: <strong>{{ user?.name }}</strong></p>
    <p>Bir xil <code>@level-up/auth</code> paketi, boshqa app. Guard ham, session ham bir xil.</p>
    <div class="row">
      <WButton type="primary" @click="login('admin')">admin sifatida kirish</WButton>
      <WButton quaternary @click="login('user')">user sifatida kirish (403 chiqadi)</WButton>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </WCard>
</template>

<style scoped>
.row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>
