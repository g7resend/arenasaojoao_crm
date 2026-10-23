import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base relativo: funciona no GitHub Pages em qualquer nome de repositório (com HashRouter)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
