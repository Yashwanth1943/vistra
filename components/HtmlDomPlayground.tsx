'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  MousePointerClick,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  addChildElement,
  getElementByPath,
  getPathForElement,
  removeElementAtPath,
  removeElementAttribute,
  reorderSiblingElement,
  sanitizeUntrustedHtml,
  setElementAttribute,
  setElementClasses,
  updateElementText,
} from '../app/dom-operations';
import { createPreviewDocument, validateHtml } from '../app/playground';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import {
  buildDomTreeFromElement,
  collectAllNodeKeys,
  DomTreeVisualizer,
  pathKey,
  type DomTreeNode,
} from './DomTreeVisualizer';
import {
  LabHeader,
  SegmentedControl,
  SelectControl,
  ToggleControl,
} from './VisualizationEngine';

const SVG_MEDIA =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='140' viewBox='0 0 320 140'><rect width='320' height='140' rx='10' fill='%23eef2ff'/><circle cx='90' cy='70' r='34' fill='%236366f1'/><rect x='145' y='44' width='130' height='52' rx='8' fill='%2306b6d4'/></svg>";

const BASE_CSS = `body{font-family:system-ui,sans-serif;padding:16px;color:#121726;background:#fff;margin:0}header,main,aside,footer,article,form,table,section,div{border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;margin-bottom:8px}header{background:#eef2ff;border-color:#c7d2fe;display:flex;justify-content:space-between;align-items:center}nav{display:flex;gap:12px}nav a{color:#4f46e5;text-decoration:none;font-size:13px;font-weight:600}main{background:#f8fafc}aside{background:#fefce8;border-color:#fde047}footer{background:#f1f5f9}h1,h2,h3{margin:0 0 6px;font-size:15px}p{margin:0 0 8px;font-size:13px;color:#475569}figure{margin:8px 0}figure img{max-width:100%;height:auto;border-radius:6px;display:block}figcaption{font-size:11px;color:#64748b;margin-top:4px}label{display:block;font-size:12px;font-weight:600;margin-bottom:6px}input{padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;margin-right:8px}button{padding:7px 14px;border:0;border-radius:6px;background:#5b5bd6;color:#fff;font-weight:600}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:7px 10px;text-align:left;font-size:12px}caption{font-weight:700;margin-bottom:8px;font-size:13px}`;

type PresetId = 'landmarks' | 'components' | 'form' | 'table';

type InspectedElement = {
  path: number[];
  tag: string;
  id: string;
  classes: string[];
  attributes: { name: string; value: string }[];
  parentLabel: string | null;
  parentPath: number[] | null;
  children: { label: string; path: number[] }[];
  width: number;
  height: number;
  textContent: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

function buildPresetHtml(
  preset: PresetId,
  opts: {
    includeAside: boolean;
    includeFooter: boolean;
    inputType: string;
    inputRequired: boolean;
    showCaption: boolean;
    includeMedia: boolean;
  }
): string {
  if (preset === 'landmarks') {
    return `<header>\n  <h1>WebCraft Journal</h1>\n  <nav><a href="#articles">Articles</a></nav>\n</header>\n<main id="articles">\n  <article>\n    <h2>Semantic HTML</h2>\n    <p>Tags describe meaning so browsers and screen readers understand structure.</p>\n  </article>${opts.includeAside ? '\n  <aside>Related links</aside>' : ''}\n</main>${opts.includeFooter ? '\n<footer>Published 2026</footer>' : ''}`;
  }
  if (preset === 'form') {
    return `<form>\n  <label for="user-field">Account ${opts.inputType}</label>\n  <input id="user-field" type="${opts.inputType}" placeholder="Try typing here..."${opts.inputRequired ? ' required' : ''} />\n  <button type="submit">Submit</button>\n</form>`;
  }
  if (preset === 'components') {
    return `<header class="site-nav">\n  <strong>Studio</strong>\n  <nav><a href="#work">Work</a><a href="#about">About</a></nav>\n</header>\n<article class="card">\n  <h3>Reusable Card Component</h3>\n  <p>Semantic article with action button and optional media figure.</p>${opts.includeMedia ? `\n  <figure><img src="${SVG_MEDIA}" alt="Preview graphic" /><figcaption>Responsive figure</figcaption></figure>` : ''}\n  <button type="button">Explore</button>\n</article>`;
  }
  return `<table>${opts.showCaption ? '\n  <caption>CSS Layout Engines</caption>' : ''}\n  <thead>\n    <tr><th>Engine</th><th>Axes</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Flexbox</td><td>1D (row or column)</td></tr>\n    <tr><td>CSS Grid</td><td>2D (rows &amp; columns)</td></tr>\n  </tbody>\n</table>`;
}

export function HtmlDomPlayground({ onOpenCodePlayground }: { onOpenCodePlayground: () => void }) {
  const [preset, setPreset] = useState<PresetId>('landmarks');
  const [includeAside, setIncludeAside] = useState(true);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [inputType, setInputType] = useState('email');
  const [inputRequired, setInputRequired] = useState(true);
  const [showCaption, setShowCaption] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);

  const [html, setHtml] = useState(() =>
    buildPresetHtml('landmarks', {
      includeAside: true,
      includeFooter: true,
      inputType: 'email',
      inputRequired: true,
      showCaption: true,
      includeMedia: true,
    })
  );
  const [selectedPath, setSelectedPath] = useState<number[]>([0]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set(['0', '1', '1.0']));
  const [inspectMode, setInspectMode] = useState(true);
  const [mobileTab, setMobileTab] = useState<'tree' | 'preview' | 'inspector'>('preview');

  const [domTree, setDomTree] = useState<DomTreeNode[]>([]);
  const [inspected, setInspected] = useState<InspectedElement | null>(null);
  const [highlightRect, setHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Inspector form inputs
  const [textDraft, setTextDraft] = useState('');
  const [classDraft, setClassDraft] = useState('');
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');
  const [newChildTag, setNewChildTag] = useState('p');
  const [newChildText, setNewChildText] = useState('');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inspectModeRef = useRef(inspectMode);
  inspectModeRef.current = inspectMode;
  const selectedPathRef = useRef(selectedPath);
  selectedPathRef.current = selectedPath;
  const cleanupObserversRef = useRef<(() => void) | null>(null);
  const rafMeasureRef = useRef<number | null>(null);

  const htmlWarning = useMemo(() => validateHtml(html), [html]);
  const previewDoc = useMemo(
    () => createPreviewDocument(sanitizeUntrustedHtml(html), BASE_CSS),
    [html]
  );

  const expandAncestors = useCallback((path: number[]) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      for (let i = 1; i < path.length; i += 1) {
        next.add(pathKey(path.slice(0, i)));
      }
      return next;
    });
  }, []);

  const measureHighlight = useCallback(() => {
    const iframe = iframeRef.current;
    const wrap = wrapRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !wrap || !doc || !doc.body) return;

    const target = getElementByPath(doc.body, selectedPathRef.current) ?? doc.body.firstElementChild;
    if (!target) {
      setHighlightRect(null);
      return;
    }

    const tRect = target.getBoundingClientRect();
    const iRect = iframe.getBoundingClientRect();
    const wRect = wrap.getBoundingClientRect();

    setHighlightRect({
      top: Math.round(iRect.top - wRect.top + tRect.top),
      left: Math.round(iRect.left - wRect.left + tRect.left),
      width: Math.round(tRect.width),
      height: Math.round(tRect.height),
    });
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (rafMeasureRef.current !== null) return;
    rafMeasureRef.current = window.requestAnimationFrame(() => {
      rafMeasureRef.current = null;
      measureHighlight();
    });
  }, [measureHighlight]);

  const syncFromIframe = useCallback(
    (scrollPreviewTarget: boolean) => {
      const iframe = iframeRef.current;
      const wrap = wrapRef.current;
      const doc = iframe?.contentDocument;
      if (!iframe || !wrap || !doc || !doc.body) return;

      const tree = buildDomTreeFromElement(doc.body);
      setDomTree(tree);

      const target = getElementByPath(doc.body, selectedPathRef.current) ?? doc.body.firstElementChild;
      if (!target) {
        setInspected(null);
        setHighlightRect(null);
        return;
      }

      const resolvedPath = getPathForElement(doc.body, target);
      if (scrollPreviewTarget) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }

      const tRect = target.getBoundingClientRect();
      const iRect = iframe.getBoundingClientRect();
      const wRect = wrap.getBoundingClientRect();
      setHighlightRect({
        top: Math.round(iRect.top - wRect.top + tRect.top),
        left: Math.round(iRect.left - wRect.left + tRect.left),
        width: Math.round(tRect.width),
        height: Math.round(tRect.height),
      });

      const parent = target.parentElement;
      const parentIsBody = !parent || parent === doc.body;
      const directText = Array.from(target.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? '')
        .join(' ')
        .trim();

      const info: InspectedElement = {
        path: resolvedPath,
        tag: target.tagName.toLowerCase(),
        id: target.id,
        classes: Array.from(target.classList),
        attributes: Array.from(target.attributes).map((a) => ({ name: a.name, value: a.value })),
        parentLabel: parentIsBody
          ? '<body>'
          : `<${parent.tagName.toLowerCase()}>${parent.id ? `#${parent.id}` : ''}`,
        parentPath: parentIsBody ? null : getPathForElement(doc.body, parent),
        children: Array.from(target.children).map((c, idx) => ({
          label: `<${c.tagName.toLowerCase()}>${c.id ? `#${c.id}` : c.classList[0] ? `.${c.classList[0]}` : ''}`,
          path: [...resolvedPath, idx],
        })),
        width: Math.round(tRect.width),
        height: Math.round(tRect.height),
        textContent: directText,
        canMoveUp: Boolean(target.previousElementSibling),
        canMoveDown: Boolean(target.nextElementSibling),
      };

      setInspected(info);
      setTextDraft(directText);
      setClassDraft(info.classes.join(' '));
    },
    []
  );

  const handleIframeLoad = useCallback(() => {
    cleanupObserversRef.current?.();
    cleanupObserversRef.current = null;

    const iframe = iframeRef.current;
    const wrap = wrapRef.current;
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (!iframe || !doc || !doc.body || !win) return;

    const onClick = (event: MouseEvent) => {
      if (!inspectModeRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as Element | null;
      if (!target || target === doc.body || target === doc.documentElement) return;
      const path = getPathForElement(doc.body, target);
      if (path.length > 0) {
        expandAncestors(path);
        selectedPathRef.current = path;
        setSelectedPath(path);
        syncFromIframe(false);
      }
    };

    doc.body.style.cursor = inspectModeRef.current ? 'pointer' : 'auto';
    doc.body.addEventListener('click', onClick);
    win.addEventListener('scroll', scheduleMeasure, { passive: true });
    doc.addEventListener('scroll', scheduleMeasure, { passive: true, capture: true });
    doc.addEventListener('load', scheduleMeasure, true);
    window.addEventListener('scroll', scheduleMeasure, { passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });

    const resizeObs =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => scheduleMeasure())
        : null;
    if (resizeObs) {
      if (wrap) resizeObs.observe(wrap);
      resizeObs.observe(iframe);
      resizeObs.observe(doc.body);
      for (const child of Array.from(doc.body.children)) {
        resizeObs.observe(child);
      }
    }

    const mutationObs =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => syncFromIframe(false))
        : null;
    mutationObs?.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    cleanupObserversRef.current = () => {
      doc.body?.removeEventListener('click', onClick);
      win.removeEventListener('scroll', scheduleMeasure);
      doc.removeEventListener('scroll', scheduleMeasure, true);
      doc.removeEventListener('load', scheduleMeasure, true);
      window.removeEventListener('scroll', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      resizeObs?.disconnect();
      mutationObs?.disconnect();
    };

    syncFromIframe(false);
  }, [expandAncestors, scheduleMeasure, syncFromIframe]);

  useEffect(
    () => () => {
      cleanupObserversRef.current?.();
      if (rafMeasureRef.current !== null) {
        window.cancelAnimationFrame(rafMeasureRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc?.body) {
      doc.body.style.cursor = inspectMode ? 'pointer' : 'auto';
    }
  }, [inspectMode]);

  useEffect(() => {
    syncFromIframe(true);
  }, [selectedPath, syncFromIframe]);

  const applyPresetState = (
    nextPreset: PresetId,
    nextOpts?: Partial<{
      includeAside: boolean;
      includeFooter: boolean;
      inputType: string;
      inputRequired: boolean;
      showCaption: boolean;
      includeMedia: boolean;
    }>
  ) => {
    const merged = {
      includeAside: nextOpts?.includeAside ?? includeAside,
      includeFooter: nextOpts?.includeFooter ?? includeFooter,
      inputType: nextOpts?.inputType ?? inputType,
      inputRequired: nextOpts?.inputRequired ?? inputRequired,
      showCaption: nextOpts?.showCaption ?? showCaption,
      includeMedia: nextOpts?.includeMedia ?? includeMedia,
    };
    setPreset(nextPreset);
    setHtml(buildPresetHtml(nextPreset, merged));
    setSelectedPath([0]);
    setExpandedKeys(new Set(['0', '1', '1.0']));
  };

  const resetAll = () => {
    setIncludeAside(true);
    setIncludeFooter(true);
    setInputType('email');
    setInputRequired(true);
    setShowCaption(true);
    setIncludeMedia(true);
    applyPresetState('landmarks', {
      includeAside: true,
      includeFooter: true,
      inputType: 'email',
      inputRequired: true,
      showCaption: true,
      includeMedia: true,
    });
  };

  const applyDomResult = (res: { html: string; nextPath: number[] } | null, announcement?: string) => {
    if (!res) return;
    setHtml(res.html);
    expandAncestors(res.nextPath);
    setSelectedPath(res.nextPath);
    if (announcement) setLiveStatus(announcement);
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard?.writeText(html);
      setCopiedHtml(true);
      window.setTimeout(() => setCopiedHtml(false), 1200);
    } catch {
      setCopiedHtml(false);
    }
  };

  return (
    <section className="lab-page enhanced-lab">
      <LabHeader
        eyebrow="HTML STRUCTURE & DOM VISUALIZER"
        title="See how HTML builds the DOM."
        copy="Click elements in the DOM tree or preview to inspect relationships, edit attributes or nodes safely, and watch the HTML & render stay synchronized."
        presets={[
          { id: 'landmarks', label: 'Landmarks' },
          { id: 'components', label: 'UI Components' },
          { id: 'form', label: 'Forms & Inputs' },
          { id: 'table', label: 'Data Table' },
        ]}
        activePreset={preset}
        onPreset={(id) => applyPresetState(id as PresetId)}
        onReset={resetAll}
      />

      {/* Compact Pattern Options Bar */}
      <div className="domv-pattern-bar">
        <SegmentedControl
          label="Pattern"
          value={preset}
          options={['landmarks', 'components', 'form', 'table']}
          onChange={(val) => applyPresetState(val as PresetId)}
        />
        <div className="domv-pattern-toggles">
          {preset === 'landmarks' && (
            <>
              <ToggleControl
                label="<aside>"
                checked={includeAside}
                onChange={(val) => {
                  setIncludeAside(val);
                  applyPresetState('landmarks', { includeAside: val });
                }}
              />
              <ToggleControl
                label="<footer>"
                checked={includeFooter}
                onChange={(val) => {
                  setIncludeFooter(val);
                  applyPresetState('landmarks', { includeFooter: val });
                }}
              />
            </>
          )}
          {preset === 'components' && (
            <ToggleControl
              label="<figure> media"
              checked={includeMedia}
              onChange={(val) => {
                setIncludeMedia(val);
                applyPresetState('components', { includeMedia: val });
              }}
            />
          )}
          {preset === 'form' && (
            <>
              <SelectControl
                label="input type"
                value={inputType}
                options={['email', 'text', 'number', 'date', 'range', 'color']}
                onChange={(val) => {
                  setInputType(val);
                  applyPresetState('form', { inputType: val });
                }}
              />
              <ToggleControl
                label="required"
                checked={inputRequired}
                onChange={(val) => {
                  setInputRequired(val);
                  applyPresetState('form', { inputRequired: val });
                }}
              />
            </>
          )}
          {preset === 'table' && (
            <ToggleControl
              label="<caption>"
              checked={showCaption}
              onChange={(val) => {
                setShowCaption(val);
                applyPresetState('table', { showCaption: val });
              }}
            />
          )}
        </div>
      </div>

      {/* Responsive Mobile Tabs */}
      <div className="domv-mobile-tabs" role="tablist" aria-label="DOM workspace panels">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'tree'}
          className={mobileTab === 'tree' ? 'active' : ''}
          onClick={() => setMobileTab('tree')}
        >
          DOM Tree
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'preview'}
          className={mobileTab === 'preview' ? 'active' : ''}
          onClick={() => setMobileTab('preview')}
        >
          Live Preview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'inspector'}
          className={mobileTab === 'inspector' ? 'active' : ''}
          onClick={() => setMobileTab('inspector')}
        >
          Inspector
        </button>
      </div>

      {/* Three-Panel DOM Workspace */}
      <div className={`domv-workspace active-${mobileTab}`}>
        <div className="domv-col-tree">
          <DomTreeVisualizer
            nodes={domTree}
            selectedPath={inspected?.path ?? selectedPath}
            expandedKeys={expandedKeys}
            onToggleExpand={(key) =>
              setExpandedKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            onSelectNode={(path) => {
              expandAncestors(path);
              setSelectedPath(path);
            }}
            onExpandAll={() => setExpandedKeys(new Set(collectAllNodeKeys(domTree)))}
            onCollapseAll={() => setExpandedKeys(new Set())}
          />
        </div>

        <div className="domv-col-preview">
          <div className="domv-preview-bar">
            <span>LIVE BROWSER RENDER</span>
            <button
              type="button"
              className={`domv-inspect-toggle ${inspectMode ? 'active' : ''}`}
              aria-pressed={inspectMode}
              onClick={() => setInspectMode((m) => !m)}
            >
              <MousePointerClick size={13} />
              {inspectMode ? 'Inspect on click: ON' : 'Inspect on click: OFF'}
            </button>
          </div>
          <div ref={wrapRef} className="domv-iframe-wrap">
            <iframe
              ref={iframeRef}
              title="HTML Playground live preview"
              sandbox="allow-same-origin"
              srcDoc={previewDoc}
              onLoad={handleIframeLoad}
            />
            {highlightRect && highlightRect.width > 0 && (
              <div
                className={`domv-highlight-box ${highlightRect.top < 20 ? 'label-inside' : ''}`}
                aria-hidden="true"
                style={{
                  top: highlightRect.top,
                  left: highlightRect.left,
                  width: highlightRect.width,
                  height: highlightRect.height,
                }}
              >
                <span>&lt;{inspected?.tag}&gt;</span>
              </div>
            )}
          </div>
        </div>

        <aside className="domv-col-inspector" aria-label="Selected element inspector">
          <div className="domv-header">
            <span className="dbg-bar-sub">ELEMENT INSPECTOR</span>
            {inspected && (
              <span className="domv-dims">
                {inspected.width} × {inspected.height}px
              </span>
            )}
          </div>

          {!inspected ? (
            <p className="domv-empty">Select an element in the DOM tree or preview to inspect it.</p>
          ) : (
            <div className="domv-inspector-body">
              <div className="domv-summary">
                <code>
                  &lt;{inspected.tag}&gt;
                  {inspected.id ? `#${inspected.id}` : ''}
                </code>
                <div className="domv-reorder-btns">
                  <button
                    type="button"
                    aria-label="Move element up"
                    disabled={!inspected.canMoveUp}
                    onClick={() =>
                      applyDomResult(reorderSiblingElement(html, inspected.path, 'up'))
                    }
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move element down"
                    disabled={!inspected.canMoveDown}
                    onClick={() =>
                      applyDomResult(reorderSiblingElement(html, inspected.path, 'down'))
                    }
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove selected element"
                    className="danger"
                    onClick={() => applyDomResult(removeElementAtPath(html, inspected.path), `Removed <${inspected.tag}> element`)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="domv-meta-row">
                <span>Parent:</span>
                {inspected.parentPath ? (
                  <button
                    type="button"
                    className="domv-link-chip"
                    onClick={() => setSelectedPath(inspected.parentPath!)}
                  >
                    {inspected.parentLabel}
                  </button>
                ) : (
                  <code>{inspected.parentLabel}</code>
                )}
              </div>

              <div className="domv-meta-row">
                <span>Children ({inspected.children.length}):</span>
                <div className="domv-chip-list">
                  {inspected.children.length === 0 ? (
                    <small>None</small>
                  ) : (
                    inspected.children.map((c) => (
                      <button
                        key={pathKey(c.path)}
                        type="button"
                        className="domv-link-chip"
                        onClick={() => {
                          expandAncestors(inspected.path);
                          setSelectedPath(c.path);
                        }}
                      >
                        {c.label}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Edit Text Content */}
              <form
                className="domv-form-group"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyDomResult(updateElementText(html, inspected.path, textDraft));
                }}
              >
                <label htmlFor="domv-text-input">Text content</label>
                <div className="domv-inline-form">
                  <input
                    id="domv-text-input"
                    value={textDraft}
                    onChange={(e) => setTextDraft(e.target.value)}
                    placeholder="Element text..."
                  />
                  <button type="submit">Apply</button>
                </div>
              </form>

              {/* Edit Classes */}
              <form
                className="domv-form-group"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyDomResult(setElementClasses(html, inspected.path, classDraft));
                }}
              >
                <label htmlFor="domv-class-input">Classes</label>
                <div className="domv-inline-form">
                  <input
                    id="domv-class-input"
                    value={classDraft}
                    onChange={(e) => setClassDraft(e.target.value)}
                    placeholder="e.g. card featured"
                  />
                  <button type="submit">Set</button>
                </div>
              </form>

              {/* Attributes */}
              <div className="domv-form-group">
                <span className="domv-sub-label">Attributes ({inspected.attributes.length})</span>
                {inspected.attributes.length > 0 && (
                  <div className="domv-attr-list">
                    {inspected.attributes.map((attr) => (
                      <div key={attr.name} className="domv-attr-chip">
                        <code>
                          {attr.name}={attr.value ? `"${attr.value}"` : '""'}
                        </code>
                        <button
                          type="button"
                          aria-label={`Remove attribute ${attr.name}`}
                          onClick={() =>
                            applyDomResult(removeElementAttribute(html, inspected.path, attr.name))
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  className="domv-attr-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newAttrName.trim()) return;
                    applyDomResult(
                      setElementAttribute(html, inspected.path, newAttrName, newAttrVal)
                    );
                    setNewAttrName('');
                    setNewAttrVal('');
                  }}
                >
                  <input
                    aria-label="Attribute name"
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(e.target.value)}
                    placeholder="attr (e.g. id)"
                  />
                  <input
                    aria-label="Attribute value"
                    value={newAttrVal}
                    onChange={(e) => setNewAttrVal(e.target.value)}
                    placeholder="value"
                  />
                  <button type="submit">Add</button>
                </form>
              </div>

              {/* Add Child Element */}
              <form
                className="domv-form-group"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyDomResult(
                    addChildElement(html, inspected.path, newChildTag, newChildText),
                    `Added <${newChildTag}> child element`
                  );
                  setNewChildText('');
                }}
              >
                <span className="domv-sub-label">Add child element</span>
                <div className="domv-attr-add">
                  <select
                    aria-label="Child tag"
                    value={newChildTag}
                    onChange={(e) => setNewChildTag(e.target.value)}
                  >
                    {['p', 'div', 'span', 'section', 'article', 'h3', 'button', 'a', 'li', 'input'].map(
                      (t) => (
                        <option key={t} value={t}>
                          &lt;{t}&gt;
                        </option>
                      )
                    )}
                  </select>
                  <input
                    aria-label="Child text"
                    value={newChildText}
                    onChange={(e) => setNewChildText(e.target.value)}
                    placeholder="Optional text"
                  />
                  <button type="submit">
                    <Plus size={13} /> Add
                  </button>
                </div>
              </form>
            </div>
          )}
        </aside>
      </div>

      {/* Live HTML Editor synchronized with DOM Tree & Preview */}
      <div className="sr-only" role="status" aria-live="polite">
        {liveStatus || (inspected ? `Selected <${inspected.tag}>${inspected.id ? `#${inspected.id}` : ''}` : '')}
      </div>
      <div className="live-exp-shell">
        <div className="live-exp-toolbar">
          <div className="live-exp-pane-head" style={{ border: 0, padding: 0, background: 'transparent' }}>
            <span>
              <i className="file-dot html-dot" /> Live HTML Editor
            </span>
            <small>Edit HTML directly — DOM tree &amp; preview update automatically</small>
          </div>
          <div className="live-exp-actions">
            <button type="button" className="reset-button" onClick={copyHtml}>
              {copiedHtml ? <Check size={13} /> : <Copy size={13} />}
              {copiedHtml ? 'Copied HTML' : 'Copy HTML'}
            </button>
            <button type="button" className="reset-button" onClick={resetAll}>
              <RotateCcw size={13} /> Reset
            </button>
            <button type="button" className="primary-button" onClick={onOpenCodePlayground}>
              Open in Code Playground
            </button>
          </div>
        </div>

        {htmlWarning && (
          <div className="live-exp-alert" role="alert">
            {htmlWarning}
          </div>
        )}

        <div className="live-exp-cm" style={{ borderTop: '1px solid var(--line)' }}>
          <CodeMirrorEditor
            language="html"
            value={html}
            ariaLabel="HTML Playground editor"
            onChange={setHtml}
            onFocus={() => {}}
            onRun={() => {}}
            onSave={() => {}}
            onFormat={() => {}}
            onNextPane={() => {}}
          />
        </div>
      </div>
    </section>
  );
}
