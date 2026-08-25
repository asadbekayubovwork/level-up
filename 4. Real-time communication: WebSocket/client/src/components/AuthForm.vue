<script setup lang="ts">
import { ref } from 'vue'
import { auth, state } from '../chat'

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const show = ref(false)

function submit() {
  auth(mode.value, username.value.trim(), password.value)
}
</script>

<template>
  <form class="card auth" @submit.prevent="submit">
    <div class="brand">
      <span class="pulse" />
      <h1>TeamPulse</h1>
    </div>
    <p class="tagline">Realtime chat hub for your team</p>

    <div class="tabs">
      <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">Log in</button>
      <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">Register</button>
    </div>

    <label>
      Username
      <input v-model="username" autocomplete="username" placeholder="jasur" required minlength="3" maxlength="20" />
    </label>

    <label>
      Password
      <div class="password">
        <input
          v-model="password"
          :type="show ? 'text' : 'password'"
          autocomplete="current-password"
          placeholder="••••••"
          required
          minlength="6"
        />
        <button
          type="button"
          class="eye"
          :aria-label="show ? 'Hide password' : 'Show password'"
          :aria-pressed="show"
          @click="show = !show"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
            <circle cx="12" cy="12" r="3.2" />
            <path v-if="show" d="m4 20 16-16" />
          </svg>
        </button>
      </div>
    </label>

    <p v-if="state.error" class="error">{{ state.error }}</p>

    <button type="submit" :disabled="state.pending">
      {{ state.pending ? 'Connecting…' : mode === 'login' ? 'Log in' : 'Create account' }}
    </button>
  </form>
</template>

<style scoped>
.auth {
  width: 400px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand h1 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.5px;
}
.pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 0 0 rgb(61 220 132 / 60%);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  70% { box-shadow: 0 0 0 12px rgb(61 220 132 / 0%); }
  100% { box-shadow: 0 0 0 0 rgb(61 220 132 / 0%); }
}
.tagline {
  margin: -12px 0 4px;
  color: var(--muted);
  font-size: 14px;
}
.tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--panel-2);
  border-radius: 10px;
}
.tabs button {
  flex: 1;
  background: transparent;
  color: var(--muted);
  padding: 8px;
  font-size: 14px;
}
.tabs button.active {
  background: var(--accent-soft);
  color: var(--text);
}
.password { position: relative; }
.password input { padding-right: 44px; }
.eye {
  position: absolute;
  right: 4px;
  top: 50%;
  translate: 0 -50%;
  display: grid;
  place-items: center;
  padding: 7px;
  background: transparent;
  color: var(--muted);
}
.eye:hover { color: var(--text); }

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}
</style>
