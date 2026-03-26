import { createTest, deleteTest } from '../api'

const defaultTestPayload = {
  name: 'Новый тест',
  description: '',
  goal: '',
  target_entity: '',
  project_type: 'api',
  test_type: 'load',
  environment: 'test',
  target_url: '',
  target_port: '',
  success_criteria: '',
  virtual_users: 50,
  duration: '5m',
  ramp_up: '30s',
  ramp_down: '15s',
  timeout: '30s',
  repeat_count: 1,
  monitoring_enabled: true,
  prometheus_url: '',
  grafana_url: '',
  max_avg_response_ms: 500,
  max_p95_ms: 1000,
  max_error_rate: 2,
  min_throughput: 100,
  scenario_type: 'http',
  script_content: '',
  status: 'draft',
}

export default function TestList({ projectId, tests, onOpenTest, onReload }) {
  async function handleCreate() {
    await createTest(projectId, defaultTestPayload)
    await onReload()
  }

  async function handleDelete(testId) {
    await deleteTest(testId)
    await onReload()
  }

  return (
    <section className="workspace-page">
      <div className="section-head">
        <div>
          <h2>Тесты проекта</h2>
          <p className="muted">Создавай отдельные тесты под разные сценарии и нагрузки.</p>
        </div>
        <button onClick={handleCreate}>Создать тест</button>
      </div>

      {tests.length === 0 ? (
        <div className="empty-state">
          <h3>Тестов пока нет</h3>
          <p className="muted">Создай первый тест для этого проекта.</p>
          <button onClick={handleCreate}>Добавить тест</button>
        </div>
      ) : (
        <div className="list">
          {tests.map((test) => (
            <article key={test.id} className="project-card">
              <div className="project-card__content">
                <div className="project-nav-head">
                  <h3>{test.name}</h3>
                  <span className="project-type-badge">{test.test_type}</span>
                </div>
                <p>{test.goal || 'Цель теста пока не указана.'}</p>
                <div className="project-nav-meta">
                  <span>Статус: {test.status}</span>
                  <span>Среда: {test.environment}</span>
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
