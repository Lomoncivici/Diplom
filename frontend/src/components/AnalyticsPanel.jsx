import { useEffect, useMemo, useState } from 'react'

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function formatMetricValue(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  return `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}${suffix}`
}

function formatDelta(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }

  const number = Number(value)
  const sign = number > 0 ? '+' : ''
  return `${sign}${number.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}${suffix}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function MetricCard({ label, value, suffix = '' }) {
  return (
    <article className="card stat-card">
      <div className="muted">{label}</div>
      <div className="stat-value">
        {value ?? '—'}
        {value != null ? suffix : ''}
      </div>
    </article>
  )
}

function buildPolylinePoints(data, key, width, height, padding) {
  if (!data?.length) return ''

  const maxValue = Math.max(...data.map((item) => Number(item[key] || 0)), 1)
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  return data
    .map((item, index) => {
      const x =
        data.length === 1
          ? padding.left + innerWidth / 2
          : padding.left + (index / (data.length - 1)) * innerWidth

      const y =
        padding.top + innerHeight - ((Number(item[key] || 0) / maxValue) * innerHeight)

      return `${x},${y}`
    })
    .join(' ')
}

function ActivityChart({ activityTimeline }) {
  if (!activityTimeline?.length) {
    return (
      <article className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>График активности запросов</h3>
        <p className="muted" style={{ marginBottom: 0 }}>
          Для последнего запуска пока нет данных активности.
        </p>
      </article>
    )
  }

  const width = 860
  const height = 320
  const padding = { top: 20, right: 20, bottom: 40, left: 40 }

  const usersLine = buildPolylinePoints(activityTimeline, 'active_users', width, height, padding)
  const requestsLine = buildPolylinePoints(activityTimeline, 'requests_sent', width, height, padding)

  const maxUsers = Math.max(...activityTimeline.map((item) => Number(item.active_users || 0)), 1)
  const maxRequests = Math.max(...activityTimeline.map((item) => Number(item.requests_sent || 0)), 1)

  const xLabels = activityTimeline.filter((_, index) => {
    if (activityTimeline.length <= 8) return true
    return index === 0 || index === activityTimeline.length - 1 || index % Math.ceil(activityTimeline.length / 6) === 0
  })

  return (
    <article className="card" style={{ padding: 20 }}>
      <div className="chart-head">
        <div>
          <h3 style={{ margin: 0 }}>График активности запросов</h3>
          <p className="muted" style={{ margin: '8px 0 0 0' }}>
            Последний запуск: активные виртуальные пользователи и количество отправленных запросов по времени.
          </p>
        </div>

        <div className="chart-head__meta">
          <div className="muted">Активных пользователей максимум: {maxUsers}</div>
          <div className="muted">Запросов за интервал максимум: {maxRequests}</div>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', minWidth: 640, display: 'block' }}
          role="img"
          aria-label="График активности запросов"
        >
          <line x1="40" y1="20" x2="40" y2="280" stroke="currentColor" opacity="0.18" />
          <line x1="40" y1="280" x2="840" y2="280" stroke="currentColor" opacity="0.18" />

          {[0.25, 0.5, 0.75].map((step) => {
            const y = padding.top + (height - padding.top - padding.bottom) * step
            return (
              <line
                key={step}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                opacity="0.08"
              />
            )
          })}

          <polyline fill="none" stroke="currentColor" strokeWidth="3" opacity="0.95" points={usersLine} />
          <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="8 6" opacity="0.55" points={requestsLine} />

          {activityTimeline.map((point, index) => {
            const innerWidth = width - padding.left - padding.right
            const x =
              activityTimeline.length === 1
                ? padding.left + innerWidth / 2
                : padding.left + (index / (activityTimeline.length - 1)) * innerWidth

            const usersY =
              padding.top +
              (height - padding.top - padding.bottom) -
              ((Number(point.active_users || 0) / maxUsers) * (height - padding.top - padding.bottom))

            const requestsY =
              padding.top +
              (height - padding.top - padding.bottom) -
              ((Number(point.requests_sent || 0) / maxRequests) * (height - padding.top - padding.bottom))

            return (
              <g key={`${point.label}-${index}`}>
                <circle cx={x} cy={usersY} r="3" fill="currentColor" opacity="0.95" />
                <circle cx={x} cy={requestsY} r="3" fill="currentColor" opacity="0.55" />
              </g>
            )
          })}

          {xLabels.map((point) => {
            const index = activityTimeline.findIndex((item) => item.label === point.label)
            const innerWidth = width - padding.left - padding.right
            const x =
              activityTimeline.length === 1
                ? padding.left + innerWidth / 2
                : padding.left + (index / (activityTimeline.length - 1)) * innerWidth

            return (
              <text
                key={point.label}
                x={x}
                y={height - 12}
                textAnchor="middle"
                fontSize="12"
                fill="currentColor"
                opacity="0.7"
              >
                {point.label}
              </text>
            )
          })}
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chart-legend-line chart-legend-line--primary" />
          <span className="muted">Активные виртуальные пользователи</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chart-legend-line chart-legend-line--secondary" />
          <span className="muted">Отправленные запросы за интервал</span>
        </div>
      </div>
    </article>
  )
}

function CompareMetricRow({ label, leftValue, rightValue, suffix = '' }) {
  const leftNumber = leftValue == null ? null : Number(leftValue)
  const rightNumber = rightValue == null ? null : Number(rightValue)
  const delta = leftNumber == null || rightNumber == null ? null : leftNumber - rightNumber

  return (
    <div className="compare-row">
      <div className="compare-row__label">{label}</div>
      <div className="compare-row__value">{formatMetricValue(leftValue, suffix)}</div>
      <div className="compare-row__value">{formatMetricValue(rightValue, suffix)}</div>
      <div className={`compare-row__delta ${delta > 0 ? 'compare-row__delta--bad' : delta < 0 ? 'compare-row__delta--good' : ''}`}>
        {formatDelta(delta, suffix)}
      </div>
    </div>
  )
}

function ThresholdPanel({ test, latestRun }) {
  const configuredThresholds = [
    { label: 'Среднее время ответа', target: test?.max_avg_response_ms, operator: 'не более', unit: 'мс' },
    { label: '95-й процентиль', target: test?.max_p95_ms, operator: 'не более', unit: 'мс' },
    { label: 'Доля ошибок', target: test?.max_error_rate, operator: 'не более', unit: '%' },
    { label: 'Пропускная способность', target: test?.min_throughput, operator: 'не менее', unit: 'запр./с' },
  ].filter((item) => item.target !== null && item.target !== undefined && item.target !== '')

  return (
    <article className="card">
      <div className="section-head">
        <div>
          <h3 style={{ margin: 0 }}>Пороговые проверки</h3>
          <p className="muted" style={{ margin: '8px 0 0 0' }}>
            Оценка результата последнего запуска по заданным порогам.
          </p>
        </div>
        {latestRun?.threshold_passed === true ? (
          <span className="threshold-badge threshold-badge--success">Проверки пройдены</span>
        ) : latestRun?.threshold_passed === false ? (
          <span className="threshold-badge threshold-badge--failed">Проверки не пройдены</span>
        ) : (
          <span className="threshold-badge">Проверки не настроены</span>
        )}
      </div>

      {configuredThresholds.length === 0 ? (
        <div className="empty-state">
          <h3>Пороговые проверки пока не заданы</h3>
          <p className="muted">Откройте вкладку конфигурации теста и задайте нужные значения.</p>
        </div>
      ) : (
        <div className="threshold-grid">
          {(latestRun?.threshold_results?.length ? latestRun.threshold_results : configuredThresholds).map((item) => {
            const isRunResult = Object.prototype.hasOwnProperty.call(item, 'passed')
            const passed = isRunResult ? item.passed : null
            const actual = isRunResult ? formatMetricValue(item.actual, item.unit ? ` ${item.unit}` : '') : '—'
            const target = formatMetricValue(item.target, item.unit ? ` ${item.unit}` : '')

            return (
              <div key={item.label} className={`threshold-item ${passed === true ? 'threshold-item--success' : passed === false ? 'threshold-item--failed' : ''}`}>
                <div className="threshold-item__title">{item.label}</div>
                <div className="muted">Порог: {item.operator} {target}</div>
                <div className="threshold-item__actual">Фактически: {actual}</div>
                <div className="threshold-item__status">
                  {passed === true ? 'Пройдено' : passed === false ? 'Не пройдено' : 'Будет проверено после запуска'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function buildHtmlReport({ test, latestRun, compareRun, activityTimeline }) {
  const timelineRows = (activityTimeline || [])
    .map((point) => `<tr><td>${escapeHtml(point.label)}</td><td>${escapeHtml(point.active_users)}</td><td>${escapeHtml(point.requests_sent)}</td></tr>`)
    .join('')

  const thresholdRows = (latestRun?.threshold_results || [])
    .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.operator)}</td><td>${escapeHtml(formatMetricValue(item.target, item.unit ? ` ${item.unit}` : ''))}</td><td>${escapeHtml(formatMetricValue(item.actual, item.unit ? ` ${item.unit}` : ''))}</td><td>${item.passed ? 'Пройдено' : 'Не пройдено'}</td></tr>`)
    .join('')

  const compareBlock = compareRun
    ? `
      <h2>Сравнение запусков</h2>
      <table>
        <thead>
          <tr>
            <th>Метрика</th>
            <th>Запуск № ${latestRun.display_number ?? latestRun.id}</th>
            <th>Запуск № ${compareRun.display_number ?? compareRun.id}</th>
            <th>Разница</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Среднее время ответа</td><td>${formatMetricValue(latestRun.avg_response_ms, ' мс')}</td><td>${formatMetricValue(compareRun.avg_response_ms, ' мс')}</td><td>${formatDelta((latestRun.avg_response_ms ?? 0) - (compareRun.avg_response_ms ?? 0), ' мс')}</td></tr>
          <tr><td>95-й процентиль</td><td>${formatMetricValue(latestRun.p95_response_ms, ' мс')}</td><td>${formatMetricValue(compareRun.p95_response_ms, ' мс')}</td><td>${formatDelta((latestRun.p95_response_ms ?? 0) - (compareRun.p95_response_ms ?? 0), ' мс')}</td></tr>
          <tr><td>Доля ошибок</td><td>${formatMetricValue(latestRun.error_rate, ' %')}</td><td>${formatMetricValue(compareRun.error_rate, ' %')}</td><td>${formatDelta((latestRun.error_rate ?? 0) - (compareRun.error_rate ?? 0), ' %')}</td></tr>
          <tr><td>Пропускная способность</td><td>${formatMetricValue(latestRun.throughput, ' запр./с')}</td><td>${formatMetricValue(compareRun.throughput, ' запр./с')}</td><td>${formatDelta((latestRun.throughput ?? 0) - (compareRun.throughput ?? 0), ' запр./с')}</td></tr>
          <tr><td>Всего запросов</td><td>${formatMetricValue(latestRun.requests_total)}</td><td>${formatMetricValue(compareRun.requests_total)}</td><td>${formatDelta((latestRun.requests_total ?? 0) - (compareRun.requests_total ?? 0))}</td></tr>
        </tbody>
      </table>
    `
    : ''

  const thresholdBlock = latestRun?.threshold_results?.length
    ? `
      <h2>Пороговые проверки</h2>
      <table>
        <thead>
          <tr>
            <th>Метрика</th>
            <th>Условие</th>
            <th>Порог</th>
            <th>Фактически</th>
            <th>Результат</th>
          </tr>
        </thead>
        <tbody>
          ${thresholdRows}
        </tbody>
      </table>
    `
    : ''

  return `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Отчёт по запуску теста</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
    h1, h2 { margin-bottom: 12px; }
    .muted { color: #6b7280; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
    th { background: #f3f4f6; }
    pre { white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
  </style>
</head>
<body>
  <h1>Отчёт по запуску теста</h1>
  <p class="muted">Сформирован: ${new Date().toLocaleString('ru-RU')}</p>
  <div class="card">
    <strong>Тест:</strong> ${escapeHtml(test?.name || 'Без названия')}<br />
    <strong>Описание:</strong> ${escapeHtml(test?.description || '—')}<br />
    <strong>Адрес сервиса:</strong> ${escapeHtml(test?.target_url || '—')}<br />
    <strong>Метод запроса:</strong> ${escapeHtml(test?.request_method || '—')}<br />
    <strong>Последний запуск:</strong> № ${latestRun.display_number ?? latestRun.id} от ${formatDate(latestRun.finished_at || latestRun.started_at)}
  </div>

  <div class="grid">
    <div class="card"><strong>Среднее время ответа</strong><br />${formatMetricValue(latestRun.avg_response_ms, ' мс')}</div>
    <div class="card"><strong>95-й процентиль</strong><br />${formatMetricValue(latestRun.p95_response_ms, ' мс')}</div>
    <div class="card"><strong>Доля ошибок</strong><br />${formatMetricValue(latestRun.error_rate, ' %')}</div>
    <div class="card"><strong>Пропускная способность</strong><br />${formatMetricValue(latestRun.throughput, ' запр./с')}</div>
  </div>

  ${thresholdBlock}
  ${compareBlock}

  <h2>Активность последнего запуска</h2>
  <table>
    <thead>
      <tr>
        <th>Интервал</th>
        <th>Активные пользователи</th>
        <th>Отправленные запросы</th>
      </tr>
    </thead>
    <tbody>
      ${timelineRows || '<tr><td colspan="3">Данные отсутствуют</td></tr>'}
    </tbody>
  </table>

  <h2>Сводка</h2>
  <pre>${escapeHtml(latestRun.summary || 'Сводка отсутствует')}</pre>

  <h2>Логи последнего запуска</h2>
  <pre>${escapeHtml(latestRun.logs || 'Логи отсутствуют')}</pre>
</body>
</html>`
}

function downloadReportFile(html, fileName) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function CompareRunsPanel({ runs, test, latestRun, activityTimeline }) {
  const completedRuns = useMemo(
    () => (runs || []).filter((run) => !['queued', 'running'].includes(run.status)),
    [runs],
  )

  const [leftRunId, setLeftRunId] = useState('')
  const [rightRunId, setRightRunId] = useState('')

  useEffect(() => {
    if (!completedRuns.length) {
      setLeftRunId('')
      setRightRunId('')
      return
    }

    const first = completedRuns[0]
    const second = completedRuns[1] || completedRuns[0]

    setLeftRunId((prev) => (prev && completedRuns.some((run) => String(run.id) === prev) ? prev : String(first.id)))
    setRightRunId((prev) => {
      if (prev && completedRuns.some((run) => String(run.id) === prev) && prev !== String(first.id)) {
        return prev
      }
      return String(second.id)
    })
  }, [completedRuns])

  const leftRun = completedRuns.find((run) => String(run.id) === leftRunId) || completedRuns[0] || null
  const rightRun = completedRuns.find((run) => String(run.id) === rightRunId) || completedRuns[1] || completedRuns[0] || null

  function handleExport() {
    if (!latestRun) return
    const html = buildHtmlReport({ test, latestRun, compareRun: rightRun && latestRun?.id !== rightRun?.id ? rightRun : null, activityTimeline })
    downloadReportFile(html, `Отчёт_по_тесту_${test?.id || 'без_номера'}_запуск_${latestRun.display_number ?? latestRun.id}.html`)
  }

  if (!latestRun) {
    return null
  }

  return (
    <section className="workspace-page">
      <div className="card report-actions-card">
        <div>
          <h3 style={{ margin: 0 }}>Экспорт отчёта</h3>
          <p className="muted" style={{ margin: '8px 0 0 0' }}>
            Выгрузка текущей аналитики и выбранного сравнения в отдельный файл отчёта.
          </p>
        </div>
        <button type="button" onClick={handleExport}>Скачать отчёт</button>
      </div>

      <article className="card">
        <div className="section-head">
          <div>
            <h3 style={{ margin: 0 }}>Сравнение запусков</h3>
            <p className="muted" style={{ margin: '8px 0 0 0' }}>
              Сравнение двух запусков по основным метрикам. Разница считается как левый запуск минус правый запуск.
            </p>
          </div>
        </div>

        {completedRuns.length < 2 ? (
          <div className="empty-state">
            <h3>Недостаточно запусков для сравнения</h3>
            <p className="muted">Выполните минимум два завершённых запуска, чтобы сравнить результаты.</p>
          </div>
        ) : (
          <>
            <div className="compare-toolbar">
              <label>
                Первый запуск
                <select value={leftRunId} onChange={(event) => setLeftRunId(event.target.value)}>
                  {completedRuns.map((run) => (
                    <option key={run.id} value={String(run.id)}>
                      {`Запуск № ${run.display_number ?? run.id} · ${formatDate(run.finished_at || run.started_at)}`}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Второй запуск
                <select value={rightRunId} onChange={(event) => setRightRunId(event.target.value)}>
                  {completedRuns.map((run) => (
                    <option key={run.id} value={String(run.id)}>
                      {`Запуск № ${run.display_number ?? run.id} · ${formatDate(run.finished_at || run.started_at)}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {leftRun && rightRun ? (
              <div className="compare-table">
                <div className="compare-row compare-row--head">
                  <div>Метрика</div>
                  <div>{`Запуск № ${leftRun.display_number ?? leftRun.id}`}</div>
                  <div>{`Запуск № ${rightRun.display_number ?? rightRun.id}`}</div>
                  <div>Разница</div>
                </div>
                <CompareMetricRow label="Среднее время ответа" leftValue={leftRun.avg_response_ms} rightValue={rightRun.avg_response_ms} suffix=" мс" />
                <CompareMetricRow label="95-й процентиль" leftValue={leftRun.p95_response_ms} rightValue={rightRun.p95_response_ms} suffix=" мс" />
                <CompareMetricRow label="Доля ошибок" leftValue={leftRun.error_rate} rightValue={rightRun.error_rate} suffix=" %" />
                <CompareMetricRow label="Пропускная способность" leftValue={leftRun.throughput} rightValue={rightRun.throughput} suffix=" запр./с" />
                <CompareMetricRow label="Всего запросов" leftValue={leftRun.requests_total} rightValue={rightRun.requests_total} />
                <CompareMetricRow label="Успешных запросов" leftValue={leftRun.requests_success} rightValue={rightRun.requests_success} />
                <CompareMetricRow label="Ошибочных запросов" leftValue={leftRun.requests_failed} rightValue={rightRun.requests_failed} />
              </div>
            ) : null}
          </>
        )}
      </article>
    </section>
  )
}

export default function AnalyticsPanel({ test, runs, latestRun, activityTimeline }) {
  return (
    <section className="workspace-page">
      {!latestRun ? (
        <div className="empty-state card">
          <h3>Нет данных для аналитики</h3>
          <p className="muted">Сначала выполните тест, чтобы увидеть метрики последнего запуска.</p>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <MetricCard label="Среднее время ответа" value={latestRun.avg_response_ms} suffix=" мс" />
            <MetricCard label="95-й процентиль" value={latestRun.p95_response_ms} suffix=" мс" />
            <MetricCard label="Доля ошибок" value={latestRun.error_rate} suffix=" %" />
            <MetricCard label="Пропускная способность" value={latestRun.throughput} suffix=" запр./с" />
          </div>

          <ThresholdPanel test={test} latestRun={latestRun} />

          <div style={{ marginTop: 20 }}>
            <ActivityChart activityTimeline={activityTimeline} />
          </div>

          <CompareRunsPanel
            test={test}
            runs={runs}
            latestRun={latestRun}
            activityTimeline={activityTimeline}
          />
        </>
      )}
    </section>
  )
}
