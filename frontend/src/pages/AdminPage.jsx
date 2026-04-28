import { useEffect, useMemo, useState } from 'react'
import {
  createUser,
  deleteUser,
  downloadAutomaticDatabaseBackup,
  downloadDatabaseBackup,
  getProjectAnalytics,
  getSystemSettings,
  restoreDatabaseBackup,
  updateSystemSettings,
  updateUser,
} from '../api'
import FieldHint from '../components/FieldHint'
import FormGuide from '../components/FormGuide'
import { getErrorMessage, getFieldErrors } from '../utils/apiErrors'

const emptyForm = {
  email: '',
  full_name: '',
  password: '',
  role: 'student',
  is_active: true,
}

const emptySystemSettings = {
  allow_private_target_hosts: false,
  allow_test_run_launches: true,
  max_virtual_users_per_test: 200,
  max_repeat_count_per_test: 500,
  max_timeout_seconds: 120,
  max_logs_per_run: 500,
  email_enabled: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_password_configured: false,
  smtp_use_tls: true,
  smtp_use_ssl: false,
  email_from_address: '',
  email_from_name: 'Платформа нагрузочного тестирования',
  frontend_base_url: '',
  email_verification_subject_template: 'Подтверждение адреса электронной почты',
  email_verification_body_template: `Здравствуйте, {{full_name}}!\n\nДля подтверждения адреса перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут.`,
  email_change_subject_template: 'Подтверждение нового адреса электронной почты',
  email_change_body_template: `Здравствуйте, {{full_name}}!\n\nДля подтверждения нового адреса {{new_email}} перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут.`,
  password_reset_subject_template: 'Сброс пароля',
  password_reset_body_template: `Здравствуйте, {{full_name}}!\n\nДля сброса пароля перейдите по ссылке:\n{{link}}\n\nСсылка действует {{minutes}} минут. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.`,
}

const tabs = [
  { id: 'users', label: 'Пользователи' },
  { id: 'system', label: 'Система' },
  { id: 'mail', label: 'Почта' },
  { id: 'backup', label: 'Резервная копия' },
  { id: 'analytics', label: 'Аналитика' },
]

const adminGuideItems = [
  {
    label: 'Вкладки панели администратора',
    text: 'Каждый раздел вынесен в отдельную вкладку: пользователи, система, почта, резервная копия и аналитика. Чаты поддержки и дерево тестируемых систем открываются отдельно из боковой панели.',
  },
  {
    label: 'Системные настройки',
    text: 'Во вкладке «Система» задаются общие ограничения платформы: лимиты нагрузки, запусков и журналов, а также правила запуска тестов внешних систем.',
  },
  {
    label: 'Настройки почты',
    text: 'Во вкладке «Почта» настраиваются сервер отправки, адрес отправителя и шаблоны писем. Эти параметры отделены от системных ограничений, чтобы не смешивать логику платформы и рассылки.',
  },
  {
    label: 'Резервная копия',
    text: 'Создание и восстановление базы выполняются отдельно. Перед восстановлением система создаёт страховочную копию текущих данных.',
  },
  {
    label: 'Аналитика системы',
    text: 'Сводка по конкретной тестируемой системе помогает быстро оценить результаты всех её нагрузочных тестов без перехода в историю каждого запуска.',
  },
]

function formatNumber(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toFixed(2)
}

function buildEditForm(user) {
  return {
    email: user.email,
    full_name: user.full_name,
    password: '',
    role: user.role,
    is_active: user.is_active,
  }
}

function getInputClassName(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? 'input-error' : ''
}

function renderFieldError(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? <small className="field-error">{fieldErrors[fieldName]}</small> : null
}

function getRoleLabel(role) {
  return role === 'admin' ? 'Администратор' : 'Пользователь'
}

function saveBlobAsFile(blob, fileName) {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}

function buildSettingsPayload(systemSettings) {
  const payload = {
    allow_private_target_hosts: Boolean(systemSettings.allow_private_target_hosts),
    allow_test_run_launches: Boolean(systemSettings.allow_test_run_launches),
    max_virtual_users_per_test: Number(systemSettings.max_virtual_users_per_test) || 1,
    max_repeat_count_per_test: Number(systemSettings.max_repeat_count_per_test) || 1,
    max_timeout_seconds: Number(systemSettings.max_timeout_seconds) || 1,
    max_logs_per_run: Number(systemSettings.max_logs_per_run) || 50,
    email_enabled: Boolean(systemSettings.email_enabled),
    smtp_host: systemSettings.smtp_host?.trim() || null,
    smtp_port: Number(systemSettings.smtp_port) || 587,
    smtp_username: systemSettings.smtp_username?.trim() || null,
    smtp_use_tls: Boolean(systemSettings.smtp_use_tls),
    smtp_use_ssl: Boolean(systemSettings.smtp_use_ssl),
    email_from_address: systemSettings.email_from_address?.trim() || null,
    email_from_name: systemSettings.email_from_name?.trim() || null,
    frontend_base_url: systemSettings.frontend_base_url?.trim() || null,
    email_verification_subject_template: systemSettings.email_verification_subject_template,
    email_verification_body_template: systemSettings.email_verification_body_template,
    email_change_subject_template: systemSettings.email_change_subject_template,
    email_change_body_template: systemSettings.email_change_body_template,
    password_reset_subject_template: systemSettings.password_reset_subject_template,
    password_reset_body_template: systemSettings.password_reset_body_template,
  }

  if (systemSettings.smtp_password?.trim()) {
    payload.smtp_password = systemSettings.smtp_password.trim()
  }

  return payload
}

export default function AdminPage({ currentUser, users, projects, onDataChanged, onOpenProject, onOpenTest, onBack, onRefreshHealthStatus }) {
  const [activeTab, setActiveTab] = useState('users')
  const [createForm, setCreateForm] = useState(emptyForm)
  const [createFieldErrors, setCreateFieldErrors] = useState({})
  const [createError, setCreateError] = useState('')
  const [editingUserId, setEditingUserId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editFieldErrors, setEditFieldErrors] = useState({})
  const [editError, setEditError] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')
  const [busy, setBusy] = useState(false)
  const [systemSettings, setSystemSettings] = useState(emptySystemSettings)
  const [loadingSystemSettings, setLoadingSystemSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsFieldErrors, setSettingsFieldErrors] = useState({})
  const [settingsMessage, setSettingsMessage] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [backupError, setBackupError] = useState('')
  const [backupMessage, setBackupMessage] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreFile, setRestoreFile] = useState(null)
  const [downloadingAutomaticBackup, setDownloadingAutomaticBackup] = useState(false)

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => left.full_name.localeCompare(right.full_name, 'ru')),
    [users],
  )

  const projectOptions = useMemo(() => {
    return [...projects].sort((a, b) => {
      const ownerA = a.owner?.full_name || a.owner?.email || ''
      const ownerB = b.owner?.full_name || b.owner?.email || ''
      const ownerCompare = ownerA.localeCompare(ownerB, 'ru')
      if (ownerCompare !== 0) return ownerCompare
      return a.name.localeCompare(b.name, 'ru')
    })
  }, [projects])

  const totalTests = useMemo(
    () => projects.reduce((sum, project) => sum + (project.tests_count || 0), 0),
    [projects],
  )

  useEffect(() => {
    let cancelled = false

    async function loadSystemSettings() {
      setLoadingSystemSettings(true)
      setSettingsError('')
      try {
        const data = await getSystemSettings()
        if (!cancelled) {
          setSystemSettings({ ...emptySystemSettings, ...data, smtp_password: '' })
        }
      } catch (err) {
        if (!cancelled) {
          setSettingsError(getErrorMessage(err))
        }
      } finally {
        if (!cancelled) {
          setLoadingSystemSettings(false)
        }
      }
    }

    loadSystemSettings()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedProjectId) {
      setAnalytics(null)
      setAnalyticsError('')
      return
    }

    let cancelled = false

    async function loadAnalytics() {
      setLoadingAnalytics(true)
      setAnalyticsError('')
      try {
        const data = await getProjectAnalytics(selectedProjectId)
        if (!cancelled) {
          setAnalytics(data)
        }
      } catch (err) {
        if (!cancelled) {
          setAnalytics(null)
          setAnalyticsError(getErrorMessage(err))
        }
      } finally {
        if (!cancelled) {
          setLoadingAnalytics(false)
        }
      }
    }

    loadAnalytics()
    return () => {
      cancelled = true
    }
  }, [selectedProjectId])

  function patchCreate(field, value) {
    setCreateForm((prev) => ({ ...prev, [field]: value }))
    setCreateFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function patchEdit(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }))
    setEditFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function patchSettings(field, value) {
    setSystemSettings((prev) => ({ ...prev, [field]: value }))
    setSettingsFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleCreateUser(event) {
    event.preventDefault()
    setBusy(true)
    setCreateError('')
    setCreateFieldErrors({})

    try {
      await createUser(createForm)
      setCreateForm(emptyForm)
      await onDataChanged()
    } catch (err) {
      setCreateError(getErrorMessage(err))
      setCreateFieldErrors(getFieldErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateUser(event) {
    event.preventDefault()
    setBusy(true)
    setEditError('')
    setEditFieldErrors({})

    try {
      const payload = { ...editForm }
      if (!payload.password) {
        delete payload.password
      }
      await updateUser(editingUserId, payload)
      setEditingUserId(null)
      setEditForm(emptyForm)
      await onDataChanged()
    } catch (err) {
      setEditError(getErrorMessage(err))
      setEditFieldErrors(getFieldErrors(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteUser(user) {
    const confirmed = window.confirm(`Удалить пользователя (${user.full_name})? Все его тестируемые системы и тесты тоже будут удалены.`)
    if (!confirmed) return

    setBusy(true)
    setEditError('')
    try {
      await deleteUser(user.id)
      if (editingUserId === user.id) {
        setEditingUserId(null)
        setEditForm(emptyForm)
      }
      await onDataChanged()
    } catch (err) {
      setEditError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadBackup() {
    setBackupBusy(true)
    setBackupError('')
    setBackupMessage('')

    try {
      await onRefreshHealthStatus?.()
      const { blob, fileName } = await downloadDatabaseBackup()
      saveBlobAsFile(blob, fileName)
      setBackupMessage('Резервная копия базы данных успешно сохранена.')
    } catch (err) {
      setBackupError(getErrorMessage(err, 'Не удалось создать резервную копию базы данных.'))
    } finally {
      setBackupBusy(false)
      await onRefreshHealthStatus?.()
    }
  }

  async function handleDownloadAutomaticBackup() {
    setDownloadingAutomaticBackup(true)
    setBackupError('')
    setBackupMessage('')

    try {
      const { blob, fileName } = await downloadAutomaticDatabaseBackup()
      saveBlobAsFile(blob, fileName)
      setBackupMessage('Автоматическая резервная копия успешно сохранена.')
    } catch (err) {
      setBackupError(getErrorMessage(err, 'Не удалось скачать автоматическую резервную копию.'))
    } finally {
      setDownloadingAutomaticBackup(false)
    }
  }

  async function handleRestoreBackup(event) {
    event.preventDefault()
    setBackupError('')
    setBackupMessage('')

    if (!restoreFile) {
      setBackupError('Сначала выберите файл резервной копии.')
      return
    }

    const confirmed = window.confirm('Загрузить резервную копию и заменить текущие данные платформы? Перед восстановлением система автоматически создаст страховочную копию.')
    if (!confirmed) return

    setBackupBusy(true)
    try {
      await onRefreshHealthStatus?.()
      const result = await restoreDatabaseBackup(restoreFile)
      setBackupMessage(`${result.message} Автоматическая резервная копия: ${result.automatic_backup_file_name}.`)
      setRestoreFile(null)
      const fileInput = document.getElementById('restore-database-file-input')
      if (fileInput) {
        fileInput.value = ''
      }
      await onDataChanged()
      await onRefreshHealthStatus?.()
    } catch (err) {
      setBackupError(getErrorMessage(err, 'Не удалось восстановить базу данных. Изменения не были применены.'))
      await onRefreshHealthStatus?.()
    } finally {
      setBackupBusy(false)
    }
  }

  async function handleSaveSettings(successMessage) {
    setSavingSettings(true)
    setSettingsError('')
    setSettingsFieldErrors({})
    setSettingsMessage('')

    try {
      const data = await updateSystemSettings(buildSettingsPayload(systemSettings))
      setSystemSettings({ ...emptySystemSettings, ...data, smtp_password: '' })
      setSettingsMessage(successMessage)
    } catch (err) {
      setSettingsError(getErrorMessage(err))
      setSettingsFieldErrors(getFieldErrors(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const renderUsersTab = () => (
    <div className="admin-panel-stack">
      <div className="content-grid admin-users-grid">
        <section className="card form-card">
          <div className="section-head">
            <div>
              <h2>Создание пользователя</h2>
              <p className="muted">Новая учётная запись создаётся сразу с ролью и признаком активности.</p>
            </div>
          </div>

          {createError ? <div className="error">{createError}</div> : null}

          <form className="form-grid" onSubmit={handleCreateUser}>
            <label>
              Электронная почта
              <input
                type="email"
                className={getInputClassName(createFieldErrors, 'email')}
                value={createForm.email}
                onChange={(event) => patchCreate('email', event.target.value)}
                required
              />
              <FieldHint>Адрес будет использоваться для входа и уведомлений.</FieldHint>
              {renderFieldError(createFieldErrors, 'email')}
            </label>

            <label>
              ФИО
              <input
                type="text"
                className={getInputClassName(createFieldErrors, 'full_name')}
                value={createForm.full_name}
                onChange={(event) => patchCreate('full_name', event.target.value)}
                required
              />
              {renderFieldError(createFieldErrors, 'full_name')}
            </label>

            <label>
              Пароль
              <input
                type="password"
                className={getInputClassName(createFieldErrors, 'password')}
                value={createForm.password}
                onChange={(event) => patchCreate('password', event.target.value)}
                required
              />
              <FieldHint>Временный пароль можно сообщить пользователю отдельно.</FieldHint>
              {renderFieldError(createFieldErrors, 'password')}
            </label>

            <label>
              Роль
              <select value={createForm.role} onChange={(event) => patchCreate('role', event.target.value)}>
                <option value="student">Пользователь</option>
                <option value="admin">Администратор</option>
              </select>
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={createForm.is_active}
                onChange={(event) => patchCreate('is_active', event.target.checked)}
              />
              Учётная запись активна
            </label>

            <div>
              <button type="submit" disabled={busy}>{busy ? 'Сохранение...' : 'Создать пользователя'}</button>
            </div>
          </form>
        </section>

        <section className="card admin-user-list-card">
          <div className="section-head">
            <div>
              <h2>Список пользователей</h2>
              <p className="muted">Выберите пользователя для редактирования роли, активности и пароля.</p>
            </div>
          </div>

          <div className="list admin-user-list">
            {sortedUsers.map((user) => (
              <article key={user.id} className={`admin-user-row ${editingUserId === user.id ? 'admin-user-row--active' : ''}`}>
                <div>
                  <strong>{user.full_name}</strong>
                  <div className="muted small">{user.email}</div>
                  <div className="muted small">{getRoleLabel(user.role)} · {user.is_active ? 'активен' : 'отключён'}</div>
                </div>
                <div className="sidebar-inline-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setEditingUserId(user.id)
                      setEditForm(buildEditForm(user))
                      setEditError('')
                      setEditFieldErrors({})
                    }}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    disabled={user.id === currentUser.id}
                    onClick={() => handleDeleteUser(user)}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {editingUserId ? (
        <section className="card form-card">
          <div className="section-head">
            <div>
              <h2>Редактирование пользователя</h2>
              <p className="muted">Если поле пароля оставить пустым, текущий пароль не изменится.</p>
            </div>
          </div>

          {editError ? <div className="error">{editError}</div> : null}

          <form className="form-grid form-grid--double" onSubmit={handleUpdateUser}>
            <label>
              Электронная почта
              <input
                type="email"
                className={getInputClassName(editFieldErrors, 'email')}
                value={editForm.email}
                onChange={(event) => patchEdit('email', event.target.value)}
                required
              />
              {renderFieldError(editFieldErrors, 'email')}
            </label>

            <label>
              ФИО
              <input
                type="text"
                className={getInputClassName(editFieldErrors, 'full_name')}
                value={editForm.full_name}
                onChange={(event) => patchEdit('full_name', event.target.value)}
                required
              />
              {renderFieldError(editFieldErrors, 'full_name')}
            </label>

            <label>
              Новый пароль
              <input
                type="password"
                className={getInputClassName(editFieldErrors, 'password')}
                value={editForm.password}
                onChange={(event) => patchEdit('password', event.target.value)}
              />
              <FieldHint>Заполняйте только если нужно заменить пароль пользователя.</FieldHint>
              {renderFieldError(editFieldErrors, 'password')}
            </label>

            <label>
              Роль
              <select value={editForm.role} onChange={(event) => patchEdit('role', event.target.value)}>
                <option value="student">Пользователь</option>
                <option value="admin">Администратор</option>
              </select>
            </label>

            <label className="checkbox-field field-span-2">
              <input
                type="checkbox"
                checked={editForm.is_active}
                onChange={(event) => patchEdit('is_active', event.target.checked)}
              />
              Учётная запись активна
            </label>

            <div className="field-span-2 sidebar-inline-actions">
              <button type="submit" disabled={busy}>{busy ? 'Сохранение...' : 'Сохранить изменения'}</button>
              <button type="button" className="button-secondary" onClick={() => setEditingUserId(null)}>
                Отменить
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  )

  const renderSystemTab = () => (
    <section className="card form-card">
      <div className="section-head">
        <div>
          <h2>Системные настройки</h2>
          <p className="muted">Эта вкладка отвечает только за логику платформы и ограничения выполнения тестов.</p>
        </div>
      </div>

      {loadingSystemSettings ? <div className="muted">Загрузка настроек...</div> : null}
      {settingsError ? <div className="error">{settingsError}</div> : null}
      {settingsMessage && activeTab === 'system' ? <div className="success">{settingsMessage}</div> : null}

      <form className="form-grid form-grid--double" onSubmit={(event) => { event.preventDefault(); handleSaveSettings('Системные настройки сохранены.') }}>
        <label className="checkbox-field field-span-2">
          <input
            type="checkbox"
            checked={systemSettings.allow_test_run_launches}
            onChange={(event) => patchSettings('allow_test_run_launches', event.target.checked)}
          />
          Разрешить запуск новых тестов
        </label>

        <label className="checkbox-field field-span-2">
          <input
            type="checkbox"
            checked={systemSettings.allow_private_target_hosts}
            onChange={(event) => patchSettings('allow_private_target_hosts', event.target.checked)}
          />
          Разрешить локальные и приватные адреса
        </label>

        <label>
          Максимум виртуальных пользователей
          <input
            type="number"
            min="1"
            className={getInputClassName(settingsFieldErrors, 'max_virtual_users_per_test')}
            value={systemSettings.max_virtual_users_per_test}
            onChange={(event) => patchSettings('max_virtual_users_per_test', event.target.value)}
          />
          <FieldHint>Глобальный лимит параллельной нагрузки на один тест.</FieldHint>
          {renderFieldError(settingsFieldErrors, 'max_virtual_users_per_test')}
        </label>

        <label>
          Максимум повторов на пользователя
          <input
            type="number"
            min="1"
            className={getInputClassName(settingsFieldErrors, 'max_repeat_count_per_test')}
            value={systemSettings.max_repeat_count_per_test}
            onChange={(event) => patchSettings('max_repeat_count_per_test', event.target.value)}
          />
          <FieldHint>Ограничивает число одинаковых вызовов от одного виртуального пользователя.</FieldHint>
          {renderFieldError(settingsFieldErrors, 'max_repeat_count_per_test')}
        </label>

        <label>
          Максимальный таймаут, секунды
          <input
            type="number"
            min="1"
            className={getInputClassName(settingsFieldErrors, 'max_timeout_seconds')}
            value={systemSettings.max_timeout_seconds}
            onChange={(event) => patchSettings('max_timeout_seconds', event.target.value)}
          />
          <FieldHint>Если тест укажет большее значение, запуск будет отклонён.</FieldHint>
          {renderFieldError(settingsFieldErrors, 'max_timeout_seconds')}
        </label>

        <label>
          Максимум строк логов на запуск
          <input
            type="number"
            min="50"
            className={getInputClassName(settingsFieldErrors, 'max_logs_per_run')}
            value={systemSettings.max_logs_per_run}
            onChange={(event) => patchSettings('max_logs_per_run', event.target.value)}
          />
          <FieldHint>Помогает не раздувать базу и хранить только полезную часть журнала выполнения.</FieldHint>
          {renderFieldError(settingsFieldErrors, 'max_logs_per_run')}
        </label>

        <div className="field-span-2">
          <button type="submit" disabled={savingSettings}>{savingSettings ? 'Сохранение...' : 'Сохранить системные настройки'}</button>
        </div>
      </form>
    </section>
  )

  const renderMailTab = () => (
    <div className="admin-panel-stack">
      <section className="card form-card">
        <div className="section-head">
          <div>
            <h2>Настройки почтового сервиса</h2>
            <p className="muted">Подключение к серверу отправки, данные отправителя и адрес интерфейса для ссылок из писем.</p>
          </div>
        </div>

        {loadingSystemSettings ? <div className="muted">Загрузка настроек...</div> : null}
        {settingsError ? <div className="error">{settingsError}</div> : null}
        {settingsMessage && activeTab === 'mail' ? <div className="success">{settingsMessage}</div> : null}

        <form className="form-grid form-grid--double" onSubmit={(event) => { event.preventDefault(); handleSaveSettings('Настройки почтового сервиса сохранены.') }}>
          <label className="checkbox-field field-span-2">
            <input
              type="checkbox"
              checked={systemSettings.email_enabled}
              onChange={(event) => patchSettings('email_enabled', event.target.checked)}
            />
            Отправка писем включена
          </label>

          <label>
            Почтовый сервер
            <input
              type="text"
              className={getInputClassName(settingsFieldErrors, 'smtp_host')}
              value={systemSettings.smtp_host || ''}
              onChange={(event) => patchSettings('smtp_host', event.target.value)}
              placeholder="Например, smtp.gmail.com"
            />
            {renderFieldError(settingsFieldErrors, 'smtp_host')}
          </label>

          <label>
            Порт
            <input
              type="number"
              min="1"
              className={getInputClassName(settingsFieldErrors, 'smtp_port')}
              value={systemSettings.smtp_port}
              onChange={(event) => patchSettings('smtp_port', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'smtp_port')}
          </label>

          <label>
            Имя пользователя
            <input
              type="text"
              className={getInputClassName(settingsFieldErrors, 'smtp_username')}
              value={systemSettings.smtp_username || ''}
              onChange={(event) => patchSettings('smtp_username', event.target.value)}
            />
            <FieldHint>Обычно это полный адрес почтового ящика.</FieldHint>
            {renderFieldError(settingsFieldErrors, 'smtp_username')}
          </label>

          <label>
            Пароль или секрет приложения
            <input
              type="password"
              className={getInputClassName(settingsFieldErrors, 'smtp_password')}
              value={systemSettings.smtp_password || ''}
              onChange={(event) => patchSettings('smtp_password', event.target.value)}
              placeholder={systemSettings.smtp_password_configured ? 'Секрет уже сохранён' : ''}
            />
            <FieldHint>{systemSettings.smtp_password_configured ? 'Оставьте пустым, если менять секрет не нужно.' : 'Секрет будет сохранён только на сервере.'}</FieldHint>
            {renderFieldError(settingsFieldErrors, 'smtp_password')}
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={systemSettings.smtp_use_tls}
              onChange={(event) => patchSettings('smtp_use_tls', event.target.checked)}
            />
            Защищённое соединение после подключения
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={systemSettings.smtp_use_ssl}
              onChange={(event) => patchSettings('smtp_use_ssl', event.target.checked)}
            />
            Использовать прямое защищённое подключение
          </label>

          <label>
            Адрес отправителя
            <input
              type="email"
              className={getInputClassName(settingsFieldErrors, 'email_from_address')}
              value={systemSettings.email_from_address || ''}
              onChange={(event) => patchSettings('email_from_address', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'email_from_address')}
          </label>

          <label>
            Подпись отправителя
            <input
              type="text"
              className={getInputClassName(settingsFieldErrors, 'email_from_name')}
              value={systemSettings.email_from_name || ''}
              onChange={(event) => patchSettings('email_from_name', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'email_from_name')}
          </label>

          <label className="field-span-2">
            Адрес пользовательского интерфейса
            <input
              type="text"
              className={getInputClassName(settingsFieldErrors, 'frontend_base_url')}
              value={systemSettings.frontend_base_url || ''}
              onChange={(event) => patchSettings('frontend_base_url', event.target.value)}
              placeholder="Например, http://192.168.1.68"
            />
            <FieldHint>Этот адрес подставляется в ссылки из писем: подтверждение почты и восстановление пароля.</FieldHint>
            {renderFieldError(settingsFieldErrors, 'frontend_base_url')}
          </label>

          <div className="field-span-2">
            <button type="submit" disabled={savingSettings}>{savingSettings ? 'Сохранение...' : 'Сохранить настройки почты'}</button>
          </div>
        </form>
      </section>

      <section className="card form-card">
        <div className="section-head">
          <div>
            <h2>Шаблоны писем</h2>
            <p className="muted">{'Используйте переменные {{full_name}}, {{link}}, {{minutes}}, а для смены адреса ещё и {{new_email}}.'}</p>
          </div>
        </div>

        <div className="form-grid form-grid--double">
          <label>
            Тема письма подтверждения адреса
            <input
              type="text"
              className={getInputClassName(settingsFieldErrors, 'email_verification_subject_template')}
              value={systemSettings.email_verification_subject_template}
              onChange={(event) => patchSettings('email_verification_subject_template', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'email_verification_subject_template')}
          </label>

          <label>
            Тема письма подтверждения нового адреса
            <input
              type="text"
              className={getInputClassName(settingsFieldErrors, 'email_change_subject_template')}
              value={systemSettings.email_change_subject_template}
              onChange={(event) => patchSettings('email_change_subject_template', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'email_change_subject_template')}
          </label>

          <label className="field-span-2">
            Текст письма подтверждения адреса
            <textarea
              rows="6"
              className={getInputClassName(settingsFieldErrors, 'email_verification_body_template')}
              value={systemSettings.email_verification_body_template}
              onChange={(event) => patchSettings('email_verification_body_template', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'email_verification_body_template')}
          </label>

          <label className="field-span-2">
            Текст письма подтверждения нового адреса
            <textarea
              rows="6"
              className={getInputClassName(settingsFieldErrors, 'email_change_body_template')}
              value={systemSettings.email_change_body_template}
              onChange={(event) => patchSettings('email_change_body_template', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'email_change_body_template')}
          </label>

          <label>
            Тема письма для сброса пароля
            <input
              type="text"
              className={getInputClassName(settingsFieldErrors, 'password_reset_subject_template')}
              value={systemSettings.password_reset_subject_template}
              onChange={(event) => patchSettings('password_reset_subject_template', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'password_reset_subject_template')}
          </label>

          <label className="field-span-2">
            Текст письма для сброса пароля
            <textarea
              rows="6"
              className={getInputClassName(settingsFieldErrors, 'password_reset_body_template')}
              value={systemSettings.password_reset_body_template}
              onChange={(event) => patchSettings('password_reset_body_template', event.target.value)}
            />
            {renderFieldError(settingsFieldErrors, 'password_reset_body_template')}
          </label>
        </div>
      </section>
    </div>
  )

  const renderBackupTab = () => (
    <section className="card form-card">
      <div className="section-head">
        <div>
          <h2>Резервная копия базы данных</h2>
          <p className="muted">Создание и восстановление выполняются только здесь, без смешивания с другими разделами панели.</p>
        </div>
      </div>

      {backupError ? <div className="error">{backupError}</div> : null}
      {backupMessage ? <div className="success">{backupMessage}</div> : null}

      <div className="backup-actions">
        <button type="button" onClick={handleDownloadBackup} disabled={backupBusy}>
          {backupBusy ? 'Подготовка...' : 'Скачать резервную копию'}
        </button>
        <button type="button" className="button-secondary" onClick={handleDownloadAutomaticBackup} disabled={downloadingAutomaticBackup}>
          {downloadingAutomaticBackup ? 'Подготовка...' : 'Скачать последнюю автоматическую копию'}
        </button>
      </div>

      <form className="form-grid" onSubmit={handleRestoreBackup}>
        <label>
          Файл резервной копии
          <input
            id="restore-database-file-input"
            type="file"
            accept="application/json"
            onChange={(event) => setRestoreFile(event.target.files?.[0] || null)}
          />
          <FieldHint>Перед восстановлением система автоматически создаст страховочную копию текущей базы данных.</FieldHint>
        </label>

        <div>
          <button type="submit" disabled={backupBusy}>{backupBusy ? 'Восстановление...' : 'Загрузить резервную копию'}</button>
        </div>
      </form>
    </section>
  )

  const renderAnalyticsTab = () => (
    <div className="admin-panel-stack">
      <section className="card form-card">
        <div className="section-head">
          <div>
            <h2>Аналитика по системе</h2>
            <p className="muted">Выберите систему пользователя, чтобы получить общую сводку по тестам и запускам.</p>
          </div>
        </div>

        <label>
          Система
          <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            <option value="">Выберите систему</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>{project.owner?.full_name || project.owner?.email || '—'} · {project.name}</option>
            ))}
          </select>
        </label>
      </section>

      {loadingAnalytics ? <div className="card">Загрузка аналитики...</div> : null}
      {analyticsError ? <div className="error">{analyticsError}</div> : null}

      {analytics ? (
        <>
          <section className="card form-card">
            <div className="section-head">
              <div>
                <h2>{analytics.project_name}</h2>
                <p className="muted">Владелец: {analytics.owner?.full_name || analytics.owner?.email || '—'}</p>
              </div>
              <div className="sidebar-inline-actions">
                <button type="button" className="button-secondary" onClick={() => onOpenProject(analytics.project_id)}>
                  Открыть систему
                </button>
              </div>
            </div>

            <div className="stats-grid admin-analytics-grid">
              <article className="card stat-card"><div className="muted">Тестов</div><div className="stat-value">{analytics.tests_count}</div></article>
              <article className="card stat-card"><div className="muted">Запусков</div><div className="stat-value">{analytics.totals.runs_count}</div></article>
              <article className="card stat-card"><div className="muted">Успешных запусков</div><div className="stat-value">{analytics.totals.successful_runs}</div></article>
              <article className="card stat-card"><div className="muted">Ошибочных запусков</div><div className="stat-value">{analytics.totals.failed_runs}</div></article>
              <article className="card stat-card"><div className="muted">Всего запросов</div><div className="stat-value">{analytics.totals.total_requests}</div></article>
              <article className="card stat-card"><div className="muted">Среднее время ответа, мс</div><div className="stat-value stat-value--small">{formatNumber(analytics.totals.avg_response_ms)}</div></article>
              <article className="card stat-card"><div className="muted">95-й процентиль, мс</div><div className="stat-value stat-value--small">{formatNumber(analytics.totals.p95_response_ms)}</div></article>
              <article className="card stat-card"><div className="muted">Средняя доля ошибок, %</div><div className="stat-value stat-value--small">{formatNumber(analytics.totals.error_rate)}</div></article>
            </div>
          </section>

          <section className="card form-card">
            <div className="section-head">
              <div>
                <h2>Нагрузочные тесты системы</h2>
                <p className="muted">Список нагрузочных тестов и итоговых показателей по каждому из них.</p>
              </div>
            </div>

            <div className="list">
              {analytics.tests.map((test) => (
                <article key={test.test_id} className="project-card project-card--stacked">
                  <div className="project-card__content">
                    <h3>{test.test_name}</h3>
                    <p className="muted">Последняя активность: {test.last_run_activity || '—'}</p>
                    <div className="muted small">
                      Запусков: {test.runs_count} · Успешных: {test.successful_runs} · Ошибочных: {test.failed_runs}
                    </div>
                    <div className="muted small">
                      Среднее время ответа: {formatNumber(test.avg_response_ms)} мс · 95-й процентиль: {formatNumber(test.p95_response_ms)} мс · Ошибки: {formatNumber(test.error_rate)}%
                    </div>
                  </div>
                  <div className="project-card__actions">
                    <button type="button" onClick={() => onOpenTest(test.test_id)}>Открыть тест</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : selectedProjectId ? null : (
        <section className="card empty-state">
          <h3>Система не выбрана</h3>
          <p className="muted">Выберите систему вверху страницы, чтобы увидеть её сводную аналитику.</p>
        </section>
      )}
    </div>
  )

  return (
    <div className="workspace-page">
      <section className="page-header">
        <div>
          <h1>Панель администратора</h1>
          <p className="muted">
            Управление пользователями, системными ограничениями, почтовым сервисом, резервными копиями и аналитикой тестируемых систем.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="button-secondary" onClick={onBack}>
            Назад к рабочему столу
          </button>
        </div>
      </section>

      <FormGuide title="Справка по панели администратора" items={adminGuideItems} />

      <section className="stats-grid admin-summary-grid">
        <article className="card stat-card"><div className="muted">Пользователей</div><div className="stat-value">{users.length}</div></article>
        <article className="card stat-card"><div className="muted">Систем</div><div className="stat-value">{projects.length}</div></article>
        <article className="card stat-card"><div className="muted">Тестов</div><div className="stat-value">{totalTests}</div></article>
      </section>

      <div className="tabs admin-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' ? renderUsersTab() : null}
      {activeTab === 'system' ? renderSystemTab() : null}
      {activeTab === 'mail' ? renderMailTab() : null}
      {activeTab === 'backup' ? renderBackupTab() : null}
      {activeTab === 'analytics' ? renderAnalyticsTab() : null}
    </div>
  )
}
