import { useMemo, useState } from 'react'
import AnalyticsPanel from './AnalyticsPanel'
import LogsPanel from './LogsPanel'
import RunHistory from './RunHistory'

const tabs = [
  { id: 'overview', label: 'Общее' },
  { id: 'config', label: 'Конфигурация' },
  { id: 'scenario', label: 'Сценарий' },
  // { id: 'runs', label: 'Запуски' }, jnrk.xtyj d cdzpb gthtyjcf aeyrwbjyfkf d kjub
  { id: 'analytics', label: 'Аналитика' },
  { id: 'logs', label: 'Логи' },
]

export default function TestEditor({ test, draft, setDraft, runs, onSave, onRun, saving }) {
  const [activeTab, setActiveTab] = useState('overview')
  const latestRun = useMemo(() => runs[0] || null, [runs])

  function patch(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>{test?.name || 'Тест'}</h1>
          <p className="muted">Отдельный тест внутри проекта: конфигурация, сценарий, запуски и метрики.</p>
        </div>

        <div className="header-actions">
          <button className="button-secondary" onClick={onRun}>
            Запустить тест
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

      {activeTab === 'overview' ? (
        <section className="card form-card">
          <div className="form-grid form-grid--double">
            <label>
              Название теста
              <input value={draft.name || ''} onChange={(e) => patch('name', e.target.value)} />
            </label>
            <label>
              Что тестируется
              <input
                value={draft.target_entity || ''}
                onChange={(e) => patch('target_entity', e.target.value)}
                placeholder="Например, /api/orders"
              />
            </label>
            <label className="field-span-2">
              Описание
              <textarea
                value={draft.description || ''}
                onChange={(e) => patch('description', e.target.value)}
                rows={4}
              />
            </label>
            <label className="field-span-2">
              Цель теста
              <textarea value={draft.goal || ''} onChange={(e) => patch('goal', e.target.value)} rows={4} />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'config' ? (
        <section className="card form-card">
          <div className="form-grid form-grid--double">
            <label>
              Target URL
              <input value={draft.target_url || ''} onChange={(e) => patch('target_url', e.target.value)} />
            </label>

            <label>
              Target Port
              <input value={draft.target_port || ''} onChange={(e) => patch('target_port', e.target.value)} />
              <small className="field-hint">Порт целевого сервиса</small>
            </label>

            <label>
              Virtual Users
              <input
                type="number"
                min="1"
                value={draft.virtual_users ?? 1}
                onChange={(e) => patch('virtual_users', Number(e.target.value) || 1)}
              />
              <small className="field-hint">Количество виртуальных пользователей</small>
            </label>

            <label>
              Repeat Count
              <input
                type="number"
                min="1"
                value={draft.repeat_count ?? 1}
                onChange={(e) => patch('repeat_count', Number(e.target.value) || 1)}
              />
              <small className="field-hint">Количество запросов от одного пользователя</small>
            </label>

            <label>
              Ramp up
              <input value={draft.ramp_up || ''} onChange={(e) => patch('ramp_up', e.target.value)} />
              <small className="field-hint">Плавное подключение пользователей</small>
            </label>

            <label>
              Duration
              <input
                value={draft.duration || '1m'}
                disabled
                readOnly
                className="input-disabled"
              />
              <small className="field-hint">Временно не используется</small>
            </label>

            <label>
              Ramp down
              <input value={draft.ramp_down || ''} onChange={(e) => patch('ramp_down', e.target.value)} />
              <small className="field-hint">Плавное снижение активности</small>
            </label>

            <label>
              HTTP Method
              <select value={draft.request_method || 'GET'} onChange={(e) => patch('request_method', e.target.value)}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </label>

            <label>
              Endpoint path
              <input
                value={draft.request_path || ''}
                onChange={(e) => patch('request_path', e.target.value)}
                placeholder="/api/orders"
              />
            </label>

            <label>
              Expected status
              <input
                type="number"
                value={draft.expected_status_code || 200}
                onChange={(e) => patch('expected_status_code', Number(e.target.value))}
              />
            </label>

            <label>
              Timeout
              <input
                value={draft.timeout || '30'}
                onChange={(e) => patch('timeout', e.target.value)}
                placeholder="30s"
              />
            </label>

            <label className="field-span-2">
              Headers (JSON)
              <textarea
                value={
                  typeof draft.request_headers === 'string'
                    ? draft.request_headers
                    : JSON.stringify(draft.request_headers || {}, null, 2)
                }
                onChange={(e) => patch('request_headers', e.target.value)}
                rows={6}
              />
            </label>

            <label className="field-span-2">
              Query params (JSON)
              <textarea
                value={
                  typeof draft.query_params === 'string'
                    ? draft.query_params
                    : JSON.stringify(draft.query_params || {}, null, 2)
                }
                onChange={(e) => patch('query_params', e.target.value)}
                rows={6}
              />
            </label>

            <label className="field-span-2">
              Request body (JSON)
              <textarea
                value={
                  typeof draft.request_body === 'string'
                    ? draft.request_body
                    : JSON.stringify(draft.request_body || {}, null, 2)
                }
                onChange={(e) => patch('request_body', e.target.value)}
                rows={8}
              />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'scenario' ? (
        <section className="card form-card">
          <label>
            Сценарий теста
            <textarea
              value={draft.script_content || ''}
              onChange={(e) => patch('script_content', e.target.value)}
              placeholder="Текст сценария / k6 script"
              rows={16}
            />
          </label>
        </section>
      ) : null}

      {/* {activeTab === 'runs' ? <RunHistory runs={runs} /> : null} */}
      {/* запуски обьеденены с логами */}
      {activeTab === 'analytics' ? <AnalyticsPanel runs={runs} latestRun={latestRun} /> : null}
      {activeTab === 'logs' ? <LogsPanel runs={runs} /> : null}
    </section>
  )
}
