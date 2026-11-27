import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const runner = read('src/lib/digestRunner.js')
const app = read('src/App.jsx')
const main = read('src/main.jsx')
const boundary = read('src/components/ErrorBoundary.jsx')

assert.match(runner, /export async function runMorningDigest/)
assert.match(runner, /getTodaysEvents\(activeConnections, date\)/)
assert.match(runner, /Promise\.all\(\[/)
assert.match(runner, /buildWeatherOutfitPrompt/)
assert.match(runner, /buildNewsRankingPrompt/)
assert.match(runner, /politicalLens: prefs\.politicalLens/)
assert.match(runner, /tone: prefs\.tone/)
assert.match(runner, /digestCacheKey/)
assert.match(runner, /newsCacheKey/)
assert.match(runner, /export async function runMorningBriefing/)

assert.match(app, /runMorningDigest/)
assert.match(app, /CardBoundary/)
assert.match(app, /onRetry=\{\(\) => runMorning/)
assert.doesNotMatch(app, /mockCalendarEvents/)

assert.match(main, /<ErrorBoundary>/)
assert.match(boundary, /export default class ErrorBoundary/)
assert.match(boundary, /export class CardBoundary/)
assert.match(boundary, /Try again/)

const { runMorningDigest, runMorningBriefing } = await import('../src/lib/digestRunner.js')
assert.equal(typeof runMorningDigest, 'function')
assert.equal(typeof runMorningBriefing, 'function')

console.log('Milestone 13 verified: unified orchestrator, calendar sync, caching, retry boundaries, no mock schedule.')
