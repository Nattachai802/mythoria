---
target: AI Control Board (/dashboard/ai-control)
total_score: 24
p0_count: 2
p1_count: 1
timestamp: 2026-08-27T08-45-21Z
slug: app-dashboard-main-ai-control-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Server-rendered and always fresh, but no "as of" timestamp on the stat row |
| 2 | Match System / Real World | 4 | Thai-first labels; provider/model/temp jargon is appropriate for this dev-facing page; หลัก/สำรอง/ภายใน Python ordering reads clearly |
| 3 | User Control and Freedom | 1 | Nothing can be collapsed, filtered, or hidden — forces a full scroll past everything regardless of what the user came for |
| 4 | Consistency and Standards | 2 | Provider badge colors hardcoded twice independently (`page.tsx` vs `feature-card.tsx`'s `PROVIDER_STYLE`); ignores the app's own collapsible-section pattern already established in `EchoScorePanel` |
| 5 | Error Prevention | 3 | No destructive actions to guard; `errorDetail` is hover/title-only, not keyboard-reachable |
| 6 | Recognition Rather Than Recall | 3 | Nothing hidden, but the tradeoff is signal dilution (see #8) |
| 7 | Flexibility and Efficiency | 1 | No filter/search/sort anywhere — no "show only OFF," no "show only errors," despite those being the two real reasons to open this page |
| 8 | Aesthetic and Minimalist Design | 1 | The same provider/model fact is shown 3x in 3 shapes (model-map table, per-card badges, recent-runs column); reference data and daily-check data get identical visual weight |
| 9 | Error Recovery | 2 | Status is color-coded per row in Recent Runs, but there's no aggregate "N errors today" — has to be found by reading up to 40 rows |
| 10 | Help and Documentation | 4 | CLI hints are terse, in-context, single-line — correctly treats editing as out of scope for a view-only page |
| **Total** | | **24/40** | **Needs restructuring — content and copy are solid, the failure is entirely layout/hierarchy/disclosure** |

## Anti-Patterns Verdict

**LLM assessment**: This page is heavy from *structure*, not raw data volume — 14 features and a 40-row log are legitimately dense for this product register, and Stripe/Linear ship tables that size without feeling bloated. What actually breaks trust is that the model→provider mapping is rendered three separate times in three different shapes back-to-back (the full model-map table, the badge row inside every feature card, and the model column in Recent Runs), with zero distinction between "reference data checked once" and "live data checked daily." It reads as four independently-reasonable sections concatenated, not one designed page.

**Deterministic scan**: `detect.mjs` returned no findings (`[]`) for `page.tsx` and `components/dashboard/ai-control/`. No AI-slop pattern tells here — this is purely a hierarchy/disclosure problem, not a template-cliché problem.

**Visual overlays**: Not run — no dev server was up and the route needs auth + a live DB, same constraint as the plot critique. All findings are source-level.

## Overall Impression

The page isn't wrong, it's unsorted. Every individual section is reasonable on its own (the stat cards are genuinely well-judged; the model-map table and feature cards are each fine tables/cards in isolation) — the problem is that a read-only reference table (model map, checked rarely) sits in prime scroll position ahead of the two sections someone actually opens this page to check (is anything broken, what ran recently), and the 14-feature grid ignores a grouping the codebase's own data model already provides for free. This is a progressive-disclosure problem with an off-the-shelf fix already living elsewhere in the app.

## What's Working

1. **The three summary stat cards** — terse label + `tabular-nums` big number, nothing extra. The one section that already matches "density with breathing room."
2. **`AiFeatureCard`'s internal layout** — label, 2-line-clamped description, ON/OFF badge, chain badges, and quota line separated by a `border-t`; chain step detail (order/temp/maxTokens) is pushed into a tooltip instead of always shown — real micro-level progressive disclosure, even if tooltip-only has an accessibility gap.
3. **The CLI hint copy** — one line, correctly treats editing as out of scope for a view-only board instead of building a fake settings UI just to look complete.

## Priority Issues

**[P0] The model-map table duplicates the per-card provider/model badges directly below it**
Why it matters: the same "which model powers X" fact is read twice, in two different formats, in one uninterrupted scroll — pure redundant scanning for something checked rarely.
Fix: wrap the model-map section in the same collapsible-header pattern this codebase already has in `EchoScorePanel` (click header → `aria-expanded` → rotating chevron), default **collapsed**, with a one-line closed summary like "14 ฟีเจอร์ · 3 providers."
Suggested command: `/impeccable distill`

**[P0] Recent Runs has no aggregate error signal and no row cap**
Why it matters: the actual reason to open this page — "is anything broken right now" — requires reading up to 40 rows hunting for red/amber text, and the stat row up top doesn't surface an error count at all.
Fix: surface an error count (a 4th stat card, or inline in the section heading: "AI runs ล่าสุด · 2 ข้อผิดพลาดวันนี้"), and default the table to the latest 10 rows behind a "แสดงทั้งหมด (40)" expand — a clean day should render almost nothing.
Suggested command: `/impeccable layout`

**[P1] The 14-feature grid drops a grouping the data already has**
Why it matters: `lib/ai-features.ts` itself comments the registry into "LLM ฝั่ง Next.js" (10 features) vs. "ผ่าน Python microservice" (4 features) — the UI flattens all 14 into one undifferentiated grid, which is exactly what causes the cognitive-load "chunking" failure below.
Fix: split the feature-status section into the same two labeled groups the registry already defines, or add a lightweight segmented filter (ทั้งหมด / เปิด / ปิด / เกิน quota) above the grid.
Suggested command: `/impeccable layout`

**[P2] No visual hierarchy between reference content and live content**
Why it matters: model map, feature grid, and Recent Runs all get identical heading + Card treatment, so the least time-sensitive section occupies the earliest scroll position, ahead of the two that change daily.
Fix: once the model map collapses by default (P0 above), consider moving it below Recent Runs entirely — it's genuinely the lowest-priority content for someone checking "what changed / what's broken."
Suggested command: `/impeccable layout`

**[P2] "custom" override badge shows that something changed but not what**
Why it matters: seeing a quota is overridden without seeing the default it overrode forces a context-switch out to the CLI just to understand the change.
Fix: extend the existing tooltip to read "override: {value} (default: {defaultDailyLimit})" — `defaultDailyLimit` is already on `AiFeatureView`, so this is copy-only.
Suggested command: `/impeccable clarify`

## Persona Red Flags

This is a read-only, no-destructive-actions, developer-facing utility page — the standard 5 personas (first-timer confusion, mobile, accessibility-dependent, stress-tester) mostly don't apply the way they do on the plot canvas. The one that fits is:

**Alex (power user, here: the developer checking the board)**: opens the page to answer one of two questions — "is anything broken" or "what powers what" — and both require scrolling past the *other* question's content first. There is no keyboard-reachable way to see `errorDetail` (title-only tooltip), no sort/filter on Recent Runs, and no shortcut to jump straight to the feature grid. A page built for a fast daily glance currently requires a full top-to-bottom read every time.

## Minor Observations

- Model-map continuation rows (a feature's 2nd fallback step) render an empty "ฟังก์ชัน" cell (`i === 0 ? f.label : ""`) — fine visually, but a screen reader hits a blank cell with no feature context on those rows.
- `STATUS_STYLE` (success/error/blocked) is text-color-only with no icon at `text-xs` size — worth a contrast check on the amber variants against the dark theme, since color-only status coding is a soft WCAG flag.
- Two explanatory footnote paragraphs bookend the page (model-map footnote + closing hint) — both always-visible prose competing with real data; could consolidate into one help affordance.
- The "ฟีเจอร์ AI ที่ปิดอยู่" stat is computed inline in JSX rather than in `server/ai-control.ts` — signals it was bolted on after the data contract was set; an "over quota" count (more actionable than "off") would need the same ad hoc treatment today.
- Provider→color mapping is hardcoded independently in both `page.tsx` and `feature-card.tsx`'s `PROVIDER_STYLE` — low risk today, but a 4th provider added to one and not the other will desync badge colors for the same provider across sections.

## Questions to Consider

1. Is the model map ever checked more than once, or is it a dump of the registry for completeness? If it's truly reference-only, should it collapse on this page, or move to its own route entirely?
2. This page bundles three different jobs — "is anything broken" (diagnostic), "what did I use today" (informational), "what powers what" (reference). Would three tabs serve better than trying to fix hierarchy within one long scroll?
3. `EchoScorePanel`'s click-to-expand section already exists in this codebase — was reusing it here considered and rejected, or just never reached? This page is a low-risk place to standardize the dashboard on one collapsible-section component instead of solving disclosure ad hoc per page.
