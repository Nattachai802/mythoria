# StoryScope — structured representation pipeline + measured generation defaults

Source: Russell et al., *StoryScope: Investigating idiosyncrasies in AI fiction*, arXiv 2604.03136 (2026)

## Caveat: this one does not fully separate from detection

StoryScope is a detection paper, and more importantly its **feature selection is defined by the human/AI label** — core features are those whose SHAP importance is stable and significant in the binary task. Remove the label and the selection criterion disappears with it.

Two things remain borrowable, and they must be kept distinct:

1. **The method** (convert prose to structured fields before analysis) — fully reusable.
2. **The descriptive statistics** (what models tend to do when unconstrained) — reusable as *known defaults*, not as quality criteria.

Not borrowable: the classifier and its macro-F1. That is the detection artifact itself.

## 1. Reusable method: structured intermediate representations

Instead of having a model read prose and answer directly, convert each text into fields against a detailed JSON schema (zero-shot, with per-dimension field specs — names/roles/motivations under Agent, causal ordering under Event), then run downstream stages over the fields.

Why it works: it **forces downstream reasoning onto narrative content instead of surface style**. This generalizes to most long-text analysis, not just detection.

Side benefit is compression: 2.7M tokens of raw prose reduced to ~686k tokens structured, which is what makes cross-text comparison affordable at all.

The pipeline has three stages — **templatize → cross-source comparison → feature discovery**. Keep them separate rather than collapsing them; they differ substantially in required reasoning depth and per-unit cost.

## 2. Measured generation defaults

From 61,608 stories. Read as "what a model drifts toward when nobody constrains it" — directly useful for deciding what a system must actively counteract.

| Tendency | AI | Human |
| --- | --- | --- |
| narrator states the theme explicitly | 77% | 52% |
| dialogue serving philosophical debate | 59% | 34% |
| vague, unnamed intertextual allusion | 72% | 50% |
| resolution driven by protagonist choice | 69% | 46% |
| no subplot at all | 79% | 57% |
| ending in internal realization/acceptance | 47% | 27% |
| emotion conveyed through bodily sensation | 81% | 38% |
| emotion named explicitly | 8% | 29% |
| explicit named references to real works | 24% | 47% |
| breaking the fourth wall | 39% | 67% |
| direct address to the reader | 7% | 28% |
| morally ambiguous protagonist | 38% | 59% |

One sentence: **the default mode is explicit, resolved, chronological, single-track.**

The engineering use is as a list of **options never considered** — useful for prompt design, generation constraints, or diversity injection. Absence of subplot by intent is fine; absence by default is what this table exposes.

## 3. Individual features reusable as questions

Features were authored as closed questions with discrete answer types (categorical, ordinal, scale, binary, multi-select). Examples that stand alone:

- **Depth of Recontextualization After Surprise** (1–5) — how much does the twist force reinterpretation of earlier events?
- **Agency in Resolution** — protagonist choice / mixed / external fate
- **Degree of Chronological Discontinuity** (1–5)
- **Narratorial Thematic Commentary** (yes/no)

Once the label is removed these are **well-posed questions, not validated instruments**. Say so if the user plans to build a scale on them.

## Required to interpret

- **A frozen schema.** Values compare only under identical schema and prompt.
- **Named models.** The paper used GPT-5.1 for template extraction and Gemini 3 Flash for feature assignment; results are tied to the annotator.
- **A comparable corpus** if the percentages above are used as reference points — they come from English short fiction written to writing prompts.

## Fails when

- **Used as targets.** Forcing subplots and fourth-wall breaks because "humans do it more often" optimizes the statistic, not the artifact.
- **Ported to serialized long-form.** Chapter-based fiction has structural reasons to be chronological and to leave threads open; the subplot and ending rows do not transfer.
- **Running feature discovery yourself.** The paper capped its discovery pool at 600 stories because that stage uses high reasoning effort over long inputs — it is by far the most expensive of the three stages.

## Methodological finding worth reusing

Rewriting AI text to remove stylistic tells (clichés, purple prose, redundant elaboration) barely moved narrative-feature classification: 95.5% → 93.9% macro-F1.

Detection-independent implication: **structural choices are orthogonal to prose style.** Polishing style does not change structure, and style-level instrumentation (stylometry, lexical diversity, MTLD) is blind to structural properties. If a system already has a style layer, this is why a narrative layer is not redundant with it.
