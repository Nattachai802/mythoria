# Intra-set diversity / automatic judge calibration

Source: Jiang et al., *Artificial Hivemind: The Open-Ended Homogeneity of Language Models (and Beyond)*, NeurIPS 2025 D&B (arXiv 2510.22954) — Infinity-Chat dataset

This paper is not a detection paper, so little needs stripping. What does need changing is the **unit of analysis**: the paper measures models, while system work usually needs to measure *the batch of candidates just generated*.

## Two borrowable measurements

**1. Intra-set similarity** — sample many responses per prompt, compute mean pairwise sentence-embedding similarity within the set.

**2. Source concentration** — take the top-N most similar responses to a query and count how many distinct sources they came from. Few distinct sources means the sources are interchangeable. In the paper a "source" is a model; in a system it can be a prompt variant, persona, temperature setting, or any knob you believe is producing variety.

## Reference points worth remembering

- At top-p 0.9 / temperature 1.0: **79% of queries had mean pairwise similarity above 0.8.** That is baseline behavior, not an anomaly.
- min-p decoding reduced extreme duplication but left 81% of pairs above 0.7 and 61.2% above 0.8.
- Cross-model similarity runs 71–82%, and **cross-model similarity sometimes exceeds within-model similarity**.

That last point has a direct design implication: rotating providers to buy diversity returns less than most architectures assume.

## High / low

| | High | Low |
| --- | --- | --- |
| Intra-set similarity | the choices presented to a user are pseudo-choices, differing in wording only | the set genuinely spreads — verify it did not spread by drifting off-task |
| Source concentration (few distinct sources) | the knob you believe creates variety does not | the knob has real effect |

## Required to interpret

- **A named embedding model.** The 0.8 figure is tied to an embedding space; changing the encoder invalidates the threshold.
- **Enough samples.** The paper uses 50 per query. Concluding "diverse enough" from 3–5 draws is underpowered.
- **Recorded decoding settings.** Scores are uninterpretable without temperature / top-p / min-p.
- **A task-specific baseline.** Whether 0.8 is high depends on the task ceiling: five character names and five plot outlines cannot be equally diverse.

## Judge calibration — raise this whenever the user proposes model-based scoring

The paper collected dense human labels (18,750 absolute ratings, 12,500 pairwise, 25 raters) and compared them against LM perplexity scores, reward models, and LM judges. Two findings:

1. **Correlation with humans drops markedly when candidates are close in quality.**
2. **Correlation drops markedly when human raters themselves disagree.**

Both are the default condition in open-ended generation, not edge cases. Practical consequences:

- Judge used to discard clearly-bad output: acceptable.
- Judge used to rank near-ties: its weakest regime, which is exactly what ranking asks it to do.
- Judge used as a reward signal for training: propagates the miscalibration into the model.

When a system must choose among comparably good candidates, prefer surfacing options to a human over having a model decide.

## Fails when

- **Diversity is not quality.** A set that spreads because some members are off-task scores as diverse. Always pair with a relevance constraint.
- **Embedding similarity only weakly tracks plot-level repetition** (0.50 Spearman, see the sui-generis card). If the concern is repeated *story content* rather than repeated *wording*, this is the wrong instrument.
- **Decoding has a ceiling.** The paper's position is that decoding-side fixes cannot solve homogeneity, and pushing temperature further degrades coherence. Say so before a user tries to fix repetition with temperature alone.
