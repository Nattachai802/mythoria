# TTCW — a 14-item creative quality rubric

Source: Chakrabarty et al., *Art or Artifice? Large Language Models and the False Promise of Creativity*, ACM CHI 2024 (arXiv 2309.14556)

## What it actually measures

**Craft quality along 14 independent binary axes.** Each item is a yes/no question answerable from the text itself.

The authors state explicitly that TTCW is **not designed to penalize machine-generated work** — the goal is to score high-quality writing above low-quality writing fairly. Almost nothing needs stripping here.

Provenance: Torrance Tests adapted by 8 credentialed creative-writing experts, yielding 126 raw measures, reduced by inductive coding to 14.

## The 14 items

**Fluency**
1. Narrative Pacing — is the expansion/compression of time balanced?
2. Scene vs Exposition — appropriate alternation between dramatized scene and summary?
3. Language & Literary Devices — figurative language used with craft?
4. Narrative Ending — does the ending resolve rather than merely stop?
5. Understandability & Coherence — do the parts cohere into a whole?

**Flexibility**
6. Perspective & Voice — multiple perspectives rendered credibly, including morally ambiguous ones?
7. Emotional Flexibility — balance of interiority against external event?
8. Structural Flexibility — are turns both surprising and consistent with the established logic?

**Originality**
9. Theme & Content — does it offer a non-obvious idea?
10. Originality in Thought — free of cliché?
11. Form & Structure — formal or structural inventiveness?

**Elaboration**
12. World Building & Setting — is the world credible at the sensory level?
13. Character Development — are characters more than plot instruments?
14. Rhetorical Complexity — multiple layers of meaning, subtext present?

## High / low

The output is **a count of items passed out of 14**, not a continuous score. The items are independent by design: **failing one does not imply the work lacks creativity**; the aggregate is what carries signal.

For system design, the value is in **which items fail**, not the total — different failures route to different remediations, which makes this the natural schema for structured feedback rather than a scalar quality gate.

## Required to interpret

- **A specified rater population.** The paper used MFA-credentialed or published writers. Substituting an LLM changes results — the paper found LLM assessment does not yet match expert judgment on these items.
- **The full text.** These are holistic judgments; excerpt-level scoring is out of scope.
- **No reference corpus needed.** Unlike the statistical metrics in this set, TTCW applies to a single work standalone — which makes it the cheapest option to deploy when there is no baseline yet.

## What it can drive

- **Feedback schema.** The authors position LLMs as most useful in the *planning* and *reviewing* phases, because writers need specific rather than diffuse feedback. These 14 items supply the vocabulary for specificity.
- **Pre-publication checklist** in an editor tool.
- **Longitudinal tracking.** Store per-item results to observe which axes fail repeatedly across a corpus.

## Fails when

The authors concede TTCW **is not a universal standard**: 8 experts, each item traceable to 1–3 of them, skewed toward Western highbrow literary norms. Documented bias points:

| Item | Biased against |
| --- | --- |
| Flexibility 1 (multiple perspectives) | deliberately single-perspective work |
| Fluency 2 / Flexibility 2 (balance) | experimental work that deliberately unbalances |
| Fluency 4 (resolving ending) | traditions that deliberately withhold resolution |
| Originality 3 (formal invention) | creativity inside strict traditional forms, e.g. mythic structures |

For genre fiction, serialized web novels, or light novels where convention is the product, items 10 and 11 penalize exactly what the audience wants. Reweight or drop them, and record why.

## Bonus: expert-observed recurring patterns

Asked open-endedly, experts did not judge by grammar; their observations mapped onto TTCW items. Usable as a list of common craft failures with no authorship framing attached:

- endings that widen scope instead of resolving, or attempt several endings at once
- figurative language either opaque or so conventional it adds nothing
- dialogue without subtext, everything stated explicitly
- characters introduced who never affect the story
- repeating structural patterns, or sharp acceleration of story time after the opening scenes
