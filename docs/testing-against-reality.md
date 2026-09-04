# Testing Against Reality: How We Shipped an Integration That Never Worked — and What It Took to Fix It

*Thomas Kraus — September 2026*

*The story behind a2ui-oat v0.3.0's real `@a2ui/web_core` adapter, and a
methodology for AI-assisted development that catches the bugs plausibility
can't.*

---

## The confession

a2ui-oat v0.1.1 shipped a function called `registerWithWebLib()`. Its job was
to register our renderer with Google's A2UI protocol engine. It had clean
JSDoc, a sensible signature, and a prominent place in our README's Quick
Start.

It also never worked. Not once, for anyone, ever.

`registerWithWebLib()` called three methods on the protocol engine —
`registerRenderer`, `registerFunction`, `setCatalogId`. None of those methods
exist in any published version of `@a2ui/web_core`. We verified this by
extracting the published npm tarballs (0.9.2 and 0.10.7) and grepping every
`.d.ts` file. The function was a contract against an imagined API: code that
*looked* like integration code, shaped by what a registration API *plausibly
would* look like, never tested against what the real one *actually* looks
like.

How does that happen? The same way it happens in a lot of AI-assisted
codebases right now: the integration target was represented in the codebase
only by its documentation and its vibes. No test ever imported the real
package. Every example hand-rolled its own message loop instead of going
through the "official" integration path — which, in hindsight, was the tell.

The interesting part isn't the mistake. It's what it took to replace fiction
with something real — because the fix surfaced a chain of *further* wrong
assumptions, each plausible, each written down confidently, each caught only
by executing against the real artifact.

## The methodology shift

The structural fix was one decision: **the published package becomes a test
dependency, and every integration claim gets executed against it.**

Not the docs. Not the monorepo source at HEAD (published packages lag and
diverge). The actual tarball that `npm install` delivers to users — because
that's the only artifact your users' code will ever meet.

Everything else followed from that decision:

1. **Design phase:** we extracted the published tarballs and verified every
   API signature we planned to use — constructors, return shapes,
   subscription semantics, export maps — directly from the shipped `.d.ts`
   and source. The design spec's "Open questions" section ended with one
   word: *none*. Every claim in it was checked against the artifact.
2. **Implementation phase:** `@a2ui/web_core@0.10.7` went in as a
   devDependency (runtime dependencies stayed at zero — the adapter is
   dependency-injected), and the new test suite drives the adapter through
   the real `MessageProcessor`, real `NodeResolver`, real zod validation,
   real signals. No mocks of the integration target, anywhere.
3. **Review phase:** every task's code review was required to *re-derive*
   load-bearing claims from the package source rather than trust the
   implementer's report — and the final whole-branch review probed runtime
   behavior empirically rather than reading diffs.

Here's the finding that justifies writing this up: **even with a
fully-verified design spec, execution against the real package kept proving
our written-down assumptions wrong.** Verification isn't a phase you
complete. It's a property you maintain.

## What reality disagreed with, step by step

Every one of these was in a carefully-written plan, drafted *after* the
tarball-verification pass. Every one was wrong anyway.

**The reactivity primitive that froze every surface.** The plan's drafted
adapter read resolved component properties with `peekValue` — the protocol
engine's non-tracking signal read. Plausible; it's right there in the API.
But the engine materializes children *after* their parent first renders
within the same message batch, and a non-tracking read means the render
effect never re-fires when they arrive. Result: every surface freezes on a
placeholder-only first render. The very first integration test failed on it.
One character of difference (`getValue`) — and the kind of bug no mock would
ever produce, because the mock would have been written from the same wrong
mental model as the plan.

**The component that doesn't have the property everyone assumes.** The
plan's test fixtures gave `Button` a `label` property. Our real catalog gives
Button a required `child` reference instead — and `@a2ui/web_core` (0.10.6+)
strictly validates every component batch against the catalog schema and
rejects the *whole batch* on any unknown key. So one wrong assumed property
didn't degrade one button; it silently killed every component in the same
message.

**The re-render design that leaked.** The plan specified a structural
re-render mechanism (a child-signature check with self-disposing effects).
Implemented as written, it had two real bugs: static property updates stopped
rendering at all, and effects stacked without bound across ancestor re-renders
— we measured the live-effect count climbing 3 → 6 → 8 → 10 → 12 → 14 across
five identical update cycles. The shipped design (memoized live-node map, one
persistent watcher per node) came from instrumenting the real signals
library, not from the plan.

**The wire shapes the spec got wrong.** The plan described action payloads
reaching the host as `{event: {name, context}}`-wrapped. The real engine
emits a flat `{name, surfaceId, sourceComponentId, timestamp, context}`
object — confirmed by reading the shipped `dispatchAction` source, twice,
independently. The plan also said malformed actions *throw*; the real engine
logs and silently drops them. Both corrections now live in our docs because
two agents read the same source and agreed, not because anyone remembered.

**The async event emitter that eats same-batch references.** A component
referencing a child defined *later in the same message batch* failed to
resolve — because the engine's internal `EventEmitter.emit` is `async` and
defers every listener but the first to a microtask *after* message processing
returns. You will not find that in any documentation. You find it by watching
your subscription fire too late and then reading `events.js` to learn why.

**And the one that survived nine rounds of review.** Every per-task review
passed. The final whole-branch review then did something none of the earlier
reviews had done: it typed a *second* character into a two-way-bound text
field. The rebuild mechanism was firing on every bound-value change — not
just structural changes — so every keystroke destroyed and replaced the
focused `<input>`. In a real browser: focus lost after the first character,
plus one leaked subscription per keystroke for the life of the surface.

Why did nine reviews miss it? Because the existing test fired exactly one
input event and asserted on the resulting *data value* — which was correct
regardless of whether the DOM element survived. A second test asserted a
captured element still showed the right text — and passed *because of the
bug*: the detached old element's orphaned subscription kept dutifully
updating it off-screen. The test suite was green and lying. Only an empirical
probe — checking *object identity and attachment*, across *two* keystrokes —
could tell the difference.

## What we'd tell other teams

**1. Your integration tests must import the artifact your users install.**
Not a mock shaped by the docs, not the upstream repo at HEAD. Mocks encode
your assumptions; the whole point is to find out where your assumptions are
wrong. Every genuinely dangerous bug above was invisible to any test that
didn't run the real package.

**2. A verified design document is a snapshot, not a warranty.** Our spec was
verified against the real tarball and still drafted code with a
surface-freezing bug, an invalid fixture, and a leaking effect design.
Verification of *signatures* doesn't verify *semantics* — materialization
order, validation strictness, event timing. Re-verify at the point of use,
every time. The plan is an argument; the artifact is the authority.

**3. Make reviewers re-derive, not re-read.** The reviews that earned their
cost in this project were the ones that opened the dependency's source and
traced the claim independently — or wrote their own throwaway probe. The
review that merely reads the diff and the implementer's report inherits the
implementer's blind spots at full price.

**4. Your tests can only see the bugs their assertions can express.** A test
that checks a data value can't see a destroyed DOM element. A test that
checks a captured reference's content can't see that the reference is
detached. When the property you care about is *identity* — element identity,
focus, subscription counts — assert on identity, and exercise the *second*
event, not just the first. The most expensive bug in this project sat behind
a green suite for six tasks because every assertion stopped one step short.

**5. This is what AI-assisted engineering should look like.** This entire
effort — design, nine implementation tasks, per-task adversarial review, a
whole-branch final review, and the fix the final review forced — was executed
by AI agents under a controller enforcing one rule: *no claim ships until
it's been executed against the real artifact*. The agents wrote the fictional
API's replacement, but they also caught each other's fictions, repeatedly,
because the process demanded evidence instead of plausibility. LLMs are
phenomenal at producing plausible code. Plausible is exactly the failure mode
that shipped `registerWithWebLib()`. The countermeasure isn't better prompting
— it's a harness where reality gets a vote at every step.

## The result

- `createSurfaceAdapter()` — a real integration over the published
  `@a2ui/web_core@0.10.7`: wire messages in, rendered reactive UI out, with
  list templates, nested references, two-way binding, validation
  (`Checkable`), theming, and disposal all driven through the real protocol
  engine and pinned by tests.
- 464 tests (up from 427), the new ones running against the real package —
  including regression tests for every discrepancy listed above, so none of
  them can come back silently.
- Still zero runtime dependencies: the consumer imports `@a2ui/web_core`
  (from npm or an ESM CDN) and injects it.
- One deleted fiction. `registerWithWebLib()` is gone, and the breaking
  change is documented as exactly what it was: the removal of code that
  could never have run.

The versions will move on — `@a2ui/web_core` will ship its v1.0 runtime
eventually, and we'll adapt to it the same way: tarball first, spec second,
tests against the artifact always.

---

*a2ui-oat is a lightweight, framework-free A2UI renderer built on Oat CSS —
39 components, 22 catalog functions, zero runtime dependencies.
[github.com/MisterTK/a2ui-oat](https://github.com/MisterTK/a2ui-oat)*
