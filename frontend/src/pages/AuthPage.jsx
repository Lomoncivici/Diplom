import { useState } from 'react'
import { login, register } from '../api'

export default function AuthPage({ onAuthSuccess, error: externalError = '' }) {
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

      onAuthSuccess(data.access_token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="auth-intro">
          <div className="brand-mark">LT</div>
          <div>
            <h1>Diploma Load Testing Platform</h1>
            <p className="muted">
              Управляй проектами, создавай тесты и отслеживай запуски в одном интерфейсе.
            </p>
          </div>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
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
              minLength={6}
            />
          </label>

          {error || externalError ? <div className="error">{error || externalError}</div> : null}

          <button type="submit" disabled={loading}>
            {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  )
}
