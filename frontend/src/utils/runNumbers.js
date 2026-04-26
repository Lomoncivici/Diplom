function getRunOrderTimestamp(run) {
  const value = run?.created_at || run?.started_at || run?.finished_at
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function addDisplayNumbersToRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return []
  }

  const runsInNumberOrder = [...runs].sort((left, right) => {
    const timestampDiff = getRunOrderTimestamp(left) - getRunOrderTimestamp(right)
    if (timestampDiff !== 0) {
      return timestampDiff
    }

    return (left?.id || 0) - (right?.id || 0)
  })

  const numbersByRunId = new Map(
    runsInNumberOrder.map((run, index) => [run.id, index + 1]),
  )

  return runs.map((run) => ({
    ...run,
    display_number: numbersByRunId.get(run.id) ?? null,
  }))
}
