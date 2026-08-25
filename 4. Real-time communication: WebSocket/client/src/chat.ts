import { reactive } from 'vue'

export type ChatMessage = { id: string; user: string; text: string; at: number; system?: boolean }

const URL = import.meta.env.VITE_WS_URL ?? `ws://${location.hostname}:7331`

export const state = reactive({
  connected: false,
  pending: false,
  username: '',
  error: '',
  messages: [] as ChatMessage[],
  users: [] as string[],
})

let socket: WebSocket | null = null

function system(text: string) {
  state.messages.push({ id: `sys-${Date.now()}-${text}`, user: '', text, at: Date.now(), system: true })
}

function handle(payload: any) {
  switch (payload.type) {
    case 'welcome':
      state.username = payload.username
      state.messages = payload.history
      state.error = ''
      break
    case 'message':
      state.messages.push(payload.message)
      break
    case 'presence':
      state.users = payload.users
      if (payload.joined) system(`${payload.joined} joined the room`)
      if (payload.left) system(`${payload.left} left the room`)
      break
    case 'error':
      state.error = payload.error
      break
  }
  state.pending = false
}

// ponytail: no auto-reconnect — a dropped socket sends you back to the login
// screen. Add exponential-backoff retry here if flaky networks become a problem.
function connect(): Promise<WebSocket> {
  if (!socket || socket.readyState > WebSocket.OPEN) {
    socket = new WebSocket(URL)
    socket.onopen = () => (state.connected = true)
    socket.onmessage = (e) => handle(JSON.parse(e.data))
    socket.onerror = () => (state.error = 'Cannot reach the chat hub — is the server running?')
    socket.onclose = () => {
      state.connected = false
      state.pending = false
      state.username = ''
      state.users = []
    }
  }
  const ws = socket
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve(ws)
  return new Promise((resolve) => ws.addEventListener('open', () => resolve(ws), { once: true }))
}

async function send(payload: Record<string, unknown>) {
  ;(await connect()).send(JSON.stringify(payload))
}

export function auth(type: 'login' | 'register', username: string, password: string) {
  state.error = ''
  state.pending = true
  send({ type, username, password })
}

export function sendMessage(text: string) {
  if (text.trim()) send({ type: 'message', text })
}

export function leave() {
  socket?.close()
}
