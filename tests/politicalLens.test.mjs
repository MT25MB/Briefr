import './helpers.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const { buildNewsRankingPrompt } = await import('../src/lib/prompts.js')
const { lensFeeds } = await import('../src/lib/rssService.js')
const { POLITICAL_LENS_LABELS, normalizePoliticalLens } = await import('../src/lib/storage.js')

const lenses = ['neutral', 'conservative', 'liberal', 'libertarian', 'independent', 'unfiltered']

test('every canonical lens builds a grounded prompt', () => {
  lenses.forEach((lens) => {
    const prompt = buildNewsRankingPrompt({
      items: [{ title: 'Story', link: 'https://example.com/a' }],
      politicalLens: lens,
      coverageMode: 'aligned',
    })
    assert.equal(normalizePoliticalLens(lens), lens)
    assert.match(prompt, new RegExp(POLITICAL_LENS_LABELS[lens].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(prompt, /UNTRUSTED_DATA label="rss"/)
    assert.match(prompt, /Never invent a story, source, URL or detail/)
  })
})

test('balanced mode asks for multiple viewpoints and aligned mode prioritizes the lens', () => {
  const balanced = buildNewsRankingPrompt({ politicalLens: 'conservative', coverageMode: 'balanced' })
  const aligned = buildNewsRankingPrompt({ politicalLens: 'conservative', coverageMode: 'aligned' })
  assert.match(balanced, /more than one viewpoint/)
  assert.match(aligned, /prioritize stories and framing most relevant/)
})

test('lens feeds add perspective sources only when a lens is chosen', () => {
  assert.equal(lensFeeds('neutral', 'balanced').length, 0)
  assert.equal(lensFeeds('unfiltered', 'balanced').length, 0)
  assert.equal(lensFeeds('liberal', 'aligned').length, 1)
  assert.equal(lensFeeds('liberal', 'balanced').length, 2)
})

test('news badge toggles between the chosen lens and neutral', () => {
  const source = readFileSync('src/components/NewsFeedCard.jsx', 'utf8')
  assert.match(source, /Lens: \{POLITICAL_LENS_LABELS\[politicalLens\]/)
  assert.match(source, /politicalLens === 'neutral' \? 'Choose a lens' : 'Back to neutral'/)
  assert.match(source, /onClick=\{onToggleLens\}/)
})
