import { useEffect, useState } from 'react'
import { login, register } from '../api'
import FieldHint from '../components/FieldHint'
import FormGuide from '../components/FormGuide'
import { getErrorMessage, getFieldErrors } from '../utils/apiErrors'

const authGuideItems = [
  {
    label: 'Электронная почта',
    text: 'Используется как логин и как уникальный идентификатор учётной записи.',
  },
  {
    label: 'ФИО',
    text: 'Нужно для понятного отображения пользователя в интерфейсе и панели администратора.',
  },
  {
    label: 'Пароль',
    text: 'Используй минимум восемь символов. Лучше сочетать буквы, цифры и специальные знаки.',
  },
]

function getInputClassName(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? 'input-error' : ''
}

function renderFieldError(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? <small className="field-error">{fieldErrors[fieldName]}</small> : null
}

export default function AuthPage({ onAuthSuccess, error: externalError = '' }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', full_name: '', password: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setError('')
    setFieldErrors({})
  }, [mode])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    setLoading(true)

    try {
      await (
        mode === 'login'
          ? login(form.email, form.password)
          : register(form.email, form.full_name, form.password)
      )

      onAuthSuccess()
    } catch (err) {
      setError(getErrorMessage(err))
      setFieldErrors(getFieldErrors(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="auth-intro">
          <div className="brand-mark">АПИ</div>
          <div>
            <h1>Платформа нагрузочного тестирования</h1>
            <p className="muted">
              Создавайте карточки тестируемых систем, запускайте нагрузочные тесты и анализируйте производительность в одном интерфейсе.
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

        <FormGuide title="Справка по форме" items={authGuideItems} />

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Электронная почта
            <input
              type="email"
              className={getInputClassName(fieldErrors, 'email')}
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
            />
            <FieldHint>На этот адрес будет привязана учётная запись.</FieldHint>
            {renderFieldError(fieldErrors, 'email')}
          </label>

          {mode === 'register' ? (
            <label>
              ФИО
              <input
                type="text"
                className={getInputClassName(fieldErrors, 'full_name')}
                value={form.full_name}
                onChange={(e) => updateField('full_name', e.target.value)}
                required
              />
              <FieldHint>Будет видно в карточках систем, списках и панели администратора.</FieldHint>
              {renderFieldError(fieldErrors, 'full_name')}
            </label>
          ) : null}

          <label>
            Пароль
            <input
              type="password"
              className={getInputClassName(fieldErrors, 'password')}
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <FieldHint>Лучше использовать буквы в разных регистрах, цифры и специальные символы.</FieldHint>
            {renderFieldError(fieldErrors, 'password')}
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
