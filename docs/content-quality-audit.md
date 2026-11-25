# WebCraft Academy content quality audit

Audit scope: all 143 entries in `app/curriculum.ts`, resolved through `explainConcept()` in `app/concept-content.ts`.

## Source classification

The repository test classifies each topic by the path used to produce its lesson:

| Source | Count | Meaning |
| --- | ---: | --- |
| Individually authored | 143 | Every curriculum topic has its own concept-specific teaching note, syntax, working example, mistakes, and knowledge check. |
| Property-guided | 0 | All property-guided entries have been upgraded to full individually authored notes. |
| Generated | 0 | Zero generated fallback concepts remain. |
| **Total** | **143** | 100% of curriculum concepts are individually authored. |

The counts (`143 / 0 / 0`) and unique concept identifiers are enforced against `app/curriculum.ts` by `tests/content-audit.test.cjs`.

## Focused accuracy and content work

- **Phase 9 additions (+29 individually authored concepts)**:
  - **Box model & Sizing**: `Box model visualization`, `Width and height`, `Practical spacing experiments`, `Responsive sizing`.
  - **Flexbox**: `Row and column directions`, `Understanding one-dimensional layouts`, `Flex item sizing`, `Building navigation bars`, `Building pricing layouts`, `Building profile cards`, `Building practical application layouts`.
  - **CSS Grid**: `Grid container`, `Grid items`, `display: grid`, `Grid columns`, `Grid rows`, `repeat()`, `Implicit and explicit grids`, `Responsive grid layouts`, `Practical website layouts`.
  - **Positioning**: `Top, right, bottom, and left`, `Positioning experiments`.
  - **Tailwind & Responsive**: `Spacing`, `Colors`, `Typography`, `Flexbox utilities`, `Grid utilities`, `Building components using Tailwind`, `Building complete responsive websites`.
- **Phase 8 additions (+45 individually authored concepts)**: All 14 property-guided concepts plus 31 foundational HTML/CSS/workflow/layout concepts.
- **Phase 7 additions (+29 individually authored concepts)**: Foundational HTML elements/forms/tables, CSS fundamentals, box model layers, Flexbox core, Grid intro/minmax, positioning basics, and responsive meta/breakpoints.
- **Original authored (40 concepts)**: Core HTML intro/structure/semantics, CSS syntax/cascade/specificity, selectors/pseudo-classes/pseudo-elements, box-sizing/margin collapse, Flexbox axes/alignment/grow/shrink/basis, Grid columns/rows/auto-fit/auto-fill/auto-flow, absolute/fixed/sticky/z-index/stacking context, media queries, and Tailwind utilities.

## Automated checks

`npm test` verifies that all 143 topics produce non-empty structured fields, enforces `authored === 143`, `property-guided === 0`, `generated === 0`, verifies unique identifiers, confirms all seven sidebar groups (`HTML`, `CSS`, `Flexbox`, `Grid`, `Positioning`, `Responsive`, `Tailwind`) are populated, checks that every `related` concept reference resolves to a valid curriculum topic or supported lab, verifies HTML/CSS separation in Playground example routing across all 143 concepts, and validates all 12 practical examples, comparison records, Playground CSS/HTML validators, and preview sanitization.
