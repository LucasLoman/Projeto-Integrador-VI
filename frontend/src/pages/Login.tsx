import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const nav = useNavigate()
  const routeLocation = useLocation()
  const next = (routeLocation.state as { from?: string } | null)?.from || '/'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
      const r = await axios.post(`${base}/auth/token/`, { username, password })
      localStorage.setItem('access', r.data.access)
      localStorage.setItem('refresh', r.data.refresh)
      nav(next, { replace: true })
      window.location.reload()
    } catch {
      setError('Usuário ou senha inválidos')
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1 className="brand">AutoStock</h1>
        <p>Gestão de estoque para autopeças</p>
        <input
          placeholder="Usuário"
          aria-label="Usuário"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="Senha"
          aria-label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <span className="error" role="alert">{error}</span>}
        <button>Entrar</button>
      </form>
    </div>
  )
}
