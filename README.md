# Briefr

Briefr is a quiet place to start your day. It pulls the weather, nearby and important news, and the things waiting on you into one simple morning view. It runs on free weather and news sources, works without an account, and keeps your AI keys in your own browser.

You can use it with no AI key at all. The weather, outfit ideas, headlines, and message sorting still work. If you do add a free key, Briefr writes shorter summaries and more personal outfit advice.

## Local setup

1. Install Node 22 or newer. Briefr uses Vite 6 and has no server runtime of its own.
2. Clone the repository and install dependencies: `npm install`.
3. Optional: copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable anon key. Without these values Briefr runs in full local-only mode.
4. Start the app: `npm run dev`, then open <http://localhost:5173>.
5. Run checks: `npm test` for the unit suite and `npm run verify:build` after a build. The full set is listed in the pre-launch checklist below.

On this Windows setup, use `npm.cmd` because PowerShell blocks `npm.ps1`. The unit suite uses Node's built-in test runner, so there is no extra test dependency. `npm run verify:milestone16` runs the security and accessibility audit.

## What's inside

- Live weather and a "what to wear" timeline from free Open-Meteo data.
- Hour-by-hour rain, temperature, and feels-like details.
- News from RSS feeds, sorted into local stories and bigger stories.
- A place to paste an email or chat message and see what to do with it.
- A read-aloud button so you can listen while you get ready.
- Space for several free AI keys, with automatic switching when one is busy.
- A single "What's Ahead Today" list that gathers events from your calendars.

Nothing is stored on a Briefr server. There isn't one. Your keys, settings, and today's saved briefing live in this browser's local storage.

## Bring your own AI key (optional)

Get a free key from Google AI Studio, Groq, or OpenRouter, then add it under **Keys & settings**. You can add more than one. If a provider is busy or out of quota for the day, Briefr quietly tries the next key or model and tells you what happened in a small, calm note.

There's also an **Advanced** section if you run a model on your own computer with Ollama. Your browser can only reach it if Ollama allows your site address, so the screen shows a short note about that.

Free tiers are handy for a morning digest, but they can have usage limits and privacy trade-offs. Avoid pasting sensitive information into prompts.

## Connect your calendars (optional)

Open **What's Ahead Today → Connect** to bring today's events into Briefr. Everything is read-only, and you can disconnect any source at any time.

- **Google Calendar:** add your own OAuth client ID and connect. Briefr asks only for read-only calendar access.
- **Notion:** paste an integration token and a database ID. Briefr finds the Date and Status properties, skips done or archived entries, and shows today's tasks with their times. OAuth is also available if you provide a small token proxy that holds the Notion client secret.
- **Apple and Proton:** paste a read-only ICS/iCalendar link. Recurring events are expanded into today's local time. Proton works best this way because there's no public third-party API.
- **Apple iCloud via CalDAV:** if you run a CalDAV proxy, add its address and your calendar URL. Briefr asks the proxy for today's events.

If a calendar feed blocks browser requests, add a proxy URL for that feed. Tokens and links stay in this browser's local storage, and Briefr doesn't keep a copy on a server.

## Accounts, Supabase and privacy

Briefr works with no account at all. Choose **Continue without an account (Local-only)** and everything stays in this browser.

For cross-device syncing, set up a free Supabase project:

1. Create a project on Supabase's free tier.
2. Under **Authentication → Providers**, enable Email. Choose email and password, magic link, or both. Add your site URL and redirect URL: `http://localhost:5173` for local work and your Cloudflare Pages domain in production.
3. Open the Supabase SQL editor and run `supabase/migrations/001_init.sql`. `supabase/schema.sql` mirrors the same result if you prefer a single reference file.
4. Confirm Row-Level Security is enabled on `user_profiles`, `user_preferences`, `calendar_sources`, and `triage_items`. Each table has owner-only `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)` policies, and grants are limited to the `authenticated` role. The migration also creates the `delete_own_account()` RPC, which deletes only rows owned by the calling user.
5. Copy `.env.example` to `.env.local` and fill in your project URL and **publishable anon key**.
6. Add the same two values as Cloudflare Pages build environment variables so production uses the same project.
7. Sign up from the top bar. Preferences and non-secret calendar settings follow your account between devices.

Only public preferences sync: tone, location, wardrobe choices, news lens, feed URLs and database IDs. BYOK API keys and calendar tokens stay in browser localStorage. Never put a service-role key or raw token in a `VITE_*` variable; client bundles are public. Private ICS and CalDAV URLs are treated as bearer capabilities and are never written to these tables.

In **Keys & settings → Privacy & data**, you can see every connection, disconnect a calendar one by one, clear the cached digest, export your data, delete your data, or wipe local storage. Calendar titles are never written to a server log.

## News lens (optional)

If you'd like, set a general political lens during setup or in **Keys & settings**. You can choose Neutral / Balanced, Conservative / Republican, Liberal / Democratic, Libertarian, Independent / Centrist, or None / Unfiltered. Coverage Mode can be Aligned Lens or Balanced / Both Sides.

This setting only affects which news stories get ranked higher and how they're summarized. It never changes weather, outfit advice, calendar events, or facts in a story. It's saved with your account preferences, and the News card has a one-click **Back to balanced** button.

## Deploy to Cloudflare Pages

1. Push this repository to GitHub.
2. In Cloudflare, go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git** and pick the repo.
3. Use these build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 22 (set `NODE_VERSION=22` if needed)
4. Add the two build environment variables below. Leave them unset to deploy a local-only instance.
5. Deploy. Cloudflare serves `functions/api/rss.js` at `/api/rss` and `functions/api/ics.js` at `/api/ics`. These files stay at the repository root and are added at deploy time. They are not copied into `dist`.
6. Optional: deploy from the command line with `npx wrangler pages deploy dist --project-name=briefr`.
7. Optional: attach a custom domain and confirm `public/_headers` is in `dist` so hashed assets get long-lived caching.

### Environment variables

| Name | Kind | Where it goes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Public | `.env.local` and Cloudflare Pages build vars |
| `VITE_SUPABASE_ANON_KEY` | Public publishable key | `.env.local` and Cloudflare Pages build vars |

Both `VITE_*` values are bundled into browser JavaScript, so they must be publishable. Never put a Supabase service-role key, LLM API key, Notion token, or calendar token in a `VITE_*` variable. `.env.example` documents the split: BYOK keys and private calendar links stay in browser localStorage, while the two Pages Functions handle public RSS and read-only calendar fetches. If you add a server proxy later, keep its credentials in Cloudflare Pages secrets. No server logs store calendar titles or event details.

### What runs where

| Path | Runs on | Notes |
| --- | --- | --- |
| `src/` | Browser | Dashboard, weather, RSS client, calendar adapters, LLM rotation, storage |
| `functions/api/rss.js` | Cloudflare Pages Function | Validated public feed fetch, `400` / `408` / `502` errors, edge caching on success |
| `functions/api/ics.js` | Cloudflare Pages Function | HTTPS-only private calendar fetch, `no-store`, no URL or title logging |
| `supabase/migrations/001_init.sql` | Supabase SQL | Owner-scoped tables, RLS policies, account deletion RPC |

The RSS endpoint validates public `http`/`https` addresses, rejects redirects into private ranges, times out after eight seconds, and caches only successful responses at the edge. The ICS endpoint accepts `https` only, blocks private and link-local ranges, times out cleanly, and never caches private calendar data. The browser shares simultaneous requests for the same feed or calendar through one in-flight promise and reuses public feed results briefly in memory.

LLM keys rotate on `429` (per-minute cooldown or daily exhaustion), `401`/`403`, and transient `5xx` across Gemini, Groq, OpenRouter, and local Ollama. When a key rotates or Briefr falls back to deterministic weather, raw headlines, or on-device inbox sorting, a calm non-blocking status banner explains that everything still works and offers Key settings or a retry. Run `npm run verify:milestone14` to check edge headers, structured errors, private ICS responses, request deduplication, quota guardrails, and the banner contract.

## Troubleshooting

**Calendar will not connect.** Google needs an OAuth client with `http://localhost:5173` (or your production domain) listed as an authorized redirect URI, and Briefr only requests read-only scopes. Notion needs the database shared with your integration and a Date property plus a title property. Optional Status, Location, Notes and Tags properties are detected by name. For Apple, Proton or CalDAV, use an `https` read-only ICS link. Private or `http` links are rejected by the edge proxy. If a feed blocks browser requests, add your own proxy URL. All four sources are read-only.

**Events look wrong or missing.** All-day items sit above the timeline, multi-day events that span today are included, and repeating events are expanded into the local day with daylight saving changes respected. If a specific occurrence is absent, check the event's `EXDATE` list. Quick events are stored only in this browser for the current day. Under 20 minute gaps are flagged as tight transitions, and overlapping events are labelled.

**Sign-in fails or settings do not sync.** Confirm both `VITE_*` values are set at build time, that the Supabase migration ran, and that RLS is enabled with owner-only policies. Add the exact site and redirect URLs to Supabase Auth settings, including the production domain. Check the browser console for auth errors. With no env vars, Briefr deliberately falls back to local-only mode, so nothing syncs.

**A key is resting or used up.** A brief `429` puts that model on a short cooldown; a daily quota marks the key used up for the day. Briefr rotates to the next key or model and shows a calm status banner. **Simulate a rate limit** in Key settings reproduces this safely. With no keys, or when every provider is exhausted, weather, headlines and inbox sorting keep working from built-in rules. If Ollama is unreachable, check its CORS settings for your site address.

**A feed fails to load.** Public feeds are cached for 15 minutes at the edge. A failing feed returns a clean error and leaves the rest of the page usable. Use the retry button on the News card. Slow feeds stop after eight seconds with a `408`.

## Pre-launch checklist

- [ ] `npm install` succeeds on Node 22 or newer.
- [ ] `npm test` passes all unit tests.
- [ ] `npm run verify:build`, `verify:milestone16`, `verify:milestone15`, `verify:milestone14`, `verify:audit`, `verify:digest`, `verify:triage`, `verify:calendars`, `verify:schedule`, `verify:politics`, and `verify:auth` all pass.
- [ ] `npm run build` finishes with no warnings or errors.
- [ ] `dist/index.html`, `dist/favicon.svg`, `dist/_headers`, and hashed `dist/assets/` files exist. There is no `dist/functions` or `dist/api`.
- [ ] `functions/api/rss.js` and `functions/api/ics.js` remain at the repository root.
- [ ] Cloudflare build command is `npm run build` and output directory is `dist`.
- [ ] Supabase migration is applied, RLS is enabled on all four tables, and only the two public `VITE_*` values are set as build vars.
- [ ] Local-only smoke test: Weather, News, Calendar and Inbox cards load, rate-limit simulation leaves the page intact.
- [ ] Cloud smoke test: sign up, change the news lens, connect a calendar link, reload, and confirm settings return.
- [ ] Check the deployed `/api/rss` and `/api/ics` responses, including cache headers and clean error codes.

## Project map

| Path | What it does |
| --- | --- |
| `src/App.jsx` | The dashboard and all the small interactions |
| `src/components/` | Cards, key manager, setup steps, and controls |
| `src/lib/digestRunner.js` | `runMorningDigest`: calendars + weather + RSS + synthesis with daily cache |
| `src/lib/session.js` | Active account session |
| `src/components/PrivacyPanel.jsx` | Connections, data controls and privacy copy |
| `supabase/migrations/001_init.sql` | User tables, RLS policies, triggers, account deletion RPC |
| `src/lib/auth.js` | Shared cloud/local auth interface |
| `src/lib/db.js` | User-scoped preferences, calendar sources, and triage sync |
| `src/lib/calendarService.js` | Reads Google, Notion, Apple/Proton ICS and CalDAV events into one schema |
| `src/lib/schedule.js` | Groups all-day events, finds Up Next, flags overlaps and tight transitions |
| `src/lib/triageService.js` | Sorts pasted inbox text into daily needs-action / FYI / noise items |
| `src/components/MorningChecklist.jsx` | Counts today's events and open action items, with timing flags |
| `src/lib/prompts.js` | Weather, wardrobe, news, schedule and triage prompts for the LLM |
| `src/lib/llmRotator.js` | Tries keys and models in order |
| `src/lib/weatherService.js` | Open-Meteo weather and place search |
| `src/lib/rssService.js` | Reads the selected feeds |
| `api/rssShared.js` | Shared feed parsing and URL checks |
| `functions/api/rss.js` | The Cloudflare Pages feed endpoint |
| `functions/api/ics.js` | The Cloudflare Pages calendar-link proxy |
| `api/icsShared.js` | Shared ICS parsing and URL checks |
| `public/favicon.svg` | The Briefr mark |

The morning run is coordinated by `runMorningDigest()`, which syncs calendars, fetches weather and feeds, runs tone/lens-aware synthesis, and caches daily results. Each section degrades independently; a failed feed or provider leaves the rest of the page usable, and weather/news/calendar sections expose retry buttons. Triage returns strict `{ needsAction, fyi, noiseCount, noiseItems }` JSON and keeps working with a deterministic fallback when no key is configured or every provider is rate-limited. Run `npm run verify:digest` and `npm run verify:triage` to check the orchestrator and triage contract.

Political curation uses canonical tokens: `politicalLens` is `neutral | conservative | liberal | libertarian | independent | unfiltered` and `coverageMode` is `aligned | balanced`. Old display-label values migrate automatically on load. Balanced mode adds broader-debate feeds and asks the LLM for multiple viewpoints grounded only in the supplied RSS items; aligned mode prioritizes stories relevant to the chosen lens without changing facts or attribution. The news lens badge switches between the chosen lens and Neutral in one click. Run `npm run verify:politics` to check tokens, migration, prompt rules, and perspective feeds.

Google (paginated REST with read-only OAuth), Notion (paginated database query with date-range matching and tags), Apple/Proton ICS, and CalDAV all normalize to `{ id, title, startTime, endTime, isAllDay, location, source, status, notes }`. The ICS parser unfolds lines, honors `TZID`/UTC, `EXDATE`, and daily/weekly/monthly `RRULE`, and the `/api/ics` edge function enforces HTTPS-only, blocks private/loopback/link-local hosts, times out, and returns `Cache-Control: no-store`. In local dev the browser falls back to a validated direct fetch. Timed events sort chronologically, all-day items sit above the timeline, and Under 20-minute gaps are flagged as tight transitions. No mock schedule is used in production paths. Use **Add a quick event** for an instant local item. Run `npm run verify:calendars` to check SSRF rules, edge caching, pagination, adapters, and recurrence.

Every calendar source is normalized to `{ id, title, startTime, endTime, isAllDay, location, source, status, notes }`. The ICS reader unfolds folded lines, keeps all-day dates on the local day, includes multi-day events that span today, resolves `TZID` and UTC through daylight saving changes, honors `EXDATE` values with their own parameters, and expands daily and weekly `RRULE` occurrences onto today's local date. The calendar dialog now explains each source: Google uses read-only events, Notion maps Date/title/Status/Location/Notes/Tags, Apple uses an ICS or CalDAV feed, and Proton uses a read-only shared ICS link. Quick one-off events for today are stored only in this browser and travel through the same pipeline.

Triage accepts several emails, texts, or chat snippets in one paste and sorts each message separately. Results are day-scoped: only derived items are saved, never the pasted text itself, and a new day resets both. Checked-off actions persist, can be undone, and offer one-click Copy draft reply or Copy checklist, plus Clear Triage to start over. Triage cross-references today's schedule when available, so an urgent item before an early meeting gets a prep note in the Inbox and a timing flag in the Morning Checklist. Run `npm run verify:schedule`, `npm run verify:triage`, and `npm run verify:milestone15` to check recurrence, DST and EXDATE handling, multi-message sorting, persistence, friction flags, and daily state.

Made for slow mornings, not dashboards that shout.
