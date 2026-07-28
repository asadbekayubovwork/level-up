import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // Auth server'ni proxy orqali beramiz → brauzer uchun hammasi bitta origin.
    // Natijada CORS kerak emas va httpOnly cookie muammosiz ishlaydi (BFF pattern).
    proxy: {
      '/auth': 'http://localhost:4000',
      '/api': 'http://localhost:4000',
    },
  },
})
