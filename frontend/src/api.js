const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export function getToken() {
  return localStorage.getItem('token')
}

export function setToken(token) {
  localStorage.setItem('token', token)
}

export function clearToken() {
  localStorage.removeItem('token')
}

export async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = 'Request failed'
    try {
      const data = await response.json()
      message = data.detail || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
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

export async function getMe() {
  return apiFetch('/users/me')
}

export async function getUsers() {
  return apiFetch('/users')
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