import { ref, shallowRef } from 'vue'
import type { Permission, SessionResponse, User } from './types'

// Access token XOTIRADA — localStorage'da emas. XSS bo'lsa ham o'g'irlab bo'lmaydi,
// va sahifa yopilishi bilan yo'qoladi. Sessiyani httpOnly refresh cookie tiklaydi.
let accessToken: string | null = null
let expiresAtMs = 0

export const user = shallowRef<User | null>(null)
export const isRestoring = ref(false)

let refreshing: Promise<boolean> | null = null
let restorePromise: Promise<void> | null = null

/** Token muddati tugashiga `skewMs` dan kam qolgan bo'lsa true. */
export function isExpiringSoon(skewMs = 5_000, now = Date.now()): boolean {
  return !accessToken || expiresAtMs - now <= skewMs
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setSession(data: SessionResponse): void {
  accessToken = data.accessToken
  expiresAtMs = Date.now() + data.expiresIn * 1000
  user.value = data.user
}

export function clearSession(): void {
  accessToken = null
  expiresAtMs = 0
  user.value = null
}

/**
 * Refresh cookie'dan yangi access token oladi.
 * Parallel chaqiruvlar bitta so'rovga birlashtiriladi — 10 ta so'rov bir vaqtda
 * token tugaganini ko'rsa ham serverga 1 marta boriladi.
 */
export function refresh(): Promise<boolean> {
  if (refreshing) return refreshing

  refreshing = (async () => {
    try {
      const res = await fetch('/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      if (!res.ok) {
        clearSession()
        return false
      }
      setSession((await res.json()) as SessionResponse)
      return true
    } catch {
      clearSession()
      return false
    } finally {
      refreshing = null
    }
  })()

  return refreshing
}

/** Sahifa yuklanganda sessiyani cookie'dan tiklaydi. Bir marta ishlaydi. */
export function restoreSession(): Promise<void> {
  if (restorePromise) return restorePromise
  isRestoring.value = true
  restorePromise = refresh().then(() => {
    isRestoring.value = false
  })
  return restorePromise
}

export async function loginWithPassword(username: string, password: string): Promise<void> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(((await res.json()) as { error: string }).error)
  setSession((await res.json()) as SessionResponse)
}

export function loginWithGitHub(): void {
  window.location.href = '/auth/github'
}

export async function logout(): Promise<void> {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } finally {
    clearSession()
  }
}

export function can(permission: Permission): boolean {
  return user.value?.permissions.includes(permission) ?? false
}

/** Faqat testlar uchun — modul holatini tozalaydi. */
export function __resetForTests(): void {
  clearSession()
  refreshing = null
  restorePromise = null
  isRestoring.value = false
}
