// dev-server integration testi. Auth — security yo'li, shuning uchun qo'lda curl qilib
// qo'yib bo'lmaydi: JWT imzo, muddat, refresh rotatsiya va permission gate har build'da tekshiriladi.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

process.env.ACCESS_TTL_S = '1' // muddati tugashini tez tekshirish uchun
const { server } = await import('./dev-server.mjs')

let base = ''

beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, resolve))
  base = `http://localhost:${server.address().port}`
})
afterAll(() => new Promise((resolve) => server.close(resolve)))

const login = (username, password = 'demo') =>
  fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

const get = (path, token, cookie) =>
  fetch(`${base}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}) },
  })

describe('login', () => {
  it('to\'g\'ri parol → token va httpOnly refresh cookie', async () => {
    const res = await login('admin')
    expect(res.status).toBe(200)

    const cookie = res.headers.get('set-cookie')
    expect(cookie).toMatch(/^refresh_token=/)
    expect(cookie).toContain('HttpOnly') // JS o'qiy olmaydi — XSS himoyasi
    expect(cookie).toContain('SameSite=Lax') // CSRF himoyasi

    const body = await res.json()
    expect(body.accessToken.split('.')).toHaveLength(3) // JWT
    expect(body.user.permissions).toContain('role.manage')
  })

  it('noto\'g\'ri parol → 401, cookie yo\'q', async () => {
    const res = await login('admin', 'xato')
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})

describe('token tekshiruvi', () => {
  it('yaroqli token → /api/me ishlaydi', async () => {
    const { accessToken } = await (await login('admin')).json()
    expect((await get('/api/me', accessToken)).status).toBe(200)
  })

  it('buzilgan imzo → 401', async () => {
    const { accessToken } = await (await login('admin')).json()
    const [h, p, s] = accessToken.split('.')
    const tampered = `${h}.${p}.${'A'.repeat(s.length)}`
    expect((await get('/api/me', tampered)).status).toBe(401)
  })

  it('o\'zgartirilgan payload (huquq qo\'shish) → 401', async () => {
    const { accessToken } = await (await login('user')).json()
    const [h, , s] = accessToken.split('.')
    const evil = Buffer.from(
      JSON.stringify({ sub: '2', name: 'x', permissions: ['role.manage'], exp: 2 ** 31 }),
    ).toString('base64url')
    expect((await get('/api/me', `${h}.${evil}.${s}`)).status).toBe(401)
  })

  it('muddati tugagan token → 401', async () => {
    const { accessToken } = await (await login('admin')).json()
    await new Promise((r) => setTimeout(r, 1100)) // TTL 1s
    expect((await get('/api/me', accessToken)).status).toBe(401)
  })
})

describe('role-based access', () => {
  it('role.manage bor → 200', async () => {
    const { accessToken } = await (await login('admin')).json()
    expect((await get('/api/admin/roles', accessToken)).status).toBe(200)
  })

  it('role.manage yo\'q → 403 (server ham tekshiradi, faqat guard emas)', async () => {
    const { accessToken } = await (await login('user')).json()
    const res = await get('/api/admin/roles', accessToken)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('role.manage')
  })
})

describe('refresh', () => {
  const cookieOf = (res) => res.headers.get('set-cookie').split(';')[0]

  it('cookie bilan yangi token beradi', async () => {
    const cookie = cookieOf(await login('admin'))
    const res = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(200)
    expect((await res.json()).accessToken.split('.')).toHaveLength(3)
  })

  it('eski refresh token qayta ishlatilmaydi (rotatsiya)', async () => {
    const cookie = cookieOf(await login('admin'))
    await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { cookie } })

    const reuse = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { cookie } })
    expect(reuse.status).toBe(401)
  })

  it('cookie yo\'q → 401', async () => {
    expect((await fetch(`${base}/auth/refresh`, { method: 'POST' })).status).toBe(401)
  })

  it('logout dan keyin refresh ishlamaydi', async () => {
    const cookie = cookieOf(await login('admin'))
    await fetch(`${base}/auth/logout`, { method: 'POST', headers: { cookie } })

    const res = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { cookie } })
    expect(res.status).toBe(401)
  })
})
