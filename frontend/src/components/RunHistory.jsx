export default function RunHistory({ runs }) {
  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>История запусков</h2>
          <p className="muted">Все выполненные запуски для выбранного теста.</p>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">
          <h3>Запусков пока нет</h3>
          <p className="muted">Нажми «Запустить тест», чтобы создать первый запуск.</p>
        </div>
      ) : (
        <div className="list">
          {runs.map((run) => (
            <article key={run.id} className="project-card">
              <div className="project-card__content">
                <div className="project-nav-head">
                  <h3>Запуск #{run.id}</h3>
                  <span className="project-type-badge">{run.status}</span>
                </div>
                <p>{run.summary || 'Без summary'}</p>
                <div className="project-nav-meta">
                  <span>Старт: {run.started_at || '—'}</span>
                  <span>Финиш: {run.finished_at || '—'}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
