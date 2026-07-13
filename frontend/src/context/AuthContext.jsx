import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const TOKEN_KEY = 'marquez_token'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario]   = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setCargando(false); return }
    axios.get(API + '/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => setUsuario(r.data.usuario))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setCargando(false))
  }, [])

  const login = async (email, password) => {
    const { data } = await axios.post(API + '/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, data.token)
    setUsuario(data.usuario)
    return data.usuario
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setUsuario(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
