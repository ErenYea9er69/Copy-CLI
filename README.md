# CopyShed

CopyShed finds the user-facing strings in your codebase and rewrites them to
match a brand voice, audience, and set of goals you define once in a config
file. It reads JSX text, targeted JSX/HTML attributes, call arguments like
`toast.error(...)`, and locale JSON files. Every rewrite is computed by a
deterministic rule engine by default, so the same input always produces the
same output, with no API key and no network call required. An optional AI
engine (Anthropic API) can replace the rule engine for teams that want it.

## Why deterministic by default

An LLM call gives a different answer on every run and needs a live API key
to function at all. That breaks two things a copy tool needs to support: a
CI lint step that has to be reproducible, and an editor "on save" hook that
has to be fast and cheap enough to run on every keystroke-adjacent save. The
rule engine handles the mechanical, high-confidence fixes (banned words,
filler phrases, em dashes, semicolon budgets, contraction policy, sentence
case, generic boilerplate phrases) instantly and for free. The optional AI
engine is there for teams who want fuller rewrites and are fine trading
determinism and cost for that.

## How rewrites get back into your files safely

CopyShed never uses find-and-replace on raw file text. It parses each file
with a real parser (Babel for JS/JSX/TS/TSX, a small hand-written scanner for
JSON) and records the exact byte offset of every string it finds. When you
apply a change, it splices only that offset range using
[magic-string](https://github.com/Rich-Harris/magic-string), leaving
everything else in the file, including formatting and unrelated code,
untouched.

## Install

```bash
npm install
npm run build
npm link          # optional: puts `copyshed` on your PATH
```

`dist/cli.cjs` is a single self-contained file (no `node_modules` needed at
runtime). You can also run it directly:

```bash
node dist/cli.cjs --help
```

## Quick start

```bash
cd your-project
copyshed init                 # writes copyshed.config.json
# edit audience, brandVoice, and bannedWords in the config
copyshed scan                 # preview only, writes nothing
copyshed apply --yes          # write the changes
copyshed lint                 # CI-friendly check, exits 1 if issues remain
```

## Commands

| Command | What it does |
|---|---|
| `copyshed init` | Writes a starter `copyshed.config.json` in the current directory. |
| `copyshed scan` | Extracts and previews rewrites. Read-only. |
| `copyshed apply` | Previews, then writes changes. Requires `--yes` to actually write; without it, it prints the same preview as `scan` and stops. |
| `copyshed lint` | Reports every string that still needs a fix or has an unresolved violation (banned word, over the word limit). Exits with code `1` if anything remains, for CI. |
| `copyshed watch` | Re-scans a file on save. Pass `--apply` to write automatically instead of only previewing. This is what the VS Code extension shells out to. |

Useful flags: `--config <path>` to point at a config file outside the
current directory, `--file <path>` to target one file instead of the
configured globs.

## Config file

`copyshed.config.json` is validated against a schema on load
(`src/config/schema.ts`), so a typo or an out-of-range value fails fast with
a clear message instead of silently doing nothing. See
`copyshed.config.example.json` for a complete, commented example, and
`examples/sample-app/copyshed.config.json` for the one used in the demo
below. The main fields:

- **audience** / **goals**: free text describing who reads this copy and
  what it is trying to do. Used by the AI engine's prompt; read by humans
  reviewing the config in a pull request.
- **brandVoice**: `tone` (array of words like `"direct"`, `"playful"`),
  `formality`, `person`, `allowContractions`, `sentenceCase`.
- **style**: `maxSentenceWords`, `forbidEmDash`, `forbidExclamationFiller`,
  `maxSemicolonsPerString`.
- **bannedWords**: words the rule engine flags as violations. It does not
  guess a replacement for these, since a wrong automatic guess is worse than
  a flag a human resolves. Use `preferredReplacements` for anything you want
  swapped automatically.
- **preferredReplacements**: direct word swaps applied everywhere, e.g.
  `{"customer": "user"}`.
- **rewriteMode**: `"rules"` (default) or `"ai"`.
- **ai**: model, which environment variable holds the API key, batch size.
  Only used when `rewriteMode` is `"ai"` and `ai.enabled` is `true`.
- **targets**: which JSX attributes and call names count as user-facing
  copy. Add your own, e.g. `"tooltip"`, `"emptyStateText"`.
- **include** / **exclude**: glob patterns, same syntax as
  [fast-glob](https://github.com/mrmlnc/fast-glob).

## Demo

`examples/sample-app` has a small React form, a notifications file, and a
locale JSON file, all written the way generic AI-drafted copy tends to come
out: filler phrases, an em dash, inconsistent exclamation marks, banned
words, semicolon-stitched sentences. Run:

```bash
cd examples/sample-app
node ../../dist/cli.cjs scan
```

A few representative rewrites it proposes:

```
"Welcome!"                                          -> "Welcome."
"In order to get the most out of the product, ..."  -> "To get the most out of the product, ..."
"Oops! Something went wrong"                         -> "That did not work"
"...at this point in time — please try again later"  -> "...now, please try again later"
"Choose a customer password"                         -> "Choose a user password"
```

And two it correctly refuses to auto-fix, flagging them instead:

```
"Are you sure you want to utilize the delete feature on this item?"
  ! contains banned word "utilize" (no automatic replacement configured)

"Delete this item permanently, this action cannot be undone and there is no way to get it back"
  ! exceeds max sentence length (18 > 16 words)
```

Run `node ../../dist/cli.cjs apply --yes` to write the fixable ones, then
`node ../../dist/cli.cjs lint` to see the two that still need a human.

## CI enforcement

```yaml
# .github/workflows/copy-lint.yml
- run: npx copyshed lint
```

Fails the build the same way `eslint` or `tsc --noEmit` would, and prints
exactly which strings need attention and why.

## Editor integration

`editor/vscode-extension` is a working skeleton, not a published extension.
It shells out to the same CLI documented above (`copyshed scan --file` and
`copyshed apply --yes --file`) from an output channel and an
`onDidSaveTextDocument` listener, gated behind a `copyshed.applyOnSave`
setting that defaults to off. To try it: open that folder in VS Code and
press F5. For any other editor, `copyshed watch --apply` gives you the same
on-save loop from a terminal.

## Known limitations

- Multi-line JSX text keeps its original internal line breaks and
  indentation after a rewrite, since only the trimmed text content is
  replaced, not the surrounding whitespace. Long paragraphs sometimes need a
  manual reflow after a rewrite that changes their length.
- Template literals with interpolation (`` `Hello ${name}` ``) are not
  extracted yet. Static string literals and JSX text are covered; add
  interpolated templates by extending `src/extract/jsxExtractor.ts`.
- The AI engine batches strings per request and falls back to the rule
  engine for any batch that fails or returns malformed JSON, so a network
  or API issue degrades gracefully instead of crashing the run.

## Project layout

```
src/
  cli.ts               entry point, command wiring
  config/               schema + loader for copyshed.config.json
  extract/               JSX/TS extractor (Babel) and JSON extractor
  rewrite/               rule engine (default) and AI engine (optional)
  diff/                  colored preview rendering
  apply/                 safe write-back via magic-string
  lint/                  CI-mode reporting
  watch/                 on-save loop used by the CLI and the editor extension
tests/                  vitest unit tests for extraction and the rule engine
examples/sample-app/    small demo project used above
editor/vscode-extension/  skeleton extension that shells out to the CLI
```

## Tests

```bash
npm test
```
#   C o p y - C L I  
 