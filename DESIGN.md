---
name: Mythoria
description: Story architect workspace for Thai novelists. Forge-themed, quiet at rest, gold on action.
colors:
  forge-gold: "oklch(0.75 0.18 85)"
  banked-amber: "oklch(0.68 0.17 70)"
  spark-yellow: "oklch(0.82 0.16 90)"
  quench-red: "oklch(0.55 0.22 25)"
  night-iron: "oklch(0.12 0.015 250)"
  night-iron-raised: "oklch(0.16 0.015 250)"
  night-iron-deep: "oklch(0.10 0.015 250)"
  night-seam: "oklch(0.28 0.015 250)"
  ash-light: "oklch(0.97 0.01 85)"
  ash-card: "oklch(0.99 0.005 85)"
  ash-seam: "oklch(0.88 0.02 85)"
  ink-steel: "oklch(0.15 0.02 250)"
  pale-forge: "oklch(0.93 0.01 85)"
  steel-100: "oklch(0.98 0.005 250)"
  steel-200: "oklch(0.91 0.01 250)"
  steel-400: "oklch(0.68 0.02 250)"
  steel-600: "oklch(0.45 0.02 250)"
  steel-800: "oklch(0.25 0.02 250)"
typography:
  display:
    fontFamily: "Outfit, var(--font-geist-sans), sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Outfit, var(--font-geist-sans), sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Geist, Sarabun, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  reading:
    fontFamily: "Sarabun, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "Geist, Sarabun, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
  technical:
    fontFamily: "JetBrains Mono, Geist Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.forge-gold}"
    textColor: "{colors.night-iron}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    textColor: "{colors.pale-forge}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    textColor: "{colors.pale-forge}"
    rounded: "{rounded.sm}"
    height: "32px"
  input:
    backgroundColor: "{colors.night-iron-raised}"
    textColor: "{colors.pale-forge}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.night-iron-raised}"
    textColor: "{colors.pale-forge}"
    rounded: "{rounded.sm}"
    padding: "24px"
  badge-technical:
    textColor: "{colors.steel-400}"
    typography: "{typography.technical}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: Mythoria

## 1. Overview

**Creative North Star: "The Writer's Forge"**

Mythoria is a workshop, not an office. Iron-dark surfaces, gold that only lights where work is happening, and technical labels that read like stamped markings on a tool. The forge is the identity; the writing is the work. Dashboards, sidebars and the plot board wear the forge openly. The editor and long-reading surfaces step back to a clean, calm canvas, because "Forge Mode is earned, not imposed."

Density is high (characters, scenes, lore, threads, timelines on one screen) and the system pays for it with quiet surfaces: thin seams instead of heavy boxes, muted text for metadata, gold reserved for the one thing to press. Components are flat at rest; they answer the cursor with a gold border, a lift of 1px, a faint amber glow. Nothing glows when nobody is touching it.

This system rejects Notion's identity-free flatness, Google Docs' zero personality, Scrivener's dated chrome, and the generic SaaS cream/beige AI template look. If a screen could belong to any productivity app, it has lost the forge.

**Key Characteristics:**
- Dark-first iron neutrals tinted toward blue-steel (hue 250); warm gold accent (hue 85).
- Gold is an action color, not decoration.
- Flat surfaces, 1px seams, small radii (4px default).
- Outfit for display, Geist for UI, Sarabun for Thai prose, JetBrains Mono for stamped technical labels.
- Forge ornaments (chamfered corners, hazard stripes, noise, glow) exist as utilities and are used sparingly, on identity surfaces only.
- Thai-first: every label, state and empty message is written in Thai.

## 2. Colors: The Forge Palette

Restrained strategy: blue-steel tinted neutrals carry 90%+ of every screen; one warm gold family carries action, selection and focus.

### Primary
- **Forge Gold** (oklch(0.75 0.18 85)): primary buttons, focus rings, selected state, the active nav item, progress. Same value in light and dark.
- **Banked Amber** (oklch(0.68 0.17 70)): the deeper gold. Hover borders on cards, key-moment markers, the second stripe of the industrial progress bar.
- **Spark Yellow** (oklch(0.82 0.16 90)): rare highlight. Used for a flash of attention, never for large fills.

### Tertiary
- **Quench Red** (oklch(0.55 0.22 25)): destructive actions and errors only.

### Neutral (dark, default for long sessions)
- **Night Iron** (oklch(0.12 0.015 250)): page background.
- **Night Iron Raised** (oklch(0.16 0.015 250)): cards, inputs, panels.
- **Night Iron Deep** (oklch(0.10 0.015 250)): sidebar, the deepest frame.
- **Night Seam** (oklch(0.28 0.015 250)): borders and dividers.
- **Pale Forge** (oklch(0.93 0.01 85)): body text on dark. Muted text is oklch(0.65 0.02 250).

### Neutral (light)
- **Ash Light** (oklch(0.97 0.01 85)): page background. Note: this sits in the warm near-white band; do not push it warmer or more saturated.
- **Ash Card** (oklch(0.99 0.005 85)): cards and popovers.
- **Ash Seam** (oklch(0.88 0.02 85)): borders.
- **Ink Steel** (oklch(0.15 0.02 250)): body text. Muted text is oklch(0.45 0.02 250).

### Steel ramp
- **Steel 100–800** (oklch 0.98 → 0.25, hue 250): technical outlines, scrollbars, sprocket strips, genealogy connectors, dashed dividers.

### Named Rules
**The Gold Means Go Rule.** Forge Gold marks what the writer can act on or what is currently selected. It never fills a decorative surface, never colors a heading for flair, and covers ≤10% of any screen.

**The Tone Color Belongs To The Story Rule.** User-chosen tone colors (idea cards, lanes, threads) are content, not chrome. Show them as a full tinted border, a dot, or a soft background tint. Never let them compete with Forge Gold for "this is the action."

## 3. Typography

**Display Font:** Outfit (fallback Geist Sans)
**Body Font:** Geist Sans (Thai glyphs fall back to Sarabun)
**Reading Font:** Sarabun, for Thai prose in the editor and long notes
**Label/Mono Font:** JetBrains Mono (fallback Geist Mono)

**Character:** A geometric display face over a neutral UI sans, with a monospace that reads like stamped serial numbers. Sarabun carries Thai prose because Thai readability beats Latin cleverness.

### Hierarchy
- **Display** (600, 1.5rem, 1.25): page and project titles.
- **Title** (600, 1rem, 1.35): panel headers, scene titles, dialog titles.
- **Body** (400, 0.875rem, 1.5): all UI text. The app's workhorse size is 14px.
- **Reading** (400, 1rem, 1.8): Thai manuscript text. Cap line length at 65–75ch.
- **Label** (500, 0.6875rem / 11px, 1.3): field labels, section labels inside panels, meta lines.
- **Technical** (500, 0.75rem, 0.05em tracking, uppercase for Latin): codes, counters, frame numbers, status stamps.

### Named Rules
**The Thai Floor Rule.** Thai text never drops below 11px, and running Thai text never below 12px. Thai stacked vowels and tone marks collapse first; 9–10px is reserved for Latin numerals only.

**The One Stamp Rule.** Technical mono labels mark data (counts, IDs, frame numbers). They are not section eyebrows. One stamp per region, not one above every heading.

## 4. Elevation

Flat by default, with tonal layering doing the depth work: Night Iron Deep (sidebar) → Night Iron (page) → Night Iron Raised (cards, inputs) → popover (oklch 0.18). Shadows appear only as a response to state or for floating layers.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.05)`): cards and outline buttons at rest (shadow-xs / shadow-sm).
- **Forge Lift** (`box-shadow: 0 4px 12px oklch(0.75 0.18 85 / 0.3)`): primary button hover, paired with translateY(-1px).
- **Focus Ember** (`box-shadow: 0 0 10px oklch(0.75 0.18 85 / 0.15)`): inputs on focus, with a 3px gold ring at 30%.
- **Floating** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.14)`): popovers, mention lists, menus.
- **Glow Gold** (`box-shadow: 0 0 20px oklch(0.75 0.18 85 / 0.2), 0 0 40px oklch(0.75 0.18 85 / 0.1)`): identity surfaces only (landing, hero, forge button). Never on working cards.

### Named Rules
**The Cold Iron Rule.** Surfaces are cold at rest. Heat (gold glow, lift) appears only while the cursor or focus is on the element, and disappears when it leaves.

## 5. Components

Flat and quiet; gold answers the hand.

### Buttons
- **Shape:** gently squared corners (4px).
- **Primary:** Forge Gold fill, Night Iron text, 36px tall, 16px side padding. Hover: 90% gold, lift 1px, Forge Lift shadow. Active: back to 0.
- **Outline:** 1px seam border on the page background. Hover: accent fill and a gold border at 50%.
- **Ghost:** no border; accent fill on hover. Default for toolbar icon buttons.
- **Forge (identity only):** uppercase, semibold, chamfered corners, stronger glow. Landing and celebratory moments, never in dense tool UI.
- **Industrial:** steel-600 outline, mono uppercase 12px. Hover turns border and text gold.
- **Focus:** 3px ring in ring color at 50%, always visible on keyboard focus.

### Chips / Badges
- **Style:** 4px radius, 12px medium text, 1px border.
- **Variants:** default (gold fill), secondary (neutral fill), outline, technical (steel outline, 10px mono uppercase, Latin/numerals only), warning (gold at 20% with gold text), success (emerald at 20%).
- **Selected participant / filter chips:** tinted background plus a full 1px border. The selected state is never conveyed by color alone; it also carries a check or weight change.

### Cards / Containers
- **Corner Style:** 4px (rounded-sm). Working cards on the plot board may use 6px.
- **Background:** Night Iron Raised (dark) / Ash Card (light).
- **Shadow Strategy:** Rest shadow; hover adds a gold border at 30% and shadow-md. See Elevation.
- **Border:** 1px seam, full perimeter.
- **Internal Padding:** 24px for content cards; 8–12px for dense board cards.
- **Nested cards are prohibited.** Group inside a card with spacing and seams, not another box.

### Inputs / Fields
- **Style:** 1px input-color border, transparent (light) or 30% input fill (dark), 4px radius, 36px tall, 14px text.
- **Hover:** border to muted-foreground at 50%.
- **Focus:** border Forge Gold, 3px gold ring at 30%, Focus Ember shadow.
- **Error:** destructive border and 20% destructive ring. **Disabled:** 50% opacity, not-allowed cursor.
- **Placeholder:** muted-foreground; must still pass 4.5:1 on its background.

### Navigation
- **Sidebar:** Night Iron Deep, 1px seam at 50%. Items are 14px Geist; hover uses the accent fill; the active item is marked with Forge Gold (sidebar-primary).
- **Tabs and segmented toggles:** muted track, the selected segment on the card surface with medium weight. Links that act as tabs copy the same classes.

### Plot Board Scene Card (signature)
- Dense card in a chapter column: title, a one-line summary (description, else key moment, else first idea titles in italics), idea count, completion state.
- Selected: amber ring. Click opens the side panel; it does not navigate.
- Tone color and key-moment state are shown with a full tinted border or a soft background tint, never a thick single-side stripe.

### Film Reel Ornaments
- The film-sprocket strip was retired from idea cards and the idea panel (CSS removed). Do not reintroduce it.

## 6. Do's and Don'ts

### Do:
- **Do** keep Forge Gold (oklch(0.75 0.18 85)) for primary actions, selection and focus only, ≤10% of the screen.
- **Do** build depth with the Night Iron tonal steps (0.10 / 0.12 / 0.16 / 0.18) before reaching for a shadow.
- **Do** write every label, empty state and error in Thai first.
- **Do** keep Thai text ≥11px and running Thai text ≥12px.
- **Do** step the forge back in writing surfaces: Sarabun at 16px / 1.8, max 75ch, no ornaments.
- **Do** give every animation a `prefers-reduced-motion: reduce` fallback.
- **Do** hide secondary card actions (⋮ menus) until hover/focus on fine pointers, and keep them always visible on touch.

### Don't:
- **Don't** look like Notion: identity-free, gray-on-white flatness with no forge at all.
- **Don't** look like Google Docs: zero personality.
- **Don't** look like Scrivener: dated, dense chrome that isn't intuitive.
- **Don't** drift into the generic SaaS cream/beige AI template look. Do not warm or saturate Ash Light further.
- **Don't** use `border-left` or `border-right` wider than 1px as a colored accent stripe on cards, list items or callouts. Use a full border, a tint, or a leading dot.
- **Don't** put Glow Gold, hazard stripes, noise textures or chamfered corners on dense working UI (board cards, panels, forms). They are identity ornaments for the landing, dashboard hero and forge buttons.
- **Don't** put a mono uppercase stamp above every section heading.
- **Don't** use gradient text, decorative glassmorphism, or nested cards.
- **Don't** use Quench Red for anything except destruction and errors.
