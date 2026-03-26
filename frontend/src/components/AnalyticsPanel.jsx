function MetricCard({ label, value, suffix = '' }) {
  return (
    <article className="card stat-card">
      <div className="muted">{label}</div>
      <div className="stat-value">{value ?? '—'}{value != null ? suffix : ''}</div>
    </article>
  )
}

export default function AnalyticsPanel({ latestRun }) {
  return (
    <section className="workspace-page">
      {!latestRun ? (
        <div className="empty-state card">
          <h3>Нет данных для аналитики</h3>
          <p className="muted">Сначала выполни тест, чтобы увидеть метрики последнего запуска.</p>
        </div>
      ) : (
        <div className="stats-grid">
          <MetricCard label="Среднее время ответа" value={latestRun.avg_response_ms} suffix=" ms" />
          <MetricCard label="P95" value={latestRun.p95_response_ms} suffix=" ms" />
          <MetricCard label="Ошибка" value={latestRun.error_rate} suffix=" %" />
          <MetricCard label="Throughput" value={latestRun.throughput} suffix=" rps" />
        </div>
      )}
    </section>
  )
}
