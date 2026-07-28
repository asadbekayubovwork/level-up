<script setup lang="ts">
import { useAuth } from '@level-up/auth'
import {
  WAlert,
  WButton,
  WCard,
  WDivider,
  WForm,
  WFormItem,
  WInput,
  WSpace,
  WText,
} from '@level-up/ui'
import type { FormInst, FormRules } from '@level-up/ui'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const { loginWithPassword, loginWithGitHub } = useAuth()
const route = useRoute()
const router = useRouter()

const formRef = ref<FormInst | null>(null)
const model = reactive({ username: 'admin', password: 'demo' })

const rules: FormRules = {
  username: { required: true, message: 'Login kiriting', trigger: ['blur', 'input'] },
  password: { required: true, message: 'Parol kiriting', trigger: ['blur', 'input'] },
}

const error = ref(route.query.error === 'oauth' ? 'GitHub orqali kirish muvaffaqiyatsiz' : '')
const busy = ref(false)

async function onSubmit() {
  error.value = ''
  try {
    await formRef.value?.validate()
  } catch {
    return // validatsiya xatolari WFormItem ostida o'zi ko'rinadi
  }

  busy.value = true
  try {
    await loginWithPassword(model.username, model.password)
    router.push((route.query.next as string) ?? '/profile')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Xatolik'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <WCard title="Kirish">
    <WSpace vertical :size="16">
      <WAlert v-if="error" type="error" closable @close="error = ''">{{ error }}</WAlert>

      <WForm ref="formRef" :model="model" :rules="rules" @submit.prevent="onSubmit">
        <WFormItem label="Login" path="username">
          <WInput
            v-model:value="model.username"
            placeholder="admin"
            :input-props="{ autocomplete: 'username' }"
          />
        </WFormItem>

        <WFormItem label="Parol" path="password">
          <WInput
            v-model:value="model.password"
            type="password"
            show-password-on="mousedown"
            placeholder="demo"
            :input-props="{ autocomplete: 'current-password' }"
          />
        </WFormItem>

        <WButton attr-type="submit" type="primary" block :loading="busy">Kirish</WButton>
      </WForm>

      <WDivider style="margin: 0">yoki</WDivider>

      <WButton block @click="loginWithGitHub">GitHub bilan kirish</WButton>

      <WText depth="3" style="font-size: 0.875rem">
        Demo hisoblar: <WText code>admin/demo</WText> (barcha huquqlar) ·
        <WText code>user/demo</WText> (faqat <WText code>user.view</WText>)
      </WText>
    </WSpace>
  </WCard>
</template>
