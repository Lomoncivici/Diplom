export default function AdminPage({ users, projects }) {
  return (
    <div className="content-grid admin-grid">
      <section className="card">
        <h2>Пользователи</h2>
        {users.length === 0 ? (
          <p className="muted">Пользователи не найдены.</p>
        ) : (
          <div className="list">
            {users.map((user) => (
              <article className="project-card" key={user.id}>
                <h3>{user.full_name}</h3>
                <p>{user.email}</p>
                <span className="muted">Роль: {user.role}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Все проекты</h2>
        {projects.length === 0 ? (
          <p className="muted">Проекты не найдены.</p>
        ) : (
          <div className="list">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <h3>{project.name}</h3>
                <p>{project.description || 'Без описания'}</p>
                <span className="muted">Владелец: {project.owner_id}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
