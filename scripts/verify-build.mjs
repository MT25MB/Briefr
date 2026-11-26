import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

if (problems.length) {
  console.error('Build verification failed:\n' + problems.join('\n'))
  process.exit(1)
}
console.log('Build verified: dist is clean and Cloudflare Functions are at the repo root.')
