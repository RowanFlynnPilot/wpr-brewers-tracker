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
        // Compact widgets for sidebars/articles — each its own page so embeds stay lightweight.
        mini: resolve(__dirname, 'mini.html'),
        miniStandings: resolve(__dirname, 'mini-standings.html'),
        miniStrikeouts: resolve(__dirname, 'mini-strikeouts.html'),
        miniDigest: resolve(__dirname, 'mini-digest.html'),
      },
    },
  },
})
