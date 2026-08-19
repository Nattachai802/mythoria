---
name: narrative-metrics
description: >-
  Select, cost, and correctly interpret quantitative signals over narrative text
  when building AI writing systems — with the AI-detection framing stripped out,
  leaving what each metric actually measures, what high/low values mean, what is
  required to interpret a number at all, and where its construct validity breaks.
  Use this skill whenever the user is designing, scoping, or debugging a system
  component that has to measure something about generated or human prose — plot
  repetitiveness, pacing, output diversity across samples, creative quality
  scoring, automated writer feedback, reranking candidates, setting thresholds,
  or building an eval harness for a writing tool. Trigger it on open-ended
  engineering questions too, such as what could I even measure here, how do I
  know if this prompt change helped, or what does this score mean — and on any
  mention of Sui Generis, echo score, drop ratio, TTCW, NarraBench, StoryScope,
  Fast-DetectGPT, or mode collapse.
---

# Narrative Metrics — measurement design, not detection

## Framing

Most of the source papers validate themselves on a human-vs-AI classification task. That task is the **validation vehicle, not the construct**. Sui Generis measures how predictable a segment is given its prefix; a low score means *this beat was foreseeable*, which is a property of the writing regardless of authorship.

This skill exists to hand back **measurement instruments an engineer can put into a pipeline**, together with the conditions that make their output meaningful.

The user is an AI engineer, not a novelist. Answers should be about *what the system computes, what it costs, and what decision the number drives* — not about how to improve a particular manuscript. Never turn a metric into writing advice unless explicitly asked.

**Do not use this skill to answer "was this written by AI".** If asked that directly, answer normally and note that detection and property-measurement are different problems.

## Workflow

1. **Translate the symptom into a construct.** Users describe system behavior ("the five candidates we surface are all the same", "quality dropped after we switched models"). Identify the measurable property underneath. If it maps to several constructs, ask one clarifying question — do not guess.
2. **Open only the relevant cards** using the routing table below. Two to four is normal; reading all six is a sign the scope is still unclear.
3. **Return the comparison table** in the required format.
4. **Close with one short paragraph** naming where to start and why. Users want an entry point, not an inventory.

## Routing table: symptom → card

| User says | Underlying construct | Read |
| --- | --- | --- |
| output is generic / formulaic / predictable; want to locate weak spans | predictability of a segment given prior context | `references/sui-generis.md` |
| pacing collapses; tension released too fast; endings rushed | shape of the predictability curve across a text | `references/sui-generis.md` |
| need automatic beat / turning-point detection for segmentation or outlining | positions of unusually low predictability | `references/sui-generis.md` |
| N candidates come back near-identical; want real variety in a picker | intra-set diversity of a sample | `references/hivemind-diversity.md` |
| can we let a model score/rank outputs? is our LLM judge trustworthy? | calibration of automatic judges | `references/hivemind-diversity.md` |
| need a quality rubric, a review schema, or structured automated feedback | creative quality along independent axes | `references/ttcw.md` |
| need a data model, field names, tags, or coverage audit for narrative | taxonomy of measurable narrative properties | `references/narrabench.md` |
| need to turn prose into structured records before analysis | intermediate representation design | `references/storyscope.md` |
| what defaults will a model drift toward if unconstrained? | measured generation tendencies | `references/storyscope.md` |
| need a cheap first-pass filter before expensive analysis | token-level anomaly against in-context alternatives | `references/probability-curvature.md` |

If the symptom is not in this table, say so. Do not stretch a metric onto a problem it was not built for.

## Required output format

One table, these columns:

| Metric | What it actually measures | High / low means | Required to interpret | Fails when |

- **"What it actually measures"** must be written without the words *AI* or *human*. If that is impossible, the construct has not been separated from the detection task yet.
- **"High / low"** needs both directions. In this set, high is frequently not "good".
- **"Required to interpret"** is the load-bearing column: reference corpus, named scoring model, number of samples, logit access, fixed schema.
- **"Fails when"** is mandatory on every row.

Add a **Cost** column when the user is scoping a real implementation; omit it during conceptual discussion. Use prose instead of a table if there is genuinely only one candidate.

## Interpretation rules to surface whenever relevant

**A bare number means nothing.** Almost everything here is relative to the model that computed it, the sample count, and the corpus it is compared against. Derive thresholds from percentiles of the user's own corpus, never from constants copied out of a paper, and recalibrate on every model swap. Log the scoring model, decoding settings, and sample count alongside every stored score, or the history becomes uncomparable.

**Measuring is far cheaper than optimizing.** The Echoes authors generated with best-of-100 selection per step: the score rose, cost rose ~2000x, and the gap to human text persisted under finer-grained measurement. If the user is about to make a metric an objective, raise this first — gating, alerting, and narrow reranking are far better returns.

**Do not treat an LLM judge as ground truth.** Infinity-Chat found reward models and LM judges lose correlation with human ratings exactly (a) when candidates are close in quality and (b) when human raters disagree with each other. Both are the default condition in creative work. Judges are acceptable for discarding clearly-bad output, weakest precisely at ranking near-ties.

**Distinguish measurable from decidable.** NarraBench marks some aspects *perspectival*: readers legitimately disagree. Scoring those with a single model and reporting a point value is a category error — report a distribution or design for multiple raters.

## Scope limits

All six papers rest on English short-story corpora (WritingPrompts, Wiki, New Yorker, r/WritingPrompts). Constructs transfer to Thai text or serialized long-form fiction; **published numbers and thresholds do not**. A new reference corpus is required.

Segment-level metrics port to long-form more cleanly than whole-work metrics, because "ending" means something different in a serialized chapter. Anything anchored on the ending — drop ratio, the TTCW ending item — needs reinterpretation rather than direct reuse.
