# NarraBench — taxonomy of what is measurable in narrative

Source: Hamilton, Wilkens, Piper, *NarraBench: A Comprehensive Framework for Narrative Benchmarking*, arXiv 2510.09869 (2025)

## Not a metric

NarraBench scores nothing. It is a **map of what narrative contains that can be measured, and what kind of evaluation each property requires**. No detection framing to remove.

Its main engineering use is as a **shared schema** — for data modeling, field naming, and auditing which dimensions a system currently ignores.

## Structure

- **4 root dimensions**: story, discourse, narration, situatedness
- **12 features** across them: Agent, Social Network, Event, Plot, Structure, Setting, Time, Revelation, Perspective, Style (plus two StoryScope did not adopt)
- **50 aspects** at the leaf level — e.g. Agent covers name, role, attributes, emotions, motivation; Plot covers topic, plot, plotline, moral, obstacle, conflict, archetype

## The most useful part: SMV criteria

Every aspect is tagged on three axes that determine **how it must be evaluated to avoid a category error**.

| Axis | Values | Engineering consequence |
| --- | --- | --- |
| **Scale** | local / meso / global | whether chunk-level evaluation suffices or full context must be loaded — a direct cost and architecture constraint |
| **Mode** | discrete / progressive / holistic | single judgment, tracked across the text, or whole-work assessment |
| **Variance** | deterministic / consensus / perspectival | one right answer, broad agreement expected, or **legitimate disagreement between readers** |

**Variance is the axis to actually use.** Perspectival aspects — suspense, curiosity, surprise under Revelation — cannot be scored by one model and reported as a fact. Design them to return distributions or collect multiple raters.

Conversely, deterministic + local aspects (name, location, dialogue) automate cheaply and are uncontestable; they are the natural first layer of any extraction pipeline.

## What it can drive

- **Coverage audit.** Lay out the 12 features and mark which your system touches. Untouched dimensions are where unmeasured failures accumulate.
- **Field naming.** Using aspect names instead of invented ones keeps the data model interoperable with later research.
- **Automation priority.** Sort by SMV: deterministic+local first, perspectival+global last or never.
- **Context budgeting.** Global aspects force whole-work context; knowing which they are prevents discovering the cost late.

## Fails when

- **It produces no numbers.** Pair it with a metric from another card to fill any slot it identifies.
- **Existing benchmark coverage is uneven across features.** The paper's own coverage wheel shows some features well served and others barely addressed. Sparse coverage means building from scratch, not picking something off the shelf.
- **Rooted in Western literary theory,** like TTCW. The structure travels across traditions better than the evaluative criteria do, but it is not neutral.
