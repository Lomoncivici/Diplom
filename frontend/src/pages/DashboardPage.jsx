import { useState } from 'react'
import { createProject } from '../api'

export default function DashboardPage({ projects, onProjectCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await createProject(name, description)
      setName('')
      setDescription('')
      onProjectCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content-grid">
      <section className="card">
        <h2>Мои проекты</h2>
        {projects.length === 0 ? (
          <p className="muted">Пока проектов нет. Создай первый проект ниже.</p>
        ) : (
          <div className="list">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <h3>{project.name}</h3>
                <p>{project.description || 'Без описания'}</p>
                <span className="muted">ID владельца: {project.owner_id}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Создать проект</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Название проекта
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Описание
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="5" />
          </label>
          {error ? <div className="error">{error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? 'Сохраняю...' : 'Создать проект'}
          </button>
        </form>
      </section>
    </div>
  )
}
