import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages project path so iframe embeds resolve assets.
// Repo name: wpr-brewers-tracker -> https://rowanflynnpilot.github.io/wpr-brewers-tracker/
export default defineConfig({
  plugins: [react()],
  base: '/wpr-brewers-tracker/',
})
