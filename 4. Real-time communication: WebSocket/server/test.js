// Smoke test: node test.js  — starts the hub on 3999 and drives it with real clients.
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'

process.env.PORT = '3999'
await import('./server.js')

const open = () =>
  new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3999')
    ws.on('open', () => resolve(ws))
  })

const next = (ws, type, where = () => true) =>
  new Promise((resolve) => {
    const onMessage = (raw) => {
      const msg = JSON.parse(raw)
      if (msg.type === type && where(msg)) {
        ws.off('message', onMessage)
        resolve(msg)
      }
    }
    ws.on('message', onMessage)
  })

const say = (ws, payload) => ws.send(JSON.stringify(payload))

const alice = await open()
say(alice, { type: 'register', username: 'alice', password: 'secret123' })
assert.deepEqual(await next(alice, 'welcome'), { type: 'welcome', username: 'alice', history: [] })

const bob = await open()
say(bob, { type: 'register', username: 'alice', password: 'secret123' })
assert.match((await next(bob, 'error')).error, /already taken/)

say(bob, { type: 'message', text: 'sneaking in' })
assert.match((await next(bob, 'error')).error, /Log in first/)

const presence = next(alice, 'presence')
say(bob, { type: 'register', username: 'bob', password: 'secret123' })
await next(bob, 'welcome')
assert.deepEqual((await presence).users, ['alice', 'bob'])

const delivered = next(alice, 'message')
say(bob, { type: 'message', text: 'hello team' })
assert.equal((await delivered).message.user, 'bob')

const carol = await open()
say(carol, { type: 'login', username: 'bob', password: 'wrong-one' })
assert.match((await next(carol, 'error')).error, /Wrong username or password/)

say(carol, { type: 'login', username: 'bob', password: 'secret123' })
assert.deepEqual((await next(carol, 'welcome')).history.map((m) => m.text), ['hello team'])

const left = next(alice, 'presence', (m) => m.left)
bob.close()
assert.equal((await left).left, 'bob')

console.log('all good')
process.exit(0)
