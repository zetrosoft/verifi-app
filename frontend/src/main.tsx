import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import { Web3Provider } from './contexts/Web3Context.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Web3Provider>
        <App />
      </Web3Provider>
    </ThemeProvider>
  </React.StrictMode>,
)
