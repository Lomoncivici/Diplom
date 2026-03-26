import { useEffect, useMemo, useState } from 'react'
import { clearToken, getMe, getProjects, getToken, getUsers } from './api'

import Sidebar from './components/Sidebar'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ProjectPage from './pages/ProjectPage'
import TestPage from './pages/TestPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  const [user, setUser] = useState(null)
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [workspaceMode, setWorkspaceMode] = useState('dashboard')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedTestId, setSelectedTestId] = useState(null)

  async function loadData() {
    if (!getToken()) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const me = await getMe()
      const projectList = await getProjects()

      setUser(me)
      setProjects(projectList)

      if (me.role === 'admin') {
        setUsers(await getUsers())
      } else {
        setUsers([])
      }
    } catch (err) {
      clearToken()
      setUser(null)
      setProjects([])
      setUsers([])
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleAuthSuccess(token) {
    localStorage.setItem('token', token)
    loadData()
  }

  function handleLogout() {
    clearToken()
    setUser(null)
    setProjects([])
    setUsers([])
    setSelectedProjectId(null)
    setSelectedTestId(null)
    setWorkspaceMode('dashboard')
  }

  function openDashboard() {
    setSelectedProjectId(null)
    setSelectedTestId(null)
    setWorkspaceMode('dashboard')
  }

  function openCreateProject() {
    setSelectedProjectId(null)
    setSelectedTestId(null)
    setWorkspaceMode('create-project')
  }

  function openProject(projectId) {
    setSelectedProjectId(projectId)
    setSelectedTestId(null)
    setWorkspaceMode('project')
  }

  function openTest(testId) {
    setSelectedTestId(testId)
    setWorkspaceMode('test')
  }

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  )

  if (loading) {
    return <div className="loading-screen">Загрузка...</div>
  }

  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} error={error} />
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        users={users}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={openProject}
        onCreateProject={openCreateProject}
        onOpenDashboard={openDashboard}
        onLogout={handleLogout}
      />

      <main className="workspace">
        {workspaceMode === 'dashboard' && (
          <DashboardPage
            projects={projects}
            onCreateProject={openCreateProject}
            onOpenProject={openProject}
            user={user}
          />
        )}

        {workspaceMode === 'create-project' && (
          <ProjectPage
            mode="create"
            projectId={null}
            onProjectCreated={async (projectId) => {
              await loadData()
              openProject(projectId)
            }}
            onOpenTest={openTest}
          />
        )}

        {workspaceMode === 'project' && selectedProject && (
          <div className="workspace-stack">
            <ProjectPage
              mode="edit"
              projectId={selectedProject.id}
              onProjectUpdated={loadData}
              onProjectDeleted={async () => {
                await loadData()
                openDashboard()
              }}
              onOpenTest={openTest}
            />
            {user.role === 'admin' ? <AdminPage users={users} projects={projects} /> : null}
          </div>
        )}

        {workspaceMode === 'test' && selectedTestId ? <TestPage testId={selectedTestId} /> : null}
      </main>
    </div>
  )
}