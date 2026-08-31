# Interpretable style vectors (LISA)

Source: Patel et al., *Learning Interpretable Style Embeddings via Prompting LLMs*, arXiv 2305.12696v2

## What it actually measures

**Presence probability of named stylistic attributes in a text.** Each of the 768 dimensions is constrained to 0.0–1.0 and corresponds to a human-readable attribute ("The author ..."), rather than an opaque coordinate.

No authorship-detection framing to strip. The paper's contribution is representational: same downstream utility as neural style embeddings, but every dimension can be read.

## How it is built (the reusable pipeline shape)

**Stage 1 — synthetic annotation.** Prompt an LLM zero-shot to describe the style of a passage. 93 prompts total: 6 open-ended (grammar, vocabulary, broad dimensions) plus 87 targeted at specific linguistic features. Source corpus: 10,000 posts from 1,000 authors (Reddit MUD).

**Stage 2 — standardization.** A second zero-shot prompt rewrites free-form paragraphs into uniform short declaratives beginning "The author...". This is what makes the outputs poolable across texts. Result: STYLEGENOME, ~5.5M text–attribute pairs.

**Stage 3 — distillation into a scorer (SFAM).** `SFAM(text, attribute) → 0.0–1.0` agreement score. EncT5 (t5-base) with a binary classification head, trained on STYLEGENOME positives against negatives retrieved by SBERT similarity (dissimilar attributes as hard negatives).

**Stage 4 — dimension selection.** 87 dimensions come from the targeted prompts; the remaining 681 are filtered from ~1.3M unique attributes by frequency threshold plus SBERT cosine deduplication to drop near-duplicates.

**Stage 5 — inference collapse.** Running SFAM 768 times per text is prohibitive, so the 768-dim outputs are precomputed over 1M posts and distilled into one EncT5 regression model with 768 labels — **the full vector in a single forward pass.**

**Stage 6 (optional) — metric learning.** Raw LISA dimensions are interpretable but their Euclidean distances are not calibrated for retrieval. A weight vector or matrix on top, trained with triplet loss (same author closer, different author farther), fixes the distance metric while preserving dimension semantics.

This six-stage shape — *LLM annotates → standardize → distill to small scorer → select dimensions → collapse to one pass → optionally learn a metric* — is the generalizable artifact here. It applies to any property where you want interpretable per-dimension scores and cannot afford an LLM call per dimension at serving time.

## High / low

A dimension near 1.0 means the attribute is judged present; near 0.0 means absent. There is no global "good" direction — the vector is a description, not a score.

For a per-work baseline, the useful quantity is not any single dimension but the **profile**: which dimensions sit at extremes relative to the corpus mean, and which drift over time. Distances only carry meaning after Stage 6.

## Required to interpret

- **A fixed attribute list.** Dimensions are only comparable across texts under identical dimension definitions. Version the list; changing it invalidates all stored vectors.
- **The scoring model.** Values are the distilled model's judgments, not measurements of the text.
- **Enough text per sample.** See `references/sample-size.md` — a style profile computed over a few hundred words is mostly noise regardless of how interpretable the dimensions are.
- **A corpus mean to deviate from.** An isolated vector says little; the signal is in deviation from a baseline.

## What it can drive

- **Per-work or per-author style baselines** with named dimensions, so drift can be reported as "these attributes moved" instead of "cosine distance is 0.31".
- **Drift detection across chapters** — same profile computed per chapter, flagged when a dimension leaves its band.
- **Editorial guardrails** — constraints expressed in the same vocabulary the system measures, since the dimensions are natural-language attributes.
- **Retrieval and attribution** after triplet-loss reweighting.

## Fails when

- **Dimensions are LLM opinions, not measurements.** "The author uses complex sentence structures" is a judgment made by a distilled model trained on GPT-3 judgments. Interpretability is not validity — a readable label can still be wrong.
- **English Reddit provenance.** Attribute inventory and the distilled scorers derive from informal English social text. Thai prose, or literary registers, sit outside the training distribution; the pipeline can be rerun, but the released dimensions cannot be assumed to transfer.
- **Raw distances mislead** before Stage 6. Do not rank by Euclidean distance over unweighted LISA vectors.
- **Dimension count is a design artifact.** 768 was chosen to match conventional embedding size, not because style has 768 independent axes. Many dimensions are correlated.
