'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Braces,
  Check,
  Code2,
  Copy,
  Layers,
  Monitor,
  MonitorPlay,
  MousePointerClick,
  PanelsTopLeft,
  RotateCcw,
  Sliders,
  Smartphone,
  Tablet,
} from 'lucide-react';
import {
  analyzeElementCascade,
  type CascadeDeclaration,
  type InheritedDeclaration,
} from '../app/css-cascade';
import { patchCssRule } from '../app/css-sync';
import { createPreviewDocument, validateCss, validateHtml } from '../app/playground';
import {
  analyzeStackingHierarchy,
  detectStackingContextTriggers,
  type StackingTreeNode,
} from '../app/stacking-context';
import { CascadeInspectorPanel } from './CascadeInspectorPanel';
import { CodeMirrorEditor } from './CodeMirrorEditor';

type DebuggerPreset = {
  id: string;
  label: string;
  defaultPath: number[];
  html: string;
  css: string;
};

const DEBUGGER_PRESETS: DebuggerPreset[] = [
  {
    id: 'flexbox',
    label: 'Flexbox Layout',
    defaultPath: [0],
    html: `<section class="flex-row">\n  <article class="card featured">01 · Featured</article>\n  <article class="card">02 · Card</article>\n  <article class="card">03 · Card</article>\n</section>`,
    css: `.flex-row {\n  display: flex;\n  flex-direction: row;\n  justify-content: space-between;\n  align-items: center;\n  gap: 14px;\n  padding: 20px;\n  background-color: #f8fafc;\n  border: 2px solid #cbd5e1;\n  border-radius: 12px;\n}\n.card {\n  padding: 16px;\n  background-color: #eef2ff;\n  border: 2px solid #6366f1;\n  border-radius: 8px;\n  color: #312e81;\n  font-weight: 600;\n}\n.featured {\n  flex-grow: 1;\n  background-color: #ecfeff;\n  border-color: #06b6d4;\n}`,
  },
  {
    id: 'grid',
    label: 'CSS Grid',
    defaultPath: [0],
    html: `<main class="dashboard">\n  <header class="panel header">Header</header>\n  <aside class="panel sidebar">Sidebar</aside>\n  <section class="panel main">Main Content</section>\n</main>`,
    css: `.dashboard {\n  display: grid;\n  grid-template-columns: 150px 1fr;\n  grid-template-rows: 54px 150px;\n  grid-template-areas:\n    "header header"\n    "sidebar main";\n  gap: 12px;\n  padding: 16px;\n  background-color: #f8fafc;\n  border-radius: 12px;\n}\n.panel {\n  padding: 12px;\n  border-radius: 8px;\n  border: 2px solid #06b6d4;\n  background-color: #ecfeff;\n  color: #0e7490;\n  font-weight: 700;\n}\n.header { grid-area: header; background-color: #eef2ff; border-color: #6366f1; }\n.sidebar { grid-area: sidebar; }\n.main { grid-area: main; background-color: #f0fdf4; border-color: #22c55e; }`,
  },
  {
    id: 'cascade',
    label: 'Cascade & Specificity',
    defaultPath: [0, 0],
    html: `<div class="container">\n  <p id="hero-note" class="note">Inspect why my color wins!</p>\n</div>`,
    css: `.container {\n  color: #334155;\n  font-family: system-ui, sans-serif;\n  padding: 20px;\n  border: 1px solid #cbd5e1;\n  border-radius: 10px;\n}\np {\n  color: #ef4444;\n  font-size: 16px;\n  padding: 12px;\n}\n.note {\n  color: #2563eb;\n  background-color: #eff6ff;\n  border-radius: 8px;\n}\n#hero-note {\n  color: #7c3aed;\n  font-weight: 700;\n}`,
  },
  {
    id: 'layers',
    label: '@layer & !important',
    defaultPath: [0, 0],
    html: `<div class="wrap">\n  <button id="cta" class="btn primary" style="background-color: #0ea5e9;">Layered + Inline + !important</button>\n</div>`,
    css: `@layer base, components;\n\n@layer base {\n  #cta.btn {\n    color: #ef4444;\n    padding: 12px 18px;\n    border-radius: 8px;\n    border: 0;\n    font-weight: 700;\n  }\n}\n\n@layer components {\n  .btn {\n    color: #ffffff;\n    background-color: #6366f1 !important;\n  }\n}\n\n:where(#cta) {\n  color: #eab308;\n}`,
  },
  {
    id: 'shorthand',
    label: 'Shorthand vs Longhand',
    defaultPath: [0],
    html: `<article class="shorthand-card">\n  <h3>Shorthand &amp; Longhand Cascade</h3>\n  <p>padding-left overrides padding, while a later background shorthand overrides background-color.</p>\n</article>`,
    css: `.shorthand-card {\n  padding: 14px;\n  padding-left: 34px;\n  background-color: #fef3c7;\n  background: #eef2ff;\n  border: 2px solid #6366f1;\n  border-radius: 10px;\n}`,
  },
  {
    id: 'positioning',
    label: 'Positioning & z-index',
    defaultPath: [0, 1],
    html: `<div class="stage">\n  <div class="sticky-bar">Sticky Header</div>\n  <div class="modal-box">Absolute Box (z-index: 5)</div>\n  <div class="backdrop">Sibling Box (z-index: 2)</div>\n</div>`,
    css: `.stage {\n  position: relative;\n  height: 220px;\n  overflow: auto;\n  padding: 16px;\n  border: 2px dashed #94a3b8;\n  border-radius: 10px;\n  background-color: #f8fafc;\n}\n.sticky-bar {\n  position: sticky;\n  top: 0;\n  padding: 8px 12px;\n  background-color: #eef2ff;\n  border: 1px solid #6366f1;\n  border-radius: 6px;\n  z-index: 3;\n}\n.modal-box {\n  position: absolute;\n  top: 56px;\n  left: 32px;\n  padding: 16px;\n  background-color: #fef3c7;\n  border: 2px solid #f59e0b;\n  border-radius: 8px;\n  z-index: 5;\n}\n.backdrop {\n  position: relative;\n  top: 24px;\n  left: 72px;\n  padding: 18px;\n  background-color: #dcfce7;\n  border: 2px solid #22c55e;\n  border-radius: 8px;\n  z-index: 2;\n}`,
  },
];

type DomNodeInfo = {
  path: number[];
  tag: string;
  id: string;
  classes: string[];
  display: string;
  position: string;
  children: DomNodeInfo[];
};

type RectBox = { top: number; left: number; width: number; height: number };

type InspectedData = {
  tag: string;
  id: string;
  classes: string[];
  selectorGuess: string;
  rect: RectBox;
  box: {
    contentW: number;
    contentH: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    borderTop: number;
    borderRight: number;
    borderBottom: number;
    borderLeft: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
  };
  computed: {
    layout: Record<string, string>;
    boxModel: Record<string, string>;
    typography: Record<string, string>;
    visual: Record<string, string>;
    positioning: Record<string, string>;
  };
  flexContainer: {
    isFlex: boolean;
    role: 'self' | 'parent' | 'none';
    direction: string;
    wrap: string;
    justifyContent: string;
    alignItems: string;
    alignContent: string;
    gap: string;
    containerRect?: RectBox;
    items: { label: string; grow: string; shrink: string; basis: string; order: string; alignSelf: string; rect: RectBox }[];
  };
  gridContainer: {
    isGrid: boolean;
    role: 'self' | 'parent' | 'none';
    columns: string;
    rows: string;
    areas: string;
    gap: string;
    containerRect?: RectBox;
    items: { label: string; col: string; row: string; rect: RectBox }[];
  };
  cascade: {
    declarations: CascadeDeclaration[];
    inherited: InheritedDeclaration[];
  };
  positioning: {
    position: string;
    zIndex: string;
    top: string;
    right: string;
    bottom: string;
    left: string;
    containingBlock: string;
    createsContext: boolean;
    triggers: string[];
    parentContextLabel: string;
    stackingLevel: string;
    stackingElements: { label: string; position: string; zIndex: string; createsContext: boolean; triggers: string[] }[];
  };
};

function sanitizeHtmlForDebugger(raw: string): string {
  return raw.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function getElementByPath(root: Element, path: number[]): Element | null {
  let cur: Element | null = root;
  for (const idx of path) {
    if (!cur || !cur.children[idx]) return null;
    cur = cur.children[idx];
  }
  return cur;
}

function getPathForElement(root: Element, target: Element): number[] {
  const path: number[] = [];
  let cur: Element | null = target;
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
    const idx = Array.from(parent.children).indexOf(cur);
    if (idx === -1) break;
    path.unshift(idx);
    cur = parent;
  }
  return path;
}

function buildDomTree(el: Element, win: Window, path: number[] = []): DomNodeInfo[] {
  return Array.from(el.children).map((child, idx) => {
    const childPath = [...path, idx];
    const st = win.getComputedStyle(child);
    return {
      path: childPath,
      tag: child.tagName.toLowerCase(),
      id: child.id,
      classes: Array.from(child.classList),
      display: st.display,
      position: st.position,
      children: buildDomTree(child, win, childPath),
    };
  });
}

function pxNum(val: string): number {
  const n = parseFloat(val);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

function toRectBox(r: DOMRect): RectBox {
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function CssVisualDebugger() {
  const [presetId, setPresetId] = useState('flexbox');
  const [html, setHtml] = useState(DEBUGGER_PRESETS[0].html);
  const [css, setCss] = useState(DEBUGGER_PRESETS[0].css);
  const [selectedPath, setSelectedPath] = useState<number[]>(DEBUGGER_PRESETS[0].defaultPath);
  const [activeInspector, setActiveInspector] = useState<'computed' | 'box' | 'flex' | 'grid' | 'cascade' | 'position' | 'code'>('computed');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [copied, setCopied] = useState<'css' | 'html' | null>(null);
  const [domTree, setDomTree] = useState<DomNodeInfo[]>([]);
  const [inspected, setInspected] = useState<InspectedData | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const copyTimer = useRef<number | null>(null);

  const cssError = useMemo(() => validateCss(css), [css]);
  const htmlWarning = useMemo(() => validateHtml(html), [html]);

  const baseWrapperCss = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#ffffff;color:#121726}*{box-sizing:border-box}`;
  const [validDoc, setValidDoc] = useState(() =>
    createPreviewDocument(sanitizeHtmlForDebugger(DEBUGGER_PRESETS[0].html), `${baseWrapperCss}\n${DEBUGGER_PRESETS[0].css}`)
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!cssError) {
        setValidDoc(createPreviewDocument(sanitizeHtmlForDebugger(html), `${baseWrapperCss}\n${css}`));
      }
    }, 90);
    return () => window.clearTimeout(timer);
  }, [html, css, cssError]);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    []
  );

  const inspectDom = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!doc || !win || !doc.body) return;

    setDomTree(buildDomTree(doc.body, win));

    const target = getElementByPath(doc.body, selectedPath) ?? doc.body.firstElementChild;
    if (!target) {
      setInspected(null);
      return;
    }

    const st = win.getComputedStyle(target);
    const r = target.getBoundingClientRect();

    const pT = pxNum(st.paddingTop);
    const pR = pxNum(st.paddingRight);
    const pB = pxNum(st.paddingBottom);
    const pL = pxNum(st.paddingLeft);
    const bT = pxNum(st.borderTopWidth);
    const bR = pxNum(st.borderRightWidth);
    const bB = pxNum(st.borderBottomWidth);
    const bL = pxNum(st.borderLeftWidth);

    const contentW = Math.max(0, Math.round((r.width - pL - pR - bL - bR) * 10) / 10);
    const contentH = Math.max(0, Math.round((r.height - pT - pB - bT - bB) * 10) / 10);

    const selectorGuess = target.id
      ? `#${target.id}`
      : target.classList.length > 0
      ? `.${target.classList[0]}`
      : target.tagName.toLowerCase();

    // Flexbox detection
    const parentEl = target.parentElement;
    const parentSt = parentEl ? win.getComputedStyle(parentEl) : null;
    const selfIsFlex = st.display === 'flex' || st.display === 'inline-flex';
    const parentIsFlex = Boolean(parentSt && (parentSt.display === 'flex' || parentSt.display === 'inline-flex'));
    const flexEl = selfIsFlex ? target : parentIsFlex ? parentEl : null;
    const flexSt = flexEl ? win.getComputedStyle(flexEl) : null;

    const flexItems = flexEl
      ? Array.from(flexEl.children).map((c, idx) => {
          const cst = win.getComputedStyle(c);
          return {
            label: c.classList[0] ? `.${c.classList[0]}` : `${c.tagName.toLowerCase()}#${idx + 1}`,
            grow: cst.flexGrow,
            shrink: cst.flexShrink,
            basis: cst.flexBasis,
            order: cst.order,
            alignSelf: cst.alignSelf,
            rect: toRectBox(c.getBoundingClientRect()),
          };
        })
      : [];

    // Grid detection
    const selfIsGrid = st.display === 'grid' || st.display === 'inline-grid';
    const parentIsGrid = Boolean(parentSt && (parentSt.display === 'grid' || parentSt.display === 'inline-grid'));
    const gridEl = selfIsGrid ? target : parentIsGrid ? parentEl : null;
    const gridSt = gridEl ? win.getComputedStyle(gridEl) : null;

    const gridItems = gridEl
      ? Array.from(gridEl.children).map((c, idx) => {
          const cst = win.getComputedStyle(c);
          return {
            label: c.classList[0] ? `.${c.classList[0]}` : `${c.tagName.toLowerCase()}#${idx + 1}`,
            col: `${cst.gridColumnStart} / ${cst.gridColumnEnd}`,
            row: `${cst.gridRowStart} / ${cst.gridRowEnd}`,
            rect: toRectBox(c.getBoundingClientRect()),
          };
        })
      : [];

    // Cascade analysis
    const cascade = analyzeElementCascade(target, css, win);

    // Positioning & stacking
    const stackingInfo = detectStackingContextTriggers(target, st, parentSt);
    const { flatByPath } = analyzeStackingHierarchy(doc.body, win);
    const selfStackNode = flatByPath.get(getPathForElement(doc.body, target).join('.'));
    const stackingElements = Array.from(doc.body.querySelectorAll('*'))
      .map((el) => {
        const est = win.getComputedStyle(el);
        const epst = el.parentElement ? win.getComputedStyle(el.parentElement) : null;
        const trig = detectStackingContextTriggers(el, est, epst);
        return {
          label: el.id ? `#${el.id}` : el.classList[0] ? `.${el.classList[0]}` : el.tagName.toLowerCase(),
          position: est.position,
          zIndex: est.zIndex,
          createsContext: trig.createsContext,
          triggers: trig.triggers,
        };
      })
      .filter((item) => item.position !== 'static' || item.createsContext);

    let containingBlock = 'viewport / initial containing block';
    if (st.position === 'absolute') {
      let anc = target.parentElement;
      while (anc && anc !== doc.body) {
        if (win.getComputedStyle(anc).position !== 'static') {
          containingBlock = anc.id ? `#${anc.id}` : anc.classList[0] ? `.${anc.classList[0]}` : anc.tagName.toLowerCase();
          break;
        }
        anc = anc.parentElement;
      }
    } else if (st.position === 'relative' || st.position === 'sticky') {
      containingBlock = parentEl ? (parentEl.classList[0] ? `.${parentEl.classList[0]}` : parentEl.tagName.toLowerCase()) : 'body';
    }

    setInspected({
      tag: target.tagName.toLowerCase(),
      id: target.id,
      classes: Array.from(target.classList),
      selectorGuess,
      rect: toRectBox(r),
      box: {
        contentW,
        contentH,
        paddingTop: pT,
        paddingRight: pR,
        paddingBottom: pB,
        paddingLeft: pL,
        borderTop: bT,
        borderRight: bR,
        borderBottom: bB,
        borderLeft: bL,
        marginTop: pxNum(st.marginTop),
        marginRight: pxNum(st.marginRight),
        marginBottom: pxNum(st.marginBottom),
        marginLeft: pxNum(st.marginLeft),
      },
      computed: {
        layout: {
          display: st.display,
          'flex-direction': st.flexDirection,
          'justify-content': st.justifyContent,
          'align-items': st.alignItems,
          gap: st.gap,
        },
        boxModel: {
          width: st.width,
          height: st.height,
          padding: st.padding,
          margin: st.margin,
          'box-sizing': st.boxSizing,
        },
        typography: {
          'font-family': st.fontFamily,
          'font-size': st.fontSize,
          'font-weight': st.fontWeight,
          'line-height': st.lineHeight,
          color: st.color,
        },
        visual: {
          'background-color': st.backgroundColor,
          'border-width': st.borderTopWidth,
          'border-radius': st.borderRadius,
          opacity: st.opacity,
        },
        positioning: {
          position: st.position,
          'z-index': st.zIndex,
          top: st.top,
          left: st.left,
        },
      },
      flexContainer: {
        isFlex: Boolean(flexEl),
        role: selfIsFlex ? 'self' : parentIsFlex ? 'parent' : 'none',
        direction: flexSt?.flexDirection ?? 'row',
        wrap: flexSt?.flexWrap ?? 'nowrap',
        justifyContent: flexSt?.justifyContent ?? 'normal',
        alignItems: flexSt?.alignItems ?? 'normal',
        alignContent: flexSt?.alignContent ?? 'normal',
        gap: flexSt?.gap ?? '0px',
        containerRect: flexEl ? toRectBox(flexEl.getBoundingClientRect()) : undefined,
        items: flexItems,
      },
      gridContainer: {
        isGrid: Boolean(gridEl),
        role: selfIsGrid ? 'self' : parentIsGrid ? 'parent' : 'none',
        columns: gridSt?.gridTemplateColumns ?? 'none',
        rows: gridSt?.gridTemplateRows ?? 'none',
        areas: gridSt?.gridTemplateAreas ?? 'none',
        gap: gridSt?.gap ?? '0px',
        containerRect: gridEl ? toRectBox(gridEl.getBoundingClientRect()) : undefined,
        items: gridItems,
      },
      cascade,
      positioning: {
        position: st.position,
        zIndex: st.zIndex,
        top: st.top,
        right: st.right,
        bottom: st.bottom,
        left: st.left,
        containingBlock,
        createsContext: stackingInfo.createsContext,
        triggers: stackingInfo.triggers,
        parentContextLabel: selfStackNode?.parentContextLabel ?? '<body> (root)',
        stackingLevel: selfStackNode?.stackingLevel ?? 'In-flow normal order',
        stackingElements,
      },
    });
  }, [css, selectedPath]);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc || !doc.body) return;

    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as Element | null;
      if (!target || target === doc.body || target === doc.documentElement) return;
      const path = getPathForElement(doc.body, target);
      if (path.length > 0) {
        setSelectedPath(path);
      }
    };

    doc.body.style.cursor = 'pointer';
    doc.body.addEventListener('click', onClick);
    inspectDom();
  }, [inspectDom]);

  useEffect(() => {
    inspectDom();
  }, [inspectDom, viewport]);

  const applyPreset = (id: string) => {
    const found = DEBUGGER_PRESETS.find((p) => p.id === id) ?? DEBUGGER_PRESETS[0];
    setPresetId(found.id);
    setHtml(found.html);
    setCss(found.css);
    setSelectedPath(found.defaultPath);
  };

  const patchSelectedCss = (property: string, value: string) => {
    const selector = inspected?.selectorGuess ?? '.card';
    setCss((prev) => patchCssRule(prev, selector, property, value));
  };

  const copyText = async (kind: 'css' | 'html') => {
    try {
      await navigator.clipboard?.writeText(kind === 'css' ? css : html);
      setCopied(kind);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => {
        setCopied(null);
        copyTimer.current = null;
      }, 1200);
    } catch {
      setCopied(null);
    }
  };

  const renderTree = (nodes: DomNodeInfo[], depth = 0) =>
    nodes.map((node) => {
      const isSelected = node.path.join('.') === selectedPath.join('.');
      const isFlex = node.display === 'flex' || node.display === 'inline-flex';
      const isGrid = node.display === 'grid' || node.display === 'inline-grid';
      return (
        <div key={node.path.join('.')}>
          <button
            type="button"
            className={`dbg-tree-node ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            onClick={() => setSelectedPath(node.path)}
          >
            <code>
              &lt;{node.tag}
              {node.id ? `#${node.id}` : ''}
              {node.classes[0] ? `.${node.classes[0]}` : ''}&gt;
            </code>
            {isFlex && <span className="dbg-badge flex">flex</span>}
            {isGrid && <span className="dbg-badge grid">grid</span>}
            {node.position !== 'static' && <span className="dbg-badge pos">{node.position}</span>}
          </button>
          {node.children.length > 0 && renderTree(node.children, depth + 1)}
        </div>
      );
    });

  return (
    <section className="lab-page enhanced-lab dbg-page">
      <div className="viz-header">
        <div>
          <div className="eyebrow-line">
            <MousePointerClick size={13} /> INTERACTIVE CSS VISUAL DEBUGGER
          </div>
          <h1>Inspect, debug, and edit live DOM &amp; CSS.</h1>
          <p>
            Click any element in the preview or DOM tree to inspect real computed styles, Box Model layers, Flex/Grid tracks, Cascade specificity, and Positioning.
          </p>
        </div>
        <div className="viz-header-actions">
          <div className="viz-presets" role="group" aria-label="Debugger presets">
            {DEBUGGER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`viz-preset-btn ${presetId === p.id ? 'active' : ''}`}
                onClick={() => applyPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" className="reset-button" onClick={() => applyPreset(presetId)}>
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {(cssError || htmlWarning) && (
        <div className="live-exp-alert" role="alert">
          {cssError || htmlWarning}
        </div>
      )}

      <div className="dbg-workspace">
        {/* LEFT: LIVE PREVIEW + OVERLAYS + DOM TREE */}
        <div className="dbg-stage-col">
          <div className="dbg-bar">
            <span className="dbg-bar-title">
              LIVE PREVIEW · CLICK ANY ELEMENT
              {inspected && (
                <code>
                  {inspected.selectorGuess} ({Math.round(inspected.rect.width)}×{Math.round(inspected.rect.height)}px)
                </code>
              )}
            </span>
            <div className="live-exp-sizes" role="group" aria-label="Debugger viewport size">
              <button type="button" className={viewport === 'desktop' ? 'active' : ''} onClick={() => setViewport('desktop')} title="Desktop">
                <Monitor size={13} />
              </button>
              <button type="button" className={viewport === 'tablet' ? 'active' : ''} onClick={() => setViewport('tablet')} title="Tablet">
                <Tablet size={13} />
              </button>
              <button type="button" className={viewport === 'mobile' ? 'active' : ''} onClick={() => setViewport('mobile')} title="Mobile">
                <Smartphone size={13} />
              </button>
            </div>
          </div>

          <div className="dbg-preview-wrap">
            <div
              className="dbg-iframe-stage"
              style={{ maxWidth: viewport === 'mobile' ? 375 : viewport === 'tablet' ? 768 : '100%' }}
            >
              <iframe
                ref={iframeRef}
                title="CSS Visual Debugger Preview"
                sandbox="allow-same-origin"
                srcDoc={validDoc}
                onLoad={handleIframeLoad}
              />
              {inspected && (
                <div className="dbg-overlay-layer" aria-hidden="true">
                  {/* Selection content/border highlight */}
                  <div
                    className="dbg-hl-box"
                    style={{
                      top: inspected.rect.top,
                      left: inspected.rect.left,
                      width: inspected.rect.width,
                      height: inspected.rect.height,
                    }}
                  >
                    <span className="dbg-hl-tag">
                      {inspected.selectorGuess} · {Math.round(inspected.rect.width)}×{Math.round(inspected.rect.height)}
                    </span>
                  </div>

                  {/* Flex items overlay */}
                  {inspected.flexContainer.isFlex &&
                    inspected.flexContainer.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="dbg-hl-flex-item"
                        style={{
                          top: item.rect.top,
                          left: item.rect.left,
                          width: item.rect.width,
                          height: item.rect.height,
                        }}
                      />
                    ))}

                  {/* Grid items overlay */}
                  {inspected.gridContainer.isGrid &&
                    inspected.gridContainer.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="dbg-hl-grid-item"
                        style={{
                          top: item.rect.top,
                          left: item.rect.left,
                          width: item.rect.width,
                          height: item.rect.height,
                        }}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="dbg-dom-panel">
            <div className="dbg-bar-sub">DOM TREE</div>
            <div className="dbg-dom-list" role="tree" aria-label="Document Object Model tree">
              {renderTree(domTree)}
            </div>
          </div>
        </div>

        {/* RIGHT: 7 INSPECTOR TABS */}
        <div className="dbg-inspector-col">
          <div className="dbg-tabs" role="tablist" aria-label="Debugger inspector panels">
            {[
              { id: 'computed', label: 'Computed', icon: Sliders },
              { id: 'box', label: 'Box Model', icon: Box },
              { id: 'flex', label: 'Flexbox', icon: Braces },
              { id: 'grid', label: 'Grid', icon: MonitorPlay },
              { id: 'cascade', label: 'Cascade', icon: Layers },
              { id: 'position', label: 'Positioning', icon: PanelsTopLeft },
              { id: 'code', label: 'HTML & CSS', icon: Code2 },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeInspector === t.id}
                className={activeInspector === t.id ? 'active' : ''}
                onClick={() => setActiveInspector(t.id as typeof activeInspector)}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          <div className="dbg-panel-body">
            {activeInspector === 'computed' && inspected && (
              <div className="dbg-computed">
                <div className="dbg-quick-edit">
                  <div className="dbg-bar-sub">QUICK EDIT ({inspected.selectorGuess})</div>
                  <div className="dbg-edit-grid">
                    <label>
                      <span>display</span>
                      <select
                        value={inspected.computed.layout.display}
                        onChange={(e) => patchSelectedCss('display', e.target.value)}
                      >
                        <option value="block">block</option>
                        <option value="inline-block">inline-block</option>
                        <option value="flex">flex</option>
                        <option value="grid">grid</option>
                      </select>
                    </label>
                    <label>
                      <span>padding</span>
                      <input
                        type="text"
                        defaultValue={inspected.computed.boxModel.padding}
                        key={`${inspected.selectorGuess}-pad-${inspected.computed.boxModel.padding}`}
                        onBlur={(e) => patchSelectedCss('padding', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') patchSelectedCss('padding', (e.target as HTMLInputElement).value);
                        }}
                      />
                    </label>
                    <label>
                      <span>gap</span>
                      <input
                        type="text"
                        defaultValue={inspected.computed.layout.gap === 'normal' ? '12px' : inspected.computed.layout.gap}
                        key={`${inspected.selectorGuess}-gap-${inspected.computed.layout.gap}`}
                        onBlur={(e) => patchSelectedCss('gap', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') patchSelectedCss('gap', (e.target as HTMLInputElement).value);
                        }}
                      />
                    </label>
                    <label>
                      <span>position</span>
                      <select
                        value={inspected.computed.positioning.position}
                        onChange={(e) => patchSelectedCss('position', e.target.value)}
                      >
                        <option value="static">static</option>
                        <option value="relative">relative</option>
                        <option value="absolute">absolute</option>
                        <option value="fixed">fixed</option>
                        <option value="sticky">sticky</option>
                      </select>
                    </label>
                  </div>
                </div>

                {Object.entries(inspected.computed).map(([group, props]) => (
                  <div key={group} className="dbg-computed-group">
                    <h4>{group.toUpperCase()}</h4>
                    <div className="dbg-prop-table">
                      {Object.entries(props).map(([k, val]) => (
                        <div key={k} className="dbg-prop-row">
                          <code>{k}</code>
                          <span>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeInspector === 'box' && inspected && (
              <div className="dbg-box-view">
                <div className="dbg-box-margin">
                  <span className="dbg-box-label">
                    margin ({inspected.box.marginTop} / {inspected.box.marginRight} / {inspected.box.marginBottom} / {inspected.box.marginLeft})
                  </span>
                  <div className="dbg-box-border">
                    <span className="dbg-box-label">
                      border ({inspected.box.borderTop} / {inspected.box.borderRight} / {inspected.box.borderBottom} / {inspected.box.borderLeft})
                    </span>
                    <div className="dbg-box-padding">
                      <span className="dbg-box-label">
                        padding ({inspected.box.paddingTop} / {inspected.box.paddingRight} / {inspected.box.paddingBottom} / {inspected.box.paddingLeft})
                      </span>
                      <div className="dbg-box-content">
                        <strong>
                          {inspected.box.contentW} × {inspected.box.contentH}px
                        </strong>
                        <small>Content Box</small>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="dimension-breakdown">
                  <div>
                    <span>Content</span>
                    <strong>{inspected.box.contentW} × {inspected.box.contentH}px</strong>
                  </div>
                  <div>
                    <span>Rendered Box</span>
                    <strong>{Math.round(inspected.rect.width)} × {Math.round(inspected.rect.height)}px</strong>
                  </div>
                  <div>
                    <span>box-sizing</span>
                    <strong>{inspected.computed.boxModel['box-sizing']}</strong>
                  </div>
                </div>
              </div>
            )}

            {activeInspector === 'flex' && inspected && (
              <div className="dbg-layout-inspector">
                {inspected.flexContainer.isFlex ? (
                  <>
                    <div className="dbg-summary-pills">
                      <span>flex-direction: <strong>{inspected.flexContainer.direction}</strong></span>
                      <span>justify-content: <strong>{inspected.flexContainer.justifyContent}</strong></span>
                      <span>align-items: <strong>{inspected.flexContainer.alignItems}</strong></span>
                      <span>flex-wrap: <strong>{inspected.flexContainer.wrap}</strong></span>
                      <span>gap: <strong>{inspected.flexContainer.gap}</strong></span>
                    </div>
                    <div className="dbg-items-list">
                      {inspected.flexContainer.items.map((item, idx) => (
                        <div key={idx} className="dbg-item-card">
                          <code>{item.label}</code>
                          <span>{Math.round(item.rect.width)}×{Math.round(item.rect.height)}px</span>
                          <small>
                            flex: {item.grow} {item.shrink} {item.basis} · order: {item.order} · align-self: {item.alignSelf}
                          </small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="dbg-empty-note">
                    Selected element is not inside a Flex container (<code>display: flex</code>). Select <code>.flex-row</code> or switch to the Flexbox Layout preset.
                  </p>
                )}
              </div>
            )}

            {activeInspector === 'grid' && inspected && (
              <div className="dbg-layout-inspector">
                {inspected.gridContainer.isGrid ? (
                  <>
                    <div className="dbg-summary-pills">
                      <span>columns: <strong>{inspected.gridContainer.columns}</strong></span>
                      <span>rows: <strong>{inspected.gridContainer.rows}</strong></span>
                      <span>gap: <strong>{inspected.gridContainer.gap}</strong></span>
                    </div>
                    <div className="dbg-items-list">
                      {inspected.gridContainer.items.map((item, idx) => (
                        <div key={idx} className="dbg-item-card">
                          <code>{item.label}</code>
                          <span>{Math.round(item.rect.width)}×{Math.round(item.rect.height)}px</span>
                          <small>grid-column: {item.col} · grid-row: {item.row}</small>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="dbg-empty-note">
                    Selected element is not inside a Grid container (<code>display: grid</code>). Switch to the CSS Grid preset or select a grid container.
                  </p>
                )}
              </div>
            )}

            {activeInspector === 'cascade' && inspected && (
              <CascadeInspectorPanel
                targetLabel={inspected.selectorGuess}
                declarations={inspected.cascade.declarations}
                inherited={inspected.cascade.inherited}
              />
            )}

            {activeInspector === 'position' && inspected && (
              <div className="dbg-layout-inspector">
                <div className="dbg-summary-pills">
                  <span>position: <strong>{inspected.positioning.position}</strong></span>
                  <span>z-index: <strong>{inspected.positioning.zIndex}</strong></span>
                  <span>containing block: <strong>{inspected.positioning.containingBlock}</strong></span>
                  <span>stacking context: <strong>{inspected.positioning.createsContext ? inspected.positioning.triggers.join(', ') : 'No (inherits parent)'}</strong></span>
                  <span>parent context: <strong>{inspected.positioning.parentContextLabel}</strong></span>
                  <span>stacking level: <strong>{inspected.positioning.stackingLevel}</strong></span>
                </div>
                <h4>POSITIONED &amp; STACKING CONTEXT ELEMENTS</h4>
                <div className="dbg-items-list">
                  {inspected.positioning.stackingElements.length > 0 ? (
                    inspected.positioning.stackingElements.map((item, idx) => (
                      <div key={idx} className="dbg-item-card">
                        <code>{item.label}</code>
                        <span>position: {item.position} · z-index: {item.zIndex}</span>
                        {item.createsContext && (
                          <small>Creates Stacking Context ({item.triggers.join(', ')})</small>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="dbg-empty-note">All elements are currently in static normal flow.</p>
                  )}
                </div>
              </div>
            )}

            {activeInspector === 'code' && (
              <div className="dbg-code-editors">
                <div className="dbg-code-actions">
                  <button type="button" className="reset-button" onClick={() => copyText('css')}>
                    {copied === 'css' ? <Check size={13} /> : <Copy size={13} />} {copied === 'css' ? 'Copied CSS' : 'Copy CSS'}
                  </button>
                  <button type="button" className="reset-button" onClick={() => copyText('html')}>
                    {copied === 'html' ? <Check size={13} /> : <Copy size={13} />} {copied === 'html' ? 'Copied HTML' : 'Copy HTML'}
                  </button>
                </div>
                <div className="live-exp-pane">
                  <div className="live-exp-pane-head">
                    <span><i className="file-dot css-dot" /> Debugger CSS</span>
                  </div>
                  <div className="live-exp-cm">
                    <CodeMirrorEditor
                      language="css"
                      value={css}
                      ariaLabel="Debugger CSS editor"
                      onChange={setCss}
                      onFocus={() => {}}
                      onRun={inspectDom}
                      onSave={() => {}}
                      onFormat={() => {}}
                      onNextPane={() => {}}
                    />
                  </div>
                </div>
                <div className="live-exp-pane">
                  <div className="live-exp-pane-head">
                    <span><i className="file-dot html-dot" /> Debugger HTML</span>
                  </div>
                  <div className="live-exp-cm">
                    <CodeMirrorEditor
                      language="html"
                      value={html}
                      ariaLabel="Debugger HTML editor"
                      onChange={setHtml}
                      onFocus={() => {}}
                      onRun={inspectDom}
                      onSave={() => {}}
                      onFormat={() => {}}
                      onNextPane={() => {}}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
