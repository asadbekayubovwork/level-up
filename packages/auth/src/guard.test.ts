import { describe, expect, it } from 'vitest'
import { checkAuth, checkPermissions } from './guard'
import type { User } from './types'

const opts = { loginRoute: 'login', forbiddenRoute: 'forbidden' }
const admin: User = { id: '1', name: 'Admin', permissions: ['user.view', 'role.manage'] }
const plain: User = { id: '2', name: 'User', permissions: ['user.view'] }

const route = (meta: Record<string, unknown>, fullPath = '/x') =>
  ({ meta, fullPath }) as never

describe('checkAuth', () => {
  it('public route — o\'tkazadi', () => {
    expect(checkAuth(route({}), { user: null }, opts)).toBeNull()
  })

  it('requiresAuth + user yo\'q — login\'ga otadi va qaytish yo\'lini saqlaydi', () => {
    expect(checkAuth(route({ requiresAuth: true }, '/profile'), { user: null }, opts)).toEqual({
      name: 'login',
      query: { next: '/profile' },
    })
  })

  it('requiresAuth + user bor — o\'tkazadi', () => {
    expect(checkAuth(route({ requiresAuth: true }), { user: plain }, opts)).toBeNull()
  })
})

describe('checkPermissions', () => {
  it('permission talab qilinmagan — o\'tkazadi', () => {
    expect(checkPermissions(route({ requiresAuth: true }), { user: plain }, opts)).toBeNull()
  })

  it('huquqi yetmaydi — forbidden\'ga otadi', () => {
    const to = route({ requiresAuth: true, permissions: ['role.manage'] })
    expect(checkPermissions(to, { user: plain }, opts)).toEqual({ name: 'forbidden' })
  })

  it('huquqi yetadi — o\'tkazadi', () => {
    const to = route({ requiresAuth: true, permissions: ['role.manage'] })
    expect(checkPermissions(to, { user: admin }, opts)).toBeNull()
  })

  it('bir nechta permission — hammasi kerak', () => {
    const to = route({ permissions: ['user.view', 'user.edit'] })
    expect(checkPermissions(to, { user: admin }, opts)).toEqual({ name: 'forbidden' })
  })
})
