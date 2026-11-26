/**
 * Conceptual Browser Rendering Pipeline model and CSS Performance / Animation comparison presets.
 * Clearly separates conceptual browser pipeline stages from directly observable JS Performance APIs.
 */

export type PipelineStageId = 'dom' | 'cssom' | 'render-tree' | 'layout' | 'paint' | 'compositing';

export type PipelineStage = {
  id: PipelineStageId;
  step: number;
  title: string;
  whatHappens: string;
  why: string;
  inputs: string;
  nextStageReceives: string;
};

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'dom',
    step: 1,
    title: 'DOM Construction',
    whatHappens: 'The HTML parser converts raw HTML characters into tokens and builds a tree of Element and Text nodes.',
    why: 'JavaScript and CSS need a structured object tree rather than raw HTML text.',
    inputs: 'HTML markup (e.g. <div class="card">Hello</div>)',
    nextStageReceives: 'Document Object Model (DOM) node hierarchy',
  },
  {
    id: 'cssom',
    step: 2,
    title: 'CSSOM Construction',
    whatHappens: 'The CSS parser reads stylesheets and resolves rules, selectors, and cascade priorities into a style tree.',
    why: 'The browser needs fast access to computed style rules before matching them to elements.',
    inputs: 'CSS rules (.card { padding: 16px; transform: ... })',
    nextStageReceives: 'CSS Object Model (CSSOM) rule tree',
  },
  {
    id: 'render-tree',
    step: 3,
    title: 'Render Tree Construction',
    whatHappens: 'DOM and CSSOM are combined, matching selectors to elements and omitting non-visual nodes like <head> or display: none.',
    why: 'Only visible elements with their resolved styles should enter geometry and painting.',
    inputs: 'DOM tree + CSSOM rules',
    nextStageReceives: 'Render tree of visible boxes with computed styles',
  },
  {
    id: 'layout',
    step: 4,
    title: 'Layout (Reflow)',
    whatHappens: 'Calculates exact box geometry (x, y, width, height) based on box model, Flexbox, Grid, and viewport size.',
    why: 'Changing one element’s size or position can shift siblings and ancestors.',
    inputs: 'Render tree + viewport/container constraints',
    nextStageReceives: 'Positioned boxes with pixel coordinates and dimensions',
  },
  {
    id: 'paint',
    step: 5,
    title: 'Paint',
    whatHappens: 'Fills in pixels for text, colors, borders, shadows, and images onto one or more paint surfaces.',
    why: 'Geometry alone has no pixels until visual styles are rasterized.',
    inputs: 'Layout boxes + visual CSS properties (color, background, border)',
    nextStageReceives: 'Painted layers / display lists',
  },
  {
    id: 'compositing',
    step: 6,
    title: 'Compositing',
    whatHappens: 'Combines painted layers in the right stacking order on screen, often handling transforms and opacity on the compositor.',
    why: 'Allows layers to move or fade without re-running Layout or re-painting when no geometry/color changed.',
    inputs: 'Painted layers + transform / opacity / z-index order',
    nextStageReceives: 'Final pixels displayed on screen',
  },
];

export type CssPerfExperiment = {
  id: 'width-height' | 'margin-padding' | 'background-color' | 'transform' | 'opacity';
  label: string;
  stages: PipelineStageId[];
  note: string;
  cssProp: string;
  valueA: string;
  valueB: string;
};

export const CSS_PERF_EXPERIMENTS: CssPerfExperiment[] = [
  {
    id: 'width-height',
    label: 'width & height',
    stages: ['layout', 'paint', 'compositing'],
    note: 'Changing width or height alters box geometry, which commonly triggers Layout, then Paint and Compositing.',
    cssProp: 'width',
    valueA: '140px',
    valueB: '220px',
  },
  {
    id: 'margin-padding',
    label: 'margin & padding',
    stages: ['layout', 'paint', 'compositing'],
    note: 'Changing margin or padding shifts box spacing and surrounding siblings, commonly triggering Layout → Paint → Compositing.',
    cssProp: 'padding',
    valueA: '10px',
    valueB: '26px',
  },
  {
    id: 'background-color',
    label: 'background-color',
    stages: ['paint', 'compositing'],
    note: 'Changing background-color keeps geometry unchanged, so Layout is typically skipped while Paint and Compositing still run.',
    cssProp: 'background-color',
    valueA: '#eef2ff',
    valueB: '#fde68a',
  },
  {
    id: 'transform',
    label: 'transform',
    stages: ['compositing'],
    note: 'transform often runs on the compositor without re-running Layout or Paint, though browser heuristics and layer promotion vary.',
    cssProp: 'transform',
    valueA: 'translateX(0px)',
    valueB: 'translateX(44px)',
  },
  {
    id: 'opacity',
    label: 'opacity',
    stages: ['compositing'],
    note: 'opacity changes can often be composited without Layout or Paint when the element is on its own compositor layer.',
    cssProp: 'opacity',
    valueA: '1',
    valueB: '0.45',
  },
];

export type AnimationComparisonPreset = {
  id: 'left-vs-transform' | 'width-vs-scale' | 'opacity-vs-bg' | 'single-vs-many';
  label: string;
  titleA: string;
  titleB: string;
  explanation: string;
  cssA: string;
  cssB: string;
};

export const ANIMATION_COMPARISONS: AnimationComparisonPreset[] = [
  {
    id: 'left-vs-transform',
    label: 'left vs transform: translateX()',
    titleA: 'Option A: Animating left (Layout + Paint + Composite)',
    titleB: 'Option B: Animating transform: translateX() (Compositor-friendly)',
    explanation:
      'Animating left changes layout offsets each frame; transform: translateX() moves the visual layer without shifting sibling geometry.',
    cssA: `@keyframes moveLeft {\n  0%, 100% { left: 0px; }\n  50% { left: 90px; }\n}\n.anim-box {\n  position: relative;\n  animation: moveLeft var(--dur, 1000ms) ease-in-out infinite;\n}`,
    cssB: `@keyframes moveTransform {\n  0%, 100% { transform: translateX(0px); }\n  50% { transform: translateX(90px); }\n}\n.anim-box {\n  animation: moveTransform var(--dur, 1000ms) ease-in-out infinite;\n}`,
  },
  {
    id: 'width-vs-scale',
    label: 'width vs transform: scale()',
    titleA: 'Option A: Animating width (Reflows siblings)',
    titleB: 'Option B: Animating transform: scale() (No sibling reflow)',
    explanation:
      'Animating width pushes neighboring elements on every frame; transform: scale() scales the layer visually without moving siblings.',
    cssA: `@keyframes growWidth {\n  0%, 100% { width: 72px; }\n  50% { width: 130px; }\n}\n.anim-box {\n  animation: growWidth var(--dur, 1000ms) ease-in-out infinite;\n}`,
    cssB: `@keyframes growScale {\n  0%, 100% { transform: scaleX(1); }\n  50% { transform: scaleX(1.65); }\n}\n.anim-box {\n  transform-origin: left center;\n  animation: growScale var(--dur, 1000ms) ease-in-out infinite;\n}`,
  },
  {
    id: 'opacity-vs-bg',
    label: 'opacity vs background-color',
    titleA: 'Option A: Animating background-color (Paint)',
    titleB: 'Option B: Animating opacity (Compositing)',
    explanation:
      'background-color repaints pixels each frame; opacity can often fade a promoted layer directly during compositing.',
    cssA: `@keyframes pulseBg {\n  0%, 100% { background-color: #6366f1; }\n  50% { background-color: #06b6d4; }\n}\n.anim-box {\n  animation: pulseBg var(--dur, 1000ms) ease-in-out infinite;\n}`,
    cssB: `@keyframes pulseOpacity {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.25; }\n}\n.anim-box {\n  animation: pulseOpacity var(--dur, 1000ms) ease-in-out infinite;\n}`,
  },
  {
    id: 'single-vs-many',
    label: 'Single vs Multiple Elements',
    titleA: 'Option A: Single Animated Element',
    titleB: 'Option B: Multiple Animated Elements (adjust count)',
    explanation:
      'Use the Element Count slider below to observe how animating many elements increases browser work compared to a single element.',
    cssA: `@keyframes slideOne {\n  0%, 100% { transform: translateX(0px); }\n  50% { transform: translateX(70px); }\n}\n.anim-box {\n  animation: slideOne var(--dur, 1000ms) ease-in-out infinite;\n}`,
    cssB: `@keyframes slideMany {\n  0%, 100% { transform: translateX(0px); }\n  50% { transform: translateX(70px); }\n}\n.anim-box {\n  animation: slideMany var(--dur, 1000ms) ease-in-out infinite;\n}`,
  },
];
