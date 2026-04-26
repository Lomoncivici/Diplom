import { useEffect, useMemo, useState } from 'react'
import { getProjectTests } from '../api'
import { getErrorMessage } from '../utils/apiErrors'
import { paletteOptions, themeOptions } from '../utils/theme'

function getOwnerLabel(account) {
  if (!account) return 'пользователь'
  return account.username || account.login || account.full_name || account.email?.split('@')[0] || 'пользователь'
}

function getRoleLabel(role) {
  return role === 'admin' ? 'Администратор' : 'Студент'
}

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

function buildProjectSearchText(project, owner) {
  return normalizeText([
    project.name,
    project.description,
    owner?.full_name,
    owner?.email,
    getOwnerLabel(owner),
  ].join(' '))
}

function buildTestSearchText(test) {
  return normalizeText([
    test.name,
    test.description,
    test.goal,
    test.target_entity,
    test.status,
    test.environment,
    test.test_type,
  ].join(' '))
}

export default function Sidebar({
  user,
  users = [],
  projects = [],
  selectedProjectId,
  selectedTestId,
  onSelectProject,
  onSelectTest,
  onCreateProject,
  onOpenDashboard,
  onOpenAdmin,
  onOpenSupport,
  onOpenProfile,
  onLogout,
  uiSettings,
  onChangeTheme,
  onChangePalette,
}) {
  const [query, setQuery] = useState('')
  const [testsByProject, setTestsByProject] = useState({})
  const [loadingProjectIds, setLoadingProjectIds] = useState([])
  const [collapsedOwnerIds, setCollapsedOwnerIds] = useState({})
  const [collapsedProjectIds, setCollapsedProjectIds] = useState({})
  const [treeError, setTreeError] = useState('')

  const safeUsers = Array.isArray(users) ? users : []
  const safeProjects = Array.isArray(projects) ? projects : []

  useEffect(() => {
    let cancelled = false

    async function loadTests() {
      if (!safeProjects.length) {
        setTestsByProject({})
        setLoadingProjectIds([])
        return
      }

      setTreeError('')
      setLoadingProjectIds(safeProjects.map((project) => project.id))

      const results = await Promise.allSettled(
        safeProjects.map(async (project) => ({
          projectId: project.id,
          tests: await getProjectTests(project.id),
        })),
      )

      if (cancelled) return

      const nextMap = {}
      let firstError = ''

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          nextMap[result.value.projectId] = result.value.tests
          return
        }
        if (!firstError) {
          firstError = getErrorMessage(result.reason, 'Не удалось загрузить тесты проектов.')
        }
      })

      setTestsByProject(nextMap)
      setLoadingProjectIds([])
      setTreeError(firstError)
    }

    loadTests()
    return () => {
      cancelled = true
    }
  }, [safeProjects])

  useEffect(() => {
    setCollapsedProjectIds((prev) => {
      const next = { ...prev }
      safeProjects.forEach((project) => {
        if (next[project.id] === undefined) {
          next[project.id] = true
        }
      })
      return next
    })
  }, [safeProjects])

  const groupedItems = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    const sortedProjects = [...safeProjects].sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    if (user?.role !== 'admin') {
      const items = sortedProjects
        .map((project) => {
          const owner = project.owner || safeUsers.find((item) => item.id === project.owner_id) || user || null
          const tests = testsByProject[project.id] || []
          const projectMatches = !normalizedQuery || buildProjectSearchText(project, owner).includes(normalizedQuery)
          const matchingTests = !normalizedQuery
            ? tests
            : tests.filter((test) => buildTestSearchText(test).includes(normalizedQuery))

          if (normalizedQuery && !projectMatches && matchingTests.length === 0) {
            return null
          }

          return {
            ...project,
            owner,
            totalTests: tests.length,
            visibleTests: normalizedQuery && !projectMatches ? matchingTests : tests,
          }
        })
        .filter(Boolean)

      return [{ key: 'user-projects', title: 'Проекты', projects: items }]
    }

    const groups = new Map()

    sortedProjects.forEach((project) => {
      const owner = project.owner || safeUsers.find((item) => item.id === project.owner_id) || null
      const ownerId = owner?.id ?? project.owner_id ?? `owner-${project.id}`
      const tests = testsByProject[project.id] || []
      const projectMatches = !normalizedQuery || buildProjectSearchText(project, owner).includes(normalizedQuery)
      const matchingTests = !normalizedQuery
        ? tests
        : tests.filter((test) => buildTestSearchText(test).includes(normalizedQuery))

      if (normalizedQuery && !projectMatches && matchingTests.length === 0) {
        return
      }

      if (!groups.has(ownerId)) {
        groups.set(ownerId, {
          key: String(ownerId),
          owner,
          title: getOwnerLabel(owner),
          subtitle: owner?.email || '',
          projects: [],
        })
      }

      groups.get(ownerId).projects.push({
        ...project,
        owner,
        totalTests: tests.length,
        visibleTests: normalizedQuery && !projectMatches ? matchingTests : tests,
      })
    })

    return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  }, [query, safeProjects, safeUsers, testsByProject, user])

  useEffect(() => {
    if (user?.role !== 'admin') return
    setCollapsedOwnerIds((prev) => {
      const next = { ...prev }
      groupedItems.forEach((group) => {
        if (next[group.key] === undefined) {
          next[group.key] = true
        }
      })
      return next
    })
  }, [groupedItems, user?.role])

  const queryActive = Boolean(normalizeText(query))

  const visibleProjectsCount = groupedItems.reduce((sum, group) => sum + group.projects.length, 0)
  const visibleTestsCount = groupedItems.reduce(
    (sum, group) => sum + group.projects.reduce((projectSum, project) => projectSum + (project.visibleTests?.length || 0), 0),
    0,
  )

  function toggleOwner(ownerId) {
    setCollapsedOwnerIds((prev) => ({ ...prev, [ownerId]: !prev[ownerId] }))
  }

  function toggleProject(projectId) {
    setCollapsedProjectIds((prev) => ({ ...prev, [projectId]: !prev[projectId] }))
  }

  function expandEverything() {
    setCollapsedOwnerIds({})
    setCollapsedProjectIds({})
  }

  function collapseAllTests() {
    const next = {}
    safeProjects.forEach((project) => {
      next[project.id] = true
    })
    setCollapsedProjectIds(next)
  }

  function renderTestItem(test) {
    return (
      <article
        key={test.id}
        className={`sidebar-test-item ${selectedTestId === test.id ? 'selected' : ''}`}
      >
        <div className="project-nav-head">
          <strong>{test.name}</strong>
          <span className="project-type-badge">{getTestTypeLabel(test.test_type)}</span>
        </div>
        <div className="project-nav-desc">
          {test.goal || test.description || 'Описание теста пока не заполнено.'}
        </div>
        <div className="project-nav-meta">
          <span>{getStatusLabel(test.status)}</span>
          <span>Номер: {test.id}</span>
        </div>
        <div className="sidebar-inline-actions">
          <button type="button" onClick={() => onSelectTest?.(test.id)}>
            Открыть тест
          </button>
        </div>
      </article>
    )
  }

  function renderProjectItem(project) {
    const isCollapsed = queryActive ? false : !!collapsedProjectIds[project.id]
    const isLoading = loadingProjectIds.includes(project.id)
    const visibleTests = project.visibleTests || []

    return (
      <article key={project.id} className={`project-nav-item sidebar-project-card ${selectedProjectId === project.id ? 'selected' : ''}`}>
        <div className="project-nav-head">
          <strong>{project.name}</strong>
          <span className="project-type-badge">Тестов: {project.totalTests}</span>
        </div>

        <div className="project-nav-desc">
          {project.description || 'Описание проекта пока не заполнено.'}
        </div>

        <div className="project-nav-meta">
          <span>Номер: {project.id}</span>
          {user?.role === 'admin' ? <span>{project.owner?.full_name || project.owner?.email || '—'}</span> : null}
        </div>

        <div className="sidebar-inline-actions">
          <button type="button" className="button-secondary" onClick={() => toggleProject(project.id)}>
            {isCollapsed ? 'Показать тесты' : 'Скрыть тесты'}
          </button>
          <button type="button" onClick={() => onSelectProject(project.id)}>
            Открыть проект
          </button>
        </div>

        {!isCollapsed ? (
          <div className="sidebar-tests-list">
            {isLoading ? (
              <div className="empty-box">Загрузка тестов...</div>
            ) : visibleTests.length === 0 ? (
              <div className="empty-box">Для этого проекта тесты не найдены.</div>
            ) : (
              visibleTests.map((test) => renderTestItem(test))
            )}
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="brand-button" type="button" onClick={onOpenDashboard}>
          <div className="brand-mark">НТ</div>
          <div>
            <div className="brand-title">Тестирование апи</div>
            <div className="muted small">Рабочее пространство для нагрузочного тестирования</div>
          </div>
        </button>

        <div className="user-panel card card--soft">
          <div className="user-avatar">{user?.full_name?.[0] || user?.email?.[0] || 'П'}</div>
          <div>
            <div className="user-name">{user?.full_name || user?.email}</div>
            <div className="muted small">{getRoleLabel(user?.role)}</div>
            {!user?.email_is_verified ? <div className="sidebar-warning-chip">Почта не подтверждена</div> : null}
          </div>
        </div>

        <div className="sidebar-actions">
          <button type="button" onClick={onCreateProject}>
            + Создать проект
          </button>
          <button type="button" className="button-secondary" onClick={onOpenProfile}>
            Профиль
          </button>
          {user?.role === 'admin' ? (
            <button type="button" className="button-secondary" onClick={onOpenAdmin}>
              Панель администратора
            </button>
          ) : null}
          <button type="button" className="button-secondary" onClick={onOpenSupport}>
            {user?.role === 'admin' ? 'Чаты поддержки' : 'Техническая поддержка'}
          </button>
          <input
            type="text"
            placeholder="Поиск по пользователю, проекту или тесту..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="sidebar-inline-actions sidebar-inline-actions--toolbar">
            <button type="button" className="button-secondary" onClick={expandEverything}>
              Показать всё
            </button>
            <button type="button" className="button-secondary" onClick={collapseAllTests}>
              Скрыть тесты
            </button>
          </div>
        </div>
      </div>

      <div className="sidebar-projects">
        <div className="section-title">Проекты и тесты</div>
        <div className="muted small">Проектов: {visibleProjectsCount} · Тестов: {visibleTestsCount}</div>

        {treeError ? <div className="error">{treeError}</div> : null}

        {visibleProjectsCount === 0 ? (
          <div className="muted empty-box">Проекты или тесты по запросу не найдены.</div>
        ) : user?.role === 'admin' ? (
          groupedItems.map((group) => {
            const isOwnerCollapsed = queryActive ? false : !!collapsedOwnerIds[group.key]
            return (
              <div key={group.key} className="project-folder">
                <div className="project-folder-header">
                  <div className="project-folder-user-info">
                    <div className="project-folder-title">{group.title}</div>
                    <div className="project-folder-subtitle">{group.subtitle || 'Без электронной почты'} · Проектов: {group.projects.length}</div>
                  </div>
                  <button
                    type="button"
                    className="folder-toggle-button"
                    onClick={() => toggleOwner(group.key)}
                  >
                    {isOwnerCollapsed ? 'Развернуть' : 'Скрыть'}
                  </button>
                </div>

                {!isOwnerCollapsed ? (
                  <div className="project-folder-items">
                    {group.projects.map((project) => renderProjectItem(project))}
                  </div>
                ) : null}
              </div>
            )
          })
        ) : (
          groupedItems[0]?.projects.map((project) => renderProjectItem(project))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="card card--soft settings-card">
          <div className="settings-card__title">Оформление</div>
          <label>
            Тема
            <select value={uiSettings?.theme || 'dark'} onChange={(event) => onChangeTheme?.(event.target.value)}>
              {themeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Палитра
            <select value={uiSettings?.palette || 'blue'} onChange={(event) => onChangePalette?.(event.target.value)}>
              {paletteOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="palette-preview-row" aria-hidden="true">
            <span className="palette-preview-dot" />
            <span className="palette-preview-dot palette-preview-dot--soft" />
            <span className="palette-preview-dot palette-preview-dot--outline" />
          </div>
        </div>

        <button className="button-secondary" type="button" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </aside>
  )
}
