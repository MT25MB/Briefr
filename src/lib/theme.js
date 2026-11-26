// Theme preference is global (not account-scoped) and intentionally simple.
const THEME_KEY = 'briefr_theme'
export const THEMES = ['system', 'light', 'dark']

export function readTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return THEMES.includes(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(value) {
  try {
    localStorage.setItem(THEME_KEY, value)
  } catch {
    // Theme still works for this session.
  }
}

export function prefersDark() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

export function applyTheme(preference) {
  const dark = preference === 'dark' || (preference === 'system' && prefersDark())
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  return dark ? 'dark' : 'light'
}
