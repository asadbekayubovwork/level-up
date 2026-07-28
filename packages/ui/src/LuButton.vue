<script setup lang="ts">
import type { ButtonVariant } from './types'

withDefaults(defineProps<{ variant?: ButtonVariant; disabled?: boolean }>(), {
  variant: 'primary',
  disabled: false,
})

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <button class="lu-btn" :class="`lu-btn--${variant}`" :disabled="disabled" @click="$emit('click', $event)">
    <slot />
  </button>
</template>

<style scoped>
.lu-btn {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font: inherit;
  cursor: pointer;
}
.lu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.lu-btn--primary {
  background: var(--lu-primary, #3b82f6);
  color: #fff;
}
.lu-btn--ghost {
  background: transparent;
  border-color: currentColor;
}
.lu-btn--danger {
  background: var(--lu-danger, #ef4444);
  color: #fff;
}
</style>
