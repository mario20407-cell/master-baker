import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontSize: '13px', borderRadius: '8px', fontFamily: 'Inter, sans-serif' },
          success: { style: { background: '#EAF3DE', color: '#27500A', border: '0.5px solid #97C459' } },
          error:   { style: { background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F09595' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
