import { createAuthGuard } from '@level-up/auth'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./pages/Home.vue') },
    { path: '/login', name: 'login', component: () => import('./pages/Login.vue') },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('./pages/Profile.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('./pages/Admin.vue'),
      // Typed: 'role.manag' deb xato yozsangiz `pnpm build` yiqiladi
      meta: { requiresAuth: true, permissions: ['role.manage'] },
    },
    { path: '/403', name: 'forbidden', component: () => import('./pages/Forbidden.vue') },
  ],
})

router.beforeEach(createAuthGuard({ loginRoute: 'login', forbiddenRoute: 'forbidden' }))

export default router
