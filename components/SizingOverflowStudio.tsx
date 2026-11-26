'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { createPreviewDocument } from '../app/playground';
import {
  RangeControl,
  SegmentedControl,
  SelectControl,
} from './VisualizationEngine';

type StudioTab = 'sizing' | 'overflow' | 'units' | 'real-world';

type RealWorldPreset = {
  id: string;
  label: string;
  explanation: string;
  html: string;
  css: string;
};

const REAL_WORLD_PRESETS: RealWorldPreset[] = [
  {
    id: 'overflow-card',
    label: 'Overflowing Card',
    explanation:
      'Long unbreakable tokens (like URLs or hashes) push past a fixed card width unless overflow or wrapping is handled.',
    html: `<div class="card">\n  <h3>API Endpoint</h3>\n  <p class="url">https://api.webcraft.dev/v2/workspaces/experiments/very-long-unbreakable-identifier-token-2026</p>\n</div>`,
    css: `.card {\n  width: 240px;\n  padding: 14px;\n  border: 2px solid #6366f1;\n  border-radius: 10px;\n  background: #eef2ff;\n  overflow-x: auto;\n}\n.url {\n  margin: 0;\n  font-family: monospace;\n  font-size: 12px;\n}`,
  },
  {
    id: 'oversized-image',
    label: 'Oversized Image',
    explanation:
      'An image with a large intrinsic width overflows its container until constrained with max-width: 100% and aspect-ratio.',
    html: `<div class="frame">\n  <img src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='520' height='180'%3E%3Crect width='520' height='180' fill='%236366f1'/%3E%3Ctext x='20' y='98' fill='%23fff' font-family='sans-serif' font-size='22'%3E520px Intrinsic Image%3C/text%3E%3C/svg%3E" alt="Wide graphic" />\n</div>`,
    css: `.frame {\n  width: 260px;\n  padding: 10px;\n  border: 2px dashed #94a3b8;\n  border-radius: 10px;\n}\nimg {\n  display: block;\n  max-width: 100%;\n  height: auto;\n  aspect-ratio: 16 / 9;\n  object-fit: cover;\n  border-radius: 6px;\n}`,
  },
  {
    id: 'flex-shrink',
    label: 'Flexbox Shrinking',
    explanation:
      'Flex items default to min-width: auto, preventing them from shrinking smaller than long unbreakable content unless min-width: 0 is set.',
    html: `<div class="flex-row">\n  <div class="flex-item">SuperLongUnbreakableTokenInsideFlexItem</div>\n  <div class="flex-item">02</div>\n</div>`,
    css: `.flex-row {\n  display: flex;\n  gap: 8px;\n  width: 280px;\n  padding: 10px;\n  border: 2px solid #94a3b8;\n  border-radius: 8px;\n}\n.flex-item {\n  flex: 1 1 120px;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  padding: 8px;\n  background: #eef2ff;\n  border: 1px solid #6366f1;\n  border-radius: 6px;\n  font-size: 12px;\n}`,
  },
  {
    id: 'grid-minmax',
    label: 'Grid minmax(0, 1fr)',
    explanation:
      '1fr defaults to minmax(auto, 1fr), which expands for long content. minmax(0, 1fr) keeps equal tracks and avoids grid overflow.',
    html: `<div class="grid-box">\n  <div class="cell">UnbreakableSuperLongWordInsideGridTrack</div>\n  <div class="cell">Track 2</div>\n</div>`,
    css: `.grid-box {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 10px;\n  width: 280px;\n  padding: 10px;\n  border: 2px solid #06b6d4;\n  border-radius: 8px;\n}\n.cell {\n  padding: 8px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  background: #ecfeff;\n  border: 1px solid #0891b2;\n  border-radius: 6px;\n  font-size: 12px;\n}`,
  },
  {
    id: 'width-constraints',
    label: 'Responsive Constraints',
    explanation:
      'Combining width: 100%, min-width, and max-width lets a container fluidly adapt while respecting readable bounds.',
    html: `<div class="fluid-box">\n  <strong>Fluid Box</strong>\n  <p>width: 100%; min-width: 180px; max-width: 340px;</p>\n</div>`,
    css: `.fluid-box {\n  width: 100%;\n  min-width: 180px;\n  max-width: 340px;\n  padding: 14px;\n  border: 2px solid #6366f1;\n  border-radius: 10px;\n  background: #eef2ff;\n  box-sizing: border-box;\n}`,
  },
];

export function SizingOverflowStudio({
  initialTab = 'sizing',
}: {
  initialTab?: StudioTab;
}) {
  const [tab, setTab] = useState<StudioTab>(initialTab);

  // 1. Sizing & Intrinsic State
  const [widthVal, setWidthVal] = useState('fit-content');
  const [minWidthVal, setMinWidthVal] = useState('0');
  const [maxWidthVal, setMaxWidthVal] = useState('340px');
  const [heightVal, setHeightVal] = useState('auto');
  const [minHeightVal, setMinHeightVal] = useState('72px');
  const [maxHeightVal, setMaxHeightVal] = useState('220px');
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [boxSizing, setBoxSizing] = useState<'border-box' | 'content-box'>('border-box');
  const [contentKind, setContentKind] = useState<'normal' | 'unbreakable' | 'image'>('normal');

  // 2. Overflow State
  const [overflowX, setOverflowX] = useState('auto');
  const [overflowY, setOverflowY] = useState('auto');
  const [overflowScenario, setOverflowScenario] = useState<'both' | 'nested' | 'card'>('both');

  // 3. CSS Units State
  const [unitKind, setUnitKind] = useState<'px' | '%' | 'em' | 'rem' | 'vw' | 'vh' | 'vmin' | 'vmax' | 'dvh' | 'ch'>('em');
  const [unitNum, setUnitNum] = useState(12);
  const [parentWidth, setParentWidth] = useState(360);
  const [rootFontSize, setRootFontSize] = useState(16);
  const [elFontSize, setElFontSize] = useState(18);
  const [vpWidth, setVpWidth] = useState(480);
  const [vpHeight, setVpHeight] = useState(260);

  // 4. Real-World State
  const [realPresetId, setRealPresetId] = useState('overflow-card');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [metrics, setMetrics] = useState({
    width: 0,
    height: 0,
    scrollW: 0,
    scrollH: 0,
    clientW: 0,
    clientH: 0,
    computedWidth: 'auto',
    computedHeight: 'auto',
    computedBoxSizing: 'border-box',
    computedAspect: 'auto',
  });

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const doc = useMemo(() => {
    const base = `body{margin:0;padding:14px;font-family:system-ui,sans-serif;background:#fff;color:#121726}`;
    if (tab === 'sizing') {
      const inner =
        contentKind === 'unbreakable'
          ? 'SuperLongUnbreakableTokenThatTestsMinContentAndMaxContentSizingBehavior'
          : contentKind === 'image'
          ? `<img src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='120'%3E%3Crect width='360' height='120' fill='%236366f1'/%3E%3Ctext x='18' y='66' fill='%23fff' font-family='sans-serif' font-size='18'%3E360×120 Image%3C/text%3E%3C/svg%3E" alt="Intrinsic sample" style="display:block;max-width:100%" />`
          : 'Intrinsic sizing adapts to content width, min/max constraints, and aspect-ratio.';
      const css = `${base}
.sizing-parent{border:1px dashed #94a3b8;padding:12px;border-radius:8px;background:#f8fafc}
.target-box{width:${widthVal};min-width:${minWidthVal};max-width:${maxWidthVal};height:${heightVal};min-height:${minHeightVal};max-height:${maxHeightVal};aspect-ratio:${aspectRatio};box-sizing:${boxSizing};padding:14px;border:4px solid #6366f1;border-radius:8px;background:#eef2ff;font-size:13px;font-weight:600;overflow:auto}`;
      return createPreviewDocument(`<div class="sizing-parent"><div class="target-box">${inner}</div></div>`, css);
    }

    if (tab === 'overflow') {
      const html =
        overflowScenario === 'nested'
          ? `<div class="target-box"><p>Outer scrollable container (${overflowX} / ${overflowY})</p><div class="nested-box"><p>Nested scrollable panel with its own overflow-y: auto and extra lines of content.</p><p>Line 2 inside nested container.</p><p>Line 3 inside nested container.</p><p>Line 4 inside nested container.</p></div><p style="width:420px;margin-top:8px">Wide horizontal strip (420px) inside outer container.</p></div>`
          : overflowScenario === 'card'
          ? `<div class="target-box"><strong>Card Header</strong><p style="width:380px">https://webcraft.academy/labs/overflow/very-long-horizontal-content-strip-exceeding-240px</p><p>Extra vertical line 1</p><p>Extra vertical line 2</p><p>Extra vertical line 3</p></div>`
          : `<div class="target-box"><div style="width:390px;padding:10px;background:#e0e7ff;border-radius:6px;margin-bottom:8px">Wide 390px child block (triggers horizontal overflow)</div><p>Tall content row 1</p><p>Tall content row 2</p><p>Tall content row 3</p><p>Tall content row 4</p><p>Tall content row 5</p></div>`;
      const css = `${base}
.target-box{width:240px;height:130px;padding:12px;border:2px solid #6366f1;border-radius:10px;background:#f8fafc;overflow-x:${overflowX};overflow-y:${overflowY};font-size:12.5px}
.nested-box{height:72px;overflow-y:auto;padding:8px;background:#fff;border:1px solid #cbd5e1;border-radius:6px}`;
      return createPreviewDocument(html, css);
    }

    if (tab === 'units') {
      const val = `${unitNum}${unitKind}`;
      const css = `html{font-size:${rootFontSize}px}
${base}
.unit-parent{width:${parentWidth}px;padding:10px;border:1px dashed #94a3b8;border-radius:8px;background:#f8fafc}
.target-box{width:${val};font-size:${elFontSize}px;padding:10px;border:2px solid #6366f1;border-radius:8px;background:#eef2ff;font-weight:700;box-sizing:border-box}`;
      return createPreviewDocument(
        `<div class="unit-parent"><div class="target-box">width: ${val}</div></div>`,
        css
      );
    }

    const activeReal = REAL_WORLD_PRESETS.find((p) => p.id === realPresetId) ?? REAL_WORLD_PRESETS[0];
    return createPreviewDocument(activeReal.html, `${base}\n${activeReal.css}`);
  }, [
    tab,
    widthVal,
    minWidthVal,
    maxWidthVal,
    heightVal,
    minHeightVal,
    maxHeightVal,
    aspectRatio,
    boxSizing,
    contentKind,
    overflowX,
    overflowY,
    overflowScenario,
    unitKind,
    unitNum,
    parentWidth,
    rootFontSize,
    elFontSize,
    realPresetId,
  ]);

  const measure = useCallback(() => {
    const iframe = iframeRef.current;
    const d = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!d || !win || !d.body) return;
    const el = d.body.querySelector('.target-box') ?? d.body.firstElementChild;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cs = win.getComputedStyle(el);
    setMetrics({
      width: Math.round(r.width * 10) / 10,
      height: Math.round(r.height * 10) / 10,
      scrollW: el.scrollWidth,
      scrollH: el.scrollHeight,
      clientW: el.clientWidth,
      clientH: el.clientHeight,
      computedWidth: cs.width,
      computedHeight: cs.height,
      computedBoxSizing: cs.boxSizing,
      computedAspect: cs.aspectRatio,
    });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(measure, 120);
    return () => window.clearTimeout(t);
  }, [doc, vpWidth, vpHeight, measure]);

  const activeReal = REAL_WORLD_PRESETS.find((p) => p.id === realPresetId) ?? REAL_WORLD_PRESETS[0];

  return (
    <div className="so-studio">
      <div className="so-header">
        <div>
          <span className="eyebrow-line">ADVANCED SIZING, OVERFLOW &amp; UNITS</span>
          <h2>Browser-Computed Sizing &amp; Overflow Studio</h2>
        </div>
        <div className="live-exp-tabs" role="tablist" aria-label="Sizing and overflow modes">
          <button type="button" role="tab" aria-selected={tab === 'sizing'} className={tab === 'sizing' ? 'active' : ''} onClick={() => setTab('sizing')}>
            Sizing &amp; Intrinsic
          </button>
          <button type="button" role="tab" aria-selected={tab === 'overflow'} className={tab === 'overflow' ? 'active' : ''} onClick={() => setTab('overflow')}>
            Overflow (X / Y)
          </button>
          <button type="button" role="tab" aria-selected={tab === 'units'} className={tab === 'units' ? 'active' : ''} onClick={() => setTab('units')}>
            CSS Units
          </button>
          <button type="button" role="tab" aria-selected={tab === 'real-world'} className={tab === 'real-world' ? 'active' : ''} onClick={() => setTab('real-world')}>
            Real-World
          </button>
        </div>
      </div>

      <div className="so-grid">
        <div className="so-controls">
          {tab === 'sizing' && (
            <>
              <SelectControl label="width" value={widthVal} options={['auto', 'min-content', 'max-content', 'fit-content', '160px', '280px', '100%']} onChange={setWidthVal} />
              <SelectControl label="min-width" value={minWidthVal} options={['0', '120px', '220px']} onChange={setMinWidthVal} />
              <SelectControl label="max-width" value={maxWidthVal} options={['none', '200px', '340px']} onChange={setMaxWidthVal} />
              <SelectControl label="height" value={heightVal} options={['auto', 'min-content', '110px', '180px']} onChange={setHeightVal} />
              <SelectControl label="min-height" value={minHeightVal} options={['0', '72px', '140px']} onChange={setMinHeightVal} />
              <SelectControl label="max-height" value={maxHeightVal} options={['none', '120px', '220px']} onChange={setMaxHeightVal} />
              <SelectControl label="aspect-ratio" value={aspectRatio} options={['auto', '16 / 9', '4 / 3', '1 / 1']} onChange={setAspectRatio} />
              <SegmentedControl label="box-sizing" value={boxSizing} options={['border-box', 'content-box']} onChange={(v) => setBoxSizing(v as 'border-box' | 'content-box')} />
              <SegmentedControl label="Content" value={contentKind} options={['normal', 'unbreakable', 'image']} onChange={(v) => setContentKind(v as 'normal' | 'unbreakable' | 'image')} />
            </>
          )}

          {tab === 'overflow' && (
            <>
              <SelectControl label="overflow-x" value={overflowX} options={['visible', 'hidden', 'clip', 'scroll', 'auto']} onChange={setOverflowX} />
              <SelectControl label="overflow-y" value={overflowY} options={['visible', 'hidden', 'clip', 'scroll', 'auto']} onChange={setOverflowY} />
              <SegmentedControl label="Scenario" value={overflowScenario} options={['both', 'nested', 'card']} onChange={(v) => setOverflowScenario(v as 'both' | 'nested' | 'card')} />
            </>
          )}

          {tab === 'units' && (
            <>
              <SelectControl label="CSS Unit" value={unitKind} options={['px', '%', 'em', 'rem', 'vw', 'vh', 'vmin', 'vmax', 'dvh', 'ch']} onChange={(v) => setUnitKind(v as typeof unitKind)} />
              <RangeControl label="Value" value={unitNum} min={1} max={320} unit={unitKind} onChange={setUnitNum} />
              <RangeControl label="Parent width" value={parentWidth} min={180} max={520} onChange={setParentWidth} />
              <RangeControl label="Root font-size (rem)" value={rootFontSize} min={12} max={24} onChange={setRootFontSize} />
              <RangeControl label="Element font-size (em)" value={elFontSize} min={12} max={28} onChange={setElFontSize} />
              <RangeControl label="Viewport width" value={vpWidth} min={260} max={640} onChange={setVpWidth} />
              <RangeControl label="Viewport height" value={vpHeight} min={160} max={360} onChange={setVpHeight} />
            </>
          )}

          {tab === 'real-world' && (
            <>
              <div className="so-preset-list">
                {REAL_WORLD_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`viz-preset-btn ${realPresetId === p.id ? 'active' : ''}`}
                    onClick={() => setRealPresetId(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="property-explain">
                <Sparkles size={15} />
                <p>{activeReal.explanation}</p>
              </div>
            </>
          )}
        </div>

        <div className="so-preview-col">
          <div className="so-metrics-bar">
            <span>Rendered: <strong>{metrics.width} × {metrics.height}px</strong></span>
            <span>Computed: <code>{metrics.computedWidth} × {metrics.computedHeight}</code></span>
            <span>Scroll: <code>{metrics.scrollW}×{metrics.scrollH}</code> / Client: <code>{metrics.clientW}×{metrics.clientH}</code></span>
            <span>box-sizing: <code>{metrics.computedBoxSizing}</code></span>
          </div>
          <div className="so-iframe-wrap">
            <iframe
              ref={iframeRef}
              title="Sizing and Overflow live browser preview"
              sandbox="allow-same-origin"
              srcDoc={doc}
              onLoad={measure}
              style={
                tab === 'units'
                  ? { width: `min(100%, ${vpWidth}px)`, height: vpHeight }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
