import { useMemo, useState } from 'react'

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
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
    unknown: 'Неизвестно',
  }
  return labels[status] || status || 'Неизвестно'
}

function RunLogCard({ run, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  const title = useMemo(() => {
    const runNumber = run?.display_number ?? run?.id ?? '—'
    return `Запуск № ${runNumber}`
  }, [run])

  return (
    <article className="run-log-card">
      <button
        type="button"
        className="run-log-card__header"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="run-log-card__title-wrap">
          <div className="run-log-card__title">{title}</div>
          <div className="run-log-card__meta">
            <span className={`run-log-card__status run-log-card__status--${run?.status || 'unknown'}`}>
              {getRunStatusLabel(run?.status)}
            </span>
            <span>Старт: {formatDate(run?.started_at)}</span>
            <span>Финиш: {formatDate(run?.finished_at)}</span>
          </div>
        </div>

        <div className="run-log-card__toggle">
          {open ? 'Скрыть' : 'Показать'}
        </div>
      </button>

      <div className="run-log-card__summary">
        {run?.summary || 'Нет краткой сводки'}
      </div>

      {open ? (
        <div className="run-log-card__body">
          <pre className="run-log-card__logs">
            {run?.logs?.trim() || 'Логи отсутствуют'}
          </pre>
        </div>
      ) : null}
    </article>
  )
}

export default function LogsPanel({ runs }) {
  if (!runs?.length) {
    return (
      <section className="card">
        <h2>Логи запусков</h2>
        <p className="muted">Пока нет выполненных запусков.</p>
      </section>
    )
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Логи запусков</h2>
          <p className="muted">
            Логи сгруппированы по отдельным запускам. Нажмите на карточку, чтобы развернуть подробности.
          </p>
        </div>
      </div>

      <div className="run-log-list">
        {runs.map((run, index) => (
          <RunLogCard
            key={run.id}
            run={run}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </section>
  )
}
