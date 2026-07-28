import { createAuthGuard } from '@level-up/auth'
import { createRouter, createWebHistory } from 'vue-router'
import Login from './pages/Login.vue'
import Roles from './pages/Roles.vue'

// Bir xil paket, bir xil guard, boshqa app. Hech narsa ko'chirilmagan.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: Login },
    {
      path: '/roles',
      name: 'roles',
      component: Roles,
      meta: { requiresAuth: true, permissions: ['role.manage'] },
    },
    { path: '/403', name: 'forbidden', component: () => import('./pages/Forbidden.vue') },
  ],
})

router.beforeEach(createAuthGuard({ loginRoute: 'login', forbiddenRoute: 'forbidden' }))

export default router
