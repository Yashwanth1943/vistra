'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Search, Sparkles } from 'lucide-react';
import { analyzeElementCascade, type CascadeDeclaration, type InheritedDeclaration } from '../app/css-cascade';
import { extractRuleDeclarations, parseNumericCss, patchCssRule } from '../app/css-sync';
import { sanitizeUntrustedHtml } from '../app/dom-operations';
import { createPreviewDocument, validateCss } from '../app/playground';
import { CascadeInspectorPanel } from './CascadeInspectorPanel';
import { HtmlDomPlayground } from './HtmlDomPlayground';
import { LiveExperimentEditor } from './LiveExperimentEditor';
import { PseudoStatesStudio } from './PseudoStatesStudio';
import { RenderingPipelineStudio } from './RenderingPipelineStudio';
import { SizingOverflowStudio } from './SizingOverflowStudio';
import {
  ColorControl,
  DualCodeOutput,
  LabHeader,
  RangeControl,
  SegmentedControl,
  SelectControl,
  ToggleControl,
} from './VisualizationEngine';

/* ==================== 1. HTML PLAYGROUND ==================== */
export function HtmlPlaygroundLab({ onOpenCodePlayground }: { onOpenCodePlayground: () => void }) {
  return <HtmlDomPlayground onOpenCodePlayground={onOpenCodePlayground} />;
}

/* ==================== 2. CSS PROPERTIES EXPLORER (14 CATEGORIES) ==================== */
type CssPropCategory =
  | 'Layout'
  | 'Flexbox'
  | 'Grid'
  | 'Positioning'
  | 'Sizing'
  | 'Spacing'
  | 'Typography'
  | 'Backgrounds'
  | 'Borders'
  | 'Transforms'
  | 'Transitions'
  | 'Animations'
  | 'Overflow'
  | 'Responsive design';

const ALL_CATEGORIES: CssPropCategory[] = [
  'Layout',
  'Flexbox',
  'Grid',
  'Positioning',
  'Sizing',
  'Spacing',
  'Typography',
  'Backgrounds',
  'Borders',
  'Transforms',
  'Transitions',
  'Animations',
  'Overflow',
  'Responsive design',
];

type PropertySpec = {
  id: string;
  name: string;
  category: CssPropCategory;
  kind: 'select' | 'range' | 'color';
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
  defaultVal: string;
  description: string;
};

const PROPERTY_CATALOG: PropertySpec[] = [
  { id: 'display', name: 'display', category: 'Layout', kind: 'select', options: ['block', 'inline-block', 'flex', 'grid'], defaultVal: 'flex', description: 'Sets whether children stack as blocks, flow inline, or use Flex/Grid.' },
  { id: 'justify-content', name: 'justify-content', category: 'Flexbox', kind: 'select', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-evenly'], defaultVal: 'space-between', description: 'Distributes free space along the main axis.' },
  { id: 'grid-template-columns', name: 'grid-template-columns', category: 'Grid', kind: 'select', options: ['1fr', 'repeat(2, 1fr)', 'repeat(3, 1fr)', '1fr 2fr 1fr'], defaultVal: 'repeat(3, 1fr)', description: 'Defines the number and width of grid columns.' },
  { id: 'position', name: 'position', category: 'Positioning', kind: 'select', options: ['static', 'relative', 'absolute'], defaultVal: 'relative', description: 'Controls flow vs offset positioning of the highlighted box.' },
  { id: 'width', name: 'width', category: 'Sizing', kind: 'range', min: 100, max: 380, unit: 'px', defaultVal: '220', description: 'Sets the explicit width of the target element.' },
  { id: 'min-width', name: 'min-width', category: 'Sizing', kind: 'select', options: ['0', 'auto', '140px', '240px', 'min-content'], defaultVal: '0', description: 'Prevents the element from shrinking below this minimum width.' },
  { id: 'aspect-ratio', name: 'aspect-ratio', category: 'Sizing', kind: 'select', options: ['auto', '16 / 9', '4 / 3', '1 / 1'], defaultVal: 'auto', description: 'Maintains a preferred width-to-height ratio when one dimension is auto.' },
  { id: 'object-fit', name: 'object-fit', category: 'Sizing', kind: 'select', options: ['fill', 'contain', 'cover', 'none'], defaultVal: 'cover', description: 'Controls how an image or media fills its fixed aspect box.' },
  { id: 'padding', name: 'padding', category: 'Spacing', kind: 'range', min: 0, max: 48, unit: 'px', defaultVal: '20', description: 'Adds breathing room inside the element border.' },
  { id: 'font-size', name: 'font-size', category: 'Typography', kind: 'range', min: 12, max: 32, unit: 'px', defaultVal: '18', description: 'Scales the text size inside the preview card.' },
  { id: 'letter-spacing', name: 'letter-spacing', category: 'Typography', kind: 'range', min: -2, max: 8, unit: 'px', defaultVal: '0', description: 'Adjusts horizontal spacing between characters.' },
  { id: 'background-color', name: 'background-color', category: 'Backgrounds', kind: 'color', defaultVal: '#eef2ff', description: 'Changes the surface fill color of the target box.' },
  { id: 'border-radius', name: 'border-radius', category: 'Borders', kind: 'range', min: 0, max: 40, unit: 'px', defaultVal: '12', description: 'Rounds the corners of the target element.' },
  { id: 'border-width', name: 'border-width', category: 'Borders', kind: 'range', min: 0, max: 12, unit: 'px', defaultVal: '2', description: 'Sets the thickness of the element border.' },
  { id: 'box-shadow', name: 'box-shadow', category: 'Borders', kind: 'select', options: ['none', '0 4px 12px rgba(15,23,42,0.08)', '0 14px 30px rgba(79,70,229,0.22)', '0 0 0 4px rgba(99,102,241,0.28)'], defaultVal: '0 4px 12px rgba(15,23,42,0.08)', description: 'Adds depth, elevation, or focus rings around a box without affecting layout.' },
  { id: 'transform', name: 'transform (rotate)', category: 'Transforms', kind: 'range', min: -45, max: 45, unit: 'deg', defaultVal: '0', description: 'Rotates the element around its center without affecting layout flow.' },
  { id: 'transition-duration', name: 'transition-duration', category: 'Transitions', kind: 'range', min: 0, max: 1000, unit: 'ms', defaultVal: '300', description: 'Controls how smoothly property changes animate.' },
  { id: 'animation', name: 'animation', category: 'Animations', kind: 'select', options: ['none', 'viz-float 2s ease-in-out infinite', 'viz-pulse 1.6s ease-in-out infinite'], defaultVal: 'viz-float 2s ease-in-out infinite', description: 'Applies a continuous keyframe animation to the element.' },
  { id: 'overflow', name: 'overflow', category: 'Overflow', kind: 'select', options: ['visible', 'hidden', 'clip', 'scroll', 'auto'], defaultVal: 'auto', description: 'Controls what happens when content exceeds the box bounds.' },
  { id: 'overflow-x', name: 'overflow-x', category: 'Overflow', kind: 'select', options: ['visible', 'hidden', 'clip', 'scroll', 'auto'], defaultVal: 'auto', description: 'Controls horizontal overflow independently of vertical overflow.' },
  { id: 'max-width', name: 'max-width', category: 'Responsive design', kind: 'range', min: 160, max: 520, unit: 'px', defaultVal: '360', description: 'Caps element width on wide screens while staying fluid on narrow ones.' },
];

export function CssPropertiesExplorer() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | CssPropCategory>('All');
  const [selectedId, setSelectedId] = useState('justify-content');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(PROPERTY_CATALOG.map((p) => [p.id, p.defaultVal]))
  );
  const [preset, setPreset] = useState('');
  const [compare, setCompare] = useState(false);
  const [compareB, setCompareB] = useState('');
  const [showCascade, setShowCascade] = useState(false);
  const [sizingTab, setSizingTab] = useState<'sizing' | 'overflow' | 'units' | 'real-world'>('sizing');
  const [cascadeData, setCascadeData] = useState<{
    declarations: CascadeDeclaration[];
    inherited: InheritedDeclaration[];
  }>({ declarations: [], inherited: [] });
  const cascadeIframeRef = useRef<HTMLIFrameElement>(null);
  const [cssText, setCssText] = useState(`.demo-stage {\n  display: flex;\n  justify-content: space-between;\n  gap: 10px;\n}\n.demo-element {\n  padding: 14px 18px;\n  border: 2px solid #6366f1;\n  border-radius: 10px;\n  background-color: #eef2ff;\n}`);
  const [htmlText, setHtmlText] = useState(`<div class="demo-stage">\n  <div class="demo-element">Target</div>\n  <div class="demo-sibling">Item 02</div>\n  <div class="demo-sibling">Item 03</div>\n</div>`);

  const cascadePreviewWrapper = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff}.demo-sibling{padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12px;color:#475569}.demo-element{color:#121726;font-weight:700}`;
  const cascadeDoc = useMemo(
    () => createPreviewDocument(sanitizeUntrustedHtml(htmlText), `${cascadePreviewWrapper}\n${cssText}`),
    [htmlText, cssText]
  );

  const measureCascade = useCallback(() => {
    const iframe = cascadeIframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!doc || !win || !doc.body) return;
    const target = doc.body.querySelector('.demo-element') ?? doc.body.firstElementChild;
    if (!target) {
      setCascadeData({ declarations: [], inherited: [] });
      return;
    }
    setCascadeData(analyzeElementCascade(target, cssText, win));
  }, [cssText]);

  useEffect(() => {
    if (showCascade) measureCascade();
  }, [showCascade, cascadeDoc, measureCascade]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PROPERTY_CATALOG.filter((p) => (category === 'All' ? true : p.category === category)).filter((p) =>
      q ? `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q) : true
    );
  }, [search, category]);

  const activeProp = PROPERTY_CATALOG.find((p) => p.id === selectedId) ?? PROPERTY_CATALOG[0];
  const val = values[activeProp.id] ?? activeProp.defaultVal;
  const formattedVal = activeProp.kind === 'range' ? `${val}${activeProp.unit ?? ''}` : val;

  const isContainerProp =
    activeProp.id === 'display' || activeProp.id === 'justify-content' || activeProp.id === 'grid-template-columns';
  const targetSelector = isContainerProp ? '.demo-stage' : '.demo-element';
  const realCssProp = activeProp.id === 'transform' ? 'transform' : activeProp.name;

  const updatePropValue = (nextRaw: string) => {
    setValues((prev) => ({ ...prev, [activeProp.id]: nextRaw }));
    const nextCssVal =
      activeProp.id === 'transform'
        ? `rotate(${nextRaw}deg)`
        : activeProp.kind === 'range'
        ? `${nextRaw}${activeProp.unit ?? ''}`
        : nextRaw;
    setCssText((prev) => patchCssRule(prev, targetSelector, realCssProp, nextCssVal));
  };

  const handleCssEdit = (nextCss: string) => {
    setCssText(nextCss);
    if (validateCss(nextCss) !== null) return;
    const stageDecl = extractRuleDeclarations(nextCss, '.demo-stage');
    const elemDecl = extractRuleDeclarations(nextCss, '.demo-element');
    setValues((prev) => {
      const next = { ...prev };
      if (stageDecl['display']) next['display'] = stageDecl['display'];
      if (stageDecl['justify-content']) next['justify-content'] = stageDecl['justify-content'];
      if (stageDecl['grid-template-columns']) next['grid-template-columns'] = stageDecl['grid-template-columns'];
      if (elemDecl['position']) next['position'] = elemDecl['position'];
      if (elemDecl['width']) next['width'] = String(parseNumericCss(elemDecl['width'], Number(prev['width'])));
      if (elemDecl['padding']) next['padding'] = String(parseNumericCss(elemDecl['padding'], Number(prev['padding'])));
      if (elemDecl['font-size']) next['font-size'] = String(parseNumericCss(elemDecl['font-size'], Number(prev['font-size'])));
      if (elemDecl['letter-spacing']) next['letter-spacing'] = String(parseNumericCss(elemDecl['letter-spacing'], Number(prev['letter-spacing'])));
      if (elemDecl['background-color']) next['background-color'] = elemDecl['background-color'];
      if (elemDecl['border-radius']) next['border-radius'] = String(parseNumericCss(elemDecl['border-radius'], Number(prev['border-radius'])));
      if (elemDecl['border-width']) next['border-width'] = String(parseNumericCss(elemDecl['border-width'], Number(prev['border-width'])));
      if (elemDecl['box-shadow']) next['box-shadow'] = elemDecl['box-shadow'];
      if (elemDecl['object-fit']) next['object-fit'] = elemDecl['object-fit'];
      if (elemDecl['overflow']) next['overflow'] = elemDecl['overflow'];
      if (elemDecl['max-width']) next['max-width'] = String(parseNumericCss(elemDecl['max-width'], Number(prev['max-width'])));
      if (elemDecl['transition-duration']) next['transition-duration'] = String(parseNumericCss(elemDecl['transition-duration'], Number(prev['transition-duration'])));
      if (elemDecl['animation']) next['animation'] = elemDecl['animation'];
      const rotMatch = elemDecl['transform']?.match(/rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/i);
      if (rotMatch) next['transform'] = rotMatch[1];
      return next;
    });
  };

  const resetExplorer = () => {
    setValues(Object.fromEntries(PROPERTY_CATALOG.map((p) => [p.id, p.defaultVal])));
    setPreset('');
    setCompare(false);
    setCompareB('');
    setCssText(`.demo-stage {\n  display: flex;\n  justify-content: space-between;\n  gap: 10px;\n}\n.demo-element {\n  padding: 14px 18px;\n  border: 2px solid #6366f1;\n  border-radius: 10px;\n  background-color: #eef2ff;\n}`);
    setHtmlText(`<div class="demo-stage">\n  <div class="demo-element">Target</div>\n  <div class="demo-sibling">Item 02</div>\n  <div class="demo-sibling">Item 03</div>\n</div>`);
    setCategory('All');
    setSearch('');
  };

  const applyPreset = (id: string) => {
    setPreset(id);
    if (id === 'card-ui') {
      setSelectedId('box-shadow');
      setCategory('All');
      setValues((prev) => ({
        ...prev,
        'box-shadow': '0 14px 30px rgba(79,70,229,0.22)',
        'border-radius': '16',
        padding: '24',
      }));
      setHtmlText(`<div class="demo-stage">\n  <div class="demo-element">\n    <strong>Card UI</strong>\n    <p style="margin:6px 0 0;font-weight:400;font-size:13px;color:#475569">Layered surface with radius, padding &amp; shadow.</p>\n  </div>\n</div>`);
      setCssText(`.demo-stage {\n  display: flex;\n  justify-content: center;\n}\n.demo-element {\n  padding: 24px;\n  border: 1px solid #c7d2fe;\n  border-radius: 16px;\n  background-color: #ffffff;\n  box-shadow: 0 14px 30px rgba(79,70,229,0.22);\n}`);
    } else if (id === 'centered-flex') {
      setSelectedId('justify-content');
      setCategory('All');
      setValues((prev) => ({ ...prev, display: 'flex', 'justify-content': 'center' }));
      setHtmlText(`<div class="demo-stage">\n  <div class="demo-element">Target</div>\n  <div class="demo-sibling">Item 02</div>\n  <div class="demo-sibling">Item 03</div>\n</div>`);
      setCssText(`.demo-stage {\n  display: flex;\n  justify-content: center;\n  gap: 12px;\n}\n.demo-element {\n  padding: 14px 18px;\n  border: 2px solid #6366f1;\n  border-radius: 10px;\n  background-color: #eef2ff;\n}`);
    } else if (id === 'media-fit') {
      setSelectedId('object-fit');
      setCategory('All');
      setValues((prev) => ({ ...prev, 'object-fit': 'cover' }));
      setHtmlText(`<div class="demo-stage">\n  <img class="demo-element" src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%236366f1'/%3E%3Cstop offset='100%25' stop-color='%230ea5e9'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='120' fill='url(%23g)'/%3E%3Ccircle cx='160' cy='60' r='34' fill='%23fff' fill-opacity='0.9'/%3E%3C/svg%3E" alt="Aspect ratio demo" style="width:180px;height:120px;padding:0;display:block" />\n</div>`);
      setCssText(`.demo-stage {\n  display: flex;\n  justify-content: center;\n}\n.demo-element {\n  width: 180px;\n  height: 120px;\n  object-fit: cover;\n  border: 2px solid #6366f1;\n  border-radius: 12px;\n}`);
    } else if (id === 'cascade') {
      setSelectedId('background-color');
      setCategory('All');
      setShowCascade(true);
      setHtmlText(`<div class="demo-stage">\n  <div id="hero-card" class="demo-element featured">Cascade Target</div>\n</div>`);
      setCssText(`@layer base, theme;\n\n.demo-stage {\n  display: flex;\n  justify-content: center;\n  color: #334155;\n}\n\n@layer base {\n  #hero-card.demo-element {\n    background-color: #fee2e2;\n    padding: 16px;\n  }\n}\n\n@layer theme {\n  .demo-element.featured {\n    background-color: #dcfce7;\n    border: 2px solid #22c55e;\n    border-radius: 12px;\n  }\n}\n\n:where(#hero-card) {\n  background-color: #fef3c7;\n}`);
    }
  };

  const buildContainerStyle = (propVal: string): React.CSSProperties => ({
    display: activeProp.id === 'display' ? propVal : activeProp.id === 'grid-template-columns' ? 'grid' : 'flex',
    justifyContent: activeProp.id === 'justify-content' ? propVal : 'center',
    gridTemplateColumns: activeProp.id === 'grid-template-columns' ? propVal : undefined,
    gap: 10,
    position: 'relative',
  });

  const buildTargetStyle = (propVal: string): React.CSSProperties => ({
    position: activeProp.id === 'position' ? (propVal as React.CSSProperties['position']) : 'relative',
    top: activeProp.id === 'position' && propVal !== 'static' ? 14 : undefined,
    left: activeProp.id === 'position' && propVal !== 'static' ? 20 : undefined,
    width: activeProp.id === 'width' ? `${propVal}px` : activeProp.id === 'aspect-ratio' ? '220px' : undefined,
    minWidth: activeProp.id === 'min-width' ? propVal : undefined,
    maxWidth: activeProp.id === 'max-width' ? `${propVal}px` : undefined,
    aspectRatio: activeProp.id === 'aspect-ratio' ? propVal : undefined,
    padding: activeProp.id === 'padding' ? `${propVal}px` : '14px 18px',
    fontSize: activeProp.id === 'font-size' ? `${propVal}px` : '14px',
    letterSpacing: activeProp.id === 'letter-spacing' ? `${propVal}px` : undefined,
    backgroundColor: activeProp.id === 'background-color' ? propVal : '#eef2ff',
    borderRadius: activeProp.id === 'border-radius' ? `${propVal}px` : '10px',
    border: `${activeProp.id === 'border-width' ? propVal : 2}px solid #6366f1`,
    boxShadow: activeProp.id === 'box-shadow' ? propVal : undefined,
    transform: activeProp.id === 'transform' ? `rotate(${propVal}deg)` : undefined,
    transitionDuration: activeProp.id === 'transition-duration' ? `${propVal}ms` : '220ms',
    animation: activeProp.id === 'animation' ? propVal : undefined,
    overflow: activeProp.id === 'overflow' ? (propVal as React.CSSProperties['overflow']) : undefined,
    overflowX: activeProp.id === 'overflow-x' ? (propVal as React.CSSProperties['overflowX']) : undefined,
    height: activeProp.id === 'overflow' || activeProp.id === 'overflow-x' ? 76 : undefined,
  });

  const defaultCompareB =
    activeProp.kind === 'select' && activeProp.options
      ? activeProp.options.find((opt) => opt !== val) ?? val
      : activeProp.kind === 'range'
      ? String(Math.min(activeProp.max ?? 100, Number(val) + Math.round(((activeProp.max ?? 100) - (activeProp.min ?? 0)) / 3)))
      : '#dbeafe';
  const compareValB = compareB || defaultCompareB;
  const formattedValB = activeProp.kind === 'range' ? `${compareValB}${activeProp.unit ?? ''}` : compareValB;

  const renderExplorerStage = (propVal: string, labelText: string, badge?: string) => (
    <div className="viz-stage-box">
      {badge && (
        <div className="viz-compare-badge">
          <code>{badge}: {activeProp.name}: {labelText}</code>
        </div>
      )}
      <div className="viz-explorer-stage" style={buildContainerStyle(propVal)}>
        {activeProp.id === 'object-fit' ? (
          <div className="viz-explorer-target" style={{ ...buildTargetStyle(propVal), padding: 8, width: 220 }}>
            <svg
              viewBox="0 0 240 90"
              style={{ width: '100%', height: 96, display: 'block', borderRadius: 6, background: '#e0e7ff' }}
              preserveAspectRatio={
                propVal === 'fill' ? 'none' : propVal === 'contain' ? 'xMidYMid meet' : propVal === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'
              }
            >
              <defs>
                <linearGradient id="fitGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
              <rect width="240" height="90" fill="url(#fitGrad)" />
              <circle cx="120" cy="45" r="28" fill="#ffffff" fillOpacity="0.88" />
            </svg>
            <small style={{ display: 'block', marginTop: 6 }}>object-fit: {propVal}</small>
          </div>
        ) : (
          <div className="viz-explorer-target" style={buildTargetStyle(propVal)}>
            <strong>Target Element</strong>
            {activeProp.id === 'overflow' ? (
              <p>
                This extra text demonstrates overflow behavior when content is taller than the 76px container height. Scroll or clip!
              </p>
            ) : (
              <small>{activeProp.name}: {labelText}</small>
            )}
          </div>
        )}
        {(activeProp.id === 'display' || activeProp.id === 'justify-content' || activeProp.id === 'grid-template-columns') && (
          <>
            <div className="viz-explorer-sibling">Item 02</div>
            <div className="viz-explorer-sibling">Item 03</div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <section className="lab-page enhanced-lab">
      <LabHeader
        eyebrow="CSS PROPERTIES EXPLORER"
        title="Test any CSS property live."
        copy="Search across CSS categories, compare two values side-by-side, or edit HTML & CSS directly."
        presets={[
          { id: 'card-ui', label: 'Card UI' },
          { id: 'centered-flex', label: 'Centered Flex' },
          { id: 'media-fit', label: 'Media Fit' },
          { id: 'cascade', label: 'Cascade' },
        ]}
        activePreset={preset}
        onPreset={applyPreset}
        compareEnabled={compare}
        onToggleCompare={() => setCompare((c) => !c)}
        onReset={resetExplorer}
      />

      <div className="viz-explorer-filters">
        <label className="search-box viz-explorer-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search CSS properties (e.g. gap, transform, overflow)..."
            aria-label="Search CSS properties"
          />
        </label>
        <div className="learn-group-pills" role="tablist" aria-label="CSS property categories">
          {(['All', ...ALL_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={category === cat}
              className={category === cat ? 'active' : ''}
              onClick={() => {
                setCategory(cat);
                if (cat === 'Overflow') setSizingTab('overflow');
                else if (cat === 'Sizing') setSizingTab('sizing');
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="enhanced-lab-layout">
        <aside className="visual-controls">
          <h2>Properties ({filtered.length})</h2>
          <div className="viz-prop-list">
            {filtered.map((prop) => (
              <button
                key={prop.id}
                type="button"
                className={`viz-prop-item ${selectedId === prop.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(prop.id)}
              >
                <code>{prop.name}</code>
                <span>{prop.category}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="visual-workspace">
          <div className="visual-stage-title">
            <span>EXPERIMENTING WITH: {activeProp.name}</span>
            <span>{activeProp.category}</span>
          </div>

          <div className="viz-explorer-control-bar">
            {activeProp.kind === 'select' && activeProp.options && (
              <SegmentedControl
                label={activeProp.name}
                value={val}
                options={activeProp.options}
                onChange={updatePropValue}
              />
            )}
            {activeProp.kind === 'range' && (
              <RangeControl
                label={activeProp.name}
                value={Number(val)}
                min={activeProp.min ?? 0}
                max={activeProp.max ?? 100}
                unit={activeProp.unit ?? ''}
                onChange={(next) => updatePropValue(String(next))}
              />
            )}
            {activeProp.kind === 'color' && (
              <ColorControl
                label={activeProp.name}
                value={val}
                onChange={updatePropValue}
              />
            )}
            {compare && activeProp.kind === 'select' && activeProp.options && (
              <SegmentedControl
                label={`Compare B (${activeProp.name})`}
                value={compareValB}
                options={activeProp.options}
                onChange={setCompareB}
              />
            )}
          </div>

          {compare ? (
            <div className="viz-compare-grid">
              {renderExplorerStage(val, formattedVal, 'Value A')}
              {renderExplorerStage(compareValB, formattedValB, 'Value B')}
            </div>
          ) : (
            renderExplorerStage(val, formattedVal)
          )}

          <div className="property-explain">
            <Sparkles size={16} />
            <p>{activeProp.description}</p>
          </div>

          <LiveExperimentEditor
            html={htmlText}
            css={cssText}
            previewCssWrapper={cascadePreviewWrapper}
            onHtmlChange={setHtmlText}
            onCssChange={handleCssEdit}
            onReset={resetExplorer}
            labelPrefix="Explorer"
          />

          <div className="cas-explorer-card">
            <div className="cas-explorer-bar">
              <span>CASCADE &amp; SPECIFICITY INSPECTOR</span>
              <button
                type="button"
                className={`domv-inspect-toggle ${showCascade ? 'active' : ''}`}
                aria-expanded={showCascade}
                onClick={() => setShowCascade((v) => !v)}
              >
                {showCascade ? 'Hide cascade' : 'Inspect cascade & specificity'}
              </button>
            </div>
            {showCascade && (
              <>
                <iframe
                  ref={cascadeIframeRef}
                  title="CSS Playground cascade measurement"
                  sandbox="allow-same-origin"
                  srcDoc={cascadeDoc}
                  onLoad={measureCascade}
                  style={{
                    position: 'absolute',
                    width: 600,
                    height: 1,
                    opacity: 0,
                    pointerEvents: 'none',
                    border: 0,
                  }}
                />
                <div style={{ padding: 12 }}>
                  <CascadeInspectorPanel
                    targetLabel=".demo-element"
                    declarations={cascadeData.declarations}
                    inherited={cascadeData.inherited}
                  />
                </div>
              </>
            )}
          </div>

          <SizingOverflowStudio initialTab={sizingTab} />

          <PseudoStatesStudio />
        </div>
      </div>
    </section>
  );
}

/* ==================== 3. TRANSFORM & ANIMATION LAB ==================== */
const animDefaults = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  scale: 1,
  skewX: 0,
  origin: 'center',
  duration: 350,
  timing: 'ease',
  keyframe: 'none',
  playing: true,
};

export function TransformAnimationLab() {
  const [a, setA] = useState(animDefaults);
  const [lastProp, setLastProp] = useState('transform');

  const set = <K extends keyof typeof animDefaults>(key: K, next: typeof animDefaults[K], prop: string) => {
    setLastProp(prop);
    setA((prev) => ({ ...prev, [key]: next }));
  };

  const transformString = `translate(${a.translateX}px, ${a.translateY}px) rotate(${a.rotate}deg) scale(${a.scale}) skewX(${a.skewX}deg)`;
  const animationString = a.keyframe === 'none' ? 'none' : `viz-${a.keyframe} 2s ${a.timing} infinite`;

  const css = `.box {\n  transform: ${transformString};\n  transform-origin: ${a.origin};\n  transition: transform ${a.duration}ms ${a.timing};\n  animation: ${animationString};\n  animation-play-state: ${a.playing ? 'running' : 'paused'};\n}`;
  const html = `<div class="stage">\n  <div class="box">Transform Me</div>\n</div>`;

  return (
    <section className="lab-page enhanced-lab">
      <LabHeader
        eyebrow="TRANSFORM & ANIMATION LAB"
        title="Move, rotate, scale, and animate."
        copy="Adjust 2D transform functions, transform-origin, transition timing, and @keyframes motion in real time."
        presets={[
          { id: 'tilt', label: 'Card Tilt' },
          { id: 'float', label: 'Float Loop' },
          { id: 'spin', label: 'Spin' },
        ]}
        onPreset={(id) => {
          if (id === 'tilt') setA({ ...animDefaults, rotate: -6, scale: 1.08, translateY: -8 });
          if (id === 'float') setA({ ...animDefaults, keyframe: 'float', playing: true });
          if (id === 'spin') setA({ ...animDefaults, keyframe: 'spin', timing: 'linear', playing: true });
        }}
        onReset={() => setA(animDefaults)}
      />

      <div className="enhanced-lab-layout">
        <aside className="visual-controls">
          <h2>2D Transforms</h2>
          <RangeControl label="translateX" value={a.translateX} min={-90} max={90} onChange={(val) => set('translateX', val, 'transform')} />
          <RangeControl label="translateY" value={a.translateY} min={-60} max={60} onChange={(val) => set('translateY', val, 'transform')} />
          <RangeControl label="rotate" value={a.rotate} min={-180} max={180} unit="deg" onChange={(val) => set('rotate', val, 'transform')} />
          <RangeControl label="scale" value={a.scale} min={0.5} max={1.6} step={0.05} unit="" onChange={(val) => set('scale', val, 'transform')} />
          <RangeControl label="skewX" value={a.skewX} min={-35} max={35} unit="deg" onChange={(val) => set('skewX', val, 'transform')} />
          <SelectControl label="transform-origin" value={a.origin} options={['center', 'top left', 'top right', 'bottom left', 'bottom right']} onChange={(val) => set('origin', val, 'transform-origin')} />

          <h2>Transition &amp; Keyframes</h2>
          <RangeControl label="transition-duration" value={a.duration} min={0} max={1200} unit="ms" onChange={(val) => set('duration', val, 'transition')} />
          <SelectControl label="timing-function" value={a.timing} options={['ease', 'linear', 'ease-in', 'ease-out', 'cubic-bezier(0.22, 1, 0.36, 1)']} onChange={(val) => set('timing', val, 'transition')} />
          <SegmentedControl label="@keyframes preset" value={a.keyframe} options={['none', 'float', 'pulse', 'spin']} onChange={(val) => set('keyframe', val, 'animation')} />
        </aside>

        <div className="visual-workspace">
          <div className="visual-stage-title">
            <span>TRANSFORM &amp; MOTION STAGE</span>
            <button type="button" className="reset-button" onClick={() => set('playing', !a.playing, 'animation-play-state')}>
              {a.playing ? <Pause size={13} /> : <Play size={13} />} {a.playing ? 'Pause' : 'Play'}
            </button>
          </div>

          <div className="viz-transform-stage">
            <div className="viz-transform-ghost">Original position</div>
            <div
              className="viz-transform-box"
              style={{
                transform: transformString,
                transformOrigin: a.origin,
                transition: `transform ${a.duration}ms ${a.timing}`,
                animation: animationString,
                animationPlayState: a.playing ? 'running' : 'paused',
              }}
            >
              <strong>Target</strong>
              <small>{a.origin}</small>
            </div>
          </div>

          <DualCodeOutput css={css} html={html} highlightProp={lastProp} onReset={() => setA(animDefaults)} />

          <RenderingPipelineStudio />
        </div>
      </div>
    </section>
  );
}
