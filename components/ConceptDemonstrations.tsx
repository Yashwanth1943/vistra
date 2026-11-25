'use client';

import { useMemo } from 'react';
import { AnimationPlayer, type AnimationStep } from './AnimationPlayer';

type DemoKind = 'box' | 'flex' | 'grid' | 'auto-fill' | 'position' | 'stacking' | 'overflow' | 'cascade' | 'responsive' | 'structure';
const sequences: Record<DemoKind, AnimationStep[]> = {
  box: [
    { title: 'Content', caption: 'The declared width is content-box by default.', code: '.card { width: 240px; }' },
    { title: 'Padding', caption: 'Padding adds room inside the border and grows the outer size under content-box.', code: '.card { width: 240px; padding: 20px; }' },
    { title: 'Border', caption: 'The border sits outside padding. Margin is still outside the border.', code: '.card { width: 240px; padding: 20px; border: 4px solid; }' },
    { title: 'Border-box', caption: 'Now the declared 240px includes content, padding, and border.', code: '.card { box-sizing: border-box; width: 240px; padding: 20px; border: 4px solid; }' },
  ],
  flex: [
    { title: 'Main axis: row', caption: 'The main axis follows flex-direction. In a row, items flow horizontally.', code: '.row { display: flex; flex-direction: row; }' },
    { title: 'Distribute on the main axis', caption: 'justify-content distributes free space along the current main axis.', code: '.row { justify-content: space-between; }' },
    { title: 'Cross-axis alignment', caption: 'align-items aligns items across the main axis.', code: '.row { align-items: center; }' },
    { title: 'Change direction', caption: 'A column turns the main axis vertical and the cross axis horizontal.', code: '.row { flex-direction: column; }' },
    { title: 'Wrap and share space', caption: 'Wrapping creates lines. Grow and shrink operate within each flex line.', code: '.row { flex-wrap: wrap; gap: 12px; }\n.item { flex: 1 1 120px; }' },
  ],
  grid: [
    { title: 'Create tracks', caption: 'Explicit columns define shared vertical tracks for all grid items.', code: '.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }' },
    { title: 'Place across columns', caption: 'Grid lines bound tracks. A span of two occupies two tracks.', code: '.featured { grid-column: span 2; }' },
    { title: 'Allocate fractions', caption: 'Fractional tracks share available free space after fixed contributions and gaps.', code: '.grid { grid-template-columns: 1fr 2fr; }' },
    { title: 'Fit to container', caption: 'auto-fit chooses tracks from the available width and collapses empty repeated tracks.', code: '.grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }' },
  ],
  position: [
    { title: 'Normal flow', caption: 'Static items occupy their normal place in document flow.', code: '.target { position: static; }' },
    { title: 'Offset but keep space', caption: 'Relative positioning shifts the painted box and keeps its original flow slot.', code: '.target { position: relative; top: 12px; left: 18px; }' },
    { title: 'Anchor an overlay', caption: 'Absolute positioning uses the nearest positioned containing block and leaves flow.', code: '.card { position: relative; }\n.badge { position: absolute; top: 0; right: 0; }' },
    { title: 'Fixed to a containing block', caption: 'Fixed usually uses the viewport; a transformed ancestor can establish a different containing block.', code: '.toolbar { position: fixed; inset: 0 0 auto; }' },
    { title: 'Stick while scrolling', caption: 'Sticky begins in flow, then stays within its scroll container and containing block.', code: '.heading { position: sticky; top: 0; }' },
  ],
  'auto-fill': [
    { title: 'Preserve empty tracks', caption: 'auto-fill keeps candidate tracks even when only two cards occupy the row.', code: 'repeat(auto-fill, minmax(100px, 1fr))' },
    { title: 'Compare auto-fit', caption: 'With auto-fit, empty tracks collapse so occupied flexible tracks can grow.', code: 'repeat(auto-fit, minmax(100px, 1fr))' },
  ],
  stacking: [
    { title: 'Compare stack levels', caption: 'Positioned siblings in one stacking context can be ordered by z-index.', code: '.menu { position: absolute; z-index: 2; }' },
    { title: 'Create a context', caption: 'A stacking context is painted as a unit inside its parent context.', code: '.panel { isolation: isolate; }' },
    { title: 'Child values stay local', caption: 'A child with a large z-index cannot escape a lower ancestor stacking context.', code: '.panel { position: relative; z-index: 1; }\n.menu { z-index: 9999; }' },
  ],
  overflow: [
    { title: 'Visible overflow', caption: 'Content can paint outside its box when overflow is visible.', code: '.box { overflow: visible; }' },
    { title: 'Clip the content', caption: 'Hidden clips overflow and does not expose scrollbars.', code: '.box { overflow: hidden; }' },
    { title: 'Allow scrolling', caption: 'Auto allows scrolling when content exceeds the box.', code: '.box { overflow: auto; }' },
  ],
  cascade: [
    { title: 'Inherited value', caption: 'A child can receive a property from its parent when no declaration overrides inheritance.', code: 'body { color: #36435c; }' },
    { title: 'Class rule', caption: 'A class selector has specificity 0-1-0 and can override the inherited value.', code: '.note { color: #5366df; }' },
    { title: 'ID rule wins', caption: 'In the same cascade context, one ID specificity point outranks class points.', code: '#featured { color: #168e85; }' },
    { title: 'Cascade stages', caption: 'Origin, importance, and cascade layer are resolved before specificity and source order.', code: '@layer base, components;\n@layer components { .note { color: #5366df; } }' },
  ],
  responsive: [
    { title: 'Narrow layout', caption: 'Start with a single column so content works in a narrow viewport.', code: '.cards { display: grid; grid-template-columns: 1fr; }' },
    { title: 'Breakpoint reached', caption: 'A min-width condition matches at and above its threshold.', code: '@media (min-width: 48rem) { .cards { grid-template-columns: repeat(2, 1fr); } }' },
    { title: 'More room', caption: 'Add a wider layout only when the content benefits from another track.', code: '@media (min-width: 70rem) { .cards { grid-template-columns: repeat(3, 1fr); } }' },
  ],
  structure: [
    { title: 'Document root', caption: 'The html element is the root of the document tree.', code: '<html lang="en">...</html>' },
    { title: 'Semantic regions', caption: 'Meaningful elements give important regions recognizable roles.', code: '<main><article>...</article></main>' },
    { title: 'Parent and child', caption: 'Nested elements form parent-child relationships in the DOM.', code: '<article>\n  <h2>Title</h2>\n  <p>Body</p>\n</article>' },
    { title: 'Form controls', caption: 'A label’s for value connects it to the input with the matching id.', code: '<label for="email">Email</label>\n<input id="email" type="email">' },
  ],
};

function getKind(title: string, group: string): DemoKind | null {
  const normalized = title.toLowerCase();
  if (normalized.includes('box model') || normalized.includes('box-sizing') || normalized.includes('padding') || normalized.includes('margin')) return 'box';
  if (normalized.includes('flex') || normalized.includes('axis') || normalized.includes('justify') || normalized.includes('align')) return 'flex';
  if (normalized.includes('auto-fill')) return 'auto-fill';
  if (normalized.includes('overflow')) return 'overflow';
  if (normalized.includes('z-index') || normalized.includes('stacking context')) return 'stacking';
  if (normalized.includes('grid') || normalized.includes('fraction') || normalized.includes('auto-fit')) return 'grid';
  if (normalized.includes('position') || normalized.includes('sticky') || normalized === 'fixed' || normalized === 'absolute' || normalized === 'relative' || normalized === 'static') return 'position';
  if (normalized.includes('specificity') || normalized.includes('cascade') || normalized.includes('inheritance') || normalized.includes('selector')) return 'cascade';
  if (normalized.includes('responsive') || normalized.includes('media quer') || normalized.includes('breakpoint') || normalized.includes('viewport') || normalized.includes('mobile-first')) return 'responsive';
  if (group === 'HTML') return 'structure';
  return null;
}

export function ConceptDemonstration({ title, group }: { title: string; group: string }) {
  const kind = getKind(title, group);
  if (!kind) return null;
  const steps = sequences[kind];
  const renderStage = useMemo(() => (step: number) => {
    if (kind === 'box') return <div className={`demo-box-scene stage-${step}`}><div className="demo-box-content">Content<br/><small>240px declared width</small></div></div>;
    if (kind === 'flex') return <div className={`demo-flex-scene ${step === 3 ? 'column' : ''} ${step === 1 ? 'spread' : ''} ${step === 2 ? 'cross-align' : ''} ${step === 4 ? 'wrap' : ''}`}><i>01</i><i>Featured</i><i>03</i><i>04</i></div>;
    if (kind === 'grid') return <div className={`demo-grid-scene ${step === 1 ? 'span' : ''} ${step === 2 ? 'uneven' : ''} ${step === 3 ? 'autofit' : ''}`}>{Array.from({length:step===3?3:6},(_,index)=><i key={index}>{String(index+1).padStart(2,'0')}</i>)}</div>;
    if (kind === 'auto-fill') return <div className="demo-grid-scene" style={{gridTemplateColumns:`repeat(${step===0?'auto-fill':'auto-fit'}, minmax(100px, 1fr))`}}>{['01','02'].map(item=><i key={item}>{item}</i>)}</div>;
    if (kind === 'position') return <div className={`demo-position-scene mode-${step}`}><span>Containing block</span><i>Normal position</i><b>Target</b></div>;
    if (kind === 'stacking') return <div className={`demo-stack-scene mode-${step}`}><div className="stack-context"><span>{step===0?'Positioned parent':'Panel · stacking context'}</span><b>Menu · z-index {step===2?'9999':'2'}</b></div><strong>Dialog · sibling layer</strong></div>;
    if (kind === 'overflow') return <div className="demo-overflow-scene"><div className={`overflow-box mode-${step}`}><span>Card content that extends beyond its container</span></div><small>{['overflow: visible','overflow: hidden','overflow: auto'][step]}</small></div>;
    if (kind === 'cascade') return <div className={`demo-cascade-scene winner-${step}`}><i>Inherited color</i><i>.note · class rule</i><i>#featured · ID rule</i><strong>Rendered text</strong></div>;
    if (kind === 'responsive') return <div className={`demo-responsive-scene width-${step}`}><i>Card one</i><i>Card two</i><i>Card three</i></div>;
    return <div className={`demo-tree-scene depth-${step}`}><strong>&lt;html&gt;</strong><div><strong>&lt;main&gt;</strong><div><strong>&lt;article&gt;</strong><span>&lt;h2&gt; · &lt;p&gt; · &lt;form&gt;</span></div></div></div>;
  }, [kind]);
  return <AnimationPlayer title={`Explore ${title}`} steps={steps} renderStage={renderStage}/>;
}
