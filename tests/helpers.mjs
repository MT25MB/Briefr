// Shared browser-ish environment for Node's built-in test runner.
const store = new Map()

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (index) => [...store.keys()][index] ?? null,
  get length() {
    return store.size
  },
}

globalThis.window = {
  location: {
    search: '',
    origin: 'https://briefr.app',
    pathname: '/',
    history: { replaceState() {} },
    assign() {},
  },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
}

export function resetStorage() {
  store.clear()
}
