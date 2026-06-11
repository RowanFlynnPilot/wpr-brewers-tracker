import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages project path so iframe embeds resolve assets.
// Repo name: wpr-brewers-tracker -> https://rowanflynnpilot.github.io/wpr-brewers-tracker/
export default defineConfig({
  plugins: [react()],
  base: '/wpr-brewers-tracker/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // Compact scoreboard for sidebars/articles — its own page so embeds stay lightweight.
        mini: resolve(__dirname, 'mini.html'),
      },
    },
  },
})
