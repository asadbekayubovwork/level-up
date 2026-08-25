import { WebSocketServer } from 'ws'
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 7331)
const HISTORY_LIMIT = 50

// ponytail: users and history live in memory, a restart wipes both.
// Swap the two collections for a DB when accounts have to survive a restart.
const users = new Map() // username -> password hash
const history = []

const hash = (username, password) => scryptSync(password, username, 32)
const sameHash = (a, b) => a.length === b.length && timingSafeEqual(a, b)

const wss = new WebSocketServer({ port: PORT })

wss.on('error', (err) => {
  console.error(
    err.code === 'EADDRINUSE'
      ? `Port ${PORT} is already taken — start on another one: PORT=7332 pnpm dev`
      : err,
  )
  process.exit(1)
})

const send = (ws, payload) => ws.send(JSON.stringify(payload))
const roster = () => [...new Set([...wss.clients].filter((c) => c.username).map((c) => c.username))].sort()

function broadcast(payload) {
  const data = JSON.stringify(payload)
  for (const client of wss.clients) {
    if (client.username && client.readyState === client.OPEN) client.send(data)
  }
}

function authenticate(ws, msg) {
  const username = String(msg.username ?? '').trim()
  const password = String(msg.password ?? '')

  if (username.length < 3 || username.length > 20) return send(ws, { type: 'error', error: 'Username must be 3-20 characters' })
  if (password.length < 6) return send(ws, { type: 'error', error: 'Password must be at least 6 characters' })

  if (msg.type === 'register') {
    if (users.has(username)) return send(ws, { type: 'error', error: 'Username is already taken' })
    users.set(username, hash(username, password))
  } else {
    const stored = users.get(username)
    if (!stored || !sameHash(stored, hash(username, password))) {
      return send(ws, { type: 'error', error: 'Wrong username or password' })
    }
  }

  ws.username = username
  send(ws, { type: 'welcome', username, history })
  broadcast({ type: 'presence', users: roster(), joined: username })
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return send(ws, { type: 'error', error: 'Malformed payload' })
    }

    if (msg.type === 'register' || msg.type === 'login') return authenticate(ws, msg)
    if (!ws.username) return send(ws, { type: 'error', error: 'Log in first' })

    if (msg.type === 'message') {
      const text = String(msg.text ?? '').trim().slice(0, 1000)
      if (!text) return
      const message = { id: randomUUID(), user: ws.username, text, at: Date.now() }
      history.push(message)
      if (history.length > HISTORY_LIMIT) history.shift()
      broadcast({ type: 'message', message })
    }
  })

  ws.on('close', () => {
    if (ws.username) broadcast({ type: 'presence', users: roster(), left: ws.username })
  })
})

wss.on('listening', () => console.log(`TeamPulse hub listening on ws://localhost:${PORT}`))
