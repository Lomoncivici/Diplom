import { useEffect, useMemo, useState } from 'react'

function getOwnerLabel(account) {
  if (!account) return 'user'
  return account.username || account.login || account.full_name || account.email?.split('@')[0] || 'user'
}

export default function Sidebar({
  user,
  users = [],
  projects = [],
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onOpenDashboard,
  onLogout,
}) {
  const [query, setQuery] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState({})

  const safeUsers = Array.isArray(users) ? users : []
  const safeProjects = Array.isArray(projects) ? projects : []

  const groupedProjects = useMemo(() => {
    if (user?.role !== 'admin') return []

    const groups = {}

    for (const project of safeProjects) {
      const ownerId = project.owner?.id ?? project.owner_id ?? 'unknown'
      const owner =
        project.owner ||
        safeUsers.find((item) => item.id === project.owner_id) || {
          id: ownerId,
          full_name: 'Неизвестный пользователь',
          email: '',
        }

      if (!groups[ownerId]) {
        groups[ownerId] = {
          owner,
          projects: [],
        }
      }

      groups[ownerId].projects.push(project)
    }

    return Object.values(groups).sort((a, b) => {
      const aName = getOwnerLabel(a.owner)
      const bName = getOwnerLabel(b.owner)
      return aName.localeCompare(bName, 'ru')
    })
  }, [safeProjects, safeUsers, user?.role])

  useEffect(() => {
    if (user?.role !== 'admin') return

    setCollapsedFolders((prev) => {
      const next = { ...prev }
      groupedProjects.forEach((group) => {
        if (next[group.owner.id] === undefined) {
          next[group.owner.id] = true
        }
      })
      return next
    })
  }, [groupedProjects, user?.role])

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return safeProjects

    return safeProjects.filter((project) => {
      const owner =
        project.owner ||
        safeUsers.find((item) => item.id === project.owner_id) || null

      const ownerName = (owner?.full_name || '').toLowerCase()
      const ownerEmail = (owner?.email || '').toLowerCase()
      const ownerLogin = getOwnerLabel(owner).toLowerCase()

      return (
        (project.name || '').toLowerCase().includes(normalized) ||
        (project.description || '').toLowerCase().includes(normalized) ||
        ownerName.includes(normalized) ||
        ownerEmail.includes(normalized) ||
        ownerLogin.includes(normalized)
      )
    })
  }, [query, safeProjects, safeUsers])

  const filteredGroupedProjects = useMemo(() => {
    if (user?.role !== 'admin') return []

    const groups = {}

    for (const project of filteredProjects) {
      const ownerId = project.owner?.id ?? project.owner_id ?? 'unknown'
      const owner =
        project.owner ||
        safeUsers.find((item) => item.id === project.owner_id) || {
          id: ownerId,
          full_name: 'Неизвестный пользователь',
          email: '',
        }

      if (!groups[ownerId]) {
        groups[ownerId] = {
          owner,
          projects: [],
        }
      }

      groups[ownerId].projects.push(project)
    }

    return Object.values(groups).sort((a, b) => {
      const aName = getOwnerLabel(a.owner)
      const bName = getOwnerLabel(b.owner)
      return aName.localeCompare(bName, 'ru')
    })
  }, [filteredProjects, safeUsers, user?.role])

  function toggleFolder(ownerId) {
    setCollapsedFolders((prev) => ({
      ...prev,
      [ownerId]: !prev[ownerId],
    }))
  }

  function renderProjectItem(project) {
    return (
      <button
        key={project.id}
        type="button"
        className={`project-nav-item ${selectedProjectId === project.id ? 'selected' : ''}`}
        onClick={() => onSelectProject(project.id)}
      >
        <div className="project-nav-head">
          <strong>{project.name}</strong>
          <span className="project-type-badge">Проект</span>
        </div>

        <div className="project-nav-desc">
          {project.description || 'Описание проекта пока не заполнено.'}
        </div>

        <div className="project-nav-meta">
          <span>ID: {project.id}</span>
        </div>
      </button>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="brand-button" type="button" onClick={onOpenDashboard}>
          <div className="brand-mark">DP</div>
          <div>
            <div className="brand-title">Diploma Platform</div>
            <div className="muted small">Load testing workspace</div>
          </div>
        </button>

        <div className="user-panel card card--soft">
          <div className="user-avatar">{user?.full_name?.[0] || user?.email?.[0] || 'U'}</div>
          <div>
            <div className="user-name">{user?.full_name || user?.email}</div>
            <div className="muted small">
              {user?.role === 'admin' ? 'Администратор' : 'Студент'}
            </div>
          </div>
        </div>

        <div className="sidebar-actions">
          <button type="button" onClick={onCreateProject}>
            + Создать проект
          </button>
          <input
            type="text"
            placeholder="Поиск по пользователю или проекту..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="sidebar-projects">
        <div className="section-title">Проекты</div>

        {user?.role === 'admin' ? (
          filteredGroupedProjects.length === 0 ? (
            <div className="muted empty-box">Проекты пока не найдены.</div>
          ) : (
            filteredGroupedProjects.map((group) => {
              const ownerId = group.owner.id
              const isCollapsed = !!collapsedFolders[ownerId]
              const ownerLogin = getOwnerLabel(group.owner)
              const ownerEmail = group.owner.email || ''

              return (
                <div key={ownerId} className="project-folder">
                  <div className="project-folder-header">
                    <div className="project-folder-user-info">
                      <div className="project-folder-title">{ownerLogin}</div>
                      <div className="project-folder-subtitle">{ownerEmail}</div>
                    </div>

                    <button
                      type="button"
                      className="folder-toggle-button"
                      onClick={() => toggleFolder(ownerId)}
                    >
                      {isCollapsed ? 'Развернуть' : 'Скрыть'}
                    </button>
                  </div>

                  {!isCollapsed ? (
                    <div className="project-folder-items">
                      {group.projects.map((project) => renderProjectItem(project))}
                    </div>
                  ) : null}
                </div>
              )
            })
          )
        ) : filteredProjects.length === 0 ? (
          <div className="muted empty-box">Проекты пока не найдены.</div>
        ) : (
          filteredProjects.map((project) => renderProjectItem(project))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="button-secondary" type="button" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </aside>
  )
}