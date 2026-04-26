import { useMemo, useState } from 'react'
import {
  requestMyEmailChange,
  resendMyEmailVerification,
  sendMyPasswordResetEmail,
} from '../api'
import FieldHint from '../components/FieldHint'
import FormGuide from '../components/FormGuide'
import { getErrorMessage, getFieldErrors } from '../utils/apiErrors'

const guideItems = [
  {
    label: 'Подтверждение почты',
    text: 'Если адрес не подтверждён, его нужно подтвердить по письму. Уведомление об этом остаётся в профиле до завершения подтверждения.',
  },
  {
    label: 'Смена адреса',
    text: 'Новый адрес становится активным только после подтверждения по письму из временной одноразовой ссылки.',
  },
  {
    label: 'Смена пароля',
    text: 'Для смены пароля отправляется письмо на подтверждённый адрес пользователя.',
  },
]

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

export default function ProfilePage({ user, onBack, onRefreshUser }) {
  const [emailForm, setEmailForm] = useState({ new_email: '', current_password: '' })
  const [emailFieldErrors, setEmailFieldErrors] = useState({})
  const [emailError, setEmailError] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [verificationBusy, setVerificationBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState('')

  const verificationNotice = useMemo(() => {
    if (user?.email_is_verified) {
      return ''
    }

    if (user?.email_verification_deadline_at) {
      return `Адрес электронной почты пока не подтверждён. Подтвердите его до ${formatDateTime(user.email_verification_deadline_at)}, иначе учётная запись будет удалена.`
    }

    return 'Адрес электронной почты пока не подтверждён. Подтвердите его как можно скорее, чтобы сохранить доступ к учётной записи.'
  }, [user])

  function patchEmailForm(field, value) {
    setEmailForm((prev) => ({ ...prev, [field]: value }))
    setEmailFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
    setEmailError('')
    setEmailMessage('')
  }

  async function handleResendVerification() {
    setVerificationBusy(true)
    setStatusError('')
    setStatusMessage('')
    try {
      const result = await resendMyEmailVerification()
      setStatusMessage(result.message)
      await onRefreshUser?.()
    } catch (err) {
      setStatusError(getErrorMessage(err))
    } finally {
      setVerificationBusy(false)
    }
  }

  async function handleSendPasswordReset() {
    setResetBusy(true)
    setStatusError('')
    setStatusMessage('')
    try {
      const result = await sendMyPasswordResetEmail()
      setStatusMessage(result.message)
    } catch (err) {
      setStatusError(getErrorMessage(err))
    } finally {
      setResetBusy(false)
    }
  }

  async function handleEmailChange(event) {
    event.preventDefault()
    setEmailBusy(true)
    setEmailError('')
    setEmailMessage('')
    setEmailFieldErrors({})
    try {
      const result = await requestMyEmailChange(emailForm.new_email, emailForm.current_password)
      setEmailMessage(result.message)
      setEmailForm({ new_email: '', current_password: '' })
      await onRefreshUser?.()
    } catch (err) {
      setEmailError(getErrorMessage(err))
      setEmailFieldErrors(getFieldErrors(err))
    } finally {
      setEmailBusy(false)
    }
  }

  return (
    <div className="workspace-page">
      <section className="page-header">
        <div>
          <h1>Профиль</h1>
          <p className="muted">Управление адресом электронной почты и восстановлением доступа.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="button-secondary" onClick={onBack}>Назад</button>
        </div>
      </section>

      <FormGuide title="Справка по профилю" items={guideItems} />

      {verificationNotice ? <section className="warning-banner">{verificationNotice}</section> : null}
      {statusError ? <div className="error">{statusError}</div> : null}
      {statusMessage ? <div className="success-message">{statusMessage}</div> : null}

      <div className="content-grid profile-grid">
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Текущий адрес</h2>
              <p className="muted">Здесь отображается основной адрес пользователя и состояние его подтверждения.</p>
            </div>
          </div>

          <div className="profile-summary-grid">
            <div className="card card--soft">
              <strong>Адрес</strong>
              <div>{user.email}</div>
            </div>
            <div className="card card--soft">
              <strong>Статус</strong>
              <div>{user.email_is_verified ? 'Подтверждён' : 'Не подтверждён'}</div>
            </div>
            <div className="card card--soft">
              <strong>Подтверждён</strong>
              <div>{formatDateTime(user.email_verified_at)}</div>
            </div>
          </div>

          {user.pending_email ? (
            <div className="card card--soft pending-email-box">
              <strong>Ожидает подтверждения новый адрес</strong>
              <div>{user.pending_email}</div>
              {user.pending_email_deadline_at ? (
                <div className="muted small">Подтвердить новый адрес нужно до {formatDateTime(user.pending_email_deadline_at)}.</div>
              ) : null}
            </div>
          ) : null}

          <div className="inline-actions">
            {!user.email_is_verified || user.pending_email ? (
              <button type="button" onClick={handleResendVerification} disabled={verificationBusy}>
                {verificationBusy ? 'Отправка...' : user.pending_email ? 'Отправить письмо для нового адреса' : 'Отправить письмо подтверждения'}
              </button>
            ) : null}
            <button type="button" className="button-secondary" onClick={handleSendPasswordReset} disabled={resetBusy || !user.email_is_verified}>
              {resetBusy ? 'Отправка...' : 'Отправить письмо для смены пароля'}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <h2>Смена адреса электронной почты</h2>
              <p className="muted">Новый адрес станет основным только после подтверждения по письму.</p>
            </div>
          </div>

          {emailError ? <div className="error">{emailError}</div> : null}
          {emailMessage ? <div className="success-message">{emailMessage}</div> : null}

          <form className="form-grid" onSubmit={handleEmailChange}>
            <label>
              Новый адрес
              <input
                type="email"
                className={getInputClassName(emailFieldErrors, 'new_email')}
                value={emailForm.new_email}
                onChange={(event) => patchEmailForm('new_email', event.target.value)}
                required
              />
              <FieldHint>На новый адрес будет отправлена временная ссылка для подтверждения.</FieldHint>
              {renderFieldError(emailFieldErrors, 'new_email')}
            </label>

            <label>
              Текущий пароль
              <input
                type="password"
                className={getInputClassName(emailFieldErrors, 'current_password')}
                value={emailForm.current_password}
                onChange={(event) => patchEmailForm('current_password', event.target.value)}
                required
              />
              <FieldHint>Нужен для дополнительной защиты при смене адреса.</FieldHint>
              {renderFieldError(emailFieldErrors, 'current_password')}
            </label>

            <div>
              <button type="submit" disabled={emailBusy}>
                {emailBusy ? 'Отправка...' : 'Подтвердить смену адреса'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
