import { useEffect, useMemo, useState } from 'react'
import { getProjectTests } from '../api'
import { getErrorMessage } from '../utils/apiErrors'

function normalizeText(value) {
  return (value || '').toString().trim().toLowerCase()
}

function getTestTypeLabel(value) {
  const labels = {
    load: 'Нагрузочный',
    smoke: 'Дымовой',
    stress: 'Стрессовый',
  }
  return labels[value] || 'Тест'
}

function getEnvironmentLabel(value) {
  const labels = {
    local: 'Локальная среда',
    test: 'Тестовая среда',
    stage: 'Предпродовая среда',
    prod: 'Рабочая среда',
  }
  return labels[value] || 'Не указано'
}

function getStatusLabel(value) {
  const labels = {
    draft: 'Черновик',
    queued: 'В очереди',
    running: 'Выполняется',
    success: 'Успешно',
    completed_with_errors: 'Завершён с ошибками',
    failed: 'Ошибка',
  }
  return labels[value] || 'Неизвестно'
}

function buildProjectSearchText(project, tests) {
  return normalizeText([
    project.name,
    project.description,
    project.owner?.full_name,
    project.owner?.email,
    ...tests.flatMap((test) => [test.name, test.description, test.goal, test.target_entity]),
  ].join(' '))
}

export default function ProjectTreeExplorer({
  projects,
  groupByOwner = false,
  onOpenProject,
  onOpenTest,
  emptyTitle = 'Ничего не найдено',
  emptyText = 'Список пока пуст.',
}) {
  const [search, setSearch] = useState('')
  const [testsByProject, setTestsByProject] = useState({})
  const [loadingProjectIds, setLoadingProjectIds] = useState([])
  const [collapsedProjectIds, setCollapsedProjectIds] = useState({})
  const [collapsedOwnerKeys, setCollapsedOwnerKeys] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadTests() {
      if (!projects.length) {
        setTestsByProject({})
        return
      }

      setError('')
      setLoadingProjectIds(projects.map((project) => project.id))

      const results = await Promise.allSettled(
        projects.map(async (project) => ({ projectId: project.id, tests: await getProjectTests(project.id) })),
      )

      if (cancelled) return

      const nextTestsByProject = {}
      let firstError = ''

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          nextTestsByProject[result.value.projectId] = result.value.tests
          return
        }

        if (!firstError) {
          firstError = getErrorMessage(result.reason, 'Не удалось загрузить список тестов.')
        }
      })

      setTestsByProject(nextTestsByProject)
      setLoadingProjectIds([])
      setError(firstError)
    }

    loadTests()

    return () => {
      cancelled = true
    }
  }, [projects])

  const filteredGroups = useMemo(() => {
    const searchValue = normalizeText(search)
    const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    if (!groupByOwner) {
      const items = sortedProjects
        .map((project) => {
          const tests = testsByProject[project.id] || []
          const matchingTests = !searchValue
            ? tests
            : tests.filter((test) => buildProjectSearchText(project, [test]).includes(searchValue))
          const projectText = buildProjectSearchText(project, tests)
          if (searchValue && !projectText.includes(searchValue) && matchingTests.length === 0) {
            return null
          }
          return { ...project, tests: matchingTests, totalTests: tests.length }
        })
        .filter(Boolean)

      return [
        {
          key: 'my-projects',
          title: 'Мои проекты',
          subtitle: `Проектов: ${items.length}`,
          projects: items,
        },
      ]
    }

    const ownerMap = new Map()

    sortedProjects.forEach((project) => {
      const ownerKey = project.owner?.id || `owner-${project.owner_id}`
      const ownerLabel = project.owner?.full_name || project.owner?.email || 'Пользователь'
      const ownerSubtitle = project.owner?.email || 'Без электронной почты'
      const tests = testsByProject[project.id] || []
      const matchingTests = !searchValue
        ? tests
        : tests.filter((test) => buildProjectSearchText(project, [test]).includes(searchValue))
      const projectText = buildProjectSearchText(project, tests)

      if (searchValue && !projectText.includes(searchValue) && matchingTests.length === 0) {
        return
      }

      if (!ownerMap.has(ownerKey)) {
        ownerMap.set(ownerKey, {
          key: String(ownerKey),
          title: ownerLabel,
          subtitle: ownerSubtitle,
          projects: [],
        })
      }

      ownerMap.get(ownerKey).projects.push({
        ...project,
        tests: matchingTests,
        totalTests: tests.length,
      })
    })

    return [...ownerMap.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  }, [groupByOwner, projects, search, testsByProject])

  function toggleProject(projectId) {
    setCollapsedProjectIds((prev) => ({ ...prev, [projectId]: !prev[projectId] }))
  }

  function toggleOwner(ownerKey) {
    setCollapsedOwnerKeys((prev) => ({ ...prev, [ownerKey]: !prev[ownerKey] }))
  }

  function collapseAllProjects() {
    const next = {}
    projects.forEach((project) => {
      next[project.id] = true
    })
    setCollapsedProjectIds(next)
  }

  function expandAllProjects() {
    setCollapsedProjectIds({})
    setCollapsedOwnerKeys({})
  }

  const visibleProjectsCount = filteredGroups.reduce((sum, group) => sum + group.projects.length, 0)

  return (
    <div className="workspace-stack">
      <div className="catalog-toolbar">
        <label className="catalog-search">
          Поиск по проектам и тестам
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Введите название проекта, теста или пользователя"
          />
        </label>

        <div className="catalog-toolbar__actions">
          <button type="button" className="button-secondary" onClick={expandAllProjects}>
            Показать всё
          </button>
          <button type="button" className="button-secondary" onClick={collapseAllProjects}>
            Скрыть все тесты
          </button>
        </div>
      </div>

      <div className="muted small">Найдено проектов: {visibleProjectsCount}</div>

      {error ? <div className="error">{error}</div> : null}

      {visibleProjectsCount === 0 ? (
        <div className="empty-state">
          <h3>{emptyTitle}</h3>
          <p className="muted">{emptyText}</p>
        </div>
      ) : (
        filteredGroups.map((group) => {
          const ownerCollapsed = Boolean(collapsedOwnerKeys[group.key])

          return (
            <section key={group.key} className="project-folder">
              {groupByOwner ? (
                <div className="project-folder-header">
                  <div className="project-folder-user-info">
                    <div className="project-folder-title">{group.title}</div>
                    <div className="project-folder-subtitle">
                      {group.subtitle} · Проектов: {group.projects.length}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="folder-toggle-button"
                    onClick={() => toggleOwner(group.key)}
                  >
                    {ownerCollapsed ? 'Показать проекты' : 'Скрыть проекты'}
                  </button>
                </div>
              ) : null}

              {!ownerCollapsed ? (
                <div className="project-folder-items">
                  {group.projects.map((project) => {
                    const projectCollapsed = Boolean(collapsedProjectIds[project.id])
                    const isLoading = loadingProjectIds.includes(project.id)
                    const visibleTests = project.tests || []

                    return (
                      <article key={project.id} className="project-card project-card--stacked">
                        <div className="project-card__content">
                          <div className="project-nav-head">
                            <h3>{project.name}</h3>
                            <span className="project-type-badge">Тестов: {project.totalTests}</span>
                          </div>
                          <p>{project.description || 'Описание отсутствует.'}</p>
                          <div className="project-nav-meta">
                            {groupByOwner ? <span>Владелец: {project.owner?.full_name || project.owner?.email || '—'}</span> : null}
                            <span>Создан: {new Date(project.created_at).toLocaleString('ru-RU')}</span>
                          </div>
                        </div>

                        <div className="project-card__actions">
                          <button type="button" className="button-secondary" onClick={() => toggleProject(project.id)}>
                            {projectCollapsed ? 'Показать тесты' : 'Скрыть тесты'}
                          </button>
                          <button type="button" onClick={() => onOpenProject?.(project.id)}>
                            Открыть проект
                          </button>
                        </div>

                        {!projectCollapsed ? (
                          <div className="project-card__tests">
                            {isLoading ? (
                              <div className="muted">Загрузка тестов...</div>
                            ) : visibleTests.length === 0 ? (
                              <div className="empty-box">Тесты для этого проекта не найдены.</div>
                            ) : (
                              <div className="list compact-list">
                                {visibleTests.map((test) => (
                                  <article key={test.id} className="nested-test-card">
                                    <div className="project-card__content">
                                      <div className="project-nav-head">
                                        <h4>{test.name}</h4>
                                        <span className="project-type-badge">{getTestTypeLabel(test.test_type)}</span>
                                      </div>
                                      <p>{test.goal || test.description || 'Описание теста отсутствует.'}</p>
                                      <div className="project-nav-meta">
                                        <span>Статус: {getStatusLabel(test.status)}</span>
                                        <span>Среда: {getEnvironmentLabel(test.environment)}</span>
                                      </div>
                                    </div>
                                    <div className="project-card__actions">
                                      <button type="button" onClick={() => onOpenTest?.(test.id)}>
                                        Открыть тест
                                      </button>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })
      )}
    </div>
  )
}
