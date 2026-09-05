copyshed

A style guide checks grammar. copyshed checks whether the reader acts.

Most style tools stop at one question: does this string follow the rules. copyshed asks two questions. Does it follow the rules, and does it do the job it exists to do. A button and an error message both pass a grammar check, yet each fails the reader in a different way. copyshed treats this difference as the point, not a footnote.

What it does

copyshed scans your code for user-facing strings: JSX text, JSX attributes, object keys, JSON locale files. It sends each string to a model along with your brand voice, your audience, and a fixed house style. It checks the result against hard rules a script verifies with certainty, and soft rules a human still has to judge. It shows you a diff. You accept, edit, or skip. Nothing touches disk until you say so.

Two commands run without an API key: check and audit. Wire either into CI. check fails the build on a banned word, an em dash, a markdown artifact. audit scores your existing copy for reading grade, passive voice, and vague quantifiers, and hands back a table sorted from worst to best.

The floor: hard rules

A banned word is present or it is not. An em dash is present or it is not. copyshed blocks a rewrite failing a hard rule and sends the model back with the exact violation, up to your configured retry count. No exceptions. No project override weakens this list. One shared floor, enforced the same way for every contributor.

The judgment: soft rules

Active voice over passive. Short sentences next to longer ones, on purpose. Plain words over their fancier synonyms. A side taken instead of a hedge. No script checks these with full certainty, so copyshed puts them in the model's instructions and runs light heuristics, surfacing a warning when one fires. A warning asks a human to look. It never blocks a rewrite on its own.

The part most tools skip: what the string is for

Here is the gap in almost every style tool on the market. It treats a call-to-action button, an error message, and a headline as the same kind of writing. They are not.

A reader hits a button when motivation, ability, and a clear prompt land in the same moment. This is BJ Fogg's behavior model, built at Stanford's Behavior Design Lab: B equals motivation times ability times prompt. Copy supplies the prompt. Copy lowers the ability bar with fewer words and a plainer verb. Copy does not manufacture motivation out of nothing, and a tool faking it ends up faking urgency instead.

A reader hits an error message already stuck and looking for a way out. Nielsen Norman Group's guidance on error messages is specific: plain language, a precise account of what happened, one constructive next step, no blame placed on the reader. "The upload failed. Check your connection and try again" does the job. "You uploaded an invalid file" does not, even though both pass a grammar check.

A reader scans a headline; they do not read it. Nielsen Norman Group's research on how people read on screens found most visitors take in a minority of the words on a page. The first few words of a heading carry the weight the rest of the sentence never gets.

A reader clicks a button speaking to them, not about them. A widely cited test from Unbounce, run by Michael Aagaard, swapped "Start your free trial" for "Start my free trial." Clicks rose by roughly ninety percent. Later replications land in a smaller range, but the direction holds: first person in a call to action beats second person, often by a wide margin.

copyshed classifies each string by the role it plays: a call to action, an error, a success message, a headline, a label, or body text. It hands the model role-specific guidance drawn from this research, instead of one blanket voice for every string in your product.

The line it will not cross

Real trust signals move a decision: a specific number, a named result, an honest deadline. copyshed encourages all three. It will not manufacture the fourth kind, the fake one. Harry Brignull, who first named these tricks dark patterns and later folded them into the broader term deceptive patterns, catalogued manufactured urgency and confirm-shaming as two of the most common moves in commercial UI copy. copyshed flags both. A countdown timer with no real deadline behind it, and a decline option worded to make the reader feel foolish for saying no, both get a warning instead of a rewrite playing along.

This is a line, not a suggestion. Persuasion needing a lie to work is not persuasion. It is a trick, and it costs you the reader's trust the moment they notice. Readers notice.

The score

Run audit and every string gets a heuristic clarity score from zero to a hundred: reading grade, passive voice density, vague quantifiers, banned words, an em dash if one slipped through. Say this plainly, because a number this easy to read invites overconfidence: the score is a smoke alarm, not a verdict. It does not tell you if a claim is true. It does not tell you if a joke lands. It exists so a team spends its limited review time on the things a script has no way to judge, and skips the strings a script already caught.

Commands

copyshed init writes a config file and asks who reads your copy, what your brand voice sounds like, and what this copy needs to accomplish.

copyshed scan lists strings without calling a model. Free, instant, a first look at what copyshed would touch.

copyshed check fails the build on a hard rule violation. No API key required. Put this in CI today.

copyshed audit scores existing copy for clarity and specificity. No API key required. Put this next to check, or run it alone to find your worst offenders before touching a single line.

copyshed rewrite calls the model, validates every suggestion, and walks you through each one with a diff and a before-and-after clarity score. Add the dry-run flag to save a report without touching a file. Add -y to accept every passing suggestion and skip the rest.

copyshed apply reviews and applies a saved report, later, on your own schedule.

Configuring the voice

copyshed.config.json holds your target audience, your brand voice, your goals, and any words or phrases your team bans on top of the built-in list. It also holds the key lists telling copyshed which strings play which role: cta_keys, error_keys, success_keys, headline_keys, label_keys. A project with an unusual naming scheme should edit these directly rather than fight the defaults.

reading_level_target sets the reading grade audit and rewrite aim for. Eight is the default, in the range most consumer-facing writing advice recommends. Raise it for a technical audience. Lower it for a general one.

Where this came from

Every claim about persuasion and reading behavior in this README traces back to a named source: Fogg's behavior model, Nielsen Norman Group's error-message and reading-behavior research, the Aagaard button-copy test, Cialdini's principles of influence, Brignull's cataloguing of deceptive patterns. None of it is copyshed's invention. copyshed's job is smaller and more useful: put this research in front of the model at the exact moment it writes your copy, then check the result against a floor no amount of persuasive flourish gets to lower.
