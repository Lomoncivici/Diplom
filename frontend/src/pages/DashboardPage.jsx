import ProjectTreeExplorer from '../components/ProjectTreeExplorer'

function getRoleLabel(role) {
  return role === 'admin' ? 'Администратор' : 'Пользователь'
}

export default function DashboardPage({ projects, onCreateProject, onOpenProject, onOpenTest, user }) {
  const totalTests = projects.reduce((sum, project) => sum + (project.tests_count || 0), 0)
  const totalComponents = projects.reduce((sum, project) => sum + (project.components_count || 0), 0)
  const totalIntegrations = projects.reduce((sum, project) => sum + (project.external_integrations_count || 0), 0)

  return (
    <div className="workspace-page">
      <section className="page-header">
        <div>
          <h1>Добро пожаловать, {user?.full_name || 'пользователь'}</h1>
          <p className="muted">
            Это рабочее пространство платформы нагрузочного тестирования и мониторинга.
            Управляйте тестируемыми системами, их структурой, нагрузочными тестами и результатами из одного интерфейса.
          </p>
        </div>

        <div className="header-actions">
          <button onClick={onCreateProject}>Добавить систему</button>
        </div>
      </section>

      <section className="stats-grid stats-grid--four">
        <article className="card stat-card">
          <div className="muted">Систем</div>
          <div className="stat-value">{projects.length}</div>
        </article>
        <article className="card stat-card">
          <div className="muted">Элементов структуры</div>
          <div className="stat-value">{totalComponents}</div>
        </article>
        <article className="card stat-card">
          <div className="muted">Внешних интеграций</div>
          <div className="stat-value">{totalIntegrations}</div>
        </article>
        <article className="card stat-card">
          <div className="muted">Нагрузочных тестов</div>
          <div className="stat-value">{totalTests}</div>
        </article>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Тестируемые системы и тесты</h2>
            <p className="muted">
              Здесь можно найти нужную внешнюю систему, открыть её карточку, проверить структуру и перейти к нагрузочным тестам.
            </p>
          </div>
          <div className="muted small">Роль: {getRoleLabel(user?.role)}</div>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>Систем пока нет</h3>
            <p className="muted">Создайте первую карточку тестируемой системы, опишите её структуру и добавьте тесты.</p>
            <button onClick={onCreateProject}>Создать систему</button>
          </div>
        ) : (
          <ProjectTreeExplorer
            projects={projects}
            onOpenProject={onOpenProject}
            onOpenTest={onOpenTest}
            emptyTitle="Ничего не найдено"
            emptyText="Попробуйте изменить строку поиска или откройте другую систему."
          />
        )}
      </section>
    </div>
  )
}
