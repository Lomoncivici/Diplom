import { useMemo, useState } from 'react'
import AnalyticsPanel from './AnalyticsPanel'
import FieldHint from './FieldHint'
import FormGuide from './FormGuide'
import LogsPanel from './LogsPanel'
import RunHistory from './RunHistory'
import { buildPayloadFromTemplate, testTemplates } from '../data/testTemplates'

const tabs = [
  { id: 'overview', label: 'Общее' },
  { id: 'config', label: 'Конфигурация' },
  { id: 'scenario', label: 'Сценарий' },
  { id: 'runs', label: 'Запуски' },
  { id: 'analytics', label: 'Аналитика' },
  { id: 'logs', label: 'Логи' },
]

function getInputClassName(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? 'input-error' : ''
}

function renderFieldError(fieldErrors, fieldName) {
  return fieldErrors[fieldName] ? <small className="field-error">{fieldErrors[fieldName]}</small> : null
}

function getRequestMethodLabel(method) {
  const labels = {
    GET: 'Получение',
    POST: 'Отправка',
    PUT: 'Полная замена',
    PATCH: 'Частичное изменение',
    DELETE: 'Удаление',
  }
  return labels[method] || method
}

function getTemplateDescription(templateId) {
  return testTemplates.find((template) => template.id === templateId)?.description || ''
}

function buildGuide(activeTab, runtimePolicy) {
  if (activeTab === 'overview') {
    return [
      { label: 'Название теста', text: 'Используй короткое и понятное имя, чтобы тест было легко найти в проекте.' },
      { label: 'Что тестируется', text: 'Укажи конкретный API-метод, ресурс или бизнес-операцию.' },
      { label: 'Цель теста', text: 'Опиши, какой результат считаешь успешным и какие риски хочешь проверить.' },
    ]
  }

  if (activeTab === 'config') {
    return [
      { label: 'Адрес и путь', text: 'Базовый адрес сервиса и путь запроса лучше хранить раздельно: так удобнее менять окружение.' },
      {
        label: 'Нагрузка',
        text: `Сейчас разрешено не более ${runtimePolicy?.max_virtual_users_per_test ?? '—'} виртуальных пользователей и ${runtimePolicy?.max_repeat_count_per_test ?? '—'} повторов на одного пользователя.`,
      },
      {
        label: 'Безопасность запуска',
        text: runtimePolicy?.allow_private_target_hosts
          ? 'Локальные и приватные адреса сейчас разрешены.'
          : 'Локальные и приватные адреса сейчас запрещены политикой запуска.',
      },
      {
        label: 'Пороговые проверки',
        text: 'Задай допустимые границы по метрикам, чтобы сразу видеть, пройден ли тест.',
      },
    ]
  }

  if (activeTab === 'scenario') {
    return [
      { label: 'Сценарий', text: 'Кратко опиши последовательность действий: подготовка, запрос, ожидаемый результат, проверка.' },
    ]
  }

  if (activeTab === 'runs') {
    return [
      { label: 'История запусков', text: 'Здесь видны статусы, итоговые метрики и результат пороговых проверок по каждому запуску.' },
    ]
  }

  if (activeTab === 'analytics') {
    return [
      { label: 'Среднее время ответа', text: 'Общая усреднённая задержка ответа API.' },
      { label: '95-й процентиль', text: 'Показывает, насколько медленными были самые тяжёлые 5 процентов запросов.' },
      { label: 'Пропускная способность', text: 'Сколько запросов система обрабатывала под нагрузкой за единицу времени.' },
    ]
  }

  if (activeTab === 'logs') {
    return [
      { label: 'Журнал выполнения', text: 'Используй логи для поиска сетевых ошибок, неожиданных кодов ответа и нестабильного поведения API.' },
    ]
  }

  return []
}

export default function TestEditor({
  test,
  draft,
  setDraft,
  fieldErrors,
  setFieldErrors,
  runs,
  runtimePolicy,
  onSave,
  onRun,
  saving,
  isRefreshingRuns,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedTemplateId, setSelectedTemplateId] = useState(testTemplates[0]?.id || 'basic_get')
  const latestRun = useMemo(
    () => runs.find((run) => !['queued', 'running'].includes(run.status)) || null,
    [runs],
  )
  const activeRun = useMemo(() => runs.find((run) => ['queued', 'running'].includes(run.status)) || null, [runs])
  const guideItems = useMemo(() => buildGuide(activeTab, runtimePolicy), [activeTab, runtimePolicy])

  function patch(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function handleApplyTemplate() {
    const templatePayload = buildPayloadFromTemplate(selectedTemplateId)
    setDraft((prev) => ({
      ...prev,
      ...templatePayload,
      id: prev.id,
      project_id: prev.project_id,
      created_at: prev.created_at,
      updated_at: prev.updated_at,
      last_run_activity: prev.last_run_activity,
    }))
    setFieldErrors({})
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>{test?.name || 'Тест'}</h1>
          <p className="muted">Отдельный тест внутри проекта: конфигурация, сценарий, запуски и метрики.</p>
          {activeRun ? (
            <div className="live-run-banner">
              <div className="live-run-banner__title">Есть активный запуск</div>
              <div className="muted">
                {activeRun.status === 'queued'
                  ? 'Запуск поставлен в очередь и скоро начнётся.'
                  : 'Тест выполняется, история запусков обновляется автоматически.'}
              </div>
            </div>
          ) : null}
        </div>

        <div className="header-actions">
          <button type="button" className="button-secondary" onClick={onBack}>
            Назад к проекту
          </button>
          <button className="button-secondary" onClick={onRun} disabled={Boolean(activeRun)}>
            {activeRun ? 'Тест выполняется' : 'Запустить тест'}
          </button>
          <button onClick={onSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <FormGuide title="Справка по текущей вкладке" items={guideItems} />

      {activeTab === 'overview' ? (
        <section className="card form-card">
          <div className="template-banner">
            <div>
              <div className="template-banner__title">Шаблоны тестов</div>
              <div className="muted">{getTemplateDescription(selectedTemplateId)}</div>
            </div>
            <div className="template-banner__actions">
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                {testTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              <button type="button" className="button-secondary" onClick={handleApplyTemplate}>
                Применить шаблон
              </button>
            </div>
          </div>

          <div className="form-grid form-grid--double">
            <label>
              Название теста
              <input
                className={getInputClassName(fieldErrors, 'name')}
                value={draft.name || ''}
                onChange={(e) => patch('name', e.target.value)}
              />
              <FieldHint>Например: (Получение списка заказов под нагрузкой).</FieldHint>
              {renderFieldError(fieldErrors, 'name')}
            </label>
            <label>
              Что тестируется
              <input
                className={getInputClassName(fieldErrors, 'target_entity')}
                value={draft.target_entity || ''}
                onChange={(e) => patch('target_entity', e.target.value)}
                placeholder="Например, /api/orders"
              />
              <FieldHint>Укажи ресурс API или бизнес-операцию.</FieldHint>
              {renderFieldError(fieldErrors, 'target_entity')}
            </label>
            <label className="field-span-2">
              Описание
              <textarea
                className={getInputClassName(fieldErrors, 'description')}
                value={draft.description || ''}
                onChange={(e) => patch('description', e.target.value)}
                rows={4}
              />
              <FieldHint>Кратко опиши контекст проверки и что важно отследить.</FieldHint>
              {renderFieldError(fieldErrors, 'description')}
            </label>
            <label className="field-span-2">
              Цель теста
              <textarea
                className={getInputClassName(fieldErrors, 'goal')}
                value={draft.goal || ''}
                onChange={(e) => patch('goal', e.target.value)}
                rows={4}
              />
              <FieldHint>Например: проверить стабильность метода при параллельных запросах без роста доли ошибок.</FieldHint>
              {renderFieldError(fieldErrors, 'goal')}
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'config' ? (
        <section className="card form-card">
          {runtimePolicy ? (
            <div className="card card--soft policy-card">
              <div className="section-head">
                <div>
                  <h3>Текущая политика запуска</h3>
                  <p className="muted">Эти ограничения применяются ко всем API-тестам.</p>
                </div>
              </div>
              <div className="policy-card__grid">
                <div>Локальные адреса: <strong>{runtimePolicy.allow_private_target_hosts ? 'разрешены' : 'запрещены'}</strong></div>
                <div>Запуск новых тестов: <strong>{runtimePolicy.allow_test_run_launches ? 'разрешён' : 'временно отключён'}</strong></div>
                <div>Максимум виртуальных пользователей: <strong>{runtimePolicy.max_virtual_users_per_test}</strong></div>
                <div>Максимум повторов: <strong>{runtimePolicy.max_repeat_count_per_test}</strong></div>
                <div>Максимальный таймаут: <strong>{runtimePolicy.max_timeout_seconds} с</strong></div>
                <div>Максимум строк лога: <strong>{runtimePolicy.max_logs_per_run}</strong></div>
              </div>
            </div>
          ) : null}

          <div className="form-grid form-grid--double">
            <label>
              Адрес сервиса
              <input
                className={getInputClassName(fieldErrors, 'target_url')}
                value={draft.target_url || ''}
                onChange={(e) => patch('target_url', e.target.value)}
              />
              <FieldHint>Базовый адрес API, например (http://localhost) или адрес стенда.</FieldHint>
              {renderFieldError(fieldErrors, 'target_url')}
            </label>

            <label>
              Порт сервиса
              <input
                className={getInputClassName(fieldErrors, 'target_port')}
                value={draft.target_port || ''}
                onChange={(e) => patch('target_port', e.target.value)}
              />
              <FieldHint>Отдельное поле для порта упрощает перенос теста между окружениями.</FieldHint>
              {renderFieldError(fieldErrors, 'target_port')}
            </label>

            <label>
              Виртуальные пользователи
              <input
                className={getInputClassName(fieldErrors, 'virtual_users')}
                type="number"
                min="1"
                value={draft.virtual_users ?? 1}
                onChange={(e) => patch('virtual_users', Number(e.target.value) || 1)}
              />
              <FieldHint>Количество параллельных виртуальных клиентов.</FieldHint>
              {renderFieldError(fieldErrors, 'virtual_users')}
            </label>

            <label>
              Количество повторов
              <input
                className={getInputClassName(fieldErrors, 'repeat_count')}
                type="number"
                min="1"
                value={draft.repeat_count ?? 1}
                onChange={(e) => patch('repeat_count', Number(e.target.value) || 1)}
              />
              <FieldHint>Сколько запросов выполнит каждый виртуальный пользователь.</FieldHint>
              {renderFieldError(fieldErrors, 'repeat_count')}
            </label>

            <label>
              Плавный запуск
              <input
                className={getInputClassName(fieldErrors, 'ramp_up')}
                value={draft.ramp_up || ''}
                onChange={(e) => patch('ramp_up', e.target.value)}
                placeholder="Например, 30с"
              />
              <FieldHint>Растягивает подключение пользователей во времени.</FieldHint>
              {renderFieldError(fieldErrors, 'ramp_up')}
            </label>

            <label>
              Длительность
              <input
                className={`input-disabled ${getInputClassName(fieldErrors, 'duration')}`.trim()}
                value={draft.duration || '1m'}
                disabled
                readOnly
              />
              <FieldHint>Поле пока зарезервировано под будущие сценарии во времени.</FieldHint>
              {renderFieldError(fieldErrors, 'duration')}
            </label>

            <label>
              Плавное завершение
              <input
                className={getInputClassName(fieldErrors, 'ramp_down')}
                value={draft.ramp_down || ''}
                onChange={(e) => patch('ramp_down', e.target.value)}
                placeholder="Например, 15с"
              />
              <FieldHint>Позволяет завершать нагрузку постепенно.</FieldHint>
              {renderFieldError(fieldErrors, 'ramp_down')}
            </label>

            <label>
              Метод запроса
              <select
                className={getInputClassName(fieldErrors, 'request_method')}
                value={draft.request_method || 'GET'}
                onChange={(e) => patch('request_method', e.target.value)}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
                  <option key={method} value={method}>
                    {getRequestMethodLabel(method)}
                  </option>
                ))}
              </select>
              <FieldHint>Выбери реальный HTTP-метод целевого API.</FieldHint>
              {renderFieldError(fieldErrors, 'request_method')}
            </label>

            <label>
              Путь запроса
              <input
                className={getInputClassName(fieldErrors, 'request_path')}
                value={draft.request_path || ''}
                onChange={(e) => patch('request_path', e.target.value)}
                placeholder="/api/orders"
              />
              <FieldHint>Лучше использовать относительный путь без повторения базового адреса.</FieldHint>
              {renderFieldError(fieldErrors, 'request_path')}
            </label>

            <label>
              Ожидаемый код ответа
              <input
                className={getInputClassName(fieldErrors, 'expected_status_code')}
                type="number"
                value={draft.expected_status_code || 200}
                onChange={(e) => patch('expected_status_code', Number(e.target.value))}
              />
              <FieldHint>Например: 200, 201, 204.</FieldHint>
              {renderFieldError(fieldErrors, 'expected_status_code')}
            </label>

            <label>
              Таймаут
              <input
                className={getInputClassName(fieldErrors, 'timeout')}
                value={draft.timeout || '30s'}
                onChange={(e) => patch('timeout', e.target.value)}
                placeholder="30с"
              />
              <FieldHint>Максимальное ожидание ответа от API.</FieldHint>
              {renderFieldError(fieldErrors, 'timeout')}
            </label>

            <label className="field-span-2">
              Заголовки запроса (объект данных)
              <textarea
                className={getInputClassName(fieldErrors, 'request_headers')}
                value={typeof draft.request_headers === 'string' ? draft.request_headers : JSON.stringify(draft.request_headers || {}, null, 2)}
                onChange={(e) => patch('request_headers', e.target.value)}
                rows={6}
              />
              <FieldHint>Пример: {`{ "Authorization": "Bearer токен" }`}</FieldHint>
              {renderFieldError(fieldErrors, 'request_headers')}
            </label>

            <label className="field-span-2">
              Параметры запроса (объект данных)
              <textarea
                className={getInputClassName(fieldErrors, 'query_params')}
                value={typeof draft.query_params === 'string' ? draft.query_params : JSON.stringify(draft.query_params || {}, null, 2)}
                onChange={(e) => patch('query_params', e.target.value)}
                rows={6}
              />
              <FieldHint>Пример: {`{ "page": 1, "limit": 20 }`}</FieldHint>
              {renderFieldError(fieldErrors, 'query_params')}
            </label>

            <label className="field-span-2">
              Тело запроса (объект данных)
              <textarea
                className={getInputClassName(fieldErrors, 'request_body')}
                value={typeof draft.request_body === 'string' ? draft.request_body : JSON.stringify(draft.request_body || {}, null, 2)}
                onChange={(e) => patch('request_body', e.target.value)}
                rows={8}
              />
              <FieldHint>Используется в методах, которые отправляют данные в API.</FieldHint>
              {renderFieldError(fieldErrors, 'request_body')}
            </label>
          </div>

          <div className="threshold-card">
            <div className="threshold-card__head">
              <div>
                <h3 style={{ margin: 0 }}>Пороговые проверки</h3>
                <p className="muted" style={{ margin: '8px 0 0 0' }}>
                  После запуска теста система покажет, пройдены ли заданные пороги качества.
                </p>
              </div>
            </div>

            <div className="form-grid form-grid--double">
              <label>
                Максимум среднего времени ответа (мс)
                <input
                  className={getInputClassName(fieldErrors, 'max_avg_response_ms')}
                  type="number"
                  min="0"
                  value={draft.max_avg_response_ms ?? ''}
                  onChange={(e) => patch('max_avg_response_ms', e.target.value === '' ? null : Number(e.target.value))}
                />
                <FieldHint>Если фактическое среднее будет выше, тест пометится как не пройденный.</FieldHint>
                {renderFieldError(fieldErrors, 'max_avg_response_ms')}
              </label>

              <label>
                Максимум 95-го процентиля (мс)
                <input
                  className={getInputClassName(fieldErrors, 'max_p95_ms')}
                  type="number"
                  min="0"
                  value={draft.max_p95_ms ?? ''}
                  onChange={(e) => patch('max_p95_ms', e.target.value === '' ? null : Number(e.target.value))}
                />
                <FieldHint>Помогает отлавливать редкие, но тяжёлые задержки.</FieldHint>
                {renderFieldError(fieldErrors, 'max_p95_ms')}
              </label>

              <label>
                Максимум доли ошибок (проценты)
                <input
                  className={getInputClassName(fieldErrors, 'max_error_rate')}
                  type="number"
                  min="0"
                  value={draft.max_error_rate ?? ''}
                  onChange={(e) => patch('max_error_rate', e.target.value === '' ? null : Number(e.target.value))}
                />
                <FieldHint>Укажи допустимый процент неуспешных запросов.</FieldHint>
                {renderFieldError(fieldErrors, 'max_error_rate')}
              </label>

              <label>
                Минимум пропускной способности (запросов в секунду)
                <input
                  className={getInputClassName(fieldErrors, 'min_throughput')}
                  type="number"
                  min="0"
                  value={draft.min_throughput ?? ''}
                  onChange={(e) => patch('min_throughput', e.target.value === '' ? null : Number(e.target.value))}
                />
                <FieldHint>Нижняя граница полезной производительности API.</FieldHint>
                {renderFieldError(fieldErrors, 'min_throughput')}
              </label>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'scenario' ? (
        <section className="card form-card">
          <label>
            Сценарий теста
            <textarea
              className={getInputClassName(fieldErrors, 'script_content')}
              value={draft.script_content || ''}
              onChange={(e) => patch('script_content', e.target.value)}
              placeholder="Текст сценария теста"
              rows={16}
            />
            <FieldHint>Опиши шаги проверки: подготовка, вызов API, ожидание результата и условия успеха.</FieldHint>
            {renderFieldError(fieldErrors, 'script_content')}
          </label>
        </section>
      ) : null}

      {activeTab === 'runs' ? <RunHistory runs={runs} isRefreshing={isRefreshingRuns} /> : null}
      {activeTab === 'analytics' ? (
        <AnalyticsPanel test={test} runs={runs} latestRun={latestRun} activityTimeline={test?.last_run_activity || []} />
      ) : null}
      {activeTab === 'logs' ? <LogsPanel runs={runs} /> : null}
    </section>
  )
}
