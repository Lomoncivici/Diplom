import { useState } from 'react'
import { createTest, deleteTest } from '../api'
import { buildPayloadFromTemplate, testTemplates } from '../data/testTemplates'
import { getErrorMessage } from '../utils/apiErrors'

function getTestTypeLabel(value) {
  const labels = {
    load: 'Нагрузочный',
    smoke: 'Дымовой',
    stress: 'Стрессовый',
  }
  return labels[value] || 'Тест'
}

function getEnvironmentLabel(value) {
  const labels = {
    local: 'Локальная среда',
    test: 'Тестовая среда',
    stage: 'Предпродовая среда',
    prod: 'Рабочая среда',
  }
  return labels[value] || 'Не указано'
}

function getStatusLabel(value) {
  const labels = {
    draft: 'Черновик',
    queued: 'В очереди',
    running: 'Выполняется',
    success: 'Успешно',
    completed_with_errors: 'Завершён с ошибками',
    failed: 'Ошибка',
  }
  return labels[value] || 'Неизвестно'
}

export default function TestList({ projectId, tests, onOpenTest, onReload }) {
  const [error, setError] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(testTemplates[0]?.id || 'basic_get')

  async function handleCreate() {
    setError('')
    try {
      await createTest(projectId, buildPayloadFromTemplate(selectedTemplateId))
      await onReload()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось создать тест.'))
    }
  }

  async function handleDelete(testId) {
    setError('')
    try {
      await deleteTest(testId)
      await onReload()
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось удалить тест.'))
    }
  }

  return (
    <section className="workspace-page">
      <div className="section-head">
        <div>
          <h2>Тесты проекта</h2>
          <p className="muted">Создавайте отдельные тесты под разные сценарии и нагрузки.</p>
        </div>
        <div className="template-create-panel">
          <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
            {testTemplates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <button onClick={handleCreate}>Создать из шаблона</button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {tests.length === 0 ? (
        <div className="empty-state">
          <h3>Тестов пока нет</h3>
          <p className="muted">Выберите шаблон и создайте первый тест для этого проекта.</p>
          <button onClick={handleCreate}>Добавить тест</button>
        </div>
      ) : (
        <div className="list">
          {tests.map((test) => (
            <article key={test.id} className="project-card">
              <div className="project-card__content">
                <div className="project-nav-head">
                  <h3>{test.name}</h3>
                  <span className="project-type-badge">{getTestTypeLabel(test.test_type)}</span>
                </div>
                <p>{test.goal || 'Цель теста пока не указана.'}</p>
                <div className="project-nav-meta">
                  <span>Статус: {getStatusLabel(test.status)}</span>
                  <span>Среда: {getEnvironmentLabel(test.environment)}</span>
                </div>
              </div>

              <div className="project-card__actions">
                <button className="button-secondary" onClick={() => handleDelete(test.id)}>
                  Удалить
                </button>
                <button onClick={() => onOpenTest(test.id)}>Открыть</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
