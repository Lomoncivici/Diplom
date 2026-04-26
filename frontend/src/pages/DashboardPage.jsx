import FormGuide from '../components/FormGuide'
import ProjectTreeExplorer from '../components/ProjectTreeExplorer'

const dashboardGuideItems = [
  {
    label: 'Рабочий стол',
    text: 'Здесь собраны ваши проекты, тесты и быстрые переходы к основным действиям платформы.',
  },
  {
    label: 'Проекты и тесты',
    text: 'В дереве можно открыть проект, перейти к нужному тесту и быстро найти материалы по названию или описанию.',
  },
  {
    label: 'Роль пользователя',
    text: 'Если у вас роль администратора, дополнительные разделы доступны через боковую панель: панель администратора и чаты поддержки.',
  },
]

function getRoleLabel(role) {
  return role === 'admin' ? 'Администратор' : 'Студент'
}

export default function DashboardPage({ projects, onCreateProject, onOpenProject, onOpenTest, user }) {
  const totalTests = projects.reduce((sum, project) => sum + (project.tests_count || 0), 0)

  return (
    <div className="workspace-page">
      <section className="page-header">
        <div>
          <h1>Добро пожаловать, {user?.full_name || 'пользователь'}</h1>
          <p className="muted">
            Это рабочее пространство платформы нагрузочного тестирования. Управляйте проектами и
            переходите к тестам из одного места.
          </p>
        </div>

        <div className="header-actions">
          <button onClick={onCreateProject}>Создать проект</button>
        </div>
      </section>

      <FormGuide title="Справка по рабочему столу" items={dashboardGuideItems} />

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
          <div className="stat-value stat-value--small">{getRoleLabel(user?.role)}</div>
        </article>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Проекты и тесты</h2>
            <p className="muted">
              Здесь можно найти нужный проект, посмотреть привязанные тесты и быстро перейти к ним.
            </p>
          </div>
          <button className="button-secondary" onClick={onCreateProject}>
            Новый проект
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>Проектов пока нет</h3>
            <p className="muted">Создайте первый проект и добавьте в него тесты нагрузки.</p>
            <button onClick={onCreateProject}>Создать первый проект</button>
          </div>
        ) : (
          <ProjectTreeExplorer
            projects={projects}
            onOpenProject={onOpenProject}
            onOpenTest={onOpenTest}
            emptyTitle="Ничего не найдено"
            emptyText="Попробуйте изменить строку поиска или откройте другой проект."
          />
        )}
      </section>
    </div>
  )
}
