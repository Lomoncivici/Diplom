import { useEffect, useState } from 'react'
import { deleteProject } from '../api'
import { useNavigate } from 'react-router-dom'
import { createProject, getProject, getProjectTests, updateProject } from '../api'
import TestList from '../components/TestList'

export default function ProjectPage({
  mode = 'edit',
  projectId,
  onProjectCreated,
  onProjectUpdated,
  onProjectDeleted,
  onOpenTest,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [project, setProject] = useState(null)
  const [tests, setTests] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ name: '', description: '' })

  async function loadProject() {
    if (!projectId) return
    const data = await getProject(projectId)
    setProject(data)
    setDraft({ name: data.name || '', description: data.description || '' })
  }

  async function handleDeleteProject() {
    const confirmed = window.confirm(
      'Удалить проект? Все тесты, запуски и связанные данные будут удалены.'
    )
    if (!confirmed) return

    try {
      await deleteProject(projectId)
      await onProjectDeleted?.()
    } catch (err) {
      setError(err.message || 'Не удалось удалить проект')
    }
  }

  async function loadTests() {
    if (!projectId) return
    setTests(await getProjectTests(projectId))
  }

  useEffect(() => {
    if (mode === 'edit' && projectId) {
      loadProject()
      loadTests()
    }
  }, [mode, projectId])

  async function handleSaveProject() {
    setSaving(true)
    setError('')
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
      setError(err.message)
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
              ? 'Создай контейнер для тестов и общей конфигурации.'
              : project?.description || 'Описание отсутствует'}
          </p>
        </div>

        <div className="header-actions">
          <button onClick={handleSaveProject} disabled={saving}>
            {saving ? 'Сохранение...' : mode === 'create' ? 'Создать проект' : 'Сохранить проект'}
          </button>
          <button className="button-danger" type="button" onClick={handleDeleteProject}>
            Удалить проект
          </button>
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
          <div className="form-grid">
            <label>
              Название проекта
              <input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Например, Order Service"
              />
            </label>
            <label>
              Описание проекта
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Кратко опиши систему и цель проекта"
                rows={6}
              />
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
