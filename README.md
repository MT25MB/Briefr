# Briefr

Briefr is a quiet place to start your day. It pulls the weather, nearby and important news, and the things waiting on you into one simple morning view. It runs on free weather and news sources, works without an account, and keeps your AI keys in your own browser.

You can use it with no AI key at all. The weather, outfit ideas, headlines, and message sorting still work. If you do add a free key, Briefr writes shorter summaries and more personal outfit advice.

## Try it locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. To check the production build, run `npm run build` and then `npm run preview`.

On this Windows setup, use `npm.cmd` — PowerShell blocks `npm.ps1`.

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
- **Apple and Proton:** paste a read-only ICS/iCalendar link. Recurring events are expanded into today's local time. Proton works best this way — there's no public third-party API.
- **Apple iCloud via CalDAV:** if you run a CalDAV proxy, add its address and your calendar URL. Briefr asks the proxy for today's events.

If a calendar feed blocks browser requests, add a proxy URL for that feed. Tokens and links stay in this browser's local storage, and Briefr doesn't keep a copy on a server.

## Accounts and privacy

Briefr works with no account at all. Choose **Continue without an account (Local-only)** and everything stays in this browser.

For cross-device syncing, connect a free Supabase project:

1. Create a project on Supabase's free tier and enable email sign-in.
2. Run `supabase/schema.sql` in the Supabase SQL editor. It creates one preferences table with Row Level Security so each person can only read and write their own row.
3. Copy `.env.example` to `.env.local` and fill in your project URL and **publishable anon key**.
4. Add the same two values as build environment variables in Cloudflare Pages.
5. Sign up from the top bar. Preferences and non-secret calendar settings follow your account between devices.

Only public preferences sync: tone, location, wardrobe choices, news lens, feed URLs and database IDs. BYOK API keys and calendar tokens stay in browser localStorage. Never put a service-role key or raw token in a `VITE_*` variable — client bundles are public.

In **Keys & settings → Privacy & data**, you can see every connection, disconnect a calendar one by one, clear the cached digest, export your data, delete your data, or wipe local storage. Calendar titles are never written to a server log.

## News lens (optional)

If you'd like, set a general political lens during setup or in **Keys & settings**. You can choose Neutral / Balanced, Conservative / Republican, Liberal / Democratic, Libertarian, Independent / Centrist, or None / Unfiltered. Coverage Mode can be Aligned Lens or Balanced / Both Sides.

This setting only affects which news stories get ranked higher and how they're summarized. It never changes weather, outfit advice, calendar events, or facts in a story. It's saved with your account preferences, and the News card has a one-click **Back to balanced** button.

## Deploy to Cloudflare Pages

1. Push this repository to your GitHub account.
2. In Cloudflare, go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git** and pick the repo.
3. Use these build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 22 (set `NODE_VERSION=22` if needed)
4. Deploy. Cloudflare automatically serves `functions/api/rss.js` at `/api/rss` and `functions/api/ics.js` at `/api/ics`. The ICS endpoint fetches read-only calendar links for you, so the browser's CORS rules don't get in the way.

You can also deploy from the command line with `npx wrangler pages deploy dist --project-name=briefr`.

The RSS endpoint is stateless. It checks that feed URLs are public `http`/`https` addresses, gives up after eight seconds, and caches successful feed results at the edge for 15 minutes. Hashed build files also get long-lived caching through `public/_headers`. The ICS endpoint only accepts `https` and blocks private addresses.

### Environment variables

| Name | Kind | Where it goes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Public | `.env.local` and Cloudflare Pages build vars |
| `VITE_SUPABASE_ANON_KEY` | Public publishable key | `.env.local` and Cloudflare Pages build vars |

Both `VITE_*` values are bundled into browser JavaScript, so they must be publishable. Never put a Supabase service-role key, LLM API key, Notion token, or calendar token in a `VITE_*` variable. Server-only secrets, if you add a proxy later, belong in Cloudflare Pages secrets. No server logs store calendar titles or event details.

### Setup checklist

- [ ] `npm install` then `npm run dev`; open `http://localhost:5173`.
- [ ] `npm run build`; confirm `dist/index.html`, `dist/favicon.svg`, `dist/_headers` and hashed assets exist. `functions/api/rss.js` and `functions/api/ics.js` stay at the repo root — Cloudflare adds them at deploy time.
- [ ] Optional: create a Supabase project, run `supabase/schema.sql`, and set the two public variables from `.env.example`.
- [ ] Deploy with `npx wrangler pages deploy dist --project-name=briefr` or connect the repo in the Cloudflare dashboard.
- [ ] Test locally: choose local-only mode, then check Weather, News, Calendar and Inbox cards. Use **Try a rate limit** to confirm a provider failure leaves the rest of the page intact.
- [ ] Test cloud: sign up, change the news lens, add a calendar link, reload, and confirm settings come back.

## Project map

| Path | What it does |
| --- | --- |
| `src/App.jsx` | The dashboard and all the small interactions |
| `src/components/` | Cards, key manager, setup steps, and controls |
| `src/lib/digestRunner.js` | Puts the morning run together |
| `src/lib/auth.js` | Supabase Auth and local-only mode |
| `src/lib/db.js` | User-scoped cloud preferences and exports |
| `src/lib/session.js` | Active account session |
| `src/components/PrivacyPanel.jsx` | Connections, data controls and privacy copy |
| `supabase/schema.sql` | Preferences table and RLS policies |
| `src/lib/calendarService.js` | Reads Google, Notion, ICS and CalDAV events |
| `src/lib/llmRotator.js` | Tries keys and models in order |
| `src/lib/weatherService.js` | Open-Meteo weather and place search |
| `src/lib/rssService.js` | Reads the selected feeds |
| `api/rssShared.js` | Shared feed parsing and URL checks |
| `functions/api/rss.js` | The Cloudflare Pages feed endpoint |
| `functions/api/ics.js` | The Cloudflare Pages calendar-link proxy |
| `api/icsShared.js` | Shared ICS parsing and URL checks |
| `public/favicon.svg` | The Briefr mark |

Made for slow mornings, not dashboards that shout.
