import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'
import { __resetForTests, getAccessToken, isExpiringSoon, refresh, setSession, user } from './session'
import type { SessionResponse } from './types'

const session = (token: string, expiresIn = 30): SessionResponse => ({
  accessToken: token,
  expiresIn,
  user: { id: '1', name: 'Admin', permissions: ['user.view'] },
})

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const fail = (status: number, error = 'nope') => ({ ok: false, status, json: async () => ({ error }) })

beforeEach(() => __resetForTests())
afterEach(() => vi.unstubAllGlobals())

describe('refresh', () => {
  it('parallel chaqiruvlar bitta so\'rovga birlashadi', async () => {
    const fetchMock = vi.fn(async () => ok(session('new')))
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all([refresh(), refresh(), refresh()])

    expect(fetchMock).toHaveBeenCalledTimes(1) // 3 ta chaqiruv → 1 ta so'rov
    expect(results).toEqual([true, true, true])
    expect(getAccessToken()).toBe('new')
  })

  it('yiqilsa sessiya tozalanadi', async () => {
    setSession(session('old'))
    vi.stubGlobal('fetch', vi.fn(async () => fail(401)))

    expect(await refresh()).toBe(false)
    expect(getAccessToken()).toBeNull()
    expect(user.value).toBeNull()
  })
})

describe('isExpiringSoon', () => {
  it('token yo\'q — true', () => {
    expect(isExpiringSoon()).toBe(true)
  })

  it('yangi token — false', () => {
    setSession(session('t', 30))
    expect(isExpiringSoon()).toBe(false)
  })

  it('5s dan kam qolgan — true', () => {
    setSession(session('t', 30))
    expect(isExpiringSoon(5_000, Date.now() + 27_000)).toBe(true)
  })
})

describe('api', () => {
  it('muddati tugayotgan bo\'lsa so\'rovdan OLDIN refresh qiladi', async () => {
    setSession(session('old', 1)) // 1s → darhol "tugayapti"
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url)
        return url === '/auth/refresh' ? ok(session('fresh')) : ok({ data: 1 })
      }),
    )

    await api('/api/me')

    expect(calls).toEqual(['/auth/refresh', '/api/me']) // refresh birinchi — 401 kutilmaydi
    expect(getAccessToken()).toBe('fresh')
  })

  it('401 kelsa bir marta refresh + retry qiladi', async () => {
    setSession(session('valid', 30))
    let meCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/auth/refresh') return ok(session('fresh'))
        return ++meCalls === 1 ? fail(401) : ok({ data: 'ok' })
      }),
    )

    expect(await api('/api/me')).toEqual({ data: 'ok' })
    expect(meCalls).toBe(2) // aynan bitta retry
  })

  it('refresh ham yiqilsa — ApiError 401, sikl yo\'q', async () => {
    setSession(session('valid', 30))
    let refreshCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/auth/refresh') {
          refreshCalls++
          return fail(401)
        }
        return fail(401)
      }),
    )

    await expect(api('/api/me')).rejects.toThrow(ApiError)
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBeNull()
  })

  it('403 — huquq xatosi sifatida chiqadi, refresh qilinmaydi', async () => {
    setSession(session('valid', 30))
    vi.stubGlobal('fetch', vi.fn(async () => fail(403, '"role.manage" huquqi kerak')))

    await expect(api('/api/admin/roles')).rejects.toMatchObject({
      status: 403,
      message: '"role.manage" huquqi kerak',
    })
  })
})
