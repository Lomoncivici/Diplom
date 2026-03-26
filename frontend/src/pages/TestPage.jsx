import { useEffect, useState } from 'react'
import { createTestRun, getTest, getTestRuns, updateTest } from '../api'
import TestEditor from '../components/TestEditor'

function parseJsonField(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'object') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`Поле "${fieldName}" содержит невалидный JSON`)
  }
}

export default function TestPage({ testId }) {
  const [test, setTest] = useState(null)
  const [draft, setDraft] = useState(null)
  const [runs, setRuns] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // async function loadTest() {
  //   const data = await getTest(testId)
  //   setTest(data)
  //   setDraft(data)
  // }

  async function loadTest() {
    const data = await getTest(testId)
    setTest(data)
    setDraft({
      ...data,
      virtual_users: data.virtual_users ?? 1,
      repeat_count: data.repeat_count ?? 1,
      duration: data.duration ?? '1m',
    })
  }

  async function loadRuns() {
    setRuns(await getTestRuns(testId))
  }

  useEffect(() => {
    if (!testId) return
    Promise.all([loadTest(), loadRuns()]).catch((err) => setError(err.message))
  }, [testId])

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    setError('')

    try {
      const payload = {
        ...draft,
        request_headers: parseJsonField(draft.request_headers, 'Headers'),
        query_params: parseJsonField(draft.query_params, 'Query params'),
        request_body: parseJsonField(draft.request_body, 'Request body'),
      }

      await updateTest(testId, payload)
      await loadTest()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRun() {
    setError('')
    try {
      await createTestRun(testId, {})
      await loadRuns()
    } catch (err) {
      setError(err.message)
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
        runs={runs}
        onSave={handleSave}
        onRun={handleRun}
        saving={saving}
      />
    </div>
  )
}