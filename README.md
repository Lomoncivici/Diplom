### Backend API
- `POST /api/auth/register` — регистрация;
- `POST /api/auth/login` — вход;
- `GET /api/users/me` — текущий пользователь;
- `GET /api/users` — список пользователей (только admin);
- `GET /api/projects` — список проектов;
- `POST /api/projects` — создать проект;
- `GET /api/projects/{id}` — получить проект;
- `GET /api/health` — проверка состояния.

После запуска:
- frontend: `http://localhost:8080`
- backend docs: `http://localhost:8000/docs`
- api health: `http://localhost:8000/api/health`

```sql
UPDATE users SET role = 'admin' WHERE email = 'your_email@example.com';
```

## Структура проекта
```text
diploma-platform-starter/
  backend/
  frontend/
  docker-compose.yml
  .env.example
  README.md
```

## обновление контейнера
- всего: 
  docker compose up --build
- только бек:
  docker compose build backend
  docker compose up
- только фронт:
  docker compose build frontend
  docker compose up