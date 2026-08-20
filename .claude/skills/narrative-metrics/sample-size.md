# Sample size floor for stylometric reliability

Source: Eder, *Does Size Matter? Authorship Attribution, Small Samples, Big Problem*, DH2010 (ab-744)

## Why this card is cross-cutting

This is not a metric. It is the **precondition that decides whether any style measurement in this skill means anything at all.** Word frequencies are random variables, so their estimates depend on the size of the text population sampled. Below a certain sample length, a stylometric score is dominated by sampling noise and reports nothing about the author.

Read this card whenever the user plans to compute style features per chapter, per scene, per commit, or per any unit they chose for product reasons rather than statistical ones.

## The numbers

Attribution success rate rises steeply with sample length, then flattens. The flattening point is the operating threshold.

| Material | Stabilization point |
| --- | --- |
| Novels | 5,000–10,000 words |
| Poetry, Latin prose | ~2,500–3,500 words |
| Absolute floor, any genre | **2,500 words** |

Below 5,000 words results are poor; **below 3,000 words they are statistically worthless.** Tested across English, Polish, German, Hungarian, French, Latin, and Ancient Greek, over novels, epic poetry, and non-fiction.

## Three sampling strategies, and which to use

**Words (bag-of-words).** 500 randomly selected words concatenated, scaled up to 20,000. Highest measured effectiveness — random sampling averages out internal variation.

**Passages (continuous blocks).** Contiguous excerpts of the same lengths. **Always performed worse than randomized sampling**, with consistently wider score dispersion, attributed to internal variation within a text such as narrative versus dialogue. Highly inflected languages showed a smaller gap.

**Chunks (concatenation).** For when no single work is long enough: concatenate random chunks into a uniform 8,192-word sample. Chunk sizes from bi-grams up to 4,096-word blocks were all acceptable; smaller chunks performed slightly better.

The engineering consequence is direct: **the natural unit of your product (a chapter, a scene) is a continuous passage, which is the weakest sampling mode.** If you need a per-work profile, sampling chunks across the whole work beats profiling one contiguous section of equal length. If you need per-chapter profiles specifically, expect wider variance and set bands accordingly rather than treating a single chapter's numbers as a point estimate.

## Method independence — the strongest result here

- **Algorithm-agnostic.** Curve shape and stabilization points are identical across Delta, Delta Prime, cluster analysis, and multidimensional scaling.
- **Parameter-agnostic.** Culling, MFW count, pronoun deletion change absolute accuracy but not the shape of the minimal-size curve.

So this is not a quirk of one method. Swapping in a better classifier does not buy a shorter minimum sample — the constraint is in the data, not the estimator.

## What it can drive

- **Choosing the analysis unit** before any implementation work.
- **Gating.** Refuse to emit a style profile below the floor rather than emitting one with a confidence caveat nobody reads.
- **Aggregation design.** Roll several short chapters up to a valid window instead of scoring each.
- **Cost planning.** The floor sets minimum corpus size for a per-work baseline to be worth building at all.

## Fails when

- **Extrapolated to neural embeddings without checking.** The experiments cover word-frequency methods with nearest-neighbour classification. The underlying argument — frequency estimates need population size — plausibly extends to any frequency-derived representation, but the specific thresholds were not measured for transformer embeddings. Present the floor as a strong prior, not a proven bound, when the pipeline uses LISA-style vectors.
- **Applied to Thai without re-derivation.** Word-count thresholds assume word tokenization. Thai segmentation changes what a "word" is; inflected-language results suggest morphology shifts the numbers.
- **Read as sufficiency.** Passing the floor makes a number interpretable; it does not make it correct.
