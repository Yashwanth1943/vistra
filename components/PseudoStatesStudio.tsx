'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, RotateCcw, Sparkles } from 'lucide-react';
import { extractRuleDeclarations, patchCssRule } from '../app/css-sync';
import { sanitizeUntrustedHtml } from '../app/dom-operations';
import { createPreviewDocument, validateCss, validateHtml } from '../app/playground';
import {
  PSEUDO_CLASS_META,
  PSEUDO_ELEMENT_META,
  PSEUDO_PRESETS,
} from '../app/pseudo-experiments';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { ColorControl, SegmentedControl, SelectControl } from './VisualizationEngine';

const PSEUDO_ELEMENTS = Object.keys(PSEUDO_ELEMENT_META);
const PSEUDO_CLASSES = Object.keys(PSEUDO_CLASS_META);

export function PseudoStatesStudio() {
  const [presetId, setPresetId] = useState(PSEUDO_PRESETS[0].id);
  const [modeTab, setModeTab] = useState<'pseudo-element' | 'pseudo-class'>('pseudo-class');
  const [selectedToken, setSelectedToken] = useState<string>(':hover');
  const [html, setHtml] = useState(PSEUDO_PRESETS[0].html);
  const [css, setCss] = useState(PSEUDO_PRESETS[0].css);
  const [copied, setCopied] = useState<'css' | 'html' | null>(null);

  const [observedStates, setObservedStates] = useState<{
    hover: boolean;
    focus: boolean;
    focusVisible: boolean;
    active: boolean;
    checked: boolean;
    disabledCount: number;
    enabledCount: number;
    selectionText: string;
  }>({
    hover: false,
    focus: false,
    focusVisible: false,
    active: false,
    checked: false,
    disabledCount: 0,
    enabledCount: 0,
    selectionText: '',
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cssError = useMemo(() => validateCss(css), [css]);
  const htmlWarning = useMemo(() => validateHtml(html), [html]);

  const baseWrapper = `body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff;color:#121726}*{box-sizing:border-box}`;
  const [validDoc, setValidDoc] = useState(() =>
    createPreviewDocument(sanitizeUntrustedHtml(PSEUDO_PRESETS[0].html), `${baseWrapper}\n${PSEUDO_PRESETS[0].css}`)
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!cssError) {
        setValidDoc(createPreviewDocument(sanitizeUntrustedHtml(html), `${baseWrapper}\n${css}`));
      }
    }, 90);
    return () => window.clearTimeout(t);
  }, [html, css, cssError]);

  const readLiveBrowserStates = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !doc.body) return;
    const els = Array.from(doc.body.querySelectorAll('*'));
    const safeMatches = (el: Element, sel: string) => {
      try {
        return el.matches(sel);
      } catch {
        return false;
      }
    };
    setObservedStates({
      hover: els.some((el) => safeMatches(el, ':hover')),
      focus: els.some((el) => safeMatches(el, ':focus')),
      focusVisible: els.some((el) => safeMatches(el, ':focus-visible')),
      active: els.some((el) => safeMatches(el, ':active')),
      checked: els.some((el) => safeMatches(el, ':checked')),
      disabledCount: els.filter((el) => safeMatches(el, ':disabled')).length,
      enabledCount: els.filter((el) => safeMatches(el, ':enabled')).length,
      selectionText: (doc.getSelection()?.toString() ?? '').slice(0, 32),
    });
  }, []);

  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !doc.body) return;
    const events = ['mousemove', 'mouseleave', 'mousedown', 'mouseup', 'focusin', 'focusout', 'change', 'selectionchange', 'keyup'];
    for (const ev of events) {
      doc.addEventListener(ev, readLiveBrowserStates);
    }
    readLiveBrowserStates();
  }, [readLiveBrowserStates]);

  const activePreset = PSEUDO_PRESETS.find((p) => p.id === presetId) ?? PSEUDO_PRESETS[0];

  const applyPreset = (id: string) => {
    const p = PSEUDO_PRESETS.find((item) => item.id === id) ?? PSEUDO_PRESETS[0];
    setPresetId(p.id);
    setModeTab(p.kind);
    setHtml(p.html);
    setCss(p.css);
    const matchedToken =
      (p.kind === 'pseudo-element' ? PSEUDO_ELEMENTS : PSEUDO_CLASSES).find((tok) =>
        p.focusSelector.includes(tok.replace('()', ''))
      ) ?? (p.kind === 'pseudo-element' ? '::before' : ':hover');
    setSelectedToken(matchedToken);
  };

  const selectPseudoToken = (token: string, kind: 'pseudo-element' | 'pseudo-class') => {
    setModeTab(kind);
    setSelectedToken(token);
    const matchingPreset = PSEUDO_PRESETS.find(
      (p) =>
        p.css.includes(token.replace('()', '')) ||
        p.focusSelector.includes(token.replace('()', ''))
    );
    if (matchingPreset && matchingPreset.id !== presetId) {
      setPresetId(matchingPreset.id);
      setHtml(matchingPreset.html);
      setCss(matchingPreset.css);
    }
  };

  const targetRuleSelector = useMemo(() => {
    const cleanTok = selectedToken.replace('()', '');
    const regex = new RegExp(`([^{}\\n]*${cleanTok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\n{]*)\\{`);
    const m = css.match(regex);
    if (m && m[1]) return m[1].trim();
    return activePreset.targetSelector;
  }, [css, selectedToken, activePreset.targetSelector]);

  const decls = useMemo(
    () => extractRuleDeclarations(css, targetRuleSelector),
    [css, targetRuleSelector]
  );

  const patchTarget = (prop: string, val: string) => {
    setCss((prev) => patchCssRule(prev, targetRuleSelector, prop, val));
  };

  const copyCode = async (kind: 'css' | 'html') => {
    try {
      await navigator.clipboard?.writeText(kind === 'css' ? css : html);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  };

  const infoText =
    modeTab === 'pseudo-element'
      ? PSEUDO_ELEMENT_META[selectedToken]?.requires ?? activePreset.explanation
      : PSEUDO_CLASS_META[selectedToken]?.trigger ?? activePreset.explanation;

  return (
    <div className="ps-studio">
      <div className="so-header">
        <div>
          <span className="eyebrow-line">PSEUDO-ELEMENTS &amp; INTERACTIVE STATES</span>
          <h2>Real Browser Pseudo-Elements &amp; States</h2>
        </div>
        <div className="live-exp-actions">
          <button type="button" className="reset-button" onClick={() => copyCode('css')}>
            {copied === 'css' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'css' ? 'Copied CSS' : 'Copy CSS'}
          </button>
          <button type="button" className="reset-button" onClick={() => copyCode('html')}>
            {copied === 'html' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'html' ? 'Copied HTML' : 'Copy HTML'}
          </button>
          <button type="button" className="reset-button" onClick={() => applyPreset(presetId)}>
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* 8 Real-World Editable Presets */}
      <div className="ps-presets" role="group" aria-label="Pseudo-element and state presets">
        {PSEUDO_PRESETS.map((p) => (
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

      {/* Pseudo-Element & Pseudo-Class Selector Strip */}
      <div className="ps-selector-strip">
        <div className="live-exp-tabs" role="tablist" aria-label="Selector type">
          <button
            type="button"
            role="tab"
            aria-selected={modeTab === 'pseudo-element'}
            className={modeTab === 'pseudo-element' ? 'active' : ''}
            onClick={() => selectPseudoToken('::before', 'pseudo-element')}
          >
            Pseudo-Elements (::)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modeTab === 'pseudo-class'}
            className={modeTab === 'pseudo-class' ? 'active' : ''}
            onClick={() => selectPseudoToken(':hover', 'pseudo-class')}
          >
            Interactive States (:)
          </button>
        </div>

        <div className="ps-token-pills">
          {(modeTab === 'pseudo-element' ? PSEUDO_ELEMENTS : PSEUDO_CLASSES).map((tok) => (
            <button
              key={tok}
              type="button"
              className={selectedToken === tok ? 'active' : ''}
              onClick={() => selectPseudoToken(tok, modeTab)}
            >
              <code>{tok}</code>
            </button>
          ))}
        </div>
      </div>

      <div className="ps-grid">
        {/* Controls */}
        <div className="ps-controls">
          <div className="dbg-bar-sub">EDIT RULE: {targetRuleSelector}</div>

          {(selectedToken === '::before' || selectedToken === '::after') && (
            <label className="viz-control">
              <div className="viz-control-head">
                <span>content</span>
                <code>{decls['content'] ?? '""'}</code>
              </div>
              <input
                type="text"
                className="ps-text-input"
                aria-label="Pseudo-element content"
                value={(decls['content'] ?? '"NEW"').replace(/^["']|["']$/g, '')}
                onChange={(e) => patchTarget('content', `"${e.target.value.replace(/"/g, '\\"')}"`)}
              />
            </label>
          )}

          <ColorControl
            label="background-color"
            value={decls['background-color']?.startsWith('#') ? decls['background-color'] : '#4f46e5'}
            onChange={(val) => patchTarget('background-color', val)}
          />
          <ColorControl
            label="color"
            value={decls['color']?.startsWith('#') ? decls['color'] : '#ffffff'}
            onChange={(val) => patchTarget('color', val)}
          />

          {selectedToken === '::marker' || selectedToken === '::first-letter' ? (
            <SelectControl
              label="font-size"
              value={decls['font-size'] ?? '18px'}
              options={['14px', '18px', '24px', '34px']}
              onChange={(val) => patchTarget('font-size', val)}
            />
          ) : (
            <SegmentedControl
              label="transform"
              value={decls['transform'] ?? 'none'}
              options={['none', 'translateY(-2px)', 'scale(0.97)']}
              onChange={(val) => patchTarget('transform', val)}
            />
          )}

          <div className="property-explain">
            <Sparkles size={15} />
            <p>{infoText}</p>
          </div>
        </div>

        {/* Live Sandboxed Preview + Real Browser State Readout */}
        <div className="ps-preview-col">
          <div className="ps-state-bar" aria-label="Observed browser states">
            <span className={observedStates.hover ? 'on' : ''}>:hover {observedStates.hover ? 'ACTIVE' : 'off'}</span>
            <span className={observedStates.focus ? 'on' : ''}>:focus {observedStates.focus ? 'ACTIVE' : 'off'}</span>
            <span className={observedStates.focusVisible ? 'on' : ''}>:focus-visible {observedStates.focusVisible ? 'ACTIVE' : 'off'}</span>
            <span className={observedStates.active ? 'on' : ''}>:active {observedStates.active ? 'ACTIVE' : 'off'}</span>
            <span className={observedStates.checked ? 'on' : ''}>:checked {observedStates.checked ? 'ACTIVE' : 'off'}</span>
            <span>:enabled ({observedStates.enabledCount}) · :disabled ({observedStates.disabledCount})</span>
            {observedStates.selectionText && (
              <span className="on">::selection &ldquo;{observedStates.selectionText}&rdquo;</span>
            )}
          </div>

          <div className="so-iframe-wrap">
            <iframe
              ref={iframeRef}
              title="Pseudo-elements and Interactive States live preview"
              sandbox="allow-same-origin"
              srcDoc={validDoc}
              onLoad={handleIframeLoad}
            />
          </div>

          <div className="property-explain">
            <Sparkles size={15} />
            <p>{activePreset.explanation}</p>
          </div>
        </div>
      </div>

      {(cssError || htmlWarning) && (
        <div className="live-exp-alert" role="alert">
          {cssError || htmlWarning}
        </div>
      )}

      {/* Synchronized CSS & HTML Editors */}
      <div className="ps-editors-grid">
        <div className="live-exp-pane">
          <div className="live-exp-pane-head">
            <span>
              <i className="file-dot css-dot" /> Pseudo &amp; State CSS
            </span>
            <small>{cssError ? 'Showing last valid CSS' : 'Synced with preview'}</small>
          </div>
          <div className="live-exp-cm">
            <CodeMirrorEditor
              language="css"
              value={css}
              ariaLabel="Pseudo-states CSS editor"
              onChange={setCss}
              onFocus={() => {}}
              onRun={readLiveBrowserStates}
              onSave={() => {}}
              onFormat={() => {}}
              onNextPane={() => {}}
            />
          </div>
        </div>

        <div className="live-exp-pane">
          <div className="live-exp-pane-head">
            <span>
              <i className="file-dot html-dot" /> Sandboxed HTML
            </span>
            <small>Interact directly inside the preview above</small>
          </div>
          <div className="live-exp-cm">
            <CodeMirrorEditor
              language="html"
              value={html}
              ariaLabel="Pseudo-states HTML editor"
              onChange={setHtml}
              onFocus={() => {}}
              onRun={readLiveBrowserStates}
              onSave={() => {}}
              onFormat={() => {}}
              onNextPane={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
