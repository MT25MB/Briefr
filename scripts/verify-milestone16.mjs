import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function filesIn(dir, extensions = ['.js', '.jsx', '.mjs', '.html']) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory()
      ? filesIn(path, extensions)
      : extensions.some((extension) => name.endsWith(extension))
        ? [path]
        : []
  })
}

const read = (path) => readFileSync(path, 'utf8')
const codeFiles = [
  ...filesIn('src'),
  ...filesIn('api'),
  ...filesIn('functions'),
  'index.html',
  'vite.config.js',
]
const allCode = codeFiles.map((path) => ({ path, text: read(path) }))

// --- Security: no secrets, no raw HTML sinks, safe outbound links ------------
const forbiddenSinks = /dangerouslySetInnerHTML|\binnerHTML\b|document\.write|\beval\s*\(/
for (const { path, text } of allCode) {
  assert.doesNotMatch(text, forbiddenSinks, `${path} must not use a raw HTML sink`)
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bAKIA[A-Z0-9]{12,}/,
  /\bntnc_[A-Za-z0-9]{16,}/,
  /service_role/i,
  /client_secret\s*[:=]\s*['"][^'"]+['"]/i,
]
for (const { path, text } of allCode) {
  secretPatterns.forEach((pattern) => {
    assert.doesNotMatch(text, pattern, `${path} contains a secret-like literal`)
  })
}

for (const { path, text } of allCode) {
  const normalized = path.replaceAll('\\', '/')
  if (normalized === 'src/lib/auth.js' || normalized.endsWith('.html')) continue
  assert.doesNotMatch(text, /VITE_/, `${path} must not reference VITE_* values`)
}
const env = read('.env.example')
const envAssignments = env
  .split(/\r?\n/)
  .filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line))
  .join('\n')
assert.match(envAssignments, /VITE_SUPABASE_URL=/)
assert.match(envAssignments, /VITE_SUPABASE_ANON_KEY=/)
assert.doesNotMatch(envAssignments, /SERVICE_ROLE|API_KEY|TOKEN|SECRET/i)
assert.match(env, /localStorage/)
assert.match(env, /\/api\/rss/)
assert.match(env, /\/api\/ics/)

for (const { path, text } of allCode) {
  const blankLinks = (text.match(/target="_blank"/g) ?? []).length
  const safeRels = (text.match(/rel="noopener noreferrer"/g) ?? []).length
  assert.equal(blankLinks, safeRels, `${path} has ${blankLinks} external links and ${safeRels} safe rels`)
}
assert.match(read('src/lib/rssService.js'), /safeHref\(item\.link\)/)
assert.match(read('src/components/NewsFeedCard.jsx'), /safeHref\(story\.url\)/)
assert.match(read('api/icsShared.js'), /validateIcsUrl/)
assert.match(read('api/rssShared.js'), /validateFeedUrl/)

// --- Accessibility: labels, roles, focus, and viewport ----------------------
const html = read('index.html')
assert.match(html, /name="viewport" content="width=device-width/)
const css = read('src/index.css')
assert.match(css, /:focus-visible\s*\{[^}]*outline:/)
assert.match(read('src/components/Modal.jsx'), /role="dialog"/)
assert.match(read('src/components/Modal.jsx'), /aria-modal="true"/)
assert.match(read('src/components/Modal.jsx'), /aria-label=\{label\}/)
assert.match(read('src/components/TriageCard.jsx'), /role="tablist" aria-label="Inbox groups"/)
assert.match(read('src/components/TriageCard.jsx'), /role="tabpanel"/)
assert.match(read('src/components/NewsFeedCard.jsx'), /aria-label=\{`News lens:/)
assert.match(read('src/components/LocationSearch.jsx'), /aria-label/)
assert.match(read('src/App.jsx'), /lg:grid-cols-3/)

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16))
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}
function token(name, scope = 'light') {
  const source = scope === 'dark' ? css.slice(css.indexOf("[data-theme='dark']")) : css
  const match = source.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  assert.ok(match, `${scope} --${name} is defined`)
  return match[1]
}

const pairs = [
  ['light ink/paper', token('ink'), token('paper'), 7],
  ['light muted/surface', token('muted'), token('surface'), 4.5],
  ['light indigo/paper', token('accent'), token('paper'), 4.5],
  ['white/indigo action', '#ffffff', token('accent-action'), 4.5],
  ['dark ink/paper', token('ink', 'dark'), token('paper', 'dark'), 7],
  ['dark muted/surface', token('muted', 'dark'), token('surface', 'dark'), 4.5],
  ['dark indigo/surface', token('accent', 'dark'), token('surface', 'dark'), 4.5],
  ['white/dark indigo action', '#ffffff', token('accent-action', 'dark'), 4.5],
]
pairs.forEach(([label, foreground, background, minimum]) => {
  const ratio = contrast(foreground, background)
  assert.ok(ratio >= minimum, `${label} contrast ${ratio.toFixed(2)} is below ${minimum}`)
})

console.log('Milestone 16 verified: no secret sinks or hardcoded keys, safe links, labels, focus, contrast and viewport.')
