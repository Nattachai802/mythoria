# Evaluating style imitation

Source: *Catch Me If You Can? Not Yet: LLMs Still Struggle to Imitate the Implicit Writing Styles of Everyday Authors*, arXiv 2509.14543

## What it actually measures

**Whether generated text lands inside a target author's style distribution**, where the target is conveyed only by in-context demonstrations — no explicit style instruction like "write sarcastically". The paper calls this *implicit style imitation*; the target property is an author's idiolect.

Setup: k historical samples from author A (typically k=5) plus a semantic directive, against a zero-shot baseline.

## The four-part evaluation suite — the main reusable artifact

Any system that claims to write "in the user's voice" needs all four. Each catches a different failure, and the first three can be satisfied by output that fails the fourth.

**1. Authorship Attribution (AA)** — multi-class. Train a classifier on the original corpus, feed it the generated text, check whether it predicts author A. Coarse but cheap; tells you whether the output lands in the right region at all.

**2. Authorship Verification (AV)** — binary. Does the generated text and a held-out real sample from A read as same-source? Stricter than AA, because AA only needs A to be the closest of the enumerated authors.

**3. Stylistic feature alignment** — distributional distance over explicit stylometric features: lexical (vocabulary richness) and syntactic (POS distribution, dependency tree depth), compared against author A's historical distribution. This is the diagnostic layer: it names *which* features are off, where AA and AV only give a verdict.

**4. Semantic preservation** — embedding cosine similarity between the output and the intended semantic directive. Guards the failure mode where style alignment improves by drifting off-topic. **Never run 1–3 without 4**; style metrics are trivially gameable by ignoring the instruction.

## High / low

| Signal | High | Low |
| --- | --- | --- |
| AA / AV | output falls in the target author's region | imitation failed, or the author's style is not separable |
| Feature distance | output diverges on named stylometric features | feature distributions align |
| Semantic similarity | instruction followed | style may have been bought by abandoning content |

## The headline finding, as a design constraint

Imitation succeeds on **structured, formal domains** (corporate news, professional email) and fails on **unstructured, personal ones** (forum posts, personal blogs).

The stated interpretation: models capture explicit structural artifacts — format conventions, register, boilerplate — but do not construct the high-dimensional implicit distribution that constitutes an everyday author's idiolect. This is framed as a limitation of ICL for deep personalization, not of one model.

For a writing tool this sets the expectation directly: few-shot prompting will approximate an author's formatting and register, and will not reproduce their voice. Systems promising "writes like you" from a handful of samples are promising the part that does not work. Treat explicit, extracted, named style constraints as the more reliable path than expecting ICL to absorb voice implicitly.

## Required to interpret

- **A trained AA/AV classifier over your own author population.** Both are relative to the candidate set — AA accuracy across 50 candidate authors and across 5 are not comparable numbers.
- **Enough text per author** to train the classifier and to characterize the feature distribution. See `references/sample-size.md`; this is where a style-imitation eval most often fails silently.
- **A fixed k and a zero-shot baseline.** Without the baseline you cannot tell whether the demonstrations contributed anything.
- **Domain labels.** Aggregate scores across mixed domains hide the effect, since formal and informal domains behave oppositely.

## Fails when

- **The author is not separable to begin with.** Low AA may mean imitation failed or may mean this author has no distinctive signal. Check the classifier's accuracy on *real* held-out text from the same author first — that is the ceiling.
- **Reported without semantic preservation.** See above.
- **The classifier keys on topic rather than style.** An author who always writes about one subject makes attribution easy for the wrong reason. Control for topic before believing the number.
- **Ported to Thai unchanged.** POS distributions and dependency depth depend on the parser; feature-alignment results are only as good as the Thai NLP stack underneath.
