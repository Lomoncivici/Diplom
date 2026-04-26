import { useState } from 'react'
import { requestPasswordReset } from '../api'
import FieldHint from '../components/FieldHint'
import FormGuide from '../components/FormGuide'
import { getErrorMessage, getFieldErrors } from '../utils/apiErrors'

const guideItems = [
  {
    label: 'Временная ссылка',
    text: 'На почту придёт одноразовая ссылка для смены пароля. Срок действия ссылки ограничен.',
  },
  {
    label: 'Безопасность',
    text: 'Если адрес не найден, система всё равно покажет нейтральный ответ без раскрытия данных о наличии учётной записи.',
  },
]

function getInputClassName(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? 'input-error' : ''
}

function renderFieldError(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? <small className="field-error">{fieldErrors[fieldName]}</small> : null
}

export default function PasswordRecoveryPage({ onBack }) {
  const [email, setEmail] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setFieldErrors({})
    setLoading(true)

    try {
      const result = await requestPasswordReset(email)
      setMessage(result.message)
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
            <h1>Восстановление пароля</h1>
            <p className="muted">
              Укажите адрес электронной почты. На него будет отправлена временная ссылка для смены пароля.
            </p>
          </div>
        </div>

        <FormGuide title="Справка" items={guideItems} />

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Электронная почта
            <input
              type="email"
              className={getInputClassName(fieldErrors, 'email')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <FieldHint>Письмо будет отправлено только на подтверждённый адрес пользователя.</FieldHint>
            {renderFieldError(fieldErrors, 'email')}
          </label>

          {error ? <div className="error">{error}</div> : null}
          {message ? <div className="success-message">{message}</div> : null}

          <div className="inline-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Отправка...' : 'Отправить письмо'}
            </button>
            <button type="button" className="button-secondary" onClick={onBack}>
              Назад
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
