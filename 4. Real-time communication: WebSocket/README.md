# TeamPulse — realtime chat hub

`server/` — Node + `ws` hub: register/login, one `# general` room, presence, last 50 messages.
`client/` — Vue 3 + Vite UI: auth screen, message list, online sidebar.

```bash
cd server && pnpm install && pnpm dev   # ws://localhost:7331
cd client && pnpm install && pnpm dev   # http://localhost:5173
node server/test.js                     # smoke test of the whole protocol
```

Everything travels over the one WebSocket connection — no REST endpoints, no CORS.
Users and history are in memory, so a server restart wipes both.
Port busy on a shared box? `PORT=7332 pnpm dev` on the hub and
`VITE_WS_URL=ws://localhost:7332 pnpm dev` on the client.

> This folder's name contains `:`, so pnpm cannot put `node_modules/.bin` on PATH —
> the client scripts call `node node_modules/vite/bin/vite.js` directly.
