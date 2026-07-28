<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <section class="lu-card">
    <h2 v-if="title" class="lu-card__title">{{ title }}</h2>
    <slot />
  </section>
</template>

<style scoped>
.lu-card {
  border: 1px solid var(--lu-border, #e5e7eb);
  border-radius: 10px;
  padding: 1.25rem;
}
.lu-card__title {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
}
</style>
