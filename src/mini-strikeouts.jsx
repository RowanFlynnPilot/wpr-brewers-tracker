import React from 'react'
import { createRoot } from 'react-dom/client'
import MiniStrikeouts from './components/MiniStrikeouts.jsx'
import { initAnalytics } from './analytics.js'
import './styles.css'

// Entry for mini-strikeouts.html — the compact "latest strikeout performance" embed.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MiniStrikeouts />
  </React.StrictMode>
)
