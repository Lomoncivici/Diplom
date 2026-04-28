# Платформа нагрузочного тестирования и мониторинга

Проект представляет собой веб-платформу для настройки, запуска и анализа нагрузочных тестов внешних систем: сайтов, API, веб-приложений и распределённых микросервисных решений.

## Что реализовано на текущем этапе
- управление пользователями и ролями;
- карточки тестируемых систем;
- хранение базовой информации о системе: тип, базовый адрес, среда и ответственный;
- описание структуры тестируемой системы: внутренние компоненты и внешние интеграции;
- создание нагрузочных тестов и просмотр результатов запусков;
- аналитика, логи, резервные копии и техническая поддержка.

## Основные маршруты backend
- `POST /api/auth/register` — регистрация;
- `POST /api/auth/login` — вход;
- `GET /api/users/me` — текущий пользователь;
- `GET /api/users` — список пользователей;
- `GET /api/projects` — список тестируемых систем;
- `POST /api/projects` — создать карточку тестируемой системы;
- `GET /api/projects/{id}` — получить карточку тестируемой системы;
- `GET /api/projects/{id}/components` — список компонентов и интеграций тестируемой системы;
- `POST /api/projects/{id}/components` — добавить компонент или внешнюю интеграцию;
- `GET /api/health` — проверка состояния платформы.

## После запуска
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

## Обновление контейнеров
- всего:
  `docker compose up --build`
- только backend:
  `docker compose build backend`
  `docker compose up backend`
- только frontend:
  `docker compose build frontend`
  `docker compose up frontend`
