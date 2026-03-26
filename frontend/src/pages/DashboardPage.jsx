export default function DashboardPage({ projects, onCreateProject, onOpenProject, user }) {
  const totalTests = projects.reduce((sum, project) => sum + (project.tests_count || 0), 0)

  return (
    <div className="workspace-page">
      <section className="page-header">
        <div>
          <h1>Добро пожаловать, {user?.full_name || 'пользователь'}</h1>
          <p className="muted">
            Это рабочее пространство платформы нагрузочного тестирования. Управляй проектами и
            переходи к тестам из одного места.
          </p>
        </div>

        <div className="header-actions">
          <button onClick={onCreateProject}>Создать проект</button>
        </div>
      </section>

      <section className="stats-grid">
        <article className="card stat-card">
          <div className="muted">Проектов</div>
          <div className="stat-value">{projects.length}</div>
        </article>
        <article className="card stat-card">
          <div className="muted">Тестов</div>
          <div className="stat-value">{totalTests}</div>
        </article>
        <article className="card stat-card">
          <div className="muted">Роль</div>
          <div className="stat-value stat-value--small">{user?.role || 'student'}</div>
        </article>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Проекты</h2>
            <p className="muted">Выбери проект, чтобы перейти к списку тестов и настройкам.</p>
          </div>
          <button className="button-secondary" onClick={onCreateProject}>
            Новый проект
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>Проектов пока нет</h3>
            <p className="muted">Создай первый проект и добавь в него тесты нагрузки.</p>
            <button onClick={onCreateProject}>Создать первый проект</button>
          </div>
        ) : (
          <div className="list">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-card__content">
                  <h3>{project.name}</h3>
                  <p>{project.description || 'Без описания'}</p>
                </div>
                <div className="project-card__actions">
                  <button onClick={() => onOpenProject(project.id)}>Открыть</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
