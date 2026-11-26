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

Use the **Sign in** button in the top bar to create a local account. It keeps each person's settings, keys, calendar links and saved digests separate on a shared device. Passwords are hashed with PBKDF2; the raw password is never stored.

These accounts live in this browser only. They are great for a shared computer, but they do not sync across devices. A cloud provider such as Supabase or Clerk could be added later if you want real cross-device sign-in.

In **Keys & settings → Privacy & permissions**, you can see every calendar connection, what Briefr reads, and wipe local data in one click. Calendar titles are never written to a server log. BYOK API keys stay in your browser and never ship in the app bundle. You can also download your data or delete your account and everything it saved from the account panel.

## Deploy to Cloudflare Pages

1. Push this repository to your GitHub account.
2. In Cloudflare, go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git** and pick the repo.
3. Use these build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 22 (set `NODE_VERSION=22` if needed)
4. Deploy. Cloudflare automatically serves `functions/api/rss.js` at `/api/rss`.

You can also deploy from the command line with `npx wrangler pages deploy dist --project-name=briefr`.

The RSS endpoint is stateless. It checks that feed URLs are public `http`/`https` addresses, gives up after eight seconds, and caches successful feed results at the edge for 15 minutes. Hashed build files also get long-lived caching through `public/_headers`.

## Project map

| Path | What it does |
| --- | --- |
| `src/App.jsx` | The dashboard and all the small interactions |
| `src/components/` | Cards, key manager, setup steps, and controls |
| `src/lib/digestRunner.js` | Puts the morning run together |
| `src/lib/accountService.js` | Local accounts, export and deletion |
| `src/lib/session.js` | Active account session |
| `src/lib/calendarService.js` | Reads Google, Notion, ICS and CalDAV events |
| `src/lib/llmRotator.js` | Tries keys and models in order |
| `src/lib/weatherService.js` | Open-Meteo weather and place search |
| `src/lib/rssService.js` | Reads the selected feeds |
| `api/rssShared.js` | Shared feed parsing and URL checks |
| `functions/api/rss.js` | The Cloudflare Pages feed endpoint |
| `public/favicon.svg` | The Briefr mark |

Made for slow mornings, not dashboards that shout.
