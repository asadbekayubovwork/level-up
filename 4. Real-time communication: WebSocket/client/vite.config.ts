import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // ponytail: the ':' in this folder's name breaks Vite's fs allow-list matching,
  // so the dev server 403s its own index.html. Drop this once the folder is renamed.
  server: { fs: { strict: false } },
})
