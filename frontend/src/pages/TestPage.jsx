import { useEffect, useMemo, useState } from 'react'
import { createTestRun, getRuntimePolicy, getTest, getTestRuns, updateTest } from '../api'
import TestEditor from '../components/TestEditor'
import { createClientFieldError, getErrorMessage, getFieldErrors } from '../utils/apiErrors'
import { addDisplayNumbersToRuns } from '../utils/runNumbers'

function parseJsonField(value, fieldName, fieldKey) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'object') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    throw createClientFieldError(`Поле (${fieldName}) содержит некорректный формат данных.`, {
      [fieldKey]: `Поле (${fieldName}) должно содержать корректный объект данных.`,
    })
  }
}

function buildDraftFromTest(data) {
  return {
    ...data,
    virtual_users: data.virtual_users ?? 1,
    repeat_count: data.repeat_count ?? 1,
    duration: data.duration ?? '1m',
  }
}

export default function TestPage({ testId, onBack }) {
  const [test, setTest] = useState(null)
  const [draft, setDraft] = useState(null)
  const [runs, setRuns] = useState([])
  const [runtimePolicy, setRuntimePolicy] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isRefreshingRuns, setIsRefreshingRuns] = useState(false)

  const hasActiveRuns = useMemo(
    () => runs.some((run) => ['queued', 'running'].includes(run.status)),
    [runs],
  )

  async function loadTest() {
    const data = await getTest(testId)
    setTest(data)
    setDraft(buildDraftFromTest(data))
  }

  async function loadRuns() {
    setRuns(addDisplayNumbersToRuns(await getTestRuns(testId)))
  }

  useEffect(() => {
    if (!testId) return

    let cancelled = false

    async function loadPage() {
      setError('')
      try {
        const [testData, runData, policyData] = await Promise.all([getTest(testId), getTestRuns(testId), getRuntimePolicy()])
        if (cancelled) return
        setTest(testData)
        setDraft(buildDraftFromTest(testData))
        setRuns(addDisplayNumbersToRuns(runData))
        setRuntimePolicy(policyData)
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Не удалось загрузить тест и историю запусков.'))
        }
      }
    }

    loadPage()
    return () => {
      cancelled = true
    }
  }, [testId])

  useEffect(() => {
    if (!testId || !hasActiveRuns) return undefined

    let cancelled = false

    async function refreshActiveRuns() {
      try {
        setIsRefreshingRuns(true)
        const [testData, runData] = await Promise.all([getTest(testId), getTestRuns(testId)])
        if (cancelled) return
        setTest(testData)
        setRuns(addDisplayNumbersToRuns(runData))
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Не удалось обновить статусы запусков.'))
        }
      } finally {
        if (!cancelled) {
          setIsRefreshingRuns(false)
        }
      }
    }

    refreshActiveRuns()
    const intervalId = window.setInterval(refreshActiveRuns, 2000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [testId, hasActiveRuns])

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      const payload = {
        ...draft,
        request_headers: parseJsonField(draft.request_headers, 'Заголовки запроса', 'request_headers'),
        query_params: parseJsonField(draft.query_params, 'Параметры запроса', 'query_params'),
        request_body: parseJsonField(draft.request_body, 'Тело запроса', 'request_body'),
      }

      await updateTest(testId, payload)
      await loadTest()
    } catch (err) {
      setError(getErrorMessage(err))
      setFieldErrors(getFieldErrors(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleRun() {
    setError('')
    try {
      const createdRun = await createTestRun(testId, {})
      setRuns((prev) => addDisplayNumbersToRuns([createdRun, ...prev.filter((run) => run.id !== createdRun.id)]))
      const freshTest = await getTest(testId)
      setTest(freshTest)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  if (!draft) {
    return <div className="loading-screen">Загрузка теста...</div>
  }

  return (
    <div className="workspace-page">
      {error ? <div className="error">{error}</div> : null}
      <TestEditor
        test={test}
        draft={draft}
        setDraft={setDraft}
        fieldErrors={fieldErrors}
        setFieldErrors={setFieldErrors}
        runs={runs}
        runtimePolicy={runtimePolicy}
        onSave={handleSave}
        onRun={handleRun}
        saving={saving}
        isRefreshingRuns={isRefreshingRuns}
        onBack={onBack}
      />
    </div>
  )
}
