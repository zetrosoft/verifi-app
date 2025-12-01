import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import { Web3Provider } from './contexts/Web3Context.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Menormalkan gaya CSS lintas browser */}
      <Web3Provider>
        <App />
      </Web3Provider>
    </ThemeProvider>
  </React.StrictMode>,
)