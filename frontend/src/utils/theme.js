export const themeOptions = [
  { value: 'dark', label: 'Тёмная тема' },
  { value: 'light', label: 'Светлая тема' },
]

export const paletteOptions = [
  { value: 'blue', label: 'Синяя палитра' },
  { value: 'green', label: 'Зелёная палитра' },
  { value: 'violet', label: 'Фиолетовая палитра' },
  { value: 'amber', label: 'Янтарная палитра' },
]

const STORAGE_KEY = 'platform-ui-settings'

export function loadUiSettings() {
  if (typeof window === 'undefined') {
    return { theme: 'dark', palette: 'blue' }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { theme: 'dark', palette: 'blue' }
    }

    const parsed = JSON.parse(raw)
    return {
      theme: parsed?.theme === 'light' ? 'light' : 'dark',
      palette: ['blue', 'green', 'violet', 'amber'].includes(parsed?.palette) ? parsed.palette : 'blue',
    }
  } catch {
    return { theme: 'dark', palette: 'blue' }
  }
}

export function saveUiSettings(settings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function applyUiSettings(settings) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = settings.theme
  document.documentElement.dataset.palette = settings.palette
}
