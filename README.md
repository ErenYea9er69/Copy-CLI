# copyshed — UI/UX overhaul

Your CLI's logic is untouched. What changed is everything the user sees, to
bring it in line with the polished feel of tools like Claude Code and
Gemini CLI: a consistent color system, a real banner, boxed summaries,
better tables, and a two-line diff view instead of a single squashed line.

## What's new

- **`src/ui/theme.ts`** — a single design system every other file pulls
  from: brand gradient (violet → cyan), status colors, icons that fall back
  to ASCII on limited terminals (via `figures`), a `panel()` helper for
  boxed summaries, and a `progressBar()` helper.
- **Gradient banner** on `copyshed` / `copyshed --help` (via `figlet` +
  `gradient-string`), plus a real "Examples" section in help output.
- **`src/utils/logger.ts`** — every log line now has an icon
  (✔ ✖ ⚠ ℹ ❯), and there's a `log.panel(...)` for boxed, color-coded
  end-of-command summaries (see `rewrite`, `check`, `audit`, `apply`, `init`).
- **`src/ui/table.ts`** — rounded borders, colored headers, a real grade
  badge instead of plain text.
- **`src/ui/diff.ts`** — added `renderReviewDiff()`: a git-style two-line
  `− before / + after` view with background highlights on the changed
  words, used during interactive review instead of one hard-to-scan
  inline line.
- **`src/ui/prompts.ts`** — the review screen now shows a mini progress
  bar (`1/12`), a status badge (clean / needs review / failed), and the
  new two-line diff, with icon-prefixed menu choices.
- **`src/cli.ts`** — added the banner, a version reader that pulls from
  `package.json` instead of a hardcoded string, and a proper examples
  block in `--help`.

The original archive was missing `package.json` and `tsconfig.json`, so
both were added here (matching the ESM/NodeNext style the existing
`dist/*.js` output already used).

## Running it

```bash
npm install
npm run build
npm link      # optional: makes `copyshed` available globally
copyshed      # shows the banner + help
copyshed init
copyshed scan
```

## Where to look first

- `src/ui/theme.ts` — change `BRAND_FROM` / `BRAND_TO` here to re-theme the
  whole CLI in one place.
- `src/commands/rewrite.ts` — the most visible command; shows the spinner,
  progress bar, and end-of-run panel in context.
