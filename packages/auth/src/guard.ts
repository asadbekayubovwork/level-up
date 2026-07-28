import type { NavigationGuard, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { restoreSession, user } from './session'
import type { User } from './types'

export interface AuthGuardOptions {
  /** Login qilmagan foydalanuvchi yuboriladigan route nomi */
  loginRoute: string
  /** Huquqi yetmaganda yuboriladigan route nomi */
  forbiddenRoute: string
}

/**
 * Har tekshiruv — alohida, sof funksiya. Redirect kerak bo'lsa route qaytaradi, aks holda null.
 *
 * wb_imzo'da bitta `beforeEach` ichida 161 qator, 8 mas'uliyat va 16 ta `next()` bor edi.
 * Bu yerda har biri alohida test qilinadi va yangi tekshiruv qo'shish — massivga bitta element.
 */
export type AuthCheck = (
  to: RouteLocationNormalized,
  ctx: { user: User | null },
  opts: AuthGuardOptions,
) => RouteLocationRaw | null

export const checkAuth: AuthCheck = (to, ctx, opts) => {
  if (!to.meta.requiresAuth) return null
  if (ctx.user) return null
  return { name: opts.loginRoute, query: { next: to.fullPath } }
}

export const checkPermissions: AuthCheck = (to, ctx, opts) => {
  const required = to.meta.permissions
  if (!required?.length) return null
  if (ctx.user && required.every((p) => ctx.user!.permissions.includes(p))) return null
  return { name: opts.forbiddenRoute }
}

export const defaultChecks: AuthCheck[] = [checkAuth, checkPermissions]

export function createAuthGuard(opts: AuthGuardOptions, checks = defaultChecks): NavigationGuard {
  return async (to) => {
    // Sahifa yangilanganda access token xotirada yo'q — cookie'dan tiklaymiz.
    // Bir marta ishlaydi, keyingi navigatsiyalar network'siz.
    await restoreSession()

    const ctx = { user: user.value }
    for (const check of checks) {
      const redirect = check(to, ctx, opts)
      if (redirect) return redirect
    }
    return true
  }
}
