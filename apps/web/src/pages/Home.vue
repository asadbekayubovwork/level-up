<script setup lang="ts">
import { WCard } from '@level-up/ui'
</script>

<template>
  <WCard title="Public sahifa">
    <p>Bu sahifa login talab qilmaydi.</p>
    <p>
      <strong>Profil</strong> — <code>requiresAuth</code>, login'siz kirsangiz login sahifasiga otadi.<br />
      <strong>Admin</strong> — <code>role.manage</code> huquqi kerak. <code>user/demo</code> bilan kirsangiz 403 olasiz.
    </p>
  </WCard>
</template>
