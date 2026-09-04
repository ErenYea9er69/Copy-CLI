# CopyShed

CopyShed finds user-facing strings in your code and rewrites them to match
your target audience, your brand voice, and a strict house writing style.
It runs in the terminal. There is no server and no editor plugin; the CLI
is the whole product.

## How it works

The tool has two halves, and they do different jobs on purpose.

Extraction and rule enforcement are deterministic. CopyShed parses your
JS, JSX, TS, TSX, and JSON locale files with Babel, finds strings sitting
in places that usually hold UI copy (JSX text, attributes like `label` or
`placeholder`, object keys like `title` or `message`, i18n calls like
`t(...)`), and checks them against a fixed rule set with plain string and
regex matching. That check has no ambiguity: a banned word is either
present or it is not.

Rewriting is not deterministic, because turning "Unlock your dashboard's
full potential" into something plain and specific requires actual
language understanding, not pattern matching. CopyShed sends each
candidate string to Claude with your brand voice, audience, and the full
rule set as instructions. The model's answer then goes back through the
same deterministic checker. If it breaks a hard rule, CopyShed sends the
specific violation back to the model and asks again, up to a retry limit
you control. A string that still fails after retries is marked "needs
review" instead of applied silently. You always see a diff before
anything touches disk, and nothing is written unless you accept it or
pass `--yes`.

### Hard rules vs. soft rules

Some of the writing rules you gave are things a script can verify with
certainty: no em dash, no markdown, no banned word or phrase, at most one
semicolon. CopyShed calls these hard rules. It blocks a suggestion that
fails one.

Other rules describe good prose but resist mechanical verification:
active voice, sentence rhythm, committing to a view instead of hedging.
CopyShed still puts these in the model's instructions, and it runs a few
light heuristics that surface a warning (an exclamation mark, a phrase
that reads like passive voice, a "not X, but Y" construction). Those are
warnings for a human to glance at, not blocks. Say a check is a heuristic
and not a guarantee; a tool that claims otherwise is lying to you.

## Setup

Requires Node 18.17 or newer.

```
cd copyshed
npm install
npm run build
```

Link it so `copyshed` works as a command anywhere:

```
npm link
```

Or run it without linking, from inside this folder:

```
node dist/cli.js <command>
```

Add your Anthropic API key. Copy `.env.example` to `.env` in whatever
project you run CopyShed against, or export the variable directly:

```
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY
```

`scan` and `check` never call the API and work with no key at all.

## Commands

### `copyshed init`

Writes `copyshed.config.json` in the current directory. Prompts for your
target audience, brand voice, and goals, or pass `-y` to accept the
defaults and edit the file by hand afterward.

### `copyshed scan [paths...]`

Lists every candidate string CopyShed finds, with no API call. Good for
checking your `include`/`exclude`/allowlist settings before spending
tokens on a real rewrite pass. Add `--json` for machine-readable output.

### `copyshed check [paths...]`

Runs the hard rules against copy that is already in your codebase. No API
key needed, no network call, safe to run in CI or a pre-commit hook.
Exits with code 1 if any string breaks a hard rule, 0 otherwise. This is
the command that gives you "team style guide enforcement across the
codebase" without spending a single API call.

```
copyshed check --json
```

### `copyshed rewrite [paths...]`

The main flow. Extracts candidates, sends each to Claude, validates the
result, retries on failure, then walks you through an interactive review:
accept, edit, skip, accept all remaining clean suggestions, or quit and
save progress. Accepted changes get written back immediately, in place,
without reformatting the rest of the file.

Flags:

- `-y, --yes` — non-interactive. Applies every suggestion that passes
  validation outright and skips anything that needed a retry or came back
  unchanged. Use this in a script or an editor's on-save hook.
- `--dry-run` — calls the model and saves a report to `.copyshed/`, but
  never touches a file and never prompts. Pair with `copyshed apply`
  later. This is the "safe preview" step.
- `-m, --model <name>` — override the model for this run.
- `--max-retries <n>` — override the retry count for this run.
- `-c, --config <path>` — use a config file somewhere other than
  `./copyshed.config.json`.

### `copyshed apply`

Reviews and applies a report saved by `rewrite --dry-run`. This is the
"one-click apply" step, and it is what an editor's on-save/on-accept
integration would call: run `rewrite --dry-run --paths <file>` when the
file saves, show the diff in your own UI, and call
`apply --yes --paths <file>` when the person accepts it.

- `-r, --report <path>` — a specific report file. Defaults to the most
  recent one.
- `-y, --yes` — apply every suggestion already accepted or clean, no
  prompts.
- `-p, --paths <patterns...>` — only apply entries whose file matches.

## Configuration

`copyshed.config.json`, written by `init` or edited by hand. See
`copyshed.config.example.json` for a filled-in reference.

| Key                    | What it controls                                                      |
| ----------------------- | ---------------------------------------------------------------------- |
| `target_audience`      | Who reads this copy. Goes straight into the model's instructions.     |
| `brand_voice`          | A few words describing tone.                                          |
| `goals`                | What the copy should accomplish.                                      |
| `extra_banned_words`   | Project-specific words on top of the built-in list.                   |
| `extra_banned_phrases` | Project-specific phrases on top of the built-in list.                 |
| `include` / `exclude`  | Glob patterns for which files to scan.                                |
| `attribute_allowlist`  | JSX attribute names treated as UI copy (`label`, `placeholder`, ...). |
| `key_allowlist`        | Object/JSON key names treated as UI copy (`title`, `message`, ...).   |
| `call_allowlist`       | Function names whose first string argument counts (`t`, `i18n.t`).    |
| `model`                | Which Claude model to call.                                           |
| `max_retries`          | How many times to send validation feedback back to the model.         |
| `temperature`          | Sampling temperature for the rewrite call.                            |

The banned word and phrase list itself, and the hard/soft rule
descriptions, live in `src/rules/writingRules.ts`. They are not
config-driven on purpose: they are the floor every project shares.
`extra_banned_words` and `extra_banned_phrases` only ever add to that
floor, never subtract from it.

## What this does not do

It does not touch Python, Go, Rust, or any language outside the
JS/TS/JSX/TSX/JSON family; the extractor is Babel-based, so it stops
there for now. It does not guarantee the soft rules; it enforces the hard
ones and flags the rest for a human. It does not run inside an editor by
itself; the `--dry-run` plus `apply` pair is the seam a plugin would call,
but writing that plugin is a separate project. And it will not fix a
string whose meaning depends on business context CopyShed does not have;
`target_audience`, `brand_voice`, and `goals` are the only context you
get to hand it, so a vague config produces vague rewrites.

## Project layout

```
src/
  cli.ts              command wiring
  config.ts            config schema, defaults, loader
  rules/
    writingRules.ts    the house style, baked in
    validator.ts        hard-rule checker + soft-rule heuristics
  extract/
    jsExtractor.ts      Babel-based extraction for JS/TS/JSX/TSX
    jsonExtractor.ts     leaf-string extraction for JSON locale files
    extractor.ts         dispatch by file extension
  ai/
    client.ts            Anthropic SDK wrapper
    prompt.ts             system/user prompt construction
    rewrite.ts            call + validate + retry loop
  patch/
    applyPatch.ts         MagicString-based in-place file patching
  cache/
    cache.ts              report read/write for dry-run + apply
  ui/
    diff.ts, table.ts, prompts.ts   terminal rendering and review flow
  commands/
    init.ts, scan.ts, rewrite.ts, apply.ts, check.ts
```
