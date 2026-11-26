'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import {
  extractMediaBreakpoint,
  extractRuleDeclarations,
  parseNumericCss,
  patchCssRule,
  patchMediaBreakpoint,
} from '../app/css-sync';
import { validateCss } from '../app/playground';
import { LiveExperimentEditor } from './LiveExperimentEditor';
import { MOTION_EASE, MOTION_TIMING, MotionProvider } from './MotionPrimitives';
import { StackingContextStudio } from './StackingContextStudio';
import {
  CountControl,
  LabHeader,
  NumberControl,
  RangeControl,
  SegmentedControl,
  SelectControl,
  ToggleControl,
} from './VisualizationEngine';

type LabName = 'Flexbox lab' | 'Grid lab' | 'Box model' | 'Positioning' | 'Responsive';

export function VisualizerSuite({ tab }: { tab: LabName }) {
  return (
    <MotionProvider>
      {tab === 'Flexbox lab' && <FlexboxLab key="flex" />}
      {tab === 'Grid lab' && <GridLab key="grid" />}
      {tab === 'Box model' && <BoxModelLab key="box" />}
      {tab === 'Positioning' && <PositionLab key="pos" />}
      {tab === 'Responsive' && <ResponsiveLab key="resp" />}
    </MotionProvider>
  );
}

/* ==================== 1. FLEXBOX LAB ==================== */
const flexDefaults = {
  display: 'flex',
  direction: 'row',
  wrap: 'nowrap',
  justify: 'space-between',
  align: 'center',
  alignContent: 'stretch',
  rowGap: 12,
  columnGap: 12,
  itemCount: 4,
  variedSizes: false,
  grow: 0,
  shrink: 1,
  basis: 100,
  minWidth: 'auto',
  order: 0,
  alignSelf: 'auto',
};

const flexInitialCss = `.container {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: space-between;
  align-items: center;
  align-content: stretch;
  row-gap: 12px;
  column-gap: 12px;
}
.item--featured {
  flex-grow: 0;
  flex-shrink: 1;
  flex-basis: 100px;
  min-width: auto;
  align-self: auto;
  order: 0;
}`;

const buildFlexHtml = (count: number) =>
  `<div class="container">\n${Array.from({ length: count }, (_, i) => `  <div class="${i === 0 ? 'item item--featured' : 'item'}">0${i + 1}</div>`).join('\n')}\n</div>`;

const flexPreviewWrapper = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff}
.container{min-height:140px;padding:12px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc}
.item{min-width:56px;min-height:48px;padding:10px 14px;border-radius:8px;background:#eef2ff;border:1px solid #c7d2fe;color:#4338ca;font-weight:700;display:grid;place-items:center}
.item--featured{background:#e0e7ff;border-color:#6366f1}`;

function FlexboxLab() {
  const [v, setV] = useState(flexDefaults);
  const [css, setCss] = useState(flexInitialCss);
  const [html, setHtml] = useState(() => buildFlexHtml(flexDefaults.itemCount));
  const [preset, setPreset] = useState('');
  const [compare, setCompare] = useState(false);
  const [compareJustify, setCompareJustify] = useState('center');

  const set = <K extends keyof typeof flexDefaults>(
    key: K,
    next: typeof flexDefaults[K],
    selector: '.container' | '.item--featured' | null,
    cssProp?: string,
    cssVal?: string
  ) => {
    setPreset('');
    setV((prev) => ({ ...prev, [key]: next }));
    if (selector && cssProp && cssVal !== undefined) {
      setCss((prev) => patchCssRule(prev, selector, cssProp, cssVal));
    }
  };

  const handleCssEdit = (nextCss: string) => {
    setCss(nextCss);
    if (validateCss(nextCss) !== null) return;
    const c = extractRuleDeclarations(nextCss, '.container');
    const f = extractRuleDeclarations(nextCss, '.item--featured');
    setV((prev) => ({
      ...prev,
      display: c['display'] === 'inline-flex' ? 'inline-flex' : c['display'] === 'flex' ? 'flex' : prev.display,
      direction: c['flex-direction'] ?? prev.direction,
      wrap: c['flex-wrap'] ?? prev.wrap,
      justify: c['justify-content'] ?? prev.justify,
      align: c['align-items'] ?? prev.align,
      alignContent: c['align-content'] ?? prev.alignContent,
      rowGap: parseNumericCss(c['row-gap'] ?? c['gap'], prev.rowGap),
      columnGap: parseNumericCss(c['column-gap'] ?? c['gap'], prev.columnGap),
      grow: parseNumericCss(f['flex-grow'], prev.grow),
      shrink: parseNumericCss(f['flex-shrink'], prev.shrink),
      basis: parseNumericCss(f['flex-basis'], prev.basis),
      order: parseNumericCss(f['order'], prev.order),
      alignSelf: f['align-self'] ?? prev.alignSelf,
    }));
  };

  const resetAll = () => {
    setV(flexDefaults);
    setCss(flexInitialCss);
    setHtml(buildFlexHtml(flexDefaults.itemCount));
    setPreset('');
    setCompare(false);
  };

  const applyPreset = (id: string) => {
    setPreset(id);
    if (id === 'navbar') {
      const next = { ...flexDefaults, direction: 'row', justify: 'space-between', align: 'center', itemCount: 3, grow: 0, basis: 90 };
      setV(next);
      setHtml(buildFlexHtml(3));
      setCss((prev) => {
        let out = patchCssRule(prev, '.container', 'flex-direction', 'row');
        out = patchCssRule(out, '.container', 'justify-content', 'space-between');
        out = patchCssRule(out, '.container', 'align-items', 'center');
        return patchCssRule(out, '.item--featured', 'flex-basis', '90px');
      });
    } else if (id === 'center') {
      const next = { ...flexDefaults, direction: 'row', justify: 'center', align: 'center', itemCount: 2, basis: 120 };
      setV(next);
      setHtml(buildFlexHtml(2));
      setCss((prev) => {
        let out = patchCssRule(prev, '.container', 'justify-content', 'center');
        out = patchCssRule(out, '.container', 'align-items', 'center');
        return patchCssRule(out, '.item--featured', 'flex-basis', '120px');
      });
    } else if (id === 'wrap-cards') {
      const next = { ...flexDefaults, direction: 'row', wrap: 'wrap', justify: 'flex-start', align: 'stretch', itemCount: 6, grow: 1, basis: 140, rowGap: 14, columnGap: 14 };
      setV(next);
      setHtml(buildFlexHtml(6));
      setCss((prev) => {
        let out = patchCssRule(prev, '.container', 'flex-wrap', 'wrap');
        out = patchCssRule(out, '.container', 'justify-content', 'flex-start');
        out = patchCssRule(out, '.container', 'align-items', 'stretch');
        out = patchCssRule(out, '.container', 'row-gap', '14px');
        out = patchCssRule(out, '.container', 'column-gap', '14px');
        out = patchCssRule(out, '.item--featured', 'flex-grow', '1');
        return patchCssRule(out, '.item--featured', 'flex-basis', '140px');
      });
    } else if (id === 'crowded-nav') {
      const next = { ...flexDefaults, direction: 'row', wrap: 'nowrap', justify: 'flex-start', align: 'center', itemCount: 6, grow: 0, shrink: 0, basis: 120, columnGap: 16 };
      setV(next);
      setHtml(buildFlexHtml(6));
      setCss((prev) => {
        let out = patchCssRule(prev, '.container', 'flex-wrap', 'nowrap');
        out = patchCssRule(out, '.container', 'justify-content', 'flex-start');
        out = patchCssRule(out, '.container', 'column-gap', '16px');
        out = patchCssRule(out, '.item--featured', 'flex-shrink', '0');
        return patchCssRule(out, '.item--featured', 'flex-basis', '120px');
      });
    } else if (id === 'shrink-minwidth') {
      const next = { ...flexDefaults, direction: 'row', wrap: 'nowrap', justify: 'flex-start', align: 'center', itemCount: 3, grow: 1, shrink: 1, basis: 120, minWidth: '0', columnGap: 12 };
      setV(next);
      setHtml(`<div class="container">\n  <div class="item item--featured">SuperLongUnbreakableTokenInsideFlex</div>\n  <div class="item">02</div>\n  <div class="item">03</div>\n</div>`);
      setCss((prev) => {
        let out = patchCssRule(prev, '.container', 'flex-wrap', 'nowrap');
        out = patchCssRule(out, '.container', 'justify-content', 'flex-start');
        out = patchCssRule(out, '.item--featured', 'flex-grow', '1');
        out = patchCssRule(out, '.item--featured', 'flex-shrink', '1');
        out = patchCssRule(out, '.item--featured', 'flex-basis', '120px');
        return patchCssRule(out, '.item--featured', 'min-width', '0');
      });
    }
  };

  const axis = v.direction.startsWith('row') ? 'horizontal' : 'vertical';
  const mainAxisArrow = v.direction === 'row' ? '→' : v.direction === 'row-reverse' ? '←' : v.direction === 'column' ? '↓' : '↑';

  const renderStage = (justifyVal: string, label?: string) => (
    <div className="viz-stage-box">
      {label && (
        <div className="viz-compare-badge">
          <code>justify-content: {justifyVal}</code>
        </div>
      )}
      <div
        className="flex-axis-stage"
        style={{
          display: v.display as 'flex' | 'inline-flex',
          flexDirection: v.direction as React.CSSProperties['flexDirection'],
          flexWrap: v.wrap as React.CSSProperties['flexWrap'],
          justifyContent: justifyVal,
          alignItems: v.align,
          alignContent: v.alignContent,
          rowGap: `${v.rowGap}px`,
          columnGap: `${v.columnGap}px`,
          minHeight: 200,
        }}
      >
        <div className="flex-axis-arrow main">Main axis {mainAxisArrow}</div>
        <div className="flex-axis-arrow cross">Cross axis</div>
        {Array.from({ length: v.itemCount }, (_, index) => {
          const variedH = v.variedSizes ? [56, 86, 68, 96, 62, 78, 64, 88][index % 8] : undefined;
          return (
            <motion.div
              layout
              transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}
              key={index}
              className={`flex-axis-item ${index === 0 ? 'featured' : ''}`}
              style={
                index === 0
                  ? {
                      alignSelf: v.alignSelf,
                      order: v.order,
                      flex: `${v.grow} ${v.shrink} ${v.basis}px`,
                      minWidth: v.minWidth,
                      minHeight: variedH ?? 62,
                    }
                  : { minHeight: variedH ?? 62 }
              }
            >
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              <small>{index === 0 ? 'Featured' : 'Item'}</small>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="lab-page enhanced-lab">
      <LabHeader
        eyebrow="FLEXBOX LABORATORY"
        title="Flexbox, property by property."
        copy="Adjust visual controls OR edit the live CSS below — both stay synchronized in real time."
        presets={[
          { id: 'navbar', label: 'Navbar' },
          { id: 'center', label: 'Center' },
          { id: 'wrap-cards', label: 'Wrap grid' },
          { id: 'crowded-nav', label: 'Crowded Navbar' },
          { id: 'shrink-minwidth', label: 'Shrink & min-width: 0' },
        ]}
        activePreset={preset}
        onPreset={applyPreset}
        compareEnabled={compare}
        onToggleCompare={() => setCompare((c) => !c)}
        onReset={resetAll}
      />

      <div className="enhanced-lab-layout">
        <aside className="visual-controls">
          <h2>Container</h2>
          <SegmentedControl label="display" value={v.display} options={['flex', 'inline-flex']} onChange={(val) => set('display', val, '.container', 'display', val)} />
          <SelectControl label="flex-direction" value={v.direction} options={['row', 'row-reverse', 'column', 'column-reverse']} onChange={(val) => set('direction', val, '.container', 'flex-direction', val)} />
          <SegmentedControl label="flex-wrap" value={v.wrap} options={['nowrap', 'wrap', 'wrap-reverse']} onChange={(val) => set('wrap', val, '.container', 'flex-wrap', val)} />
          <SelectControl label="justify-content" value={v.justify} options={['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']} onChange={(val) => set('justify', val, '.container', 'justify-content', val)} />
          {compare && (
            <SelectControl label="Compare justify-content (B)" value={compareJustify} options={['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']} onChange={setCompareJustify} />
          )}
          <SelectControl label="align-items" value={v.align} options={['stretch', 'flex-start', 'center', 'flex-end', 'baseline']} onChange={(val) => set('align', val, '.container', 'align-items', val)} />
          <SelectControl label="align-content" value={v.alignContent} options={['stretch', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around']} onChange={(val) => set('alignContent', val, '.container', 'align-content', val)} />
          <RangeControl label="row-gap" value={v.rowGap} min={0} max={36} onChange={(val) => set('rowGap', val, '.container', 'row-gap', `${val}px`)} />
          <RangeControl label="column-gap" value={v.columnGap} min={0} max={36} onChange={(val) => set('columnGap', val, '.container', 'column-gap', `${val}px`)} />

          <h2>Elements &amp; Featured Item</h2>
          <CountControl
            label="Flex items"
            value={v.itemCount}
            min={2}
            max={8}
            onChange={(val) => {
              setV((prev) => ({ ...prev, itemCount: val }));
              setHtml(buildFlexHtml(val));
            }}
          />
          <ToggleControl label="Vary item heights" checked={v.variedSizes} onChange={(val) => set('variedSizes', val, null)} />
          <SelectControl label="align-self" value={v.alignSelf} options={['auto', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline']} onChange={(val) => set('alignSelf', val, '.item--featured', 'align-self', val)} />
          <SelectControl label="order" value={String(v.order)} options={['-1', '0', '1', '2']} onChange={(val) => set('order', Number(val), '.item--featured', 'order', val)} />
          <RangeControl label="flex-grow" value={v.grow} min={0} max={3} unit="" onChange={(val) => set('grow', val, '.item--featured', 'flex-grow', String(val))} />
          <RangeControl label="flex-shrink" value={v.shrink} min={0} max={3} unit="" onChange={(val) => set('shrink', val, '.item--featured', 'flex-shrink', String(val))} />
          <RangeControl label="flex-basis" value={v.basis} min={50} max={220} onChange={(val) => set('basis', val, '.item--featured', 'flex-basis', `${val}px`)} />
          <SelectControl label="min-width (Item 01)" value={v.minWidth} options={['auto', '0', '90px', '150px']} onChange={(val) => set('minWidth', val, '.item--featured', 'min-width', val)} />
        </aside>

        <div className="visual-workspace">
          <div className="visual-stage-title">
            <span>LIVE FLEX CONTAINER</span>
            <span>Main axis: {axis} · Cross axis: {axis === 'horizontal' ? 'vertical' : 'horizontal'}</span>
          </div>

          {compare ? (
            <div className="viz-compare-grid">
              {renderStage(v.justify, 'A')}
              {renderStage(compareJustify, 'B')}
            </div>
          ) : (
            renderStage(v.justify)
          )}

          <div className="property-explain">
            <Sparkles size={16} />
            <p>
              <strong>justify-content: {v.justify}</strong> distributes space along the {axis} main axis.{' '}
              <strong>align-items: {v.align}</strong> aligns items across the cross axis.
            </p>
          </div>

          <LiveExperimentEditor
            html={html}
            css={css}
            previewCssWrapper={flexPreviewWrapper}
            onHtmlChange={setHtml}
            onCssChange={handleCssEdit}
            onReset={resetAll}
            labelPrefix="Flexbox"
          />
        </div>
      </div>
    </section>
  );
}

/* ==================== 2. GRID LAB ==================== */
const gridDefaults = {
  columns: 'repeat(3, 1fr)',
  rows: 'repeat(2, minmax(80px, auto))',
  areasMode: 'none' as 'none' | 'layout',
  autoFlow: 'row',
  autoCols: 'minmax(80px, 1fr)',
  autoRows: '80px',
  justifyItems: 'stretch',
  alignItems: 'stretch',
  justifyContent: 'stretch',
  alignContent: 'stretch',
  rowGap: 12,
  columnGap: 12,
  itemCount: 6,
  featuredCol: 'auto',
  featuredRow: 'auto',
  featuredArea: 'auto',
};

const gridInitialCss = `.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, minmax(80px, auto));
  grid-auto-flow: row;
  grid-auto-columns: minmax(80px, 1fr);
  grid-auto-rows: 80px;
  justify-items: stretch;
  align-items: stretch;
  justify-content: stretch;
  align-content: stretch;
  row-gap: 12px;
  column-gap: 12px;
}
.item--featured {
  grid-column: auto;
  grid-row: auto;
  grid-area: auto;
}`;

const buildGridHtml = (count: number) =>
  `<div class="grid">\n${Array.from({ length: count }, (_, i) => `  <div class="${i === 0 ? 'item item--featured' : 'item'}">Item ${String(i + 1).padStart(2, '0')}</div>`).join('\n')}\n</div>`;

const gridPreviewWrapper = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff}
.grid{min-height:180px;padding:12px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc}
.item{min-height:52px;padding:10px;border-radius:7px;background:#ecfeff;border:1px solid #a5f3fc;color:#0e7490;font-weight:700;display:grid;place-items:center}
.item--featured{background:#ede9fe;border-color:#7c5cff;color:#5b21b6}`;

function GridLab() {
  const [g, setG] = useState(gridDefaults);
  const [css, setCss] = useState(gridInitialCss);
  const [html, setHtml] = useState(() => buildGridHtml(gridDefaults.itemCount));
  const [preset, setPreset] = useState('');
  const [compare, setCompare] = useState(false);
  const [compareCols, setCompareCols] = useState('1fr 2fr 1fr');

  const set = <K extends keyof typeof gridDefaults>(
    key: K,
    next: typeof gridDefaults[K],
    selector: '.grid' | '.item--featured' | null,
    cssProp?: string,
    cssVal?: string
  ) => {
    setPreset('');
    setG((prev) => ({ ...prev, [key]: next }));
    if (selector && cssProp && cssVal !== undefined) {
      setCss((prev) => patchCssRule(prev, selector, cssProp, cssVal));
    }
  };

  const handleCssEdit = (nextCss: string) => {
    setCss(nextCss);
    if (validateCss(nextCss) !== null) return;
    const gr = extractRuleDeclarations(nextCss, '.grid');
    const ft = extractRuleDeclarations(nextCss, '.item--featured');
    setG((prev) => ({
      ...prev,
      columns: gr['grid-template-columns'] ?? prev.columns,
      rows: gr['grid-template-rows'] ?? prev.rows,
      areasMode: gr['grid-template-areas'] ? 'layout' : 'none',
      autoFlow: gr['grid-auto-flow'] ?? prev.autoFlow,
      autoCols: gr['grid-auto-columns'] ?? prev.autoCols,
      autoRows: gr['grid-auto-rows'] ?? prev.autoRows,
      justifyItems: gr['justify-items'] ?? prev.justifyItems,
      alignItems: gr['align-items'] ?? prev.alignItems,
      justifyContent: gr['justify-content'] ?? prev.justifyContent,
      alignContent: gr['align-content'] ?? prev.alignContent,
      rowGap: parseNumericCss(gr['row-gap'] ?? gr['gap'], prev.rowGap),
      columnGap: parseNumericCss(gr['column-gap'] ?? gr['gap'], prev.columnGap),
      featuredCol: ft['grid-column'] ?? prev.featuredCol,
      featuredRow: ft['grid-row'] ?? prev.featuredRow,
      featuredArea: ft['grid-area'] ?? prev.featuredArea,
    }));
  };

  const resetAll = () => {
    setG(gridDefaults);
    setCss(gridInitialCss);
    setHtml(buildGridHtml(gridDefaults.itemCount));
    setPreset('');
    setCompare(false);
  };

  const applyPreset = (id: string) => {
    setPreset(id);
    if (id === 'cards') {
      setG({ ...gridDefaults, columns: 'repeat(3, 1fr)', itemCount: 6 });
      setHtml(buildGridHtml(6));
      setCss(gridInitialCss);
    } else if (id === 'areas') {
      setG({ ...gridDefaults, areasMode: 'layout', columns: '160px 1fr', rows: '56px 150px 52px', itemCount: 3 });
      setHtml(`<div class="grid">\n  <div class="item item--1">header</div>\n  <div class="item item--2">sidebar</div>\n  <div class="item item--3">main</div>\n</div>`);
      setCss(`.grid {\n  display: grid;\n  grid-template-columns: 160px 1fr;\n  grid-template-rows: 56px 150px 52px;\n  grid-template-areas:\n    "header header"\n    "sidebar main"\n    "footer footer";\n  row-gap: 12px;\n  column-gap: 12px;\n}\n.item--1 { grid-area: header; }\n.item--2 { grid-area: sidebar; }\n.item--3 { grid-area: main; }`);
    } else if (id === 'auto-fit') {
      setG({ ...gridDefaults, columns: 'repeat(auto-fit, minmax(120px, 1fr))', itemCount: 5 });
      setHtml(buildGridHtml(5));
      setCss(patchCssRule(gridInitialCss, '.grid', 'grid-template-columns', 'repeat(auto-fit, minmax(120px, 1fr))'));
    } else if (id === 'minmax-zero') {
      setG({ ...gridDefaults, columns: 'repeat(3, minmax(0, 1fr))', itemCount: 3 });
      setHtml(`<div class="grid">\n  <div class="item item--featured">UnbreakableLongTokenInsideGridTrack</div>\n  <div class="item">Item 02</div>\n  <div class="item">Item 03</div>\n</div>`);
      setCss(patchCssRule(gridInitialCss, '.grid', 'grid-template-columns', 'repeat(3, minmax(0, 1fr))'));
    }
  };

  const renderGridStage = (cols: string, label?: string) => (
    <div className="viz-stage-box">
      {label && (
        <div className="viz-compare-badge">
          <code>grid-template-columns: {cols}</code>
        </div>
      )}
      <div
        className="grid-lines-stage"
        style={{
          height: 300,
          gridTemplateColumns: cols,
          gridTemplateRows: g.rows,
          gridTemplateAreas: g.areasMode === 'layout' ? `"header header" "sidebar main" "footer footer"` : undefined,
          gridAutoFlow: g.autoFlow,
          gridAutoColumns: g.autoCols,
          gridAutoRows: g.autoRows,
          justifyItems: g.justifyItems,
          alignItems: g.alignItems,
          justifyContent: g.justifyContent,
          alignContent: g.alignContent,
          rowGap: `${g.rowGap}px`,
          columnGap: `${g.columnGap}px`,
        }}
      >
        {Array.from({ length: g.itemCount }, (_, index) => {
          const areaNames = ['header', 'sidebar', 'main', 'footer'];
          const itemStyle: React.CSSProperties | undefined =
            g.areasMode === 'layout'
              ? { gridArea: areaNames[index] ?? 'auto' }
              : index === 0
              ? {
                  gridColumn: g.featuredCol !== 'auto' ? g.featuredCol : undefined,
                  gridRow: g.featuredRow !== 'auto' ? g.featuredRow : undefined,
                  gridArea: g.featuredArea !== 'auto' ? g.featuredArea : undefined,
                }
              : undefined;
          return (
            <motion.div
              layout
              transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}
              key={index}
              className={`grid-lines-item ${index === 0 ? 'featured' : ''}`}
              style={itemStyle}
            >
              <small>
                {g.areasMode === 'layout' ? areaNames[index] ?? `Item ${index + 1}` : `Item ${String(index + 1).padStart(2, '0')}`}
              </small>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  return (
    <section className="lab-page enhanced-lab">
      <LabHeader
        eyebrow="CSS GRID LABORATORY"
        title="See the grid beneath the layout."
        copy="Adjust track controls or edit the CSS directly to synchronize grid tracks, alignment, and browser preview."
        presets={[
          { id: 'cards', label: '3-Col Cards' },
          { id: 'areas', label: 'Named Areas' },
          { id: 'auto-fit', label: 'Auto-fit' },
          { id: 'minmax-zero', label: 'minmax(0, 1fr)' },
        ]}
        activePreset={preset}
        onPreset={applyPreset}
        compareEnabled={compare}
        onToggleCompare={() => setCompare((c) => !c)}
        onReset={resetAll}
      />

      <div className="enhanced-lab-layout">
        <aside className="visual-controls">
          <h2>Tracks &amp; Areas</h2>
          <SelectControl
            label="grid-template-columns"
            value={g.columns}
            options={[
              'repeat(2, 1fr)',
              'repeat(3, 1fr)',
              'repeat(3, minmax(0, 1fr))',
              'repeat(4, 1fr)',
              '1fr 2fr 1fr',
              '160px 1fr',
              'minmax(120px, max-content) 1fr',
              'repeat(auto-fit, minmax(120px, 1fr))',
              'repeat(auto-fill, minmax(120px, 1fr))',
            ]}
            onChange={(val) => set('columns', val, '.grid', 'grid-template-columns', val)}
          />
          {compare && (
            <SelectControl
              label="Compare columns (B)"
              value={compareCols}
              options={['repeat(2, 1fr)', 'repeat(3, 1fr)', '1fr 2fr 1fr', 'repeat(auto-fit, minmax(120px, 1fr))', 'repeat(auto-fill, minmax(120px, 1fr))']}
              onChange={setCompareCols}
            />
          )}
          <SelectControl
            label="grid-template-rows"
            value={g.rows}
            options={['repeat(2, minmax(80px, auto))', 'repeat(3, 1fr)', '56px 150px 52px', '80px auto']}
            onChange={(val) => set('rows', val, '.grid', 'grid-template-rows', val)}
          />
          <SegmentedControl
            label="grid-template-areas"
            value={g.areasMode}
            options={['none', 'layout']}
            onChange={(val) => applyPreset(val === 'layout' ? 'areas' : 'cards')}
          />
          <SelectControl label="grid-auto-flow" value={g.autoFlow} options={['row', 'column', 'row dense', 'column dense']} onChange={(val) => set('autoFlow', val, '.grid', 'grid-auto-flow', val)} />
          <SelectControl label="grid-auto-rows" value={g.autoRows} options={['auto', '80px', 'minmax(65px, auto)']} onChange={(val) => set('autoRows', val, '.grid', 'grid-auto-rows', val)} />
          <SelectControl label="grid-auto-columns" value={g.autoCols} options={['auto', 'minmax(80px, 1fr)', '110px']} onChange={(val) => set('autoCols', val, '.grid', 'grid-auto-columns', val)} />

          <h2>Alignment &amp; Gaps</h2>
          <SelectControl label="justify-items" value={g.justifyItems} options={['stretch', 'start', 'center', 'end']} onChange={(val) => set('justifyItems', val, '.grid', 'justify-items', val)} />
          <SelectControl label="align-items" value={g.alignItems} options={['stretch', 'start', 'center', 'end']} onChange={(val) => set('alignItems', val, '.grid', 'align-items', val)} />
          <SelectControl label="justify-content" value={g.justifyContent} options={['stretch', 'start', 'center', 'end', 'space-between', 'space-around']} onChange={(val) => set('justifyContent', val, '.grid', 'justify-content', val)} />
          <SelectControl label="align-content" value={g.alignContent} options={['stretch', 'start', 'center', 'end', 'space-between']} onChange={(val) => set('alignContent', val, '.grid', 'align-content', val)} />
          <RangeControl label="column-gap" value={g.columnGap} min={0} max={36} onChange={(val) => set('columnGap', val, '.grid', 'column-gap', `${val}px`)} />
          <RangeControl label="row-gap" value={g.rowGap} min={0} max={36} onChange={(val) => set('rowGap', val, '.grid', 'row-gap', `${val}px`)} />

          <h2>Items &amp; Placement</h2>
          <CountControl
            label="Grid items"
            value={g.itemCount}
            min={2}
            max={12}
            onChange={(val) => {
              setG((prev) => ({ ...prev, itemCount: val }));
              setHtml(buildGridHtml(val));
            }}
          />
          <SelectControl label="grid-column (Item 01)" value={g.featuredCol} options={['auto', 'span 2', '1 / 3', '2 / 4', '1 / -1']} onChange={(val) => set('featuredCol', val, '.item--featured', 'grid-column', val)} />
          <SelectControl label="grid-row (Item 01)" value={g.featuredRow} options={['auto', 'span 2', '1 / 3']} onChange={(val) => set('featuredRow', val, '.item--featured', 'grid-row', val)} />
          <SelectControl label="grid-area (Item 01)" value={g.featuredArea} options={['auto', '1 / 1 / 3 / 3']} onChange={(val) => set('featuredArea', val, '.item--featured', 'grid-area', val)} />
        </aside>

        <div className="visual-workspace">
          <div className="visual-stage-title">
            <span>LIVE CSS GRID</span>
            <span>{g.columns} · {g.itemCount} items</span>
          </div>

          {compare ? (
            <div className="viz-compare-grid">
              {renderGridStage(g.columns, 'A')}
              {renderGridStage(compareCols, 'B')}
            </div>
          ) : (
            renderGridStage(g.columns)
          )}

          <LiveExperimentEditor
            html={html}
            css={css}
            previewCssWrapper={gridPreviewWrapper}
            onHtmlChange={setHtml}
            onCssChange={handleCssEdit}
            onReset={resetAll}
            labelPrefix="Grid"
          />
        </div>
      </div>
    </section>
  );
}

/* ==================== 3. BOX MODEL LAB ==================== */
const boxDefaults = {
  width: 260,
  height: 130,
  minWidth: 120,
  maxWidth: 420,
  padding: 24,
  margin: 20,
  borderWidth: 6,
  borderStyle: 'solid',
  borderRadius: 10,
  sizing: 'border-box' as 'border-box' | 'content-box',
};

const boxInitialCss = `.box {
  width: 260px;
  height: 130px;
  min-width: 120px;
  max-width: 420px;
  padding: 24px;
  margin: 20px;
  border-width: 6px;
  border-style: solid;
  border-color: #7c5cff;
  border-radius: 10px;
  box-sizing: border-box;
}`;

const boxInitialHtml = `<div class="box">Box Model Content</div>`;

const boxPreviewWrapper = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff}
.box{background:#dcfce7;color:#166534;font-weight:700;display:grid;place-items:center}`;

function BoxModelLab() {
  const [b, setB] = useState(boxDefaults);
  const [css, setCss] = useState(boxInitialCss);
  const [html, setHtml] = useState(boxInitialHtml);
  const [compare, setCompare] = useState(false);

  const set = <K extends keyof typeof boxDefaults>(
    key: K,
    next: typeof boxDefaults[K],
    cssProp: string,
    cssVal: string
  ) => {
    setB((prev) => ({ ...prev, [key]: next }));
    setCss((prev) => patchCssRule(prev, '.box', cssProp, cssVal));
  };

  const handleCssEdit = (nextCss: string) => {
    setCss(nextCss);
    if (validateCss(nextCss) !== null) return;
    const d = extractRuleDeclarations(nextCss, '.box');
    setB((prev) => ({
      ...prev,
      width: parseNumericCss(d['width'], prev.width),
      height: parseNumericCss(d['height'], prev.height),
      minWidth: parseNumericCss(d['min-width'], prev.minWidth),
      maxWidth: parseNumericCss(d['max-width'], prev.maxWidth),
      padding: parseNumericCss(d['padding'], prev.padding),
      margin: parseNumericCss(d['margin'], prev.margin),
      borderWidth: parseNumericCss(d['border-width'], prev.borderWidth),
      borderStyle: d['border-style'] ?? prev.borderStyle,
      borderRadius: parseNumericCss(d['border-radius'], prev.borderRadius),
      sizing: d['box-sizing'] === 'content-box' ? 'content-box' : d['box-sizing'] === 'border-box' ? 'border-box' : prev.sizing,
    }));
  };

  const resetAll = () => {
    setB(boxDefaults);
    setCss(boxInitialCss);
    setHtml(boxInitialHtml);
    setCompare(false);
  };

  const applyBoxPreset = (id: string) => {
    if (id === 'overflow-100') {
      setB({ ...boxDefaults, sizing: 'content-box', width: 340, padding: 32, borderWidth: 8, margin: 16 });
      setCss(`.box {\n  width: 340px;\n  height: 130px;\n  min-width: 120px;\n  max-width: 420px;\n  padding: 32px;\n  margin: 16px;\n  border-width: 8px;\n  border-style: solid;\n  border-radius: 10px;\n  box-sizing: content-box;\n}`);
    }
  };

  const calc = (sizing: 'border-box' | 'content-box') => {
    const clampedW = Math.min(b.maxWidth, Math.max(b.minWidth, b.width));
    const contentW = sizing === 'border-box' ? Math.max(20, clampedW - b.padding * 2 - b.borderWidth * 2) : clampedW;
    const contentH = sizing === 'border-box' ? Math.max(20, b.height - b.padding * 2 - b.borderWidth * 2) : b.height;
    const borderBoxW = sizing === 'border-box' ? clampedW : clampedW + b.padding * 2 + b.borderWidth * 2;
    const borderBoxH = sizing === 'border-box' ? b.height : b.height + b.padding * 2 + b.borderWidth * 2;
    return { contentW, contentH, borderBoxW, borderBoxH };
  };

  const current = calc(b.sizing);

  const renderBox = (sizing: 'border-box' | 'content-box', badge?: string) => {
    const m = calc(sizing);
    return (
      <div className="viz-stage-box">
        {badge && (
          <div className="viz-compare-badge">
            <code>box-sizing: {sizing} · Border box: {m.borderBoxW}×{m.borderBoxH}px</code>
          </div>
        )}
        <div className="box-model-stage" style={{ padding: 14 }}>
          <motion.div className="box-margin-layer" animate={{ padding: Math.min(b.margin, 44) }} transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}>
            <span className="layer-caption margin-caption">MARGIN {b.margin}px</span>
            <motion.div
              className="box-border-layer"
              animate={{ borderWidth: b.borderWidth, borderRadius: b.borderRadius }}
              style={{ borderStyle: b.borderStyle }}
              transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}
            >
              <span className="layer-caption border-caption">BORDER {b.borderWidth}px {b.borderStyle}</span>
              <motion.div className="box-padding-layer" animate={{ padding: b.padding }} transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}>
                <span className="layer-caption padding-caption">PADDING {b.padding}px</span>
                <motion.div className="box-content-layer" animate={{ width: m.contentW, height: m.contentH }} transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}>
                  CONTENT
                  <small>{m.contentW} × {m.contentH}px</small>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  };

  return (
    <section className="lab-page enhanced-lab">
      <LabHeader
        eyebrow="BOX MODEL LABORATORY"
        title="Every element is a box."
        copy="Inspect content, padding, border, and margin layers, or edit CSS directly to see border-box vs content-box update."
        presets={[{ id: 'overflow-100', label: '100% Overflow' }]}
        activePreset={b.sizing === 'content-box' && b.width === 340 && b.padding === 32 ? 'overflow-100' : ''}
        onPreset={applyBoxPreset}
        compareEnabled={compare}
        onToggleCompare={() => setCompare((c) => !c)}
        onReset={resetAll}
      />

      <div className="enhanced-lab-layout">
        <aside className="visual-controls">
          <h2>Sizing</h2>
          <SegmentedControl label="box-sizing" value={b.sizing} options={['border-box', 'content-box']} onChange={(val) => set('sizing', val as 'border-box' | 'content-box', 'box-sizing', val)} />
          <RangeControl label="width" value={b.width} min={120} max={380} onChange={(val) => set('width', val, 'width', `${val}px`)} />
          <RangeControl label="height" value={b.height} min={80} max={240} onChange={(val) => set('height', val, 'height', `${val}px`)} />
          <RangeControl label="min-width" value={b.minWidth} min={60} max={240} onChange={(val) => set('minWidth', val, 'min-width', `${val}px`)} />
          <RangeControl label="max-width" value={b.maxWidth} min={180} max={440} onChange={(val) => set('maxWidth', val, 'max-width', `${val}px`)} />

          <h2>Spacing &amp; Border</h2>
          <RangeControl label="padding" value={b.padding} min={0} max={48} onChange={(val) => set('padding', val, 'padding', `${val}px`)} />
          <RangeControl label="margin" value={b.margin} min={0} max={44} onChange={(val) => set('margin', val, 'margin', `${val}px`)} />
          <RangeControl label="border-width" value={b.borderWidth} min={0} max={20} onChange={(val) => set('borderWidth', val, 'border-width', `${val}px`)} />
          <SelectControl label="border-style" value={b.borderStyle} options={['solid', 'dashed', 'dotted', 'double']} onChange={(val) => set('borderStyle', val, 'border-style', val)} />
          <RangeControl label="border-radius" value={b.borderRadius} min={0} max={40} onChange={(val) => set('borderRadius', val, 'border-radius', `${val}px`)} />
        </aside>

        <div className="visual-workspace">
          <div className="visual-stage-title">
            <span>BOX LAYERS</span>
            <span>{b.sizing} · Border box {current.borderBoxW} × {current.borderBoxH}px</span>
          </div>

          {compare ? (
            <div className="viz-compare-grid">
              {renderBox('border-box', 'border-box')}
              {renderBox('content-box', 'content-box')}
            </div>
          ) : (
            renderBox(b.sizing)
          )}

          <div className="dimension-breakdown">
            <div><span>Content</span><strong>{current.contentW} × {current.contentH}px</strong></div>
            <div><span>Border box</span><strong>{current.borderBoxW} × {current.borderBoxH}px</strong></div>
            <div><span>Total with margin</span><strong>{current.borderBoxW + b.margin * 2} × {current.borderBoxH + b.margin * 2}px</strong></div>
          </div>

          <LiveExperimentEditor
            html={html}
            css={css}
            previewCssWrapper={boxPreviewWrapper}
            onHtmlChange={setHtml}
            onCssChange={handleCssEdit}
            onReset={resetAll}
            labelPrefix="Box Model"
          />
        </div>
      </div>
    </section>
  );
}

/* ==================== 4. POSITIONING LAB ==================== */
const posDefaults = {
  position: 'relative',
  anchorEdge: 'top-left' as 'top-left' | 'bottom-right',
  top: 20,
  left: 24,
  right: 24,
  bottom: 20,
  zIndex: 2,
  parentPositioned: true,
};

const posInitialCss = `.parent {
  position: relative;
}
.target {
  position: relative;
  top: 20px;
  left: 24px;
  z-index: 2;
}`;

const posInitialHtml = `<div class="parent">
  <div class="target">Target</div>
  <div class="sibling">Sibling (z-index: 2)</div>
</div>`;

const posPreviewWrapper = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff;min-height:420px}
.parent{height:180px;padding:14px;border:1px dashed #94a3b8;border-radius:8px;background:#f8fafc}
.target{width:110px;height:60px;display:grid;place-items:center;border-radius:8px;background:#ede9fe;border:1px solid #7c5cff;color:#5b21b6;font-weight:700}
.sibling{margin-top:12px;width:150px;height:52px;display:grid;place-items:center;border-radius:7px;background:#dcfce7;border:1px solid #86efac;color:#166534;position:relative;z-index:2;font-size:12px}`;

function PositionLab() {
  const [p, setP] = useState(posDefaults);
  const [css, setCss] = useState(posInitialCss);
  const [html, setHtml] = useState(posInitialHtml);

  const set = <K extends keyof typeof posDefaults>(
    key: K,
    next: typeof posDefaults[K],
    selector: '.parent' | '.target' | null,
    cssProp?: string,
    cssVal?: string
  ) => {
    setP((prev) => ({ ...prev, [key]: next }));
    if (selector && cssProp && cssVal !== undefined) {
      setCss((prev) => patchCssRule(prev, selector, cssProp, cssVal));
    }
  };

  const handleCssEdit = (nextCss: string) => {
    setCss(nextCss);
    if (validateCss(nextCss) !== null) return;
    const pr = extractRuleDeclarations(nextCss, '.parent');
    const tg = extractRuleDeclarations(nextCss, '.target');
    setP((prev) => ({
      ...prev,
      parentPositioned: pr['position'] ? pr['position'] !== 'static' : prev.parentPositioned,
      position: tg['position'] ?? prev.position,
      top: parseNumericCss(tg['top'], prev.top),
      left: parseNumericCss(tg['left'], prev.left),
      right: parseNumericCss(tg['right'], prev.right),
      bottom: parseNumericCss(tg['bottom'], prev.bottom),
      zIndex: parseNumericCss(tg['z-index'], prev.zIndex),
    }));
  };

  const resetAll = () => {
    setP(posDefaults);
    setCss(posInitialCss);
    setHtml(posInitialHtml);
  };

  const applyPosPreset = (id: string) => {
    if (id === 'badge-zindex') {
      setP({ ...posDefaults, position: 'absolute', parentPositioned: false, anchorEdge: 'top-left', top: 12, left: 12, zIndex: 0 });
      setCss(`.parent {\n  position: static;\n}\n.target {\n  position: absolute;\n  top: 12px;\n  left: 12px;\n  z-index: 0;\n}`);
    }
  };

  const targetInsets: React.CSSProperties =
    p.position === 'static'
      ? {}
      : p.anchorEdge === 'top-left'
      ? { top: p.top, left: p.left, zIndex: p.zIndex }
      : { bottom: p.bottom, right: p.right, zIndex: p.zIndex };

  return (
    <section className="lab-page enhanced-lab">
      <LabHeader
        eyebrow="POSITIONING LABORATORY"
        title="See what position changes."
        copy="Compare static, relative, absolute, fixed, and sticky positioning, or edit CSS directly."
        presets={[{ id: 'badge-zindex', label: 'Badge z-index' }]}
        activePreset={p.position === 'absolute' && !p.parentPositioned && p.zIndex === 0 ? 'badge-zindex' : ''}
        onPreset={applyPosPreset}
        onReset={resetAll}
      />

      <div className="enhanced-lab-layout">
        <aside className="visual-controls">
          <h2>Position &amp; Containing Block</h2>
          <SegmentedControl label="position" value={p.position} options={['static', 'relative', 'absolute', 'fixed', 'sticky']} onChange={(val) => set('position', val, '.target', 'position', val)} />
          <ToggleControl label="Parent is position: relative" checked={p.parentPositioned} onChange={(val) => set('parentPositioned', val, '.parent', 'position', val ? 'relative' : 'static')} />
          <SegmentedControl label="Inset anchor" value={p.anchorEdge} options={['top-left', 'bottom-right']} onChange={(val) => set('anchorEdge', val as 'top-left' | 'bottom-right', null)} />

          {p.anchorEdge === 'top-left' ? (
            <>
              <RangeControl label="top" value={p.top} min={0} max={120} onChange={(val) => set('top', val, '.target', 'top', `${val}px`)} />
              <RangeControl label="left" value={p.left} min={0} max={140} onChange={(val) => set('left', val, '.target', 'left', `${val}px`)} />
            </>
          ) : (
            <>
              <RangeControl label="bottom" value={p.bottom} min={0} max={120} onChange={(val) => set('bottom', val, '.target', 'bottom', `${val}px`)} />
              <RangeControl label="right" value={p.right} min={0} max={140} onChange={(val) => set('right', val, '.target', 'right', `${val}px`)} />
            </>
          )}
          <RangeControl label="z-index" value={p.zIndex} min={0} max={10} unit="" onChange={(val) => set('zIndex', val, '.target', 'z-index', String(val))} />
        </aside>

        <div className="visual-workspace">
          <div className="visual-stage-title">
            <span>SCROLLABLE POSITIONING STAGE</span>
            <span>position: {p.position} · parent: {p.parentPositioned ? 'relative' : 'static'}</span>
          </div>

          <div className="position-scroll-stage">
            <div className="position-scroll-content">
              <div className="position-ancestor" style={{ position: p.parentPositioned ? 'relative' : 'static' }}>
                <span className="ancestor-label">Parent container · position: {p.parentPositioned ? 'relative (containing block)' : 'static'}</span>
                <div className="position-placeholder">Normal flow slot</div>
                <div className={`positioning-target position-${p.position}`} style={targetInsets}>
                  <strong>Target</strong>
                  <small>{p.position}</small>
                </div>
                <div className="overlap-target" style={{ zIndex: 2 }}>
                  Sibling (z-index: 2)
                </div>
              </div>
              <p>Scroll inside this stage ↓ to observe sticky and fixed behavior.</p>
              <div className="position-filler" />
            </div>
          </div>

          <LiveExperimentEditor
            html={html}
            css={css}
            previewCssWrapper={posPreviewWrapper}
            onHtmlChange={setHtml}
            onCssChange={handleCssEdit}
            onReset={resetAll}
            labelPrefix="Positioning"
          />

          <StackingContextStudio />
        </div>
      </div>
    </section>
  );
}

/* ==================== 5. RESPONSIVE LAB ==================== */
const respInitialCss = `.cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 768px) {
  .cards {
    grid-template-columns: repeat(3, 1fr);
  }
}`;

const respInitialHtml = `<div class="cards">
  <div class="card">Project one</div>
  <div class="card">Project two</div>
  <div class="card">Project three</div>
</div>`;

const respPreviewWrapper = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff}
.card{padding:18px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#121726;font-weight:600;font-size:13px}`;

function ResponsiveLab() {
  const [width, setWidth] = useState(375);
  const [height, setHeight] = useState(420);
  const [breakpoint, setBreakpoint] = useState(768);
  const [css, setCss] = useState(respInitialCss);
  const [html, setHtml] = useState(respInitialHtml);
  const [brokenGrid, setBrokenGrid] = useState(false);
  const [overflowPx, setOverflowPx] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const active = width >= breakpoint;

  useEffect(() => {
    const checkOverflow = () => {
      const el = previewRef.current;
      if (!el) return;
      const diff = el.scrollWidth - el.clientWidth;
      setOverflowPx(diff > 1 ? diff : 0);
    };
    const timer = window.setTimeout(checkOverflow, 180);
    return () => window.clearTimeout(timer);
  }, [width, height, breakpoint, brokenGrid]);

  const updateBreakpoint = (nextBp: number) => {
    setBreakpoint(nextBp);
    setCss((prev) => patchMediaBreakpoint(prev, nextBp));
  };

  const handleCssEdit = (nextCss: string) => {
    setCss(nextCss);
    if (validateCss(nextCss) !== null) return;
    setBreakpoint((prev) => extractMediaBreakpoint(nextCss, prev));
  };

  const resetAll = () => {
    setWidth(375);
    setHeight(420);
    setBreakpoint(768);
    setBrokenGrid(false);
    setCss(respInitialCss);
    setHtml(respInitialHtml);
  };

  const handlePreset = (id: string) => {
    if (id === 'broken-mobile') {
      setWidth(375);
      setBrokenGrid(true);
      setCss(`.cards {\n  display: grid;\n  grid-template-columns: repeat(3, 180px);\n  gap: 12px;\n}\n@media (min-width: ${breakpoint}px) {\n  .cards {\n    grid-template-columns: repeat(3, 1fr);\n  }\n}`);
    } else if (id === 'width-constraints') {
      setWidth(768);
      setBrokenGrid(false);
      setCss(`.cards {\n  width: 90%;\n  min-width: 240px;\n  max-width: 640px;\n  margin: 0 auto;\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: 12px;\n}\n@media (min-width: ${breakpoint}px) {\n  .cards {\n    grid-template-columns: repeat(3, 1fr);\n  }\n}`);
    } else {
      setBrokenGrid(false);
      setWidth(Number(id));
    }
  };

  return (
    <section className="lab-page enhanced-lab">
      <LabHeader
        eyebrow="RESPONSIVE VIEWPORT LAB"
        title="One layout, many viewports."
        copy="Resize width/height, inspect real horizontal overflow, or edit @media (min-width) in CSS directly."
        presets={[
          { id: '375', label: 'Mobile' },
          { id: '768', label: 'Tablet' },
          { id: '1024', label: 'Laptop' },
          { id: '1440', label: 'Desktop' },
          { id: 'broken-mobile', label: 'Broken Mobile Grid' },
          { id: 'width-constraints', label: 'Width Constraints' },
        ]}
        activePreset={brokenGrid ? 'broken-mobile' : String(width)}
        onPreset={handlePreset}
        onReset={resetAll}
      />

      <div className="enhanced-lab-layout">
        <aside className="visual-controls">
          <h2>Viewport Dimensions</h2>
          <NumberControl label="Viewport width" value={width} min={280} max={1440} onChange={setWidth} />
          <RangeControl label="Width slider" value={width} min={280} max={1440} onChange={setWidth} />
          <RangeControl label="Preview height" value={height} min={280} max={620} onChange={setHeight} />
          <h2>Media Query</h2>
          <RangeControl label="@media min-width" value={breakpoint} min={480} max={1100} onChange={updateBreakpoint} />
          <div className="property-explain">
            <Sparkles size={16} />
            <p>
              At <strong>{width}px</strong>, the media query is{' '}
              <strong>{active ? 'ACTIVE (3 columns)' : 'INACTIVE (1 column)'}</strong>.
            </p>
          </div>
        </aside>

        <div className="visual-workspace">
          <div className="visual-stage-title">
            <span>SIMULATED VIEWPORT</span>
            <span>
              {width} × {height}px · breakpoint {breakpoint}px
              {overflowPx > 0 && ` · ⚠ Horizontal overflow (+${overflowPx}px)`}
            </span>
          </div>

          <div className="responsive-preview-wrap">
            <motion.div
              ref={previewRef}
              className="responsive-preview"
              style={{ overflowX: 'auto' }}
              animate={{ width: `min(100%, ${width}px)`, minHeight: height }}
              transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}
            >
              <div className="responsive-preview-head">
                <span>PREVIEW</span>
                <span>
                  {overflowPx > 0 ? `Overflow +${overflowPx}px` : `${width} × ${height}px · ${active ? '≥' : '<'} ${breakpoint}px`}
                </span>
              </div>
              <div className={`responsive-preview-body ${active ? 'wide' : ''}`}>
                <div className="responsive-nav">
                  <strong>Studio</strong>
                  <span>Work</span>
                  <span>About</span>
                  <span>Contact</span>
                </div>
                <div className="responsive-hero">
                  <span className="eyebrow-line">MEDIA QUERY DEMO</span>
                  <h2>Ideas take shape.</h2>
                  <p>Resize the viewport past {breakpoint}px and watch the cards expand into 3 columns.</p>
                </div>
                <div
                  className="responsive-cards"
                  style={brokenGrid ? { gridTemplateColumns: 'repeat(3, 180px)' } : undefined}
                >
                  {['Project one', 'Project two', 'Project three'].map((card) => (
                    <motion.div layout transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }} key={card}>
                      {card}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <LiveExperimentEditor
            html={html}
            css={css}
            previewCssWrapper={respPreviewWrapper}
            onHtmlChange={setHtml}
            onCssChange={handleCssEdit}
            onReset={resetAll}
            labelPrefix="Responsive"
          />
        </div>
      </div>
    </section>
  );
}
