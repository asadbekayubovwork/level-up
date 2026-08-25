<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { leave, sendMessage, state } from '../chat'

const draft = ref('')
const list = ref<HTMLElement>()

const hue = (name: string) => [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360
const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function submit() {
  sendMessage(draft.value)
  draft.value = ''
}

watch(
  () => state.messages.length,
  async () => {
    await nextTick()
    list.value?.scrollTo({ top: list.value.scrollHeight, behavior: 'smooth' })
  },
)
</script>

<template>
  <div class="card room">
    <aside>
      <h2>Online <span class="count">{{ state.users.length }}</span></h2>
      <ul>
        <li v-for="user in state.users" :key="user">
          <span class="avatar" :style="{ background: `hsl(${hue(user)} 60% 45%)` }">{{ user[0].toUpperCase() }}</span>
          <span class="name">{{ user }}<em v-if="user === state.username"> (you)</em></span>
        </li>
      </ul>
    </aside>

    <section>
      <header>
        <div>
          <strong># general</strong>
          <span class="status">{{ state.connected ? 'Connected' : 'Disconnected' }}</span>
        </div>
        <button class="ghost" @click="leave">Leave</button>
      </header>

      <div ref="list" class="messages">
        <p v-if="!state.messages.length" class="empty">No messages yet — say hello 👋</p>

        <template v-for="m in state.messages" :key="m.id">
          <p v-if="m.system" class="system">{{ m.text }}</p>
          <div v-else class="msg" :class="{ own: m.user === state.username }">
            <span class="avatar" :style="{ background: `hsl(${hue(m.user)} 60% 45%)` }">{{ m.user[0].toUpperCase() }}</span>
            <div class="bubble">
              <div class="meta">{{ m.user }} <span>{{ time(m.at) }}</span></div>
              {{ m.text }}
            </div>
          </div>
        </template>
      </div>

      <form @submit.prevent="submit">
        <input v-model="draft" placeholder="Write a message…" maxlength="1000" autofocus />
        <button type="submit" :disabled="!draft.trim() || !state.connected">Send</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.room {
  display: grid;
  grid-template-columns: 220px 1fr;
  width: min(940px, 100%);
  height: min(640px, 85vh);
  overflow: hidden;
}
aside {
  background: var(--panel-2);
  border-right: 1px solid var(--line);
  padding: 20px 16px;
  min-height: 0;
  overflow-y: auto;
}
aside h2 {
  margin: 0 0 14px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
}
.count {
  background: var(--accent-soft);
  border-radius: 20px;
  padding: 1px 8px;
  margin-left: 4px;
}
aside ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
aside li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}
.name em { color: var(--muted); font-style: normal; font-size: 12px; }

section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
.status {
  margin-left: 10px;
  font-size: 12px;
  color: var(--muted);
}
.ghost {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--muted);
  padding: 6px 12px;
  font-size: 13px;
}

.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.empty, .system {
  flex: none;
  margin: 0;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}
.msg {
  display: flex;
  flex: none;
  gap: 10px;
  max-width: 78%;
}
.msg.own {
  flex-direction: row-reverse;
  align-self: flex-end;
}
.bubble {
  background: var(--panel-2);
  border-radius: 12px;
  padding: 9px 13px;
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
}
.msg.own .bubble { background: var(--accent-soft); }
.meta {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 3px;
}
.meta span { margin-left: 6px; }

form {
  display: flex;
  flex: none;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--line);
}

@media (max-width: 640px) {
  .room { grid-template-columns: 1fr; }
  aside { display: none; }
}
</style>
