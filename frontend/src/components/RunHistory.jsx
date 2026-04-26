function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function getRunStatusLabel(status) {
  const labels = {
    queued: 'В очереди',
    running: 'Выполняется',
    success: 'Успешно',
    completed_with_errors: 'Завершён с ошибками',
    failed: 'Ошибка',
  }
  return labels[status] || 'Неизвестно'
}

function getRunStatusClassName(status) {
  const variants = {
    queued: 'status-chip warning',
    running: 'status-chip warning',
    success: 'status-chip success',
    completed_with_errors: 'status-chip warning',
    failed: 'status-chip danger',
  }
  return variants[status] || 'status-chip'
}

function getThresholdStatus(run) {
  if (run?.threshold_passed === true) {
    return { label: 'Проверки пройдены', className: 'threshold-badge threshold-badge--success' }
  }
  if (run?.threshold_passed === false) {
    return { label: 'Проверки не пройдены', className: 'threshold-badge threshold-badge--failed' }
  }
  return null
}

export default function RunHistory({ runs, isRefreshing = false }) {
  const hasActiveRuns = runs.some((run) => ['queued', 'running'].includes(run.status))

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>История запусков</h2>
          <p className="muted">Все выполненные запуски для выбранного теста.</p>
        </div>
        {hasActiveRuns ? (
          <div className="live-status-note">
            <span className="live-status-note__dot" />
            <span>{isRefreshing ? 'Статусы обновляются' : 'Идёт обновление статусов'}</span>
          </div>
        ) : null}
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">
          <h3>Запусков пока нет</h3>
          <p className="muted">Нажмите Запустить тест, чтобы создать первый запуск.</p>
        </div>
      ) : (
        <div className="list">
          {runs.map((run) => {
            const thresholdStatus = getThresholdStatus(run)

            return (
              <article key={run.id} className="project-card">
                <div className="project-card__content">
                  <div className="project-nav-head">
                    <h3>{`Запуск № ${run.display_number ?? run.id}`}</h3>
                    <div className="run-card-badges">
                      {thresholdStatus ? <span className={thresholdStatus.className}>{thresholdStatus.label}</span> : null}
                      <span className={getRunStatusClassName(run.status)}>{getRunStatusLabel(run.status)}</span>
                    </div>
                  </div>
                  <p>{run.summary || 'Краткая сводка отсутствует'}</p>
                  <div className="project-nav-meta">
                    <span>{`Старт: ${formatDate(run.started_at)}`}</span>
                    <span>{`Финиш: ${formatDate(run.finished_at)}`}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
