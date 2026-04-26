import { useEffect, useState } from 'react'
import { createProject, deleteProject, getProject, getProjectTests, updateProject } from '../api'
import FieldHint from '../components/FieldHint'
import FormGuide from '../components/FormGuide'
import TestList from '../components/TestList'
import { getErrorMessage, getFieldErrors } from '../utils/apiErrors'

const projectGuideItems = [
  {
    label: 'Название проекта',
    text: 'Задай короткое и понятное имя системы или сервиса, для которого создаются API-тесты.',
  },
  {
    label: 'Описание проекта',
    text: 'Кратко опиши назначение системы, тестируемые API и общую цель проекта.',
  },
]

function getInputClassName(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? 'input-error' : ''
}

function renderFieldError(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? <small className="field-error">{fieldErrors[fieldName]}</small> : null
}

export default function ProjectPage({
  mode = 'edit',
  projectId,
  onProjectCreated,
  onProjectUpdated,
  onProjectDeleted,
  onOpenTest,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [project, setProject] = useState(null)
  const [tests, setTests] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [draft, setDraft] = useState({ name: '', description: '' })

  async function loadProject() {
    if (!projectId) return
    const data = await getProject(projectId)
    setProject(data)
    setDraft({ name: data.name || '', description: data.description || '' })
  }

  async function handleDeleteProject() {
    const confirmed = window.confirm(
      'Удалить проект? Все тесты, запуски и связанные данные будут удалены.',
    )
    if (!confirmed) return

    try {
      await deleteProject(projectId)
      await onProjectDeleted?.()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось удалить проект.'))
    }
  }

  async function loadTests() {
    if (!projectId) return
    const list = await getProjectTests(projectId)
    setTests(list)
  }

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      if (mode !== 'edit' || !projectId) return

      setError('')
      try {
        const [projectData, testsData] = await Promise.all([getProject(projectId), getProjectTests(projectId)])
        if (cancelled) return
        setProject(projectData)
        setDraft({ name: projectData.name || '', description: projectData.description || '' })
        setTests(testsData)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Не удалось загрузить проект и тесты.'))
          setTests([])
        }
      }
    }

    loadPage()
    return () => {
      cancelled = true
    }
  }, [mode, projectId])

  function patch(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  async function handleSaveProject() {
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      if (mode === 'create') {
        const created = await createProject(draft)
        onProjectCreated?.(created.id)
      } else {
        await updateProject(projectId, draft)
        await loadProject()
        onProjectUpdated?.()
      }
    } catch (err) {
      setError(getErrorMessage(err))
      setFieldErrors(getFieldErrors(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>{mode === 'create' ? 'Новый проект' : project?.name || 'Проект'}</h1>
          <p className="muted">
            {mode === 'create'
              ? 'Создайте пространство для API-тестов и общей конфигурации.'
              : project?.description || 'Описание отсутствует.'}
          </p>
        </div>

        <div className="header-actions">
          <button type="button" className="button-secondary" onClick={onBack}>
            Назад к проектам
          </button>
          <button onClick={handleSaveProject} disabled={saving}>
            {saving ? 'Сохранение...' : mode === 'create' ? 'Создать проект' : 'Сохранить проект'}
          </button>
          {mode === 'edit' ? (
            <button className="button-danger" type="button" onClick={handleDeleteProject}>
              Удалить проект
            </button>
          ) : null}
        </div>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Общее
        </button>
        {mode === 'edit' ? (
          <button
            type="button"
            className={activeTab === 'tests' ? 'active' : ''}
            onClick={() => setActiveTab('tests')}
          >
            Тесты
          </button>
        ) : null}
      </div>

      {error ? <div className="error">{error}</div> : null}

      {activeTab === 'overview' && (
        <section className="card form-card">
          <FormGuide title="Справка по форме проекта" items={projectGuideItems} />
          <div className="form-grid">
            <label>
              Название проекта
              <input
                className={getInputClassName(fieldErrors, 'name')}
                value={draft.name}
                onChange={(e) => patch('name', e.target.value)}
                placeholder="Например, Сервис заказов"
              />
              <FieldHint>Используй имя системы или домена API, который тестируешь.</FieldHint>
              {renderFieldError(fieldErrors, 'name')}
            </label>
            <label>
              Описание проекта
              <textarea
                className={getInputClassName(fieldErrors, 'description')}
                value={draft.description}
                onChange={(e) => patch('description', e.target.value)}
                placeholder="Кратко опишите систему и цель проекта"
                rows={6}
              />
              <FieldHint>Например: сервис заказов, основной набор методов, тестовые цели и ограничения.</FieldHint>
              {renderFieldError(fieldErrors, 'description')}
            </label>
          </div>
        </section>
      )}

      {activeTab === 'tests' && mode === 'edit' && projectId ? (
        <section className="card">
          <TestList
            projectId={projectId}
            tests={tests}
            onOpenTest={onOpenTest}
            onReload={loadTests}
          />
        </section>
      ) : null}
    </section>
  )
}
