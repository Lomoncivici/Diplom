const MESSAGE_TRANSLATIONS = [
  ['value is not a valid email address', 'Введите корректный адрес электронной почты.'],
  ['field required', 'Поле обязательно для заполнения.'],
  ['string too short', 'Слишком короткое значение.'],
  ['string too long', 'Слишком длинное значение.'],
  ['Input should be a valid dictionary', 'Нужно указать объект в формате данных запроса.'],
  ['Input should be a valid integer', 'Нужно указать целое число.'],
  ['Input should be a valid boolean', 'Нужно выбрать корректное логическое значение.'],
  ['Password must be at least 8 characters long', 'Пароль должен быть не короче 8 символов.'],
  ['Password must be at most 128 characters long', 'Пароль должен быть не длиннее 128 символов.'],
  ['Password must not start or end with spaces', 'Пароль не должен начинаться или заканчиваться пробелом.'],
  ['Password must contain a lowercase letter', 'Пароль должен содержать хотя бы одну строчную букву.'],
  ['Password must contain an uppercase letter', 'Пароль должен содержать хотя бы одну заглавную букву.'],
  ['Password must contain a digit', 'Пароль должен содержать хотя бы одну цифру.'],
  ['User with this email already exists', 'Пользователь с таким адресом уже существует.'],
  ['Invalid email or password', 'Неверный адрес или пароль.'],
  ['User account is inactive', 'Учётная запись пользователя отключена.'],
  ['Admin access required', 'Требуются права администратора.'],
  ['Admin cannot remove own admin role', 'Администратор не может снять роль администратора у самого себя.'],
  ['Admin cannot deactivate own account', 'Администратор не может отключить свой аккаунт.'],
  ['Admin cannot delete own account', 'Администратор не может удалить свой аккаунт.'],
  ['Only http and https targets are allowed', 'Разрешены только адреса с протоколами http и https.'],
  ['Target URL is invalid', 'Указан некорректный адрес сервиса.'],
  ['Target URL is required', 'Укажите адрес сервиса.'],
  ['Target URL must include a valid http or https hostname', 'Адрес сервиса должен содержать корректный сетевой адрес.'],
  ['Embedded credentials in target URLs are not allowed', 'В адресе сервиса нельзя передавать логин и пароль.'],
  ['Requests to localhost, private or reserved network addresses are blocked.', 'Запросы на локальные, приватные и служебные адреса запрещены.'],
  ['Port must contain only digits', 'Порт должен содержать только цифры.'],
  ['Port must be between 1 and 65535', 'Порт должен быть в диапазоне от 1 до 65535.'],
  ['Duration must end with ms, s, m or h', 'Длительность должна оканчиваться на мс, с, м или ч.'],
  ['Ramp up must end with ms, s, m or h', 'Плавный запуск должен оканчиваться на мс, с, м или ч.'],
  ['Ramp down must end with ms, s, m or h', 'Плавное завершение должно оканчиваться на мс, с, м или ч.'],
  ['Timeout must end with ms, s, m or h', 'Тайм-аут должен оканчиваться на мс, с, м или ч.'],
  ['contains an invalid number', 'содержит некорректное число.'],
  ['must be greater than zero', 'должно быть больше нуля.'],
  ['is too large', 'значение слишком большое.'],
  ['Unsupported request method', 'Неподдерживаемый метод запроса.'],
  ['Status code must be between 100 and 599', 'Ожидаемый код ответа должен быть в диапазоне от 100 до 599.'],
  ['contains too many items', 'содержит слишком много элементов.'],
  ['contains too many keys', 'содержит слишком много ключей.'],
  ['contains a non-JSON value', 'содержит значение, которое не относится к допустимому формату данных.'],
  ['Header name must not be empty', 'Имя заголовка не должно быть пустым.'],
  ['Invalid header name', 'Некорректное имя заголовка.'],
  ['contains an invalid value', 'содержит недопустимое значение.'],
  ['managed by the HTTP client and cannot be overridden', 'управляется клиентом запроса и не может быть переопределён.'],
  ['Could not validate credentials', 'Не удалось проверить данные входа.'],
  ['Project not found', 'Проект не найден.'],
  ['Test not found', 'Тест не найден.'],
  ['Run not found', 'Запуск не найден.'],
  ['User not found', 'Пользователь не найден.'],
  ['Access denied', 'Доступ запрещён.'],
  ['Failed to execute test run', 'Не удалось выполнить запуск теста.'],
]

const FIELD_LABELS = {
  email: 'Адрес электронной почты',
  full_name: 'Фамилия, имя и отчество',
  password: 'Пароль',
  role: 'Роль',
  is_active: 'Статус',
  name: 'Название',
  description: 'Описание',
  goal: 'Цель',
  target_entity: 'Что тестируется',
  target_url: 'Адрес сервиса',
  target_port: 'Порт сервиса',
  virtual_users: 'Виртуальные пользователи',
  repeat_count: 'Количество повторов',
  ramp_up: 'Плавный запуск',
  ramp_down: 'Плавное завершение',
  duration: 'Длительность',
  timeout: 'Тайм-аут',
  request_method: 'Метод запроса',
  request_path: 'Путь запроса',
  expected_status_code: 'Ожидаемый код ответа',
  request_headers: 'Заголовки запроса',
  query_params: 'Параметры запроса',
  request_body: 'Тело запроса',
  script_content: 'Сценарий теста',
}

function translateMessage(message) {
  if (!message) return 'Не удалось выполнить запрос.'

  let result = String(message)
  for (const [source, target] of MESSAGE_TRANSLATIONS) {
    result = result.replace(source, target)
  }
  return result
}

function humanizeFieldName(field) {
  return FIELD_LABELS[field] || field
}

function appendFieldError(fieldErrors, field, message) {
  if (!field || !message) return
  if (!fieldErrors[field]) {
    fieldErrors[field] = []
  }
  if (!fieldErrors[field].includes(message)) {
    fieldErrors[field].push(message)
  }
}

function flattenFieldErrors(fieldErrors) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, messages.join(' ')]),
  )
}

function normalizeFastApiValidation(detail) {
  const fieldErrors = {}

  for (const issue of detail) {
    const path = Array.isArray(issue?.loc) ? issue.loc.filter((part) => part !== 'body') : []
    const field = path.length ? String(path[path.length - 1]) : 'form'
    let message = translateMessage(issue?.msg || 'Некорректное значение.')

    if (field !== 'form' && !message.includes(humanizeFieldName(field))) {
      const lower = message.toLowerCase()
      if (!lower.startsWith('поле ') && !lower.startsWith(humanizeFieldName(field).toLowerCase())) {
        message = `${humanizeFieldName(field)}: ${message}`
      }
    }

    appendFieldError(fieldErrors, field, message)
  }

  const normalizedFields = flattenFieldErrors(fieldErrors)
  const formMessage = normalizedFields.form || 'Проверьте заполнение полей формы.'

  return {
    message: formMessage,
    fieldErrors: normalizedFields,
  }
}

function normalizeErrorPayload(payload) {
  if (!payload) {
    return { message: 'Не удалось выполнить запрос.', fieldErrors: {} }
  }

  if (Array.isArray(payload.detail)) {
    return normalizeFastApiValidation(payload.detail)
  }

  if (typeof payload.detail === 'string') {
    return { message: translateMessage(payload.detail), fieldErrors: {} }
  }

  if (payload.detail && typeof payload.detail === 'object') {
    const fieldErrors = {}

    if (payload.detail.fieldErrors && typeof payload.detail.fieldErrors === 'object') {
      for (const [field, value] of Object.entries(payload.detail.fieldErrors)) {
        appendFieldError(fieldErrors, field, translateMessage(value))
      }
    }

    if (payload.detail.message) {
      return {
        message: translateMessage(payload.detail.message),
        fieldErrors: flattenFieldErrors(fieldErrors),
      }
    }
  }

  if (typeof payload.message === 'string') {
    return { message: translateMessage(payload.message), fieldErrors: {} }
  }

  return { message: 'Не удалось выполнить запрос.', fieldErrors: {} }
}

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status || 0
    this.fieldErrors = options.fieldErrors || {}
    this.raw = options.raw
  }
}

export async function buildApiError(response) {
  let payload = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const normalized = normalizeErrorPayload(payload)
  return new ApiError(normalized.message, {
    status: response.status,
    fieldErrors: normalized.fieldErrors,
    raw: payload,
  })
}

export function getErrorMessage(error, fallback = 'Не удалось выполнить запрос.') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message.trim()) return error.message
  return fallback
}

export function getFieldErrors(error) {
  if (!error || typeof error !== 'object' || !error.fieldErrors) {
    return {}
  }
  return error.fieldErrors
}

export function createClientFieldError(message, fieldErrors = {}) {
  return new ApiError(message, { fieldErrors })
}
