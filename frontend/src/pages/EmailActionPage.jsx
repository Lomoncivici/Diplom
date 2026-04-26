import { useEffect, useState } from 'react'
import { confirmEmailByToken, getActionLinkInfo, resetPasswordByToken } from '../api'
import FieldHint from '../components/FieldHint'
import { getErrorMessage, getFieldErrors } from '../utils/apiErrors'

function formatDateTime(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getInputClassName(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? 'input-error' : ''
}

function renderFieldError(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? <small className="field-error">{fieldErrors[fieldName]}</small> : null
}

export default function EmailActionPage({ token, onBackToAuth, onBackToApp }) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadInfo() {
      setLoading(true)
      setError('')
      try {
        const data = await getActionLinkInfo(token)
        if (!cancelled) {
          setInfo(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadInfo()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleConfirmEmail() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await confirmEmailByToken(token)
      setMessage(result.message)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    setFieldErrors({})
    try {
      const result = await resetPasswordByToken(token, password)
      setMessage(result.message)
      setPassword('')
    } catch (err) {
      setError(getErrorMessage(err))
      setFieldErrors(getFieldErrors(err))
    } finally {
      setBusy(false)
    }
  }

  const backLabel = onBackToApp ? 'Вернуться в систему' : 'Вернуться ко входу'
  const handleBack = onBackToApp || onBackToAuth

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="auth-intro">
          <div className="brand-mark">АПИ</div>
          <div>
            <h1>{info?.action_type === 'password_reset' ? 'Смена пароля' : 'Подтверждение почты'}</h1>
            <p className="muted">
              Эта страница доступна только по временной одноразовой ссылке из письма.
            </p>
          </div>
        </div>

        {loading ? <p className="muted">Проверка временной ссылки...</p> : null}
        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="success-message">{message}</div> : null}

        {!loading && info ? (
          <div className="form-grid">
            <div className="card card--soft token-info-box">
              <div><strong>Получатель:</strong> {info.target_email || info.current_email}</div>
              <div><strong>Пользователь:</strong> {info.full_name}</div>
              <div><strong>Срок действия:</strong> {formatDateTime(info.expires_at)}</div>
            </div>

            {info.action_type === 'password_reset' ? (
              <form className="form-grid" onSubmit={handleResetPassword}>
                <label>
                  Новый пароль
                  <input
                    type="password"
                    className={getInputClassName(fieldErrors, 'password')}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                  <FieldHint>Используйте новый сложный пароль. Ссылка одноразовая и действует ограниченное время.</FieldHint>
                  {renderFieldError(fieldErrors, 'password')}
                </label>

                <div className="inline-actions">
                  <button type="submit" disabled={busy || Boolean(message)}>
                    {busy ? 'Сохранение...' : 'Сменить пароль'}
                  </button>
                  {handleBack ? (
                    <button type="button" className="button-secondary" onClick={handleBack}>
                      {backLabel}
                    </button>
                  ) : null}
                </div>
              </form>
            ) : (
              <div className="inline-actions">
                <button type="button" onClick={handleConfirmEmail} disabled={busy || Boolean(message)}>
                  {busy ? 'Подтверждение...' : 'Подтвердить адрес'}
                </button>
                {handleBack ? (
                  <button type="button" className="button-secondary" onClick={handleBack}>
                    {backLabel}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
