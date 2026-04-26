import { useState } from 'react'

export default function FormGuide({ title = 'Справка', items = [], defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!items.length) return null

  return (
    <section className="card card--soft form-guide">
      <div className="section-head form-guide__head">
        <div>
          <h2>{title}</h2>
          <p className="muted small">Краткие подсказки по текущей странице.</p>
        </div>
        <button
          type="button"
          className="button-secondary form-guide__toggle"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? 'Скрыть справку' : 'Показать справку'}
        </button>
      </div>

      {isOpen ? (
        <div className="form-guide__list">
          {items.map((item) => (
            <div key={item.label} className="form-guide__item">
              <strong>{item.label}</strong>
              <p className="muted">{item.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
