<script setup lang="ts">
import { useAuth } from '@level-up/auth'
import {
  LuThemeProvider,
  WAvatar,
  WButton,
  WFlex,
  WLayout,
  WLayoutContent,
  WLayoutHeader,
  WMenu,
  WSpin,
  WText,
} from '@level-up/ui'
import type { MenuOption } from '@level-up/ui'
import { computed, h } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

const { user, isAuthenticated, isRestoring, logout } = useAuth()
const router = useRouter()
const route = useRoute()

// WMenu aktiv sahifani `value` bo'yicha o'zi belgilaydi — qo'lda `.router-link-active`
// CSS yozish kerak emas.
const menuOptions = computed<MenuOption[]>(() => [
  { key: 'home', label: () => h(RouterLink, { to: { name: 'home' } }, () => 'Bosh sahifa') },
  { key: 'profile', label: () => h(RouterLink, { to: { name: 'profile' } }, () => 'Profil') },
  { key: 'admin', label: () => h(RouterLink, { to: { name: 'admin' } }, () => 'Admin') },
])

async function onLogout() {
  await logout()
  router.push({ name: 'home' })
}
</script>

<template>
  <LuThemeProvider>
    <WLayout style="height: 100vh">
      <WLayoutHeader bordered style="padding: 0 1.5rem">
        <!-- :wrap="false" — WFlex default'da o'raladi va WMenu butun kenglikni olgani uchun
             o'ng tomondagi tugma pastga tushib ketardi. min-width:0 menu'ga qisqarishga ruxsat beradi. -->
        <WFlex align="center" justify="space-between" :wrap="false">
          <WMenu
            mode="horizontal"
            :value="String(route.name ?? '')"
            :options="menuOptions"
            style="flex: 1; min-width: 0"
          />

          <WSpin v-if="isRestoring" size="small" />

          <WFlex v-else-if="isAuthenticated" align="center" :size="12" :wrap="false">
            <WAvatar round size="small">{{ user?.name?.[0] }}</WAvatar>
            <WText>{{ user?.name }}</WText>
            <WButton quaternary size="small" @click="onLogout">Chiqish</WButton>
          </WFlex>

          <WButton v-else type="primary" size="small" @click="router.push({ name: 'login' })">
            Kirish
          </WButton>
        </WFlex>
      </WLayoutHeader>

      <WLayoutContent content-style="padding: 2rem 1.5rem">
        <div class="page">
          <RouterView />
        </div>
      </WLayoutContent>
    </WLayout>
  </LuThemeProvider>
</template>

<style scoped>
/* Faqat sahifa kengligi — qolgan hamma narsa kutubxonadan keladi (WGlobalStyle body'ni ham reset qiladi) */
.page {
  max-width: 42rem;
  margin: 0 auto;
}
</style>
