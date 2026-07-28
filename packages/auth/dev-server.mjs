#!/usr/bin/env node
// Auth dev-server — httpOnly cookie'ni FAQAT server qo'ya oladi, shuning uchun bu shart.
// 0 dependency: node:http + node:crypto. JWT ham qo'lda — HS256 20 qator, jsonwebtoken kerak emas.
//
// Endpoint'lar:
//   POST /auth/login     {username,password} → access token + httpOnly refresh cookie
//   GET  /auth/github    → GitHub OAuth authorize sahifasiga redirect
//   GET  /auth/callback  → code'ni almashtirib, cookie qo'yib, app'ga qaytaradi
//   POST /auth/refresh   → cookie'dan yangi access token (refresh token rotatsiya qilinadi)
//   POST /auth/logout    → cookie o'chadi, refresh token bekor qilinadi
//   GET  /api/me         → Bearer talab qiladi
//   GET  /api/admin/roles→ Bearer + 'role.manage' huquqi talab qiladi
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

// ponytail: dotenv o'rniga 5 qator. .env bo'lmasa jim o'tadi — GitHub OAuth ixtiyoriy.
try {
  for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (m) process.env[m[1]] ??= m[2].trim()
  }
} catch {}

const PORT = Number(process.env.AUTH_PORT ?? 4000)
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:5173'
const SECRET = process.env.AUTH_SECRET ?? 'dev-only-secret-do-not-use-in-prod'
const GH_ID = process.env.GITHUB_CLIENT_ID
const GH_SECRET = process.env.GITHUB_CLIENT_SECRET

// ponytail: dev'da 30s — mentor DevTools'da refresh'ni jonli ko'rsin. Prod'da 5-15 daqiqa.
const ACCESS_TTL_S = Number(process.env.ACCESS_TTL_S ?? 30)
const REFRESH_TTL_S = 7 * 24 * 60 * 60

// --- JWT (HS256) ---------------------------------------------------------
const b64url = (v) => Buffer.from(v).toString('base64url')

function signJwt(payload) {
  const body = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}`
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`
}

export function verifyJwt(token, secret = SECRET, now = Date.now()) {
  const [head, body, sig] = String(token).split('.')
  if (!head || !body || !sig) return null
  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')
  // timingSafeEqual uzunliklar teng bo'lishini talab qiladi — avval tekshiramiz
  if (sig.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return payload.exp * 1000 > now ? payload : null
  } catch {
    return null
  }
}

// --- Demo foydalanuvchilar ----------------------------------------------
// ponytail: in-memory — bu dev-server, DB kerak emas. Parol hammasida "demo".
const USERS = {
  admin: { id: '1', name: 'Admin Adminov', permissions: ['user.view', 'user.edit', 'role.manage'] },
  user: { id: '2', name: 'Oddiy Foydalanuvchi', permissions: ['user.view'] },
}
const refreshTokens = new Map() // jti → { userKey, exp }

function issue(userKey, res) {
  const user = USERS[userKey]
  const access = signJwt({
    sub: user.id,
    name: user.name,
    permissions: user.permissions,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_S,
  })
  const jti = randomUUID()
  refreshTokens.set(jti, { userKey, exp: Date.now() + REFRESH_TTL_S * 1000 })
  // HttpOnly → JS o'qiy olmaydi (XSS himoyasi). SameSite=Lax → CSRF himoyasi.
  // Prod'da Secure ham qo'shiladi; localhost http bo'lgani uchun dev'da yo'q.
  res.setHeader('Set-Cookie', `refresh_token=${jti}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${REFRESH_TTL_S}`)
  return {
    accessToken: access,
    expiresIn: ACCESS_TTL_S,
    user: { id: user.id, name: user.name, permissions: user.permissions },
  }
}

// --- HTTP yordamchilari ---------------------------------------------------
const json = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
  })

const cookie = (req, name) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === name)?.[1]

function bearer(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  return token ? verifyJwt(token) : null
}

// --- Route'lar ------------------------------------------------------------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const route = `${req.method} ${url.pathname}`

  if (route === 'POST /auth/login') {
    const { username, password } = await readBody(req)
    if (!USERS[username] || password !== 'demo') {
      return json(res, 401, { error: 'Login yoki parol noto\'g\'ri' })
    }
    return json(res, 200, issue(username, res))
  }

  if (route === 'GET /auth/github') {
    if (!GH_ID) {
      return json(res, 500, {
        error: 'GITHUB_CLIENT_ID sozlanmagan. .env ga qo\'shing yoki parol bilan kiring (admin/demo).',
      })
    }
    const gh = new URL('https://github.com/login/oauth/authorize')
    gh.searchParams.set('client_id', GH_ID)
    gh.searchParams.set('redirect_uri', `${APP_ORIGIN}/auth/callback`)
    gh.searchParams.set('scope', 'read:user')
    gh.searchParams.set('state', randomUUID()) // ponytail: dev'da tekshirilmaydi; prod'da session'ga bog'lang
    res.writeHead(302, { Location: gh.toString() })
    return res.end()
  }

  if (route === 'GET /auth/callback') {
    const code = url.searchParams.get('code')
    if (!code || !GH_ID || !GH_SECRET) {
      res.writeHead(302, { Location: `${APP_ORIGIN}/login?error=oauth` })
      return res.end()
    }
    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: GH_ID, client_secret: GH_SECRET, code }),
      })
      const { access_token } = await tokenRes.json()
      const ghUser = await (
        await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${access_token}` } })
      ).json()

      // GitHub orqali kirgan foydalanuvchi 'user' rolini oladi — /admin unga yopiq.
      // Shu bilan role-based access jonli ko'rsatiladi.
      USERS[`gh:${ghUser.login}`] = {
        id: `gh:${ghUser.id}`,
        name: ghUser.name || ghUser.login,
        permissions: ['user.view'],
      }
      issue(`gh:${ghUser.login}`, res) // Set-Cookie'ni o'rnatadi
      res.writeHead(302, { Location: `${APP_ORIGIN}/profile` })
      return res.end()
    } catch (err) {
      console.error('[auth] GitHub callback failed:', err)
      res.writeHead(302, { Location: `${APP_ORIGIN}/login?error=oauth` })
      return res.end()
    }
  }

  if (route === 'POST /auth/refresh') {
    const jti = cookie(req, 'refresh_token')
    const stored = jti && refreshTokens.get(jti)
    if (!stored || stored.exp < Date.now()) {
      res.setHeader('Set-Cookie', 'refresh_token=; HttpOnly; Path=/; Max-Age=0')
      return json(res, 401, { error: 'Refresh token yaroqsiz' })
    }
    refreshTokens.delete(jti) // rotatsiya: eski token bir marta ishlatiladi
    return json(res, 200, issue(stored.userKey, res))
  }

  if (route === 'POST /auth/logout') {
    const jti = cookie(req, 'refresh_token')
    if (jti) refreshTokens.delete(jti)
    res.setHeader('Set-Cookie', 'refresh_token=; HttpOnly; Path=/; Max-Age=0')
    return json(res, 200, { ok: true })
  }

  if (route === 'GET /api/me') {
    const claims = bearer(req)
    if (!claims) return json(res, 401, { error: 'Token yaroqsiz yoki muddati tugagan' })
    return json(res, 200, { id: claims.sub, name: claims.name, permissions: claims.permissions })
  }

  if (route === 'GET /api/admin/roles') {
    const claims = bearer(req)
    if (!claims) return json(res, 401, { error: 'Token yaroqsiz' })
    // Muhim: guard faqat UI — server ham tekshirishi SHART
    if (!claims.permissions?.includes('role.manage')) {
      return json(res, 403, { error: '"role.manage" huquqi kerak' })
    }
    return json(res, 200, { roles: ['admin', 'user'] })
  }

  json(res, 404, { error: 'Not found' })
})

export { server }

if (process.argv[1]?.endsWith('dev-server.mjs')) {
  server.listen(PORT, () => {
    console.log(`[auth] http://localhost:${PORT}  (access TTL ${ACCESS_TTL_S}s)`)
    if (!GH_ID) console.log('[auth] GitHub OAuth o\'chiq — parol bilan kiring: admin/demo yoki user/demo')
  })
}
