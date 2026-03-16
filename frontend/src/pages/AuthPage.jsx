import { useState } from 'react'
import { login, register, setToken } from '../api'

export default function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', full_name: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data =
        mode === 'login'
          ? await login(form.email, form.password)
          : await register(form.email, form.full_name, form.password)

      setToken(data.access_token)
      onAuthSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card auth-card">
      <div className="tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
          Вход
        </button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
          Регистрация
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            required
          />
        </label>

        {mode === 'register' ? (
          <label>
            ФИО
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
              required
            />
          </label>
        ) : null}

        <label>
          Пароль
          <input
            type="password"
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            required
          />
        </label>

        {error ? <div className="error">{error}</div> : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  )
}
