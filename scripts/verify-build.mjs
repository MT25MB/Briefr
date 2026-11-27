import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

function filesIn(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesIn(path) : [path]
  })
}

const root = process.cwd()
const required = [
  'dist/index.html',
  'dist/favicon.svg',
  'dist/_headers',
  'functions/api/rss.js',
  'functions/api/ics.js',
  'api/rssShared.js',
  'api/icsShared.js',
]
const forbidden = ['dist/functions', 'dist/api']

const html = existsSync(resolve(root, 'dist/index.html'))
  ? readFileSync(resolve(root, 'dist/index.html'), 'utf8')
  : ''
const problems = []
required.forEach((file) => {
  if (!existsSync(resolve(root, file))) problems.push(`Missing ${file}`)
})
forbidden.forEach((file) => {
  if (existsSync(resolve(root, file))) problems.push(`Unexpected build output ${file}`)
})
if (!html.includes('/favicon.svg')) problems.push('index.html does not reference the favicon')

const distFiles = filesIn(resolve(root, 'dist')).map((file) => file.replaceAll('\\', '/'))
const unexpectedDist = distFiles.filter((file) => /\.(ts|tsx|map)$/.test(file) || file.includes('vite.config'))
if (unexpectedDist.length) problems.push(`Unexpected build artifacts: ${unexpectedDist.join(', ')}`)
const assets = distFiles.filter((file) => file.includes('/assets/'))
if (!assets.some((file) => file.endsWith('.js'))) problems.push('dist has no hashed JavaScript asset')
if (!assets.some((file) => file.endsWith('.css'))) problems.push('dist has no hashed CSS asset')

const functionFiles = filesIn(resolve(root, 'functions/api'))
  .map((file) => relative(root, file).replaceAll('\\', '/'))
  .filter((file) => file.endsWith('.js'))
  .sort()
if (functionFiles.join(',') !== 'functions/api/ics.js,functions/api/rss.js') {
  problems.push(`Unexpected Pages Functions: ${functionFiles.join(', ')}`)
}

if (problems.length) {
  console.error('Build verification failed:\n' + problems.join('\n'))
  process.exit(1)
}
console.log(
  `Build verified: ${distFiles.length} dist files, ${assets.length} hashed assets, and 2 Cloudflare Functions at the repo root.`,
)
