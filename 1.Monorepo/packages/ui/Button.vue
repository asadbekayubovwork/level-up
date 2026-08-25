<script setup>
defineProps({ label: { type: String, required: true } })
</script>

<template>
  <button type="button">{{ label }}</button>
</template>
