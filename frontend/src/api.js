import { buildApiError } from './utils/apiErrors'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })

  if (!response.ok) {
    throw await buildApiError(response)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function rawFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  }

  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })

  if (!response.ok) {
    throw await buildApiError(response)
  }

  return response
}

function getFileNameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1])
  }

  const simpleMatch = disposition.match(/filename="?([^";]+)"?/i)
  if (simpleMatch?.[1]) {
    return simpleMatch[1]
  }

  return fallback
}

export async function login(email, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function register(email, full_name, password) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, full_name, password }),
  })
}

export async function logout() {
  return apiFetch('/auth/logout', {
    method: 'POST',
  })
}

export async function getMe() {
  return apiFetch('/users/me')
}

export async function getUsers() {
  return apiFetch('/users')
}

export async function createUser(payload) {
  return apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateUser(userId, payload) {
  return apiFetch(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteUser(userId) {
  return apiFetch(`/users/${userId}`, {
    method: 'DELETE',
  })
}

export async function getProjects() {
  return apiFetch('/projects')
}

export async function getProject(projectId) {
  return apiFetch(`/projects/${projectId}`)
}

export async function createProject(payload) {
  return apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateProject(projectId, payload) {
  return apiFetch(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function getProjectAnalytics(projectId) {
  return apiFetch(`/projects/${projectId}/analytics`)
}

export async function getProjectTests(projectId) {
  return apiFetch(`/projects/${projectId}/tests`)
}

export async function createTest(projectId, payload) {
  return apiFetch(`/projects/${projectId}/tests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getTest(testId) {
  return apiFetch(`/tests/${testId}`)
}

export async function updateTest(testId, payload) {
  return apiFetch(`/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteTest(testId) {
  return apiFetch(`/tests/${testId}`, {
    method: 'DELETE',
  })
}

export async function getTestRuns(testId) {
  return apiFetch(`/tests/${testId}/runs`)
}

export async function createTestRun(testId, payload = {}) {
  return apiFetch(`/tests/${testId}/runs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getRun(runId) {
  return apiFetch(`/runs/${runId}`)
}

export async function deleteProject(projectId) {
  return apiFetch(`/projects/${projectId}`, {
    method: 'DELETE',
  })
}

export async function getSystemSettings() {
  return apiFetch('/admin/system-settings')
}

export async function updateSystemSettings(payload) {
  return apiFetch('/admin/system-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function getRuntimePolicy() {
  return apiFetch('/system/runtime-policy')
}

export async function getHealthStatus() {
  return rawFetch('/health').then((response) => response.json())
}

export async function downloadDatabaseBackup() {
  const response = await rawFetch('/admin/database-backup')
  const blob = await response.blob()
  const fileName = getFileNameFromDisposition(
    response.headers.get('Content-Disposition'),
    'резервная-копия-базы-данных.json',
  )

  return { blob, fileName }
}

export async function downloadAutomaticDatabaseBackup() {
  const response = await rawFetch('/admin/database-backup/automatic')
  const blob = await response.blob()
  const fileName = getFileNameFromDisposition(
    response.headers.get('Content-Disposition'),
    'автоматическая-резервная-копия-базы-данных.json',
  )

  return { blob, fileName }
}

export async function restoreDatabaseBackup(file) {
  const content = await file.text()
  return apiFetch('/admin/database-restore', {
    method: 'POST',
    body: JSON.stringify({
      file_name: file.name,
      content,
    }),
  })
}

export async function getMySupportConversations() {
  return apiFetch('/support/my/conversations')
}

export async function createMySupportConversation() {
  return apiFetch('/support/my/conversations', {
    method: 'POST',
  })
}

export async function getMySupportConversation(conversationId) {
  return apiFetch(`/support/my/conversations/${conversationId}`)
}

export async function sendMessageToSupport(conversationId, text) {
  return apiFetch(`/support/my/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function getSupportConversations() {
  return apiFetch('/support/conversations')
}

export async function getSupportConversation(conversationId) {
  return apiFetch(`/support/conversations/${conversationId}`)
}

export async function takeSupportConversation(conversationId) {
  return apiFetch(`/support/conversations/${conversationId}/take`, {
    method: 'PUT',
  })
}

export async function releaseSupportConversation(conversationId) {
  return apiFetch(`/support/conversations/${conversationId}/release`, {
    method: 'PUT',
  })
}

export async function sendSupportReply(conversationId, text) {
  return apiFetch(`/support/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function closeSupportConversation(conversationId) {
  return apiFetch(`/support/conversations/${conversationId}/close`, {
    method: 'PUT',
  })
}

export async function updateSupportConversationStatus(conversationId, status) {
  if (status === 'closed') {
    return closeSupportConversation(conversationId)
  }

  throw new Error('Повторное открытие закрытого чата не поддерживается. Пользователь должен создать новый чат.')
}
export async function requestPasswordReset(email) {
  return apiFetch('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function getActionLinkInfo(token) {
  return apiFetch(`/auth/action-links/${encodeURIComponent(token)}`)
}

export async function confirmEmailByToken(token) {
  return apiFetch(`/auth/verify-email/${encodeURIComponent(token)}`, {
    method: 'POST',
  })
}

export async function resetPasswordByToken(token, password) {
  return apiFetch(`/auth/password-reset/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export async function resendMyEmailVerification() {
  return apiFetch('/users/me/resend-email-verification', {
    method: 'POST',
  })
}

export async function requestMyEmailChange(new_email, current_password) {
  return apiFetch('/users/me/change-email', {
    method: 'POST',
    body: JSON.stringify({ new_email, current_password }),
  })
}

export async function sendMyPasswordResetEmail() {
  return apiFetch('/users/me/password-reset-email', {
    method: 'POST',
  })
}
