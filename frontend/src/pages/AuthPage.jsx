import { useState } from 'react'
import { login, register } from '../api'
import FieldHint from '../components/FieldHint'
import FormGuide from '../components/FormGuide'
import { getErrorMessage, getFieldErrors } from '../utils/apiErrors'

const authGuideItems = [
  {
    label: 'Регистрация',
    text: 'После регистрации нужно подтвердить адрес электронной почты по письму. Если адрес не подтвердить за 15 минут, учётная запись будет удалена.',
  },
  {
    label: 'Пароль',
    text: 'Используйте не менее восьми символов, включая заглавные и строчные буквы, а также цифры.',
  },
  {
    label: 'Восстановление доступа',
    text: 'Если пароль забыт, воспользуйтесь ссылкой восстановления. На почту придёт временная одноразовая ссылка.',
  },
]

const initialForm = {
  email: '',
  full_name: '',
  password: '',
}

function getInputClassName(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? 'input-error' : ''
}

function renderFieldError(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? <small className="field-error">{fieldErrors[fieldName]}</small> : null
}

export default function AuthPage({ onAuthSuccess, error: externalError, onOpenPasswordRecovery }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setError('')
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
            <h1>Платформа тестирования API</h1>
            <p className="muted">
              Управляйте проектами, создавайте тесты и отслеживайте запуски в одном интерфейсе.
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
              <FieldHint>Будет видно в проектах, списках и панели администратора.</FieldHint>
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

          {mode === 'login' ? (
            <button type="button" className="link-button" onClick={onOpenPasswordRecovery}>
              Забыли пароль?
            </button>
          ) : null}

          {error || externalError ? <div className="error">{error || externalError}</div> : null}

          <button type="submit" disabled={loading}>
            {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  )
}
