import React from 'react'
import { createRoot } from 'react-dom/client'
import MiniDigest from './components/MiniDigest.jsx'
import { initAnalytics } from './analytics.js'
import './styles.css'

// Entry for mini-digest.html — the newsletter "digest" embed: last final (with W/L pitchers),
// next game (probables), and the NL Central standings in one card.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MiniDigest />
  </React.StrictMode>
)
