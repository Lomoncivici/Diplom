function getRoleLabel(role) {
  return role === 'admin' ? 'Администратор' : 'Студент'
}

export default function Layout({ user, onLogout, children }) {
  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Платформа нагрузочного тестирования</h1>
          <p className="muted">Стартовая версия дипломного проекта</p>
        </div>
        {user ? (
          <div className="user-box">
            <div>
              <strong>{user.full_name}</strong>
              <div className="muted">{getRoleLabel(user.role)}</div>
            </div>
            <button onClick={onLogout}>Выйти</button>
          </div>
        ) : null}
      </header>
      {children}
    </div>
  )
}
