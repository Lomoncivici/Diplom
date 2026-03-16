import { useEffect, useMemo, useState } from 'react'
import {
  clearToken,
  createProject,
  getMe,
  getProjects,
  getToken,
  getUsers,
  login,
  register,
  updateProject,
} from './api'

const PROJECT_META_KEY = 'diploma_project_meta'
const PROJECT_RUNS_KEY = 'diploma_project_runs'
const PROJECT_LOGS_KEY = 'diploma_project_logs'

const emptyDraft = {
  name: '',
  description: '',
  projectType: 'api',
  testType: 'load',
  environment: 'local',
  targetUrl: '',
  targetPort: '',
  goal: '',
  successCriteria: '',
  virtualUsers: 50,
  duration: '5m',
  rampUp: '30s',
  rampDown: '15s',
  timeout: '30s',
  repeatCount: 1,
  monitoringEnabled: true,
  prometheusUrl: '',
  grafanaUrl: '',
  maxAvgResponseMs: 500,
  maxP95Ms: 1000,
  maxErrorRate: 2,
  minThroughput: 100,
  scenariosText: '',
}

function loadMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}

function saveMap(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function getProjectBadge(type) {
  const map = {
    api: 'API',
    website: 'Сайт',
    application: 'Приложение',
    microservice: 'Микросервисы',
  }
  return map[type] || 'Проект'
}

function getStatusLabel(projectMeta, runs) {
  if (!projectMeta?.targetUrl) return 'Не настроен'
  if (!runs?.length) return 'Готов'
  return runs[0]?.status === 'success' ? 'Успешно' : 'Есть ошибки'
}

function buildSimulatedRun(project, meta) {
  const startedAt = new Date()
  const vus = Number(meta.virtualUsers || 1)
  const avgResponse = Math.max(120, Math.round(900 - Math.min(vus * 4, 500)))
  const p95 = avgResponse + 180
  const errorRate = vus > 180 ? 3.1 : vus > 100 ? 1.7 : 0.8
  const throughput = Math.max(30, Math.round(vus * 2.2))
  const success =
    avgResponse <= Number(meta.maxAvgResponseMs || 500) &&
    p95 <= Number(meta.maxP95Ms || 1000) &&
    errorRate <= Number(meta.maxErrorRate || 2)

  const finishedAt = new Date(startedAt.getTime() + 1200)

  return {
    id: crypto.randomUUID(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    status: success ? 'success' : 'warning',
    summary: success
      ? 'Тест завершён успешно. Пороговые значения не превышены.'
      : 'Тест завершён с предупреждениями. Один или несколько порогов превышены.',
    metrics: {
      avgResponse,
      p95,
      errorRate,
      throughput,
      vus,
    },
    projectId: project.id,
  }
}

function AuthPage({ onAuthSuccess, error }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState('')

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setLocalError('')

    try {
      if (mode === 'register') {
        await register(form.email, form.full_name, form.password)
      }
      const data = await login(form.email, form.password)
      onAuthSuccess(data.access_token)
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <div className="auth-head">
          <div>
            <h1>Diploma Platform</h1>
            <p className="muted">
              Платформа нагрузочного тестирования и мониторинга производительности.
            </p>
          </div>
        </div>

        <div className="tabs">
          <button
            className={mode === 'login' ? 'active' : ''}
            type="button"
            onClick={() => setMode('login')}
          >
            Вход
          </button>
          <button
            className={mode === 'register' ? 'active' : ''}
            type="button"
            onClick={() => setMode('register')}
          >
            Регистрация
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {localError ? <div className="error">{localError}</div> : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              type="email"
              placeholder="student@example.com"
              required
            />
          </label>

          {mode === 'register' ? (
            <label>
              Полное имя
              <input
                value={form.full_name}
                onChange={(e) => updateField('full_name', e.target.value)}
                type="text"
                placeholder="Иван Иванов"
                required
              />
            </label>
          ) : null}

          <label>
            Пароль
            <input
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              type="password"
              placeholder="Qwerty123!"
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Sidebar({
  user,
  projects,
  projectMetaMap,
  projectRunsMap,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onOpenDashboard,
  onLogout,
}) {
  const [query, setQuery] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState({})

  function toggleFolder(ownerId) {
    setCollapsedFolders((prev) => ({
      ...prev,
      [ownerId]: !prev[ownerId],
    }))
  }

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return projects

    return projects.filter((project) => {
      const meta = projectMetaMap[project.id] || {}

      const ownerFullName = (project.owner?.full_name || '').toLowerCase()
      const ownerEmail = (project.owner?.email || '').toLowerCase()

      const ownerLogin = (
        project.owner?.username ||
        project.owner?.email?.split('@')[0] ||
        ''
      ).toLowerCase()

      return (
        project.name.toLowerCase().includes(normalized) ||
        (project.description || '').toLowerCase().includes(normalized) ||
        (meta.projectType || '').toLowerCase().includes(normalized) ||
        ownerFullName.includes(normalized) ||
        ownerEmail.includes(normalized) ||
        ownerLogin.includes(normalized)
      )
    })
  }, [projects, projectMetaMap, query])

  const groupedProjects = useMemo(() => {
    if (user.role !== 'admin') return []

    const groups = {}

    for (const project of filteredProjects) {
      const ownerId = project.owner?.id ?? 'unknown'

      if (!groups[ownerId]) {
        groups[ownerId] = {
          owner: project.owner ?? {
            id: 'unknown',
            full_name: 'Неизвестный пользователь',
            email: 'unknown',
            username: '',
          },
          projects: [],
        }
      }

      groups[ownerId].projects.push(project)
    }

    return Object.values(groups).sort((a, b) => {
      const aName =
        a.owner?.full_name ||
        a.owner?.username ||
        a.owner?.email ||
        ''
      const bName =
        b.owner?.full_name ||
        b.owner?.username ||
        b.owner?.email ||
        ''
      return aName.localeCompare(bName, 'ru')
    })
  }, [filteredProjects, user.role])

  useEffect(() => {
    if (user.role !== 'admin') return

    setCollapsedFolders((prev) => {
      const next = { ...prev }

      groupedProjects.forEach((group) => {
        if (next[group.owner.id] === undefined) {
          next[group.owner.id] = true
        }
      })

      return next
    })
  }, [groupedProjects, user.role])

  function renderProjectItem(project) {
    const meta = projectMetaMap[project.id] || {}
    const runs = projectRunsMap[project.id] || []
    const status = getStatusLabel(meta, runs)

    return (
      <button
        key={project.id}
        type="button"
        className={`project-nav-item ${selectedProjectId === project.id ? 'selected' : ''}`}
        onClick={() => onSelectProject(project.id)}
      >
        <div className="project-nav-head">
          <strong>{project.name}</strong>
          <span className="project-type-badge">{getProjectBadge(meta.projectType)}</span>
        </div>

        <div className="project-nav-desc">
          {project.description || 'Описание проекта пока не заполнено.'}
        </div>

        <div className="project-nav-meta">
          <span>{status}</span>
          <span>Запусков: {runs.length}</span>
        </div>
      </button>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="brand-button" type="button" onClick={onOpenDashboard}>
          <div className="brand-mark">DP</div>
          <div>
            <div className="brand-title">Diploma Platform</div>
            <div className="muted small">Load testing workspace</div>
          </div>
        </button>

        <div className="user-panel card card--soft">
          <div className="user-avatar">{user.full_name?.[0] || user.email?.[0] || 'U'}</div>
          <div>
            <div className="user-name">{user.full_name || user.email}</div>
            <div className="muted small">
              {user.role === 'admin' ? 'Администратор' : 'Студент'}
            </div>
          </div>
        </div>

        <div className="sidebar-actions">
          <button type="button" onClick={onCreateProject}>
            + Создать проект
          </button>
          <input
            type="text"
            placeholder="Поиск проектов..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="sidebar-projects">
        <div className="section-title">Проекты</div>

        {filteredProjects.length === 0 ? (
          <div className="muted empty-box">Проекты пока не найдены.</div>
        ) : user.role === 'admin' ? (
          groupedProjects.map((group) => {
            const ownerId = group.owner.id
            const isCollapsed = !!collapsedFolders[ownerId]

            const ownerLogin =
              group.owner.username ||
              group.owner.login ||
              group.owner.email?.split('@')[0] ||
              'user'

            const ownerEmail = group.owner.email || ''

            return (
              <div key={ownerId} className="project-folder">
                <div className="project-folder-header">
                  <div className="project-folder-user-info">
                    <div className="project-folder-title">{ownerLogin}</div>

                    <div className="project-folder-subtitle">
                      {ownerEmail}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="folder-toggle-button"
                    onClick={() => toggleFolder(ownerId)}
                  >
                    {isCollapsed ? 'Развернуть' : 'Скрыть'}
                  </button>
                </div>

                {!isCollapsed ? (
                  <div className="project-folder-items">
                    {group.projects.map((project) => renderProjectItem(project))}
                  </div>
                ) : null}
              </div>
            )
          })
        ) : (
          filteredProjects.map((project) => renderProjectItem(project))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="button-secondary" type="button" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </aside>
  )
}

function Dashboard({
  projects,
  projectMetaMap,
  projectRunsMap,
  onCreateProject,
  onOpenProject,
  user,
}) {
  const totalRuns = Object.values(projectRunsMap).reduce((sum, arr) => sum + arr.length, 0)
  const successfulRuns = Object.values(projectRunsMap).reduce(
    (sum, arr) => sum + arr.filter((run) => run.status === 'success').length,
    0
  )

  const recentProjects = [...projects].slice(0, 4)

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div>
          <h1>Рабочее пространство</h1>
          <p className="muted">
            Добро пожаловать, {user.full_name || user.email}. Здесь можно создавать проекты,
            настраивать тесты и смотреть аналитику запусков.
          </p>
        </div>
        <button type="button" onClick={onCreateProject}>
          + Новый проект
        </button>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="muted small">Всего проектов</div>
          <div className="stat-value">{projects.length}</div>
        </div>
        <div className="card stat-card">
          <div className="muted small">Всего запусков</div>
          <div className="stat-value">{totalRuns}</div>
        </div>
        <div className="card stat-card">
          <div className="muted small">Успешных запусков</div>
          <div className="stat-value">{successfulRuns}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="section-title">Последние проекты</div>
          <div className="stack">
            {recentProjects.length === 0 ? (
              <div className="muted">Проекты ещё не созданы.</div>
            ) : (
              recentProjects.map((project) => {
                const meta = projectMetaMap[project.id] || {}
                return (
                  <button
                    key={project.id}
                    type="button"
                    className="dashboard-project-card"
                    onClick={() => onOpenProject(project.id)}
                  >
                    <div className="dashboard-project-head">
                      <strong>{project.name}</strong>
                      <span className="project-type-badge">{getProjectBadge(meta.projectType)}</span>
                    </div>
                    <div className="muted">
                      {project.description || 'Описание проекта отсутствует.'}
                    </div>
                    <div className="muted small">
                      URL: {meta.targetUrl || 'не задан'} · Среда: {meta.environment || 'local'}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="section-title">Что здесь уже можно делать</div>
          <ul className="feature-list">
            <li>создавать и открывать проекты;</li>
            <li>хранить расширенные настройки проекта;</li>
            <li>распределять интерфейс на левую панель и рабочую область;</li>
            <li>переключаться между вкладками проекта;</li>
            <li>имитировать запуск теста и видеть аналитику.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function ProjectEditor({
  mode,
  project,
  draft,
  setDraft,
  onSave,
  onRunTest,
  runs,
  logs,
  saveError,
  saveSuccess,
  saving,
}) {
  const [activeTab, setActiveTab] = useState('overview')

  function patch(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  const latestRun = runs[0]
  const latestMetrics = latestRun?.metrics

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div>
          <h1>{mode === 'create' ? 'Создание проекта' : project?.name || 'Проект'}</h1>
          <p className="muted">
            {mode === 'create'
              ? 'Заполни основные настройки проекта, затем сохрани его.'
              : 'Настраивай проект, редактируй параметры тестирования и переходи по вкладкам.'}
          </p>
        </div>

        <div className="header-actions">
          {mode === 'edit' ? (
            <button type="button" className="button-secondary" onClick={onRunTest}>
              Запустить тест
            </button>
          ) : null}
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? 'Сохранение...' : mode === 'create' ? 'Создать проект' : 'Сохранить'}
          </button>
        </div>
      </div>

      {saveError ? <div className="error">{saveError}</div> : null}
      {saveSuccess ? <div className="success">{saveSuccess}</div> : null}

      <div className="tabs project-tabs">
        <button
          type="button"
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Общее
        </button>
        <button
          type="button"
          className={activeTab === 'config' ? 'active' : ''}
          onClick={() => setActiveTab('config')}
        >
          Конфигурация
        </button>
        <button
          type="button"
          className={activeTab === 'scenarios' ? 'active' : ''}
          onClick={() => setActiveTab('scenarios')}
        >
          Сценарии
        </button>
        <button
          type="button"
          className={activeTab === 'runs' ? 'active' : ''}
          onClick={() => setActiveTab('runs')}
        >
          Запуски
        </button>
        <button
          type="button"
          className={activeTab === 'analytics' ? 'active' : ''}
          onClick={() => setActiveTab('analytics')}
        >
          Аналитика
        </button>
        <button
          type="button"
          className={activeTab === 'logs' ? 'active' : ''}
          onClick={() => setActiveTab('logs')}
        >
          Логи
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="editor-grid">
          <div className="card">
            <div className="section-title">Основная информация</div>
            <div className="form-grid two-columns">
              <label>
                Название проекта
                <input
                  value={draft.name}
                  onChange={(e) => patch('name', e.target.value)}
                  placeholder="Например: Order Service Load Test"
                />
              </label>

              <label>
                Тип проекта
                <select
                  value={draft.projectType}
                  onChange={(e) => patch('projectType', e.target.value)}
                >
                  <option value="api">API</option>
                  <option value="website">Сайт</option>
                  <option value="application">Приложение</option>
                  <option value="microservice">Микросервисная система</option>
                </select>
              </label>

              <label className="full-width">
                Описание
                <textarea
                  rows="4"
                  value={draft.description}
                  onChange={(e) => patch('description', e.target.value)}
                  placeholder="Кратко опиши, что именно тестируется."
                />
              </label>

              <label>
                Среда
                <select
                  value={draft.environment}
                  onChange={(e) => patch('environment', e.target.value)}
                >
                  <option value="local">local</option>
                  <option value="test">test</option>
                  <option value="staging">staging</option>
                  <option value="production-like">production-like</option>
                </select>
              </label>

              <label>
                Тип тестирования
                <select value={draft.testType} onChange={(e) => patch('testType', e.target.value)}>
                  <option value="load">Load</option>
                  <option value="stress">Stress</option>
                  <option value="baseline">Baseline</option>
                  <option value="spike">Spike</option>
                </select>
              </label>

              <label className="full-width">
                Цель тестирования
                <textarea
                  rows="3"
                  value={draft.goal}
                  onChange={(e) => patch('goal', e.target.value)}
                  placeholder="Например: Проверка устойчивости API при 100 одновременных пользователях."
                />
              </label>

              <label className="full-width">
                Критерий успешности
                <textarea
                  rows="3"
                  value={draft.successCriteria}
                  onChange={(e) => patch('successCriteria', e.target.value)}
                  placeholder="Например: avg < 500 ms, p95 < 1000 ms, error rate < 2%."
                />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Целевая система</div>
            <div className="form-grid">
              <label>
                Base URL
                <input
                  value={draft.targetUrl}
                  onChange={(e) => patch('targetUrl', e.target.value)}
                  placeholder="http://order-service:8000"
                />
              </label>
              <label>
                Порт
                <input
                  value={draft.targetPort}
                  onChange={(e) => patch('targetPort', e.target.value)}
                  placeholder="8000"
                />
              </label>
            </div>

            <div className="preview-box">
              <div className="muted small">Предпросмотр</div>
              <div>
                {draft.targetUrl || 'URL не задан'}
                {draft.targetPort ? `:${draft.targetPort}` : ''}
              </div>
              <div className="muted small">
                Тип: {getProjectBadge(draft.projectType)} · Среда: {draft.environment}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'config' ? (
        <div className="editor-grid">
          <div className="card">
            <div className="section-title">Параметры нагрузки</div>
            <div className="form-grid two-columns">
              <label>
                Виртуальные пользователи (VUs)
                <input
                  type="number"
                  min="1"
                  value={draft.virtualUsers}
                  onChange={(e) => patch('virtualUsers', e.target.value)}
                />
              </label>
              <label>
                Длительность
                <input
                  value={draft.duration}
                  onChange={(e) => patch('duration', e.target.value)}
                  placeholder="5m"
                />
              </label>
              <label>
                Ramp-up
                <input
                  value={draft.rampUp}
                  onChange={(e) => patch('rampUp', e.target.value)}
                  placeholder="30s"
                />
              </label>
              <label>
                Ramp-down
                <input
                  value={draft.rampDown}
                  onChange={(e) => patch('rampDown', e.target.value)}
                  placeholder="15s"
                />
              </label>
              <label>
                Timeout
                <input
                  value={draft.timeout}
                  onChange={(e) => patch('timeout', e.target.value)}
                  placeholder="30s"
                />
              </label>
              <label>
                Повторов
                <input
                  type="number"
                  min="1"
                  value={draft.repeatCount}
                  onChange={(e) => patch('repeatCount', e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Мониторинг и пороги</div>
            <div className="form-grid">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draft.monitoringEnabled}
                  onChange={(e) => patch('monitoringEnabled', e.target.checked)}
                />
                <span>Включить мониторинг</span>
              </label>

              <label>
                Prometheus URL
                <input
                  value={draft.prometheusUrl}
                  onChange={(e) => patch('prometheusUrl', e.target.value)}
                  placeholder="http://prometheus:9090"
                />
              </label>

              <label>
                Grafana URL
                <input
                  value={draft.grafanaUrl}
                  onChange={(e) => patch('grafanaUrl', e.target.value)}
                  placeholder="http://grafana:3000"
                />
              </label>

              <label>
                Максимальное среднее время ответа (ms)
                <input
                  type="number"
                  value={draft.maxAvgResponseMs}
                  onChange={(e) => patch('maxAvgResponseMs', e.target.value)}
                />
              </label>

              <label>
                Максимальный p95 (ms)
                <input
                  type="number"
                  value={draft.maxP95Ms}
                  onChange={(e) => patch('maxP95Ms', e.target.value)}
                />
              </label>

              <label>
                Максимальный error rate (%)
                <input
                  type="number"
                  step="0.1"
                  value={draft.maxErrorRate}
                  onChange={(e) => patch('maxErrorRate', e.target.value)}
                />
              </label>

              <label>
                Минимальный throughput
                <input
                  type="number"
                  value={draft.minThroughput}
                  onChange={(e) => patch('minThroughput', e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'scenarios' ? (
        <div className="card">
          <div className="section-title">Сценарии тестирования</div>
          <p className="muted">
            Пока backend ещё не хранит отдельные сущности сценариев, здесь можно держать черновик
            сценариев проекта.
          </p>
          <textarea
            rows="14"
            value={draft.scenariosText}
            onChange={(e) => patch('scenariosText', e.target.value)}
            placeholder={`Пример:\n1. GET /api/users\n2. POST /api/login\n3. GET /api/orders\n\nили k6-скрипт / псевдо-сценарий.`}
          />
        </div>
      ) : null}

      {activeTab === 'runs' ? (
        <div className="card">
          <div className="section-title">История запусков</div>
          {runs.length === 0 ? (
            <div className="muted">Запусков пока нет. Нажми “Запустить тест”.</div>
          ) : (
            <div className="stack">
              {runs.map((run) => (
                <div key={run.id} className="run-card">
                  <div className="run-card-head">
                    <strong>{run.status === 'success' ? 'Успешный запуск' : 'Запуск с предупреждениями'}</strong>
                    <span className={`status-chip ${run.status}`}>{run.status}</span>
                  </div>
                  <div className="muted small">
                    Начало: {formatDate(run.startedAt)} · Окончание: {formatDate(run.finishedAt)}
                  </div>
                  <div>{run.summary}</div>
                  <div className="run-metrics-grid">
                    <div>avg: {run.metrics.avgResponse} ms</div>
                    <div>p95: {run.metrics.p95} ms</div>
                    <div>errors: {run.metrics.errorRate}%</div>
                    <div>throughput: {run.metrics.throughput}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'analytics' ? (
        <div className="analytics-grid">
          <div className="card stat-card">
            <div className="muted small">Среднее время ответа</div>
            <div className="stat-value">
              {latestMetrics ? `${latestMetrics.avgResponse} ms` : '—'}
            </div>
          </div>
          <div className="card stat-card">
            <div className="muted small">p95</div>
            <div className="stat-value">{latestMetrics ? `${latestMetrics.p95} ms` : '—'}</div>
          </div>
          <div className="card stat-card">
            <div className="muted small">Error rate</div>
            <div className="stat-value">
              {latestMetrics ? `${latestMetrics.errorRate}%` : '—'}
            </div>
          </div>
          <div className="card stat-card">
            <div className="muted small">Throughput</div>
            <div className="stat-value">
              {latestMetrics ? latestMetrics.throughput : '—'}
            </div>
          </div>

          <div className="card analytics-wide">
            <div className="section-title">Итог по последнему запуску</div>
            {latestRun ? (
              <>
                <p>{latestRun.summary}</p>
                <ul className="feature-list">
                  <li>
                    avg response: {latestMetrics.avgResponse} ms / порог {draft.maxAvgResponseMs} ms
                  </li>
                  <li>
                    p95: {latestMetrics.p95} ms / порог {draft.maxP95Ms} ms
                  </li>
                  <li>
                    error rate: {latestMetrics.errorRate}% / порог {draft.maxErrorRate}%
                  </li>
                  <li>
                    throughput: {latestMetrics.throughput} / минимум {draft.minThroughput}
                  </li>
                </ul>
              </>
            ) : (
              <div className="muted">Пока нет данных для аналитики.</div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'logs' ? (
        <div className="card">
          <div className="section-title">Логи проекта</div>
          {logs.length === 0 ? (
            <div className="muted">Логи ещё не сформированы.</div>
          ) : (
            <div className="logs-box">
              {logs.map((line, index) => (
                <div key={`${line}-${index}`} className="log-line">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function AdminPanel({ users }) {
  return (
    <div className="card">
      <div className="section-title">Пользователи</div>
      {users.length === 0 ? (
        <div className="muted">Список пользователей пуст.</div>
      ) : (
        <div className="stack">
          {users.map((user) => (
            <div key={user.id} className="user-row">
              <div>
                <strong>{user.full_name || user.email}</strong>
                <div className="muted small">{user.email}</div>
              </div>
              <span className="project-type-badge">
                {user.role === 'admin' ? 'admin' : 'student'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [workspaceMode, setWorkspaceMode] = useState('dashboard')
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const [projectMetaMap, setProjectMetaMap] = useState(loadMap(PROJECT_META_KEY))
  const [projectRunsMap, setProjectRunsMap] = useState(loadMap(PROJECT_RUNS_KEY))
  const [projectLogsMap, setProjectLogsMap] = useState(loadMap(PROJECT_LOGS_KEY))

  async function loadData() {
    if (!getToken()) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const me = await getMe()
      const projectList = await getProjects()
      setUser(me)
      setProjects(projectList)

      if (me.role === 'admin') {
        const userList = await getUsers()
        setUsers(userList)
      } else {
        setUsers([])
      }
    } catch (err) {
      clearToken()
      setUser(null)
      setProjects([])
      setUsers([])
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    saveMap(PROJECT_META_KEY, projectMetaMap)
  }, [projectMetaMap])

  useEffect(() => {
    saveMap(PROJECT_RUNS_KEY, projectRunsMap)
  }, [projectRunsMap])

  useEffect(() => {
    saveMap(PROJECT_LOGS_KEY, projectLogsMap)
  }, [projectLogsMap])

  useEffect(() => {
    if (workspaceMode === 'create') {
      setDraft(emptyDraft)
      return
    }

    if (workspaceMode === 'project' && selectedProjectId) {
      const project = projects.find((item) => item.id === selectedProjectId)
      const meta = projectMetaMap[selectedProjectId] || {}

      if (project) {
        setDraft({
          ...emptyDraft,
          name: project.name || '',
          description: project.description || '',
          ...meta,
        })
      }
    }
  }, [workspaceMode, selectedProjectId, projects, projectMetaMap])

  function handleAuthSuccess(token) {
    localStorage.setItem('token', token)
    loadData()
  }

  function handleLogout() {
    clearToken()
    setUser(null)
    setProjects([])
    setUsers([])
    setSelectedProjectId(null)
    setWorkspaceMode('dashboard')
  }

  function openDashboard() {
    setSelectedProjectId(null)
    setWorkspaceMode('dashboard')
    setSaveError('')
    setSaveSuccess('')
  }

  function openCreateProject() {
    setSelectedProjectId(null)
    setWorkspaceMode('create')
    setSaveError('')
    setSaveSuccess('')
  }

  function openProject(projectId) {
    setSelectedProjectId(projectId)
    setWorkspaceMode('project')
    setSaveError('')
    setSaveSuccess('')
  }

  async function handleSaveProject() {
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    try {
      if (!draft.name.trim()) {
        throw new Error('Укажи название проекта.')
      }

      if (workspaceMode === 'create') {
        const created = await createProject({
          name: draft.name.trim(),
          description: draft.description.trim(),
        })

        setProjects((prev) => [created, ...prev])
        setProjectMetaMap((prev) => ({
          ...prev,
          [created.id]: {
            ...draft,
          },
        }))
        setProjectRunsMap((prev) => ({ ...prev, [created.id]: [] }))
        setProjectLogsMap((prev) => ({
          ...prev,
          [created.id]: [
            `[${new Date().toLocaleString()}] Проект создан.`,
          ],
        }))

        setSelectedProjectId(created.id)
        setWorkspaceMode('project')
        setSaveSuccess('Проект успешно создан.')
        return
      }

      if (!selectedProjectId) {
        throw new Error('Проект не выбран.')
      }

      const updated = await updateProject(selectedProjectId, {
        name: draft.name.trim(),
        description: draft.description.trim(),
      })

      setProjects((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      )

      setProjectMetaMap((prev) => ({
        ...prev,
        [selectedProjectId]: {
          ...draft,
        },
      }))

      setProjectLogsMap((prev) => ({
        ...prev,
        [selectedProjectId]: [
          `[${new Date().toLocaleString()}] Настройки проекта сохранены.`,
          ...(prev[selectedProjectId] || []),
        ],
      }))

      setSaveSuccess('Проект успешно сохранён.')
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleRunTest() {
    if (!selectedProjectId) return
    const project = projects.find((item) => item.id === selectedProjectId)
    if (!project) return

    const run = buildSimulatedRun(project, draft)

    setProjectRunsMap((prev) => ({
      ...prev,
      [selectedProjectId]: [run, ...(prev[selectedProjectId] || [])],
    }))

    setProjectLogsMap((prev) => ({
      ...prev,
      [selectedProjectId]: [
        `[${new Date().toLocaleString()}] Запуск теста для проекта "${project.name}".`,
        `[${new Date().toLocaleString()}] avg=${run.metrics.avgResponse}ms p95=${run.metrics.p95}ms errors=${run.metrics.errorRate}% throughput=${run.metrics.throughput}.`,
        ...(prev[selectedProjectId] || []),
      ],
    }))

    setSaveSuccess('Тест выполнен. Данные обновлены локально.')
    setSaveError('')
  }

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  )

  if (loading) {
    return <div className="loading-screen">Загрузка...</div>
  }

  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} error={error} />
  }

  const runs = selectedProjectId ? projectRunsMap[selectedProjectId] || [] : []
  const logs = selectedProjectId ? projectLogsMap[selectedProjectId] || [] : []

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        projects={projects}
        projectMetaMap={projectMetaMap}
        projectRunsMap={projectRunsMap}
        selectedProjectId={selectedProjectId}
        onSelectProject={openProject}
        onCreateProject={openCreateProject}
        onOpenDashboard={openDashboard}
        onLogout={handleLogout}
      />

      <main className="workspace">
        {workspaceMode === 'dashboard' ? (
          <Dashboard
            projects={projects}
            projectMetaMap={projectMetaMap}
            projectRunsMap={projectRunsMap}
            onCreateProject={openCreateProject}
            onOpenProject={openProject}
            user={user}
          />
        ) : null}

        {workspaceMode === 'create' ? (
          <ProjectEditor
            mode="create"
            project={null}
            draft={draft}
            setDraft={setDraft}
            onSave={handleSaveProject}
            onRunTest={handleRunTest}
            runs={[]}
            logs={[]}
            saveError={saveError}
            saveSuccess={saveSuccess}
            saving={saving}
          />
        ) : null}

        {workspaceMode === 'project' && selectedProject ? (
          <div className="workspace-stack">
            <ProjectEditor
              mode="edit"
              project={selectedProject}
              draft={draft}
              setDraft={setDraft}
              onSave={handleSaveProject}
              onRunTest={handleRunTest}
              runs={runs}
              logs={logs}
              saveError={saveError}
              saveSuccess={saveSuccess}
              saving={saving}
            />
            {user.role === 'admin' ? <AdminPanel users={users} /> : null}
          </div>
        ) : null}
      </main>
    </div>
  )
}