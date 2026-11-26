# Briefr visual system

Briefr is a morning briefing, not a control panel. The interface should read like a quiet newspaper page: warm paper, one accent, a clear reading order, and copy that sounds like a person.

## Type

Two faces, loaded in `index.html`:

- **Fraunces** — display and section headings (`font-display`, `.editorial-title`, `.section-title`, `.modal-title`, `.reading-title`). Tight tracking on large sizes, balanced wrapping.
- **Source Sans 3** — body copy, controls, and metadata (`font-body`, `.body-copy`, `.metadata`, `.overline`).

Root font size is `112.5%` (18px). All text sizes are rem-based and scale with the user's browser setting. Temperatures, times and counts use `tnum`.

Roles: display title → section title → reading title → body → metadata. Hierarchy comes from role and spacing, not from ever-smaller grey text.

## Color

Tokens live in `src/index.css`:

- Ground `--paper`, surfaces `--surface`, ink `--ink` / `--ink-2`, reading text `--muted`, quiet metadata `--faint`.
- Hairlines `--line`, `--line-soft`, `--line-strong`. Borders are 1px.
- One accent, `--accent`, reserved for primary actions and active states. Status tones are muted and used only for real status.
- No gradients. No decorative shadows. Focus is a 2px accent outline with offset.

Contrast: body and metadata stay at or above 4.5:1; large display text stays above 3:1. Changes to tokens should be checked with the browser detector before merging.

## Layout

- Spacing steps: 4 / 8 / 12 / 16 / 24 / 32px (`--space-*`).
- Cards are one flat surface with a hairline. No nested panels: use whitespace, rules, and left-rule notes instead.
- Rows and timelines are separated by hairlines. Badges are quiet colored text, never filled chips competing with headings.
- Interactive targets are at least 48×48px.
- The header keeps the geometric badge and forward-ray mark (`BrandMark`) free of surrounding chrome.

## States and copy

- Loading, error, empty, and success states use short, plain sentences that say what happened and what to do next.
- Async status regions use `aria-live="polite"`. Warning toasts also play a short, quiet tone; the sound can be turned off in Keys & settings.
- Each dashboard card has its own error boundary, so one failed feed or provider cannot blank the morning.

## Verification

```bash
npm run build
npm run verify:build
npx impeccable detect --json src
```

Review the rendered page at desktop and phone widths. The detector should report no `nested-cards`, `tiny-text`, or `low-contrast` findings.
