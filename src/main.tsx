import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'animate.css'
import './i18n'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
