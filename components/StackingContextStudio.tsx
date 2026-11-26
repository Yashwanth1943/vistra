'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { extractRuleDeclarations, parseNumericCss, patchCssRule } from '../app/css-sync';
import { getElementByPath, getPathForElement, sanitizeUntrustedHtml } from '../app/dom-operations';
import { createPreviewDocument, validateCss } from '../app/playground';
import {
  analyzeStackingHierarchy,
  type PaintOrderEntry,
  type StackingTreeNode,
} from '../app/stacking-context';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { RangeControl, SegmentedControl, SelectControl } from './VisualizationEngine';

type StackingPreset = {
  id: string;
  label: string;
  defaultPath: number[];
  explanation: string;
  html: string;
  css: string;
};

const STACKING_PRESETS: StackingPreset[] = [
  {
    id: 'dropdown-navbar',
    label: 'Dropdown behind navbar',
    defaultPath: [0, 0],
    explanation:
      'Header has position: relative; z-index: 1, trapping .dropdown (z-index: 99) below .hero-banner (z-index: 2). Remove z-index on .site-header or raise it above 2.',
    html: `<header class="site-header">\n  <span>Header (z-index: 1)</span>\n  <div class="dropdown">Dropdown (z-index: 99)</div>\n</header>\n<section class="hero-banner">Hero Banner (z-index: 2)</section>`,
    css: `.site-header {\n  position: relative;\n  z-index: 1;\n  padding: 12px;\n  background: #eef2ff;\n  border: 2px solid #6366f1;\n  border-radius: 8px;\n}\n.dropdown {\n  position: absolute;\n  top: 34px;\n  left: 24px;\n  width: 190px;\n  height: 64px;\n  z-index: 99;\n  padding: 10px;\n  background: #fef3c7;\n  border: 2px solid #f59e0b;\n  border-radius: 8px;\n}\n.hero-banner {\n  position: relative;\n  top: -10px;\n  left: 10px;\n  height: 76px;\n  z-index: 2;\n  padding: 14px;\n  background: #dcfce7;\n  border: 2px solid #22c55e;\n  border-radius: 8px;\n}`,
  },
  {
    id: 'modal-overlay',
    label: 'Modal behind overlay',
    defaultPath: [0, 0],
    explanation:
      '.page-shell creates a stacking context at z-index: 1, so .modal (z-index: 500) cannot rise above .backdrop (z-index: 5).',
    html: `<div class="page-shell">\n  <div class="modal">Modal Dialog (z-index: 500)</div>\n</div>\n<div class="backdrop">Overlay (z-index: 5)</div>`,
    css: `.page-shell {\n  position: relative;\n  z-index: 1;\n  height: 90px;\n  padding: 12px;\n  background: #f8fafc;\n  border: 1px dashed #94a3b8;\n  border-radius: 8px;\n}\n.modal {\n  position: absolute;\n  top: 28px;\n  left: 24px;\n  width: 210px;\n  height: 68px;\n  z-index: 500;\n  padding: 12px;\n  background: #ede9fe;\n  border: 2px solid #7c3aed;\n  border-radius: 8px;\n}\n.backdrop {\n  position: relative;\n  top: -42px;\n  left: 80px;\n  width: 210px;\n  height: 72px;\n  z-index: 5;\n  padding: 12px;\n  background: rgba(15, 23, 42, 0.82);\n  color: #fff;\n  border-radius: 8px;\n}`,
  },
  {
    id: 'tooltip-trapped',
    label: 'Tooltip trapped in parent',
    defaultPath: [0, 0],
    explanation:
      '.card-a has isolation: isolate (creating a stacking context). Even with z-index: 9999, .tooltip stays behind .card-b.',
    html: `<div class="card-a">\n  Card A (isolation: isolate)\n  <div class="tooltip">Tooltip (z-index: 9999)</div>\n</div>\n<div class="card-b">Card B (z-index: 2)</div>`,
    css: `.card-a {\n  position: relative;\n  isolation: isolate;\n  height: 70px;\n  padding: 12px;\n  background: #eef2ff;\n  border: 2px solid #6366f1;\n  border-radius: 8px;\n}\n.tooltip {\n  position: absolute;\n  top: 44px;\n  left: 36px;\n  width: 190px;\n  height: 52px;\n  z-index: 9999;\n  padding: 10px;\n  background: #fef08a;\n  border: 2px solid #eab308;\n  border-radius: 8px;\n}\n.card-b {\n  position: relative;\n  top: -16px;\n  left: 20px;\n  height: 64px;\n  z-index: 2;\n  padding: 12px;\n  background: #ecfeff;\n  border: 2px solid #06b6d4;\n  border-radius: 8px;\n}`,
  },
  {
    id: 'high-z-child',
    label: 'High z-index child',
    defaultPath: [0, 0],
    explanation:
      'Compare z-index: -1 (paints behind parent content) vs z-index: 9999 inside a parent stacking context.',
    html: `<div class="stack-parent">\n  Parent (z-index: 1)\n  <div class="child-high">Child (z-index: 9999)</div>\n  <div class="child-neg">Negative (z-index: -1)</div>\n</div>\n<div class="stack-sibling">Sibling (z-index: 2)</div>`,
    css: `.stack-parent {\n  position: relative;\n  z-index: 1;\n  height: 100px;\n  padding: 12px;\n  background: #f1f5f9;\n  border: 2px solid #64748b;\n  border-radius: 8px;\n}\n.child-high {\n  position: absolute;\n  top: 38px;\n  left: 28px;\n  width: 170px;\n  height: 52px;\n  z-index: 9999;\n  padding: 8px;\n  background: #ede9fe;\n  border: 2px solid #7c3aed;\n  border-radius: 8px;\n}\n.child-neg {\n  position: relative;\n  top: 6px;\n  left: 110px;\n  width: 150px;\n  height: 44px;\n  z-index: -1;\n  padding: 8px;\n  background: #fee2e2;\n  border: 2px solid #ef4444;\n  border-radius: 8px;\n}\n.stack-sibling {\n  position: relative;\n  top: -30px;\n  left: 70px;\n  width: 170px;\n  height: 56px;\n  z-index: 2;\n  padding: 10px;\n  background: #dcfce7;\n  border: 2px solid #22c55e;\n  border-radius: 8px;\n}`,
  },
  {
    id: 'transform-context',
    label: 'Transform stacking context',
    defaultPath: [0],
    explanation:
      'Any transform other than none creates a stacking context even with position: static and z-index: auto, trapping children inside.',
    html: `<div class="transformed-box">\n  Parent (transform: translateY(0px))\n  <div class="inner-pop">Child (z-index: 50)</div>\n</div>\n<div class="later-box">Later Positioned (z-index: 1)</div>`,
    css: `.transformed-box {\n  position: static;\n  transform: translateY(0px);\n  height: 80px;\n  padding: 12px;\n  background: #eef2ff;\n  border: 2px solid #6366f1;\n  border-radius: 8px;\n}\n.inner-pop {\n  position: relative;\n  top: 12px;\n  left: 28px;\n  width: 170px;\n  height: 50px;\n  z-index: 50;\n  padding: 8px;\n  background: #fef3c7;\n  border: 2px solid #f59e0b;\n  border-radius: 8px;\n}\n.later-box {\n  position: relative;\n  top: -18px;\n  left: 60px;\n  width: 190px;\n  height: 58px;\n  z-index: 1;\n  padding: 10px;\n  background: #dcfce7;\n  border: 2px solid #22c55e;\n  border-radius: 8px;\n}`,
  },
  {
    id: 'opacity-context',
    label: 'Opacity stacking context',
    defaultPath: [0],
    explanation:
      'Setting opacity less than 1 (even 0.99) creates a new stacking context so the browser can composite the subtree as a single layer.',
    html: `<div class="fade-group">\n  Parent (opacity: 0.99)\n  <div class="badge-top">Badge (z-index: 100)</div>\n</div>\n<div class="cover-bar">Cover Bar (z-index: 1)</div>`,
    css: `.fade-group {\n  opacity: 0.99;\n  height: 80px;\n  padding: 12px;\n  background: #f8fafc;\n  border: 2px solid #64748b;\n  border-radius: 8px;\n}\n.badge-top {\n  position: relative;\n  top: 12px;\n  left: 24px;\n  width: 170px;\n  height: 50px;\n  z-index: 100;\n  padding: 8px;\n  background: #ede9fe;\n  border: 2px solid #7c3aed;\n  border-radius: 8px;\n}\n.cover-bar {\n  position: relative;\n  top: -20px;\n  left: 50px;\n  width: 190px;\n  height: 58px;\n  z-index: 1;\n  padding: 10px;\n  background: #ecfeff;\n  border: 2px solid #06b6d4;\n  border-radius: 8px;\n}`,
  },
];

export function StackingContextStudio() {
  const [presetId, setPresetId] = useState('dropdown-navbar');
  const [html, setHtml] = useState(STACKING_PRESETS[0].html);
  const [css, setCss] = useState(STACKING_PRESETS[0].css);
  const [selectedPath, setSelectedPath] = useState<number[]>(STACKING_PRESETS[0].defaultPath);
  const [extraCount, setExtraCount] = useState(0);

  const [tree, setTree] = useState<StackingTreeNode[]>([]);
  const [paintOrder, setPaintOrder] = useState<PaintOrderEntry[]>([]);
  const [selectedNode, setSelectedNode] = useState<StackingTreeNode | null>(null);
  const [selectedSelector, setSelectedSelector] = useState('.site-header');
  const [subTab, setSubTab] = useState<'tree' | 'paint'>('tree');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cssError = useMemo(() => validateCss(css), [css]);
  const baseWrapper = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff;color:#121726;font-size:12.5px;font-weight:600}*{box-sizing:border-box}`;

  const [validDoc, setValidDoc] = useState(() =>
    createPreviewDocument(sanitizeUntrustedHtml(STACKING_PRESETS[0].html), `${baseWrapper}\n${STACKING_PRESETS[0].css}`)
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!cssError) {
        setValidDoc(createPreviewDocument(sanitizeUntrustedHtml(html), `${baseWrapper}\n${css}`));
      }
    }, 90);
    return () => window.clearTimeout(t);
  }, [html, css, cssError]);

  const inspectStacking = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!doc || !win || !doc.body) return;

    const { tree: nextTree, paintOrder: nextPaint, flatByPath } = analyzeStackingHierarchy(doc.body, win);
    setTree(nextTree);
    setPaintOrder(nextPaint);

    const target = getElementByPath(doc.body, selectedPath) ?? doc.body.firstElementChild;
    if (!target) {
      setSelectedNode(null);
      return;
    }
    const resolvedPath = getPathForElement(doc.body, target);
    setSelectedNode(flatByPath.get(resolvedPath.join('.')) ?? null);
    const sel = target.id ? `#${target.id}` : target.classList[0] ? `.${target.classList[0]}` : target.tagName.toLowerCase();
    setSelectedSelector(sel);
  }, [selectedPath]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc || !doc.body) return;

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.target as Element | null;
      if (!target || target === doc.body || target === doc.documentElement) return;
      const path = getPathForElement(doc.body, target);
      if (path.length > 0) setSelectedPath(path);
    };
    doc.body.style.cursor = 'pointer';
    doc.body.addEventListener('click', onClick);
    inspectStacking();
  }, [inspectStacking]);

  useEffect(() => {
    inspectStacking();
  }, [selectedPath, inspectStacking]);

  const applyPreset = (id: string) => {
    const p = STACKING_PRESETS.find((item) => item.id === id) ?? STACKING_PRESETS[0];
    setPresetId(p.id);
    setHtml(p.html);
    setCss(p.css);
    setSelectedPath(p.defaultPath);
    setExtraCount(0);
  };

  const addExtraBox = () => {
    const nextIdx = extraCount + 1;
    const cls = `extra-box-${nextIdx}`;
    setExtraCount(nextIdx);
    setHtml((prev) => `${prev}\n<div class="${cls}">Extra #${nextIdx} (z-index: ${nextIdx + 2})</div>`);
    setCss(
      (prev) =>
        `${prev}\n.${cls} {\n  position: relative;\n  top: -${20 + nextIdx * 8}px;\n  left: ${36 + nextIdx * 14}px;\n  width: 170px;\n  height: 52px;\n  z-index: ${nextIdx + 2};\n  padding: 10px;\n  background: #fce7f3;\n  border: 2px solid #ec4899;\n  border-radius: 8px;\n}`
    );
  };

  const removeLastExtraBox = () => {
    if (extraCount <= 0) return;
    const cls = `extra-box-${extraCount}`;
    setExtraCount((c) => c - 1);
    setHtml((prev) => prev.replace(new RegExp(`\\n?<div class="${cls}">.*?</div>`, 's'), ''));
    setCss((prev) => prev.replace(new RegExp(`\\n?\\.${cls}\\s*\\{[^}]*\\}`, 's'), ''));
  };

  const decls = useMemo(() => extractRuleDeclarations(css, selectedSelector), [css, selectedSelector]);
  const patchSelected = (prop: string, val: string) => {
    setCss((prev) => patchCssRule(prev, selectedSelector, prop, val));
  };

  const activePreset = STACKING_PRESETS.find((p) => p.id === presetId) ?? STACKING_PRESETS[0];

  const renderTree = (nodes: StackingTreeNode[], depth = 0) =>
    nodes.map((node) => {
      const key = node.path.join('.');
      const isSelected = selectedNode?.path.join('.') === key;
      return (
        <div key={key} className="stc-tree-branch">
          <button
            type="button"
            className={`stc-tree-node ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: 8 + depth * 16 }}
            onClick={() => setSelectedPath(node.path)}
          >
            <code>{node.label}</code>
            <span className="stc-z-pill">z: {node.zIndex}</span>
            {node.createsContext && (
              <span className="stc-ctx-badge" title={node.triggers.join(', ')}>
                SC: {node.triggers[0]}
              </span>
            )}
          </button>
          {node.children.length > 0 && renderTree(node.children, depth + 1)}
        </div>
      );
    });

  return (
    <div className="stc-studio">
      <div className="so-header">
        <div>
          <span className="eyebrow-line">
            <Layers size={12} /> STACKING CONTEXT &amp; Z-INDEX EXPLORER
          </span>
          <h2>Why z-index wins or gets trapped.</h2>
        </div>
        <div className="viz-header-actions">
          <button type="button" className="reset-button" onClick={addExtraBox}>
            <Plus size={13} /> Add Box
          </button>
          <button type="button" className="reset-button" disabled={extraCount === 0} onClick={removeLastExtraBox}>
            <Trash2 size={13} /> Remove Box
          </button>
          <button type="button" className="reset-button" onClick={() => applyPreset(presetId)}>
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Real-World Presets */}
      <div className="stc-presets">
        {STACKING_PRESETS.map((p) => (
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

      <div className="property-explain" style={{ margin: '0 14px' }}>
        <Sparkles size={15} />
        <p>{activePreset.explanation}</p>
      </div>

      <div className="stc-grid">
        {/* Left: Interactive Element Controls */}
        <div className="stc-controls">
          <div className="dbg-bar-sub">EDIT SELECTED: {selectedSelector}</div>
          <SegmentedControl
            label="position"
            value={decls['position'] ?? selectedNode?.position ?? 'static'}
            options={['static', 'relative', 'absolute', 'fixed', 'sticky']}
            onChange={(val) => patchSelected('position', val)}
          />
          <SelectControl
            label="z-index"
            value={decls['z-index'] ?? selectedNode?.zIndex ?? 'auto'}
            options={['auto', '-1', '0', '1', '2', '5', '10', '99', '9999']}
            onChange={(val) => patchSelected('z-index', val)}
          />
          <RangeControl
            label="top"
            value={parseNumericCss(decls['top'], 0)}
            min={-60}
            max={100}
            onChange={(val) => patchSelected('top', `${val}px`)}
          />
          <RangeControl
            label="left"
            value={parseNumericCss(decls['left'], 0)}
            min={0}
            max={140}
            onChange={(val) => patchSelected('left', `${val}px`)}
          />
          <SelectControl
            label="opacity (trigger < 1)"
            value={decls['opacity'] ?? '1'}
            options={['1', '0.99', '0.85']}
            onChange={(val) => patchSelected('opacity', val)}
          />
          <SelectControl
            label="transform"
            value={decls['transform'] ?? 'none'}
            options={['none', 'translateY(0px)', 'scale(1.02)']}
            onChange={(val) => patchSelected('transform', val)}
          />
          <SegmentedControl
            label="isolation"
            value={decls['isolation'] ?? 'auto'}
            options={['auto', 'isolate']}
            onChange={(val) => patchSelected('isolation', val)}
          />
        </div>

        {/* Center: Live Browser Render */}
        <div className="stc-preview-col">
          <div className="dbg-bar-sub">LIVE BROWSER RENDER (CLICK ELEMENT TO INSPECT)</div>
          <div className="so-iframe-wrap">
            <iframe
              ref={iframeRef}
              title="Stacking Context live browser preview"
              sandbox="allow-same-origin"
              srcDoc={validDoc}
              onLoad={handleLoad}
            />
          </div>

          {selectedNode && (
            <div className="stc-selected-summary">
              <div>
                <span>Parent Stacking Context</span>
                <strong>{selectedNode.parentContextLabel}</strong>
              </div>
              <div>
                <span>Creates Own Context?</span>
                <strong>
                  {selectedNode.createsContext
                    ? `Yes (${selectedNode.triggers.join(', ')})`
                    : 'No (uses parent context)'}
                </strong>
              </div>
              <div>
                <span>Stacking Level</span>
                <strong>{selectedNode.stackingLevel}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Right: Stacking Context Hierarchy & Paint Order */}
        <div className="stc-inspector-col">
          <div className="stc-subtabs" role="tablist" aria-label="Stacking views">
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'tree'}
              className={subTab === 'tree' ? 'active' : ''}
              onClick={() => setSubTab('tree')}
            >
              Context Hierarchy
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'paint'}
              className={subTab === 'paint' ? 'active' : ''}
              onClick={() => setSubTab('paint')}
            >
              Paint Order
            </button>
          </div>

          {subTab === 'tree' ? (
            <div className="stc-tree">{renderTree(tree)}</div>
          ) : (
            <div className="stc-paint-list">
              <div className="stc-paint-note">
                1. Context root background/borders → 2. Negative z-index → 3. In-flow blocks → 4. Positioned auto / 0 → 5. Positive z-index (nested contexts paint atomically inside their parent).
              </div>
              {paintOrder.map((entry, idx) => (
                <button
                  key={`${entry.path.join('.')}-${idx}`}
                  type="button"
                  className={`stc-paint-row ${selectedNode?.path.join('.') === entry.path.join('.') ? 'selected' : ''}`}
                  style={{ marginLeft: entry.depth * 12 }}
                  onClick={() => setSelectedPath(entry.path)}
                >
                  <span>{idx + 1}.</span>
                  <code>{entry.label}</code>
                  <small>{entry.phase}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Synced CSS Editor */}
      <div style={{ borderTop: '1px solid var(--line)' }}>
        <div className="live-exp-pane-head">
          <span>
            <i className="file-dot css-dot" /> Stacking CSS (Live Synced)
          </span>
          <small>{cssError || 'Edit CSS directly to observe stacking changes'}</small>
        </div>
        <div className="live-exp-cm">
          <CodeMirrorEditor
            language="css"
            value={css}
            ariaLabel="Stacking Context CSS editor"
            onChange={setCss}
            onFocus={() => {}}
            onRun={inspectStacking}
            onSave={() => {}}
            onFormat={() => {}}
            onNextPane={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
