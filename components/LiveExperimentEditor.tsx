'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Monitor, RotateCcw, Smartphone, Tablet } from 'lucide-react';
import { createPreviewDocument, validateCss, validateHtml } from '../app/playground';
import { CodeMirrorEditor } from './CodeMirrorEditor';

type PreviewSize = 'desktop' | 'tablet' | 'mobile';

export function LiveExperimentEditor({
  html,
  css,
  previewCssWrapper,
  onHtmlChange,
  onCssChange,
  onReset,
  labelPrefix = 'Live',
}: {
  html: string;
  css: string;
  /** Optional base CSS prepended only in the preview iframe (e.g., default demo item colors/padding). */
  previewCssWrapper?: string;
  onHtmlChange: (nextHtml: string) => void;
  onCssChange: (nextCss: string) => void;
  onReset: () => void;
  labelPrefix?: string;
}) {
  const [activePane, setActivePane] = useState<'split' | 'css' | 'html'>('split');
  const [viewport, setViewport] = useState<PreviewSize>('desktop');
  const [copied, setCopied] = useState<'html' | 'css' | null>(null);
  const copyTimer = useRef<number | null>(null);

  const combinedPreviewCss = previewCssWrapper ? `${previewCssWrapper}\n${css}` : css;
  const cssError = useMemo(() => validateCss(css), [css]);
  const htmlWarning = useMemo(() => validateHtml(html), [html]);

  const [lastValidDoc, setLastValidDoc] = useState(() =>
    createPreviewDocument(html, combinedPreviewCss)
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!cssError) {
        setLastValidDoc(createPreviewDocument(html, combinedPreviewCss));
      }
    }, 90);
    return () => window.clearTimeout(timer);
  }, [html, combinedPreviewCss, cssError]);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    []
  );

  const copyText = async (kind: 'html' | 'css') => {
    const text = kind === 'html' ? html : css;
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(kind);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => {
        setCopied(null);
        copyTimer.current = null;
      }, 1300);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="live-exp-shell">
      <div className="live-exp-toolbar">
        <div className="live-exp-tabs" role="tablist" aria-label="Experiment editor view">
          <button
            type="button"
            role="tab"
            aria-selected={activePane === 'split'}
            className={activePane === 'split' ? 'active' : ''}
            onClick={() => setActivePane('split')}
          >
            CSS + HTML
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePane === 'css'}
            className={activePane === 'css' ? 'active' : ''}
            onClick={() => setActivePane('css')}
          >
            CSS
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePane === 'html'}
            className={activePane === 'html' ? 'active' : ''}
            onClick={() => setActivePane('html')}
          >
            HTML
          </button>
        </div>

        <div className="live-exp-actions">
          <div className="live-exp-sizes" role="group" aria-label="Preview size">
            <button
              type="button"
              className={viewport === 'desktop' ? 'active' : ''}
              onClick={() => setViewport('desktop')}
              title="Desktop preview"
              aria-label="Desktop preview"
              aria-pressed={viewport === 'desktop'}
            >
              <Monitor size={13} />
            </button>
            <button
              type="button"
              className={viewport === 'tablet' ? 'active' : ''}
              onClick={() => setViewport('tablet')}
              title="Tablet preview (768px)"
              aria-label="Tablet preview (768px)"
              aria-pressed={viewport === 'tablet'}
            >
              <Tablet size={13} />
            </button>
            <button
              type="button"
              className={viewport === 'mobile' ? 'active' : ''}
              onClick={() => setViewport('mobile')}
              title="Mobile preview (375px)"
              aria-label="Mobile preview (375px)"
              aria-pressed={viewport === 'mobile'}
            >
              <Smartphone size={13} />
            </button>
          </div>

          <button type="button" className="reset-button" onClick={() => copyText('css')}>
            {copied === 'css' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'css' ? 'Copied CSS' : 'Copy CSS'}
          </button>
          <button type="button" className="reset-button" onClick={() => copyText('html')}>
            {copied === 'html' ? <Check size={13} /> : <Copy size={13} />}
            {copied === 'html' ? 'Copied HTML' : 'Copy HTML'}
          </button>
          <button type="button" className="reset-button" onClick={onReset}>
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      {(cssError || htmlWarning) && (
        <div className="live-exp-alert" role="alert">
          {cssError || htmlWarning}
        </div>
      )}

      <div className="live-exp-grid">
        <div className={`live-exp-editors pane-${activePane}`}>
          {activePane !== 'html' && (
            <div className="live-exp-pane">
              <div className="live-exp-pane-head">
                <span>
                  <i className="file-dot css-dot" /> {labelPrefix} CSS
                </span>
                <small>Edit CSS directly — controls &amp; preview sync</small>
              </div>
              <div className="live-exp-cm">
                <CodeMirrorEditor
                  language="css"
                  value={css}
                  ariaLabel={`${labelPrefix} CSS editor`}
                  onChange={onCssChange}
                  onFocus={() => {}}
                  onRun={() => {
                    if (!cssError) setLastValidDoc(createPreviewDocument(html, combinedPreviewCss));
                  }}
                  onSave={() => {}}
                  onFormat={() => {}}
                  onNextPane={() => {}}
                />
              </div>
            </div>
          )}

          {activePane !== 'css' && (
            <div className="live-exp-pane">
              <div className="live-exp-pane-head">
                <span>
                  <i className="file-dot html-dot" /> {labelPrefix} HTML
                </span>
                <small>Sandboxed DOM</small>
              </div>
              <div className="live-exp-cm">
                <CodeMirrorEditor
                  language="html"
                  value={html}
                  ariaLabel={`${labelPrefix} HTML editor`}
                  onChange={onHtmlChange}
                  onFocus={() => {}}
                  onRun={() => {
                    if (!cssError) setLastValidDoc(createPreviewDocument(html, combinedPreviewCss));
                  }}
                  onSave={() => {}}
                  onFormat={() => {}}
                  onNextPane={() => {}}
                />
              </div>
            </div>
          )}
        </div>

        <div className="live-exp-preview-col">
          <div className="live-exp-pane-head light">
            <span>BROWSER PREVIEW · {viewport.toUpperCase()}</span>
            <small>{cssError ? 'Showing last valid CSS' : 'Synced'}</small>
          </div>
          <div className="live-exp-iframe-wrap">
            <iframe
              title={`${labelPrefix} sandboxed browser preview`}
              sandbox=""
              srcDoc={lastValidDoc}
              style={{
                maxWidth: viewport === 'mobile' ? 375 : viewport === 'tablet' ? 768 : '100%',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
