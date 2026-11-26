/**
 * Real-world CSS Pseudo-Elements & Interactive Pseudo-Classes presets and metadata
 * for Phase 18.5 PseudoStatesStudio.
 */

export type PseudoPreset = {
  id: string;
  label: string;
  kind: 'pseudo-element' | 'pseudo-class';
  focusSelector: string;
  targetSelector: string;
  explanation: string;
  html: string;
  css: string;
};

export const PSEUDO_ELEMENT_META: Record<
  string,
  { requires: string; summary: string }
> = {
  '::before': {
    requires: 'Requires content (e.g. content: "NEW") and a non-void container element.',
    summary: 'Inserts a virtual first child inside the element before its real content.',
  },
  '::after': {
    requires: 'Requires content (e.g. content: "→" or "") and a non-void container element.',
    summary: 'Inserts a virtual last child inside the element for badges, icons, or underlines.',
  },
  '::first-letter': {
    requires: 'Applies only to block-level containers (e.g. <p>, <div>, <article>).',
    summary: 'Styles the very first letter of the first formatted line (drop caps).',
  },
  '::first-line': {
    requires: 'Applies only to block-level containers and adapts as text wraps.',
    summary: 'Styles the first rendered line of text inside a block element.',
  },
  '::placeholder': {
    requires: 'Applies to <input> or <textarea> elements with a placeholder attribute.',
    summary: 'Styles the hint text shown before the user types a value.',
  },
  '::selection': {
    requires: 'Triggered only when the user highlights text with mouse or keyboard.',
    summary: 'Styles the portion of a document currently selected by the user.',
  },
  '::marker': {
    requires: 'Applies to list items (<li>) or elements with display: list-item.',
    summary: 'Styles the bullet, number, or custom symbol of a list item.',
  },
};

export const PSEUDO_CLASS_META: Record<
  string,
  { trigger: string; summary: string }
> = {
  ':hover': {
    trigger: 'Move pointer over the element.',
    summary: 'Matches while the user hovers a pointing device over the element.',
  },
  ':focus': {
    trigger: 'Click or press Tab to focus an interactive element.',
    summary: 'Matches whenever an element receives keyboard or pointer focus.',
  },
  ':focus-visible': {
    trigger: 'Press Tab inside the preview to trigger keyboard-only focus ring.',
    summary: 'Matches when the browser determines focus should be visibly indicated (keyboard navigation).',
  },
  ':active': {
    trigger: 'Press and hold mouse button (or Space/Enter) on the element.',
    summary: 'Matches during the brief moment an element is being activated.',
  },
  ':checked': {
    trigger: 'Click the checkbox to toggle its checked state.',
    summary: 'Matches checked radio buttons, checkboxes, or selected <option>s.',
  },
  ':disabled': {
    trigger: 'Toggle the disabled attribute on a form control.',
    summary: 'Matches form controls that cannot be focused or edited.',
  },
  ':enabled': {
    trigger: 'Applies to interactive form controls without the disabled attribute.',
    summary: 'Matches form controls that are currently active and interactive.',
  },
  ':first-child': {
    trigger: 'Matches the first element among its siblings.',
    summary: 'Structural pseudo-class targeting the 1st child of a parent.',
  },
  ':last-child': {
    trigger: 'Matches the last element among its siblings.',
    summary: 'Structural pseudo-class targeting the final child of a parent.',
  },
  ':nth-child()': {
    trigger: 'Matches siblings by index or pattern (odd, even, 2n+1).',
    summary: 'Structural pseudo-class selecting repeating child positions.',
  },
  ':not()': {
    trigger: 'Excludes elements matching the inner selector.',
    summary: 'Negation pseudo-class matching everything except the excluded selector.',
  },
  ':is()': {
    trigger: 'Matches any selector in the list (takes highest specificity).',
    summary: 'Matches-any functional pseudo-class for concise grouped selectors.',
  },
  ':where()': {
    trigger: 'Matches any selector in the list with (0, 0, 0) specificity.',
    summary: 'Zero-specificity functional pseudo-class ideal for overridable defaults.',
  },
};

export const PSEUDO_PRESETS: PseudoPreset[] = [
  {
    id: 'button-states',
    label: '1. Interactive Button States',
    kind: 'pseudo-class',
    focusSelector: '.action-btn:hover',
    targetSelector: '.action-btn:hover',
    explanation:
      'Hover, Tab-focus (:focus-visible), press-and-hold (:active), and compare :enabled vs :disabled on real buttons.',
    html: `<div class="btn-row">\n  <button type="button" class="action-btn">Hover / Tab / Hold Me</button>\n  <button type="button" class="action-btn" disabled>Disabled Button</button>\n</div>`,
    css: `.btn-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 12px;\n}\n.action-btn {\n  padding: 10px 18px;\n  border: 2px solid #4f46e5;\n  border-radius: 8px;\n  background-color: #6366f1;\n  color: #ffffff;\n  font-weight: 700;\n  cursor: pointer;\n  transition: transform 0.14s ease, background-color 0.14s ease;\n}\n.action-btn:enabled {\n  opacity: 1;\n}\n.action-btn:hover {\n  background-color: #4338ca;\n  transform: translateY(-2px);\n}\n.action-btn:focus-visible {\n  outline: 3px solid #f59e0b;\n  outline-offset: 2px;\n}\n.action-btn:active {\n  transform: scale(0.97);\n  background-color: #312e81;\n}\n.action-btn:disabled {\n  background-color: #e2e8f0;\n  border-color: #cbd5e1;\n  color: #64748b;\n  cursor: not-allowed;\n}`,
  },
  {
    id: 'input-focus',
    label: '2. Form Input Focus & ::placeholder',
    kind: 'pseudo-element',
    focusSelector: '.field::placeholder',
    targetSelector: '.field::placeholder',
    explanation:
      '::placeholder styles the hint text inside <input>, while :focus and :focus-visible highlight the active field.',
    html: `<div class="form-stack">\n  <label for="email-box">Email address</label>\n  <input id="email-box" class="field" type="email" placeholder="you@webcraft.dev" />\n  <input class="field" type="text" placeholder="Disabled input" disabled />\n</div>`,
    css: `.form-stack {\n  display: grid;\n  gap: 8px;\n  max-width: 320px;\n}\nlabel {\n  font-size: 12px;\n  font-weight: 700;\n  color: #334155;\n}\n.field {\n  padding: 9px 12px;\n  border: 2px solid #cbd5e1;\n  border-radius: 8px;\n  font-size: 13px;\n  background-color: #ffffff;\n  color: #0f172a;\n}\n.field::placeholder {\n  color: #6366f1;\n  font-style: italic;\n}\n.field:focus {\n  outline: none;\n  border-color: #6366f1;\n  background-color: #f5f3ff;\n}\n.field:disabled {\n  background-color: #f1f5f9;\n  color: #94a3b8;\n}`,
  },
  {
    id: 'custom-checkbox',
    label: '3. Custom Checkbox (:checked)',
    kind: 'pseudo-class',
    focusSelector: '.check-input:checked + .check-label::before',
    targetSelector: '.check-input:checked + .check-label::before',
    explanation:
      'Clicking the checkbox toggles :checked in the browser, activating adjacent sibling (+) styles and ::before checkmark content.',
    html: `<label class="check-wrap">\n  <input type="checkbox" class="check-input" />\n  <span class="check-label">Enable live DOM inspection</span>\n</label>`,
    css: `.check-wrap {\n  display: inline-flex;\n  align-items: center;\n  gap: 10px;\n  cursor: pointer;\n  font-weight: 600;\n}\n.check-input {\n  position: relative;\n  width: 18px;\n  height: 18px;\n  accent-color: #6366f1;\n}\n.check-label::before {\n  content: "○ ";\n  color: #64748b;\n  font-weight: 700;\n}\n.check-input:checked + .check-label {\n  color: #4338ca;\n}\n.check-input:checked + .check-label::before {\n  content: "✓ ";\n  color: #16a34a;\n}`,
  },
  {
    id: 'nav-hover',
    label: '4. Navigation Hover & Structural',
    kind: 'pseudo-class',
    focusSelector: '.nav-link:hover::after',
    targetSelector: '.nav-link:hover::after',
    explanation:
      'Combines :hover with ::after underline and :first-child / :last-child / :not() structural selectors.',
    html: `<nav class="demo-nav">\n  <a href="#home" class="nav-link">Overview</a>\n  <a href="#labs" class="nav-link">Labs</a>\n  <a href="#docs" class="nav-link">Reference</a>\n</nav>`,
    css: `.demo-nav {\n  display: flex;\n  gap: 14px;\n  padding: 10px 14px;\n  background-color: #f8fafc;\n  border: 1px solid #e2e8f0;\n  border-radius: 10px;\n}\n.nav-link {\n  position: relative;\n  text-decoration: none;\n  color: #334155;\n  font-weight: 600;\n  padding: 4px 2px;\n}\n.nav-link:first-child {\n  color: #4f46e5;\n}\n.nav-link:last-child {\n  margin-left: auto;\n}\n.nav-link::after {\n  content: "";\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  height: 2px;\n  background-color: transparent;\n}\n.nav-link:hover::after {\n  background-color: #6366f1;\n}`,
  },
  {
    id: 'decorative-card',
    label: '5. Decorative Card (::before & ::after)',
    kind: 'pseudo-element',
    focusSelector: '.promo-card::before',
    targetSelector: '.promo-card::before',
    explanation:
      '::before and ::after generate decorative badges and accents purely from CSS content without extra HTML nodes.',
    html: `<article class="promo-card">\n  <h3>CSS Grid Workshop</h3>\n  <p>Generated ::before badge and ::after corner tag.</p>\n</article>`,
    css: `.promo-card {\n  position: relative;\n  padding: 20px 16px 16px;\n  border: 2px solid #c7d2fe;\n  border-radius: 12px;\n  background-color: #eef2ff;\n  max-width: 320px;\n}\n.promo-card::before {\n  content: "NEW";\n  position: absolute;\n  top: -10px;\n  left: 14px;\n  padding: 2px 8px;\n  border-radius: 999px;\n  background-color: #4f46e5;\n  color: #ffffff;\n  font-size: 10px;\n  font-weight: 700;\n}\n.promo-card::after {\n  content: "★";\n  position: absolute;\n  top: 10px;\n  right: 12px;\n  color: #f59e0b;\n  font-size: 16px;\n}\n.promo-card h3 { margin: 0 0 6px; font-size: 15px; }\n.promo-card p { margin: 0; font-size: 13px; color: #475569; }`,
  },
  {
    id: 'list-marker',
    label: '6. List Styling (::marker & :nth-child)',
    kind: 'pseudo-element',
    focusSelector: '.styled-list li::marker',
    targetSelector: '.styled-list li::marker',
    explanation:
      '::marker styles list bullets directly, while :nth-child(), :not(), :is(), and :where() style matching items.',
    html: `<ul class="styled-list">\n  <li>HTML Semantics</li>\n  <li class="highlight">CSS Cascade</li>\n  <li>Flexbox &amp; Grid</li>\n  <li class="muted">Optional Notes</li>\n</ul>`,
    css: `.styled-list {\n  margin: 0;\n  padding-left: 22px;\n  display: grid;\n  gap: 6px;\n}\n.styled-list li::marker {\n  content: "▸ ";\n  color: #6366f1;\n  font-size: 15px;\n}\n.styled-list li:nth-child(odd) {\n  background-color: #f8fafc;\n}\n.styled-list li:not(.muted) {\n  font-weight: 600;\n}\n:where(.styled-list) :is(.highlight) {\n  color: #4338ca;\n}`,
  },
  {
    id: 'text-selection',
    label: '7. Text Selection (::selection)',
    kind: 'pseudo-element',
    focusSelector: '.selectable-copy::selection',
    targetSelector: '.selectable-copy::selection',
    explanation:
      'Drag your mouse across the paragraph below to highlight text and see ::selection change background and color.',
    html: `<p class="selectable-copy">Drag across this sentence inside the preview to test real browser ::selection styling!</p>`,
    css: `.selectable-copy {\n  padding: 14px;\n  border: 1px solid #cbd5e1;\n  border-radius: 8px;\n  background-color: #f8fafc;\n  font-size: 14px;\n  line-height: 1.6;\n  color: #1e293b;\n}\n.selectable-copy::selection {\n  background-color: #4f46e5;\n  color: #ffffff;\n}`,
  },
  {
    id: 'first-letter',
    label: '8. Drop Cap (::first-letter & ::first-line)',
    kind: 'pseudo-element',
    focusSelector: '.editorial::first-letter',
    targetSelector: '.editorial::first-letter',
    explanation:
      '::first-letter creates a magazine drop cap and ::first-line styles the first wrapped line of a block paragraph.',
    html: `<p class="editorial">Typography shapes how readers enter a page. Resize or edit CSS to watch ::first-letter and ::first-line adapt to line wrapping.</p>`,
    css: `.editorial {\n  max-width: 360px;\n  padding: 14px;\n  border: 1px solid #e2e8f0;\n  border-radius: 10px;\n  background-color: #ffffff;\n  font-size: 13.5px;\n  line-height: 1.6;\n  color: #334155;\n}\n.editorial::first-letter {\n  float: left;\n  font-size: 34px;\n  line-height: 0.9;\n  padding-right: 8px;\n  color: #4f46e5;\n  font-weight: 800;\n}\n.editorial::first-line {\n  color: #0f172a;\n  font-weight: 700;\n}`,
  },
];
