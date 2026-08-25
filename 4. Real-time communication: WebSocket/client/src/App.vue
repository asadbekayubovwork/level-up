<script setup lang="ts">
import { state } from './chat'
import AuthForm from './components/AuthForm.vue'
import ChatRoom from './components/ChatRoom.vue'
</script>

<template>
  <ChatRoom v-if="state.username" />
  <AuthForm v-else />
</template>
