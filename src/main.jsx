import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Note: React StrictMode is intentionally disabled.
// Strict Mode's double-mount behavior in development triggers two concurrent
// calls to supabase.auth.getSession() / onAuthStateChange, which compete for
// the same IndexedDB storage lock and produce:
//   "Lock 'sb-...-auth-token' was not released within 5000ms"
// This causes the app to lose the session on tab focus/blur and show a blank screen.
// The AuthContext is already hardened against this, but removing StrictMode
// eliminates the root trigger entirely and is safe for this application.
createRoot(document.getElementById('root')).render(
  <App />
)
