# Conditional probability curvature — a cheap signal from logits

Source: Bao et al., *Fast-DetectGPT: Efficient Zero-Shot Detection of Machine-Generated Text via Conditional Probability Curvature*, ICLR 2024 (arXiv 2310.05130)

## Caveat: this one cannot be separated from detection

Curvature is defined to be meaningful only **as a contrast between two populations**. A single value says nothing about the quality of a text. If the user wants a property measurement, this is the wrong card — send them to `sui-generis.md`.

What is reusable is the **architectural idea**: how to build a signal that costs one forward pass.

## What it computes

Compare the log-probability of the observed token against the distribution over alternative tokens at the same position, standardized:

> d̂ = ( log p(x) − μ̃ ) / σ̃

where μ̃ and σ̃ come from conditionally sampled alternatives at each position.

In plain terms: **at this position, was the chosen token an unusually preferred option relative to the alternatives available in the same context?**

## The engineering lesson worth keeping

The predecessor, DetectGPT, perturbed the passage ~100 times and rescored each variant, because changing one token forces re-evaluating the whole Markov chain.

Fast-DetectGPT redefined the quantity over **per-position conditional probabilities evaluated independently**. That allows 10,000 alternative samples from **a single forward pass** — they all read off the same predictive distribution — and when one model does both sampling and scoring, an analytical solution exists with no sampling at all.

**Transferable rule:** when a metric requires repeated generation to estimate something, first ask whether it can be redefined to read from a distribution you already computed. Expense often lives in the form of the definition rather than in the quantity itself. Contrast with Sui Generis, where generation is unavoidable because the quantity is about *plot*, not *tokens*.

## Required to interpret

- **Logit access.** Unusable against APIs that do not return log-probabilities — in practice this eliminates most hosted options.
- **A named scoring model.** In black-box settings a surrogate works, resting on the assumption that models share characteristics from pretraining on human text.
- **Two populations and a calibrated threshold.** There is no interpretable absolute value.

## Non-detection uses

- **Cheap first-pass filter** ahead of far more expensive analysis (SG scoring is ~3 orders of magnitude more costly per unit), to bound how much text reaches the deep stage.
- **Locating unusually flat spans** where every token was an expected choice. This correlates loosely with monotony, but flag it as an interpretation the paper does not validate.
- **Estimating model familiarity with a corpus** — useful when choosing a base model for fine-tuning or gauging domain novelty.

## Fails when

- **Asked about quality.** Very good and very bad writing can produce similar curvature.
- **Compared across models or tokenizers.** Values are not portable.
- **Applied to Thai text.** Tokenization in a script without word delimiters makes per-token values much harder to interpret, and the paper does not test this case.
- **Treated as a complete filter.** Anything passing the cheap stage is not clean, only unseen by this instrument — budget for false negatives explicitly.
