# Echo score / Sui Generis / Drop ratio

Source: Xu et al., *Echoes in AI: Quantifying lack of plot diversity in LLM outputs*, PNAS 122(35), 2025 (arXiv 2501.00273)

## What it actually measures

**How predictable a segment is given the preceding context** — operationalized by sampling continuations from a cut point and checking how often the real segment's plot content appears among them.

Nothing in that definition references authorship. Human-written passages score low whenever they are standard beats.

## Three levels, kept distinct

**1. Echo score** `p(i,j)` — cut the text at position `j`, sample K continuations from that prefix, measure the fraction in which segment `s_i`'s plot content appears. A 0–1 value per (segment, cut point) pair.

**2. Sui Generis** `SG_i` — aggregate echo scores over all earlier cut points with exponential decay `λ^j`, weighting short prefixes more heavily:

> SG_i = ( −Σ λ^j · log p(i,j) ) / ( Σ λ^j ),  λ < 1

Rationale: being predicted from little context is stronger evidence of formulaic content than being predicted once most of the story is known.

**3. Drop ratio** — shape of the SG curve; does it spike then immediately collapse?

> drop_i = max( (SG_i − SG_{i+1}) / SG_i − θ , 0 )

## High / low

| | High | Low |
| --- | --- | --- |
| Echo score | segment is an expected beat for this context | segment sits outside the model's expectation |
| Sui Generis | text as a whole is hard to anticipate | follows a template |
| Drop ratio | tension raised then discharged immediately | tension sustained past the peak |

The per-segment distribution is more useful than the mean. High-SG segments align with major turning points, which makes the score usable as an **automatic beat detector** — a use with no detection component at all.

Two distinct low-score profiles the paper separates, which warrant different engineering responses: (1) bland relative to the prompt, (2) varied but assembled from components that recur frequently across generations.

## Required to interpret

- **A named continuation model.** The score is defined against that model's distribution; swapping it shifts every value. Store it with the score.
- **A plot-equivalence judge.** The paper prompts an LLM to decide "same plot content or not" — not string or embedding matching.
- **A reference corpus.** SG = 7.2 is meaningless alone; compare within a work or against your own baseline.
- **Fixed K and λ across any comparison.** Moving K from 20 to 100 changes conclusions because it resolves repetition more finely.

## Cost

LLM calls per work = `n + K·n(n−1)/2`, where n = segment count.

A 10-segment, ~500-word story ≈ 910 calls ≈ 1.4M tokens ≈ **$7** at 2025 GPT-4.1-class pricing.

Cost is **quadratic in segment count**, which dominates every design decision here. The effective lever is cutting fewer points: cut at scene boundaries rather than paragraphs, or compute echo scores only in a region of interest. Raw echo scores retain the positional information; the full SG aggregation is often unnecessary.

## What it can drive

- **Localization** — flag which spans are predictable; no aggregate score needed.
- **Structure extraction** — SG peaks as candidate turning points for outlining, chunking, or summarization anchors.
- **Pacing check** — drop ratio is free once echo scores exist.
- **Reranking at generation time** — sample M candidate segments, keep the highest SG.

## Fails when

- **It cannot separate "surprising" from "incoherent."** Nonsense scores high because the model also fails to predict it. Pair with a coherence or consistency check before treating it as a quality signal.
- **Transitional and setup passages score low by construction.** Driving every segment upward damages structure.
- **Deliberately quiet resolutions produce high drop ratio.**
- **θ has no published default.**
- **Goodhart.** Best-of-100 generation gained +5.3 points at ~2000x the calls, and still trailed human text by 6.4 points under SG-100. Note that measurement scales linearly in K while score-chasing scales in K×M.

## Why prompting instead of cheaper similarity metrics

Spearman correlation with human judgments of "same plot": prompting-based **0.85**, embedding similarity 0.50, ROUGE-L 0.46, Self-BLEU 0.33, n-gram diversity 0.23, compression ratio 0.07.

Transferable point: surface-overlap metrics do not capture semantic plot repetition. If the requirement is semantic, starting with n-grams because they are cheap measures a different thing, not the same thing worse.
