import { useEffect, useMemo, useState } from 'react'
import { getHealthStatus, getMe, getProjects, getUsers, logout } from './api'
import { applyUiSettings, loadUiSettings, saveUiSettings } from './utils/theme'

import Sidebar from './components/Sidebar'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ProjectPage from './pages/ProjectPage'
import TestPage from './pages/TestPage'
import AdminPage from './pages/AdminPage'
import SupportPage from './pages/SupportPage'
import ProfilePage from './pages/ProfilePage'
import PasswordRecoveryPage from './pages/PasswordRecoveryPage'
import EmailActionPage from './pages/EmailActionPage'

function readPublicPage() {
  const path = decodeURIComponent(window.location.pathname || '/')

  if (path.startsWith('/подтверждение-почты/')) {
    return {
      kind: 'email-action',
      token: path.replace('/подтверждение-почты/', ''),
    }
  }

  if (path.startsWith('/сброс-пароля/')) {
    return {
      kind: 'email-action',
      token: path.replace('/сброс-пароля/', ''),
    }
  }

  if (path === '/восстановление-пароля') {
    return { kind: 'password-recovery' }
  }

  return { kind: 'default' }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uiSettings, setUiSettings] = useState(() => loadUiSettings())
  const [technicalWorksMessage, setTechnicalWorksMessage] = useState('')
  const [technicalWorksOperation, setTechnicalWorksOperation] = useState('')
  const [publicPage, setPublicPage] = useState(() => readPublicPage())

  const [workspaceMode, setWorkspaceMode] = useState('dashboard')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedTestId, setSelectedTestId] = useState(null)

  useEffect(() => {
    applyUiSettings(uiSettings)
    saveUiSettings(uiSettings)
  }, [uiSettings])

  useEffect(() => {
    const handlePopState = () => setPublicPage(readPublicPage())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function setPublicPath(path) {
    window.history.pushState({}, '', path)
    setPublicPage(readPublicPage())
  }

  function resetPublicPath() {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
    }
    setPublicPage({ kind: 'default' })
  }

  async function refreshHealthStatus() {
    try {
      const data = await getHealthStatus()
      if (data.technical_works_active) {
        setTechnicalWorksMessage(data.technical_works_message || 'Сейчас идут технические работы. Платформа может работать нестабильно.')
        setTechnicalWorksOperation(data.technical_works_operation || '')
      } else {
        setTechnicalWorksMessage('')
        setTechnicalWorksOperation('')
      }
    } catch {
    }
  }

  async function loadData() {
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

      await refreshHealthStatus()
    } catch (err) {
      setUser(null)
      setProjects([])
      setUsers([])
      setTechnicalWorksMessage('')
      setTechnicalWorksOperation('')

      if (err?.status !== 401) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!user) return undefined

    refreshHealthStatus()
    const intervalId = window.setInterval(refreshHealthStatus, 10000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [user])

  async function handleAuthSuccess() {
    resetPublicPath()
    await loadData()
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
    }

    resetPublicPath()
    setUser(null)
    setProjects([])
    setUsers([])
    setSelectedProjectId(null)
    setSelectedTestId(null)
    setWorkspaceMode('dashboard')
    setTechnicalWorksMessage('')
    setTechnicalWorksOperation('')
  }

  function openDashboard() {
    setSelectedProjectId(null)
    setSelectedTestId(null)
    setWorkspaceMode('dashboard')
  }

  function openAdmin() {
    setSelectedProjectId(null)
    setSelectedTestId(null)
    setWorkspaceMode('admin')
  }

  function openSupport() {
    setSelectedProjectId(null)
    setSelectedTestId(null)
    setWorkspaceMode('support')
  }

  function openProfile() {
    setSelectedProjectId(null)
    setSelectedTestId(null)
    setWorkspaceMode('profile')
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

  if (publicPage.kind === 'email-action') {
    return (
      <EmailActionPage
        token={publicPage.token}
        onBackToAuth={!user ? resetPublicPath : null}
        onBackToApp={user ? resetPublicPath : null}
      />
    )
  }

  if (!user) {
    if (publicPage.kind === 'password-recovery') {
      return <PasswordRecoveryPage onBack={resetPublicPath} />
    }

    return <AuthPage onAuthSuccess={handleAuthSuccess} error={error} onOpenPasswordRecovery={() => setPublicPath('/восстановление-пароля')} />
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        users={users}
        projects={projects}
        selectedProjectId={selectedProjectId}
        selectedTestId={selectedTestId}
        onSelectProject={openProject}
        onSelectTest={openTest}
        onCreateProject={openCreateProject}
        onOpenDashboard={openDashboard}
        onOpenAdmin={openAdmin}
        onOpenSupport={openSupport}
        onOpenProfile={openProfile}
        onLogout={handleLogout}
        uiSettings={uiSettings}
        onChangeTheme={(theme) => setUiSettings((prev) => ({ ...prev, theme }))}
        onChangePalette={(palette) => setUiSettings((prev) => ({ ...prev, palette }))}
      />

      <main className="workspace">
        {technicalWorksMessage ? (
          <section className="technical-works-banner">
            <strong>Технические работы.</strong> {technicalWorksMessage}
            {technicalWorksOperation ? <div className="muted small">Текущая операция: {technicalWorksOperation}.</div> : null}
          </section>
        ) : null}

        {workspaceMode === 'dashboard' && (
          <DashboardPage
            projects={projects}
            onCreateProject={openCreateProject}
            onOpenProject={openProject}
            onOpenTest={openTest}
            user={user}
          />
        )}

        {workspaceMode === 'profile' && (
          <ProfilePage
            user={user}
            onBack={openDashboard}
            onRefreshUser={loadData}
          />
        )}

        {workspaceMode === 'admin' && user.role === 'admin' ? (
          <AdminPage
            currentUser={user}
            users={users}
            projects={projects}
            onDataChanged={loadData}
            onOpenProject={openProject}
            onOpenTest={openTest}
            onBack={openDashboard}
            onRefreshHealthStatus={refreshHealthStatus}
          />
        ) : null}
        {workspaceMode === 'support' && (
          <SupportPage
            user={user}
            onBack={openDashboard}
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
            onBack={openDashboard}
          />
        )}

        {workspaceMode === 'project' && selectedProject && (
          <ProjectPage
            mode="edit"
            projectId={selectedProject.id}
            onProjectUpdated={loadData}
            onProjectDeleted={async () => {
              await loadData()
              openDashboard()
            }}
            onOpenTest={openTest}
            onBack={openDashboard}
          />
        )}

        {workspaceMode === 'test' && selectedTestId ? (
          <TestPage
            testId={selectedTestId}
            onBack={() => {
              if (selectedProjectId) {
                openProject(selectedProjectId)
                return
              }
              openDashboard()
            }}
          />
        ) : null}
      </main>
    </div>
  )
}
