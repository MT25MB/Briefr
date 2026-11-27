# Briefr visual system

Briefr is a morning briefing, not a control panel. The interface should read like a quiet newspaper page: warm paper, one accent, a clear reading order, and copy that sounds like a person.

## Type

Two faces, loaded in `index.html`:

- **Fraunces**: display and section headings (`font-display`, `.editorial-title`, `.section-title`, `.modal-title`, `.reading-title`). Tight tracking on large sizes, balanced wrapping.
- **Source Sans 3**: body copy, controls, and metadata (`font-body`, `.body-copy`, `.metadata`, `.overline`).

Root font size is `112.5%` (18px). All text sizes are rem-based and scale with the user's browser setting. Temperatures, times and counts use `tnum`.

Roles: display title → section title → reading title → body → metadata. Hierarchy comes from role and spacing, not from ever-smaller grey text.

## Color

Tokens live in `src/index.css`:

- Ground `--paper`, surfaces `--surface`, ink `--ink` / `--ink-2`, reading text `--muted`, quiet metadata `--faint`.
- Hairlines `--line`, `--line-soft`, `--line-strong`. Borders are 1px.
- One accent: `--accent` for links and active states, `--accent-action` for solid buttons with white text. Status tones are muted and used only for real status.
- Dark mode lives under `:root[data-theme='dark']`. It is a warm near-black palette with elevated surfaces, not an inversion. `--danger-action` exists for the same reason as `--accent-action`.
- No gradients. No decorative shadows. Focus is a 2px accent outline with offset.

Contrast: body and metadata stay at or above 4.5:1 in both modes; large display text stays above 3:1. Changes to tokens should be checked with the browser detector before merging.

Theme preference is `system | light | dark`, stored in `localStorage` as `briefr_theme` and applied before first paint in `index.html`. It is global, not account-scoped. The control is in **Keys & settings → Appearance**.

## Layout

- Spacing steps: 4 / 8 / 12 / 16 / 24 / 32px (`--space-*`).
- Cards are one flat surface with no outer border. Grouping comes from whitespace and type, not boxes.
- Rows and timelines use hairlines only where they separate distinct records. No badges, pills, monograms, or filled chips compete with headings.
- All four dialogs share one `Modal` shell with focus trapping, Escape to close, and 48px close targets.
- Interactive targets are at least 48×48px.
- The header keeps the geometric badge and forward-ray mark (`BrandMark`) free of surrounding chrome.

## States and copy

- Loading, error, empty, and success states use short, plain sentences that say what happened and what to do next.
- Privacy is stated once in **Privacy & data**. Don't repeat "keys stay here" around every key, calendar, and form field.
- Button labels name the object: "Add key", "Sort this message", "Connect calendar", "Refresh briefing", never bare "Done" or "Continue".
- Async status regions use `aria-live="polite"`. Warning toasts also play a short, quiet tone; the sound can be turned off in Keys & settings.
- Each dashboard card has its own error boundary, so one failed feed or provider cannot blank the morning.

## Verification

```bash
npm run build
npm run verify:build
npx impeccable detect --json src
```

Review the rendered page at desktop and phone widths. The detector should report no `nested-cards`, `tiny-text`, or `low-contrast` findings.
