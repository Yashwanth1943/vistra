'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Download, Expand, Maximize2, Monitor, Play, RotateCcw, Smartphone, Tablet, Wand2 } from 'lucide-react';
import { formatCss, formatCssSync, formatHtml, formatHtmlSync } from '../app/format-code';
import { buildExamples, type BuildExample } from '../app/learning-tools';
import { createPreviewDocument, starterTemplates, validateCss, validateHtml, type PlaygroundTemplate } from '../app/playground';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { MOTION_EASE, MOTION_TIMING, MotionProvider } from './MotionPrimitives';

type EditorLanguage = 'html' | 'css';
type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

const DRAFT_KEY = 'webcraft:playground-draft';

function EditorPane({
  title,
  language,
  value,
  onChange,
  onActivate,
  onRun,
  onSave,
  onFormat,
  onFormatPane,
  onNextPane,
}: {
  title: string;
  language: EditorLanguage;
  value: string;
  onChange: (value: string) => void;
  onActivate: () => void;
  onRun: () => void;
  onSave: () => void;
  onFormat: () => void;
  onFormatPane: () => void;
  onNextPane: () => void;
}) {
  return (
    <div className="pro-editor">
      <div className="pro-editor-head">
        <span className="pro-editor-file">
          <i className={`file-dot ${language === 'html' ? 'html-dot' : 'css-dot'}`} />
          {title}
        </span>
        <div className="pro-editor-actions">
          <button
            type="button"
            className="pro-editor-fmt"
            onClick={onFormatPane}
            title={`Format ${language.toUpperCase()} (Shift+Alt+F)`}
          >
            <Wand2 size={11} /> Format {language.toUpperCase()}
          </button>
          <span className="pro-editor-meta">
            {language.toUpperCase()} · Tab indent · Ctrl+M next
          </span>
        </div>
      </div>
      <div className="pro-editor-body cm-body">
        <CodeMirrorEditor
          language={language}
          value={value}
          ariaLabel={`${title} editor`}
          onChange={onChange}
          onFocus={onActivate}
          onRun={onRun}
          onSave={onSave}
          onFormat={onFormat}
          onNextPane={onNextPane}
        />
      </div>
    </div>
  );
}

export function PlaygroundStudio({ starter }: { starter?: BuildExample }) {
  const available = useMemo<PlaygroundTemplate[]>(() => {
    const examples = buildExamples.map((example) => ({ ...example, name: example.title }));
    const entries = [...starterTemplates, ...examples];
    if (starter && !entries.some((entry) => entry.id === starter.id)) {
      entries.push({ ...starter, name: starter.title });
    }
    return entries;
  }, [starter]);

  const initialIndex = starter ? Math.max(0, available.findIndex((item) => item.id === starter.id)) : 0;
  const initialHtml = formatHtmlSync(starter?.html ?? available[initialIndex].html);
  const initialCss = formatCssSync(starter?.css ?? available[initialIndex].css);

  const [templateIndex, setTemplateIndex] = useState(initialIndex);
  const [html, setHtml] = useState(initialHtml);
  const [css, setCss] = useState(initialCss);
  const [previewDocument, setPreviewDocument] = useState(() => createPreviewDocument(initialHtml, initialCss));
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop');
  const [expanded, setExpanded] = useState<'editor' | 'preview' | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [activeEditor, setActiveEditor] = useState<EditorLanguage>('html');
  const [editorTab, setEditorTab] = useState<'split' | EditorLanguage>('split');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hydratedDraft, setHydratedDraft] = useState(Boolean(starter));
  const workspaceRef = useRef<HTMLElement>(null);
  const messageTimer = useRef<number | null>(null);

  useEffect(() => {
    if (starter) {
      setHydratedDraft(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { templateIndex?: number; html?: string; css?: string };
        if (typeof parsed.html === 'string' && typeof parsed.css === 'string') {
          const safeIndex =
            typeof parsed.templateIndex === 'number' && parsed.templateIndex >= 0 && parsed.templateIndex < available.length
              ? parsed.templateIndex
              : 0;
          setTemplateIndex(safeIndex);
          setHtml(parsed.html);
          setCss(parsed.css);
          const cssIssue = validateCss(parsed.css);
          setError(cssIssue ?? validateHtml(parsed.html) ?? '');
          if (!cssIssue) setPreviewDocument(createPreviewDocument(parsed.html, parsed.css));
        }
      }
    } catch {
      /* Ignore unreadable draft storage */
    } finally {
      setHydratedDraft(true);
    }
  }, [starter, available.length]);

  useEffect(() => {
    if (!hydratedDraft || starter) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ templateIndex, html, css }));
    } catch {
      /* Ignore storage quota errors */
    }
  }, [hydratedDraft, starter, templateIndex, html, css]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === workspaceRef.current);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expanded !== null && !document.fullscreenElement) {
        setExpanded(null);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [expanded]);

  useEffect(() => () => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const issue = validateCss(css);
      if (issue) {
        setError(issue);
        return;
      }
      setError(validateHtml(html) ?? '');
      setPreviewDocument(createPreviewDocument(html, css));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [html, css]);

  const report = (text: string) => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current);
    setMessage(text);
    messageTimer.current = window.setTimeout(() => {
      setMessage('');
      messageTimer.current = null;
    }, 2000);
  };

  const run = () => {
    const issue = validateCss(css);
    if (issue) {
      setError(issue);
      report('Fix the CSS issue before running.');
      return;
    }
    setError(validateHtml(html) ?? '');
    setPreviewDocument(createPreviewDocument(html, css));
    setPreviewRevision((value) => value + 1);
    report('Preview updated.');
  };

  const formatOnlyHtml = async () => {
    try {
      const nextHtml = await formatHtml(html);
      setHtml(nextHtml);
      report('Formatted HTML.');
    } catch {
      report('Could not format HTML — check for syntax errors.');
    }
  };

  const formatOnlyCss = async () => {
    try {
      const nextCss = await formatCss(css);
      setCss(nextCss);
      report('Formatted CSS.');
    } catch {
      report('Could not format CSS — check for unclosed braces or syntax errors.');
    }
  };

  const formatAll = async () => {
    try {
      const [nextHtml, nextCss] = await Promise.all([formatHtml(html), formatCss(css)]);
      setHtml(nextHtml);
      setCss(nextCss);
      report('Formatted HTML & CSS.');
    } catch {
      report('Could not format — check HTML or CSS for syntax errors.');
    }
  };

  const reset = () => {
    const selected = available[templateIndex];
    const nextHtml = formatHtmlSync(selected.html);
    const nextCss = formatCssSync(selected.css);
    setHtml(nextHtml);
    setCss(nextCss);
    setError('');
    setPreviewDocument(createPreviewDocument(nextHtml, nextCss));
    setPreviewRevision((value) => value + 1);
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* Ignore */
    }
    report('Starter restored.');
  };

  const choose = (index: number) => {
    const selected = available[index];
    const nextHtml = formatHtmlSync(selected.html);
    const nextCss = formatCssSync(selected.css);
    setTemplateIndex(index);
    setHtml(nextHtml);
    setCss(nextCss);
    setError('');
    setActiveEditor('html');
    setPreviewDocument(createPreviewDocument(nextHtml, nextCss));
    setPreviewRevision((value) => value + 1);
    report(`Loaded ${selected.name}.`);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      report(`${label} copied.`);
    } catch {
      report('Clipboard access is unavailable in this browser.');
    }
  };

  const download = (name: string, text: string, type = 'text/html;charset=utf-8') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    report(`Downloaded ${name}.`);
  };

  const toggleFullscreen = async () => {
    if (!workspaceRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await workspaceRef.current.requestFullscreen();
    } catch {
      report('Fullscreen is not available here; use Expand editor or Expand preview.');
    }
  };

  const combinedHtml = createPreviewDocument(html, css);
  const previewStale = Boolean(validateCss(css));
  const isEmpty = !html.trim() && !css.trim();

  return (
    <MotionProvider>
      <section
        ref={workspaceRef}
        className={`playground-page premium-playground ${isFullscreen ? 'playground-fullscreen' : ''}`}
      >
        <div className="page-heading">
          <div>
            <div className="eyebrow-line">HTML + CSS WORKBENCH</div>
            <h1>Make something real.</h1>
            <p>Changes preview automatically after a short pause. Use Run (Ctrl/Cmd+Enter) or Format (Shift+Alt+F).</p>
          </div>
          <div className="playground-toolbar-actions">
            <label className="template-picker">
              Starter
              <select
                aria-label="Choose starter template"
                value={templateIndex}
                onChange={(event) => choose(Number(event.target.value))}
              >
                {available.map((item, index) => (
                  <option value={index} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="reset-button" type="button" onClick={run}>
              <Play size={14} /> Run
            </button>
            <button className="reset-button" type="button" onClick={formatAll} title="Format HTML and CSS (Shift+Alt+F)">
              <Wand2 size={14} /> Format Document
            </button>
            <button className="reset-button" type="button" onClick={reset}>
              <RotateCcw size={14} /> Reset
            </button>
            <button
              className="reset-button"
              type="button"
              aria-pressed={previewViewport === 'desktop'}
              onClick={() => setPreviewViewport('desktop')}
            >
              <Monitor size={14} /> Desktop
            </button>
            <button
              className="reset-button"
              type="button"
              aria-pressed={previewViewport === 'tablet'}
              onClick={() => setPreviewViewport('tablet')}
            >
              <Tablet size={14} /> Tablet
            </button>
            <button
              className="reset-button"
              type="button"
              aria-pressed={previewViewport === 'mobile'}
              onClick={() => setPreviewViewport('mobile')}
            >
              <Smartphone size={14} /> Mobile preview
            </button>
            <button
              className="reset-button"
              type="button"
              aria-expanded={expanded === 'editor'}
              onClick={() => setExpanded((value) => (value === 'editor' ? null : 'editor'))}
            >
              <Expand size={14} /> {expanded === 'editor' ? 'Split view' : 'Expand editor'}
            </button>
            <button
              className="reset-button"
              type="button"
              aria-expanded={expanded === 'preview'}
              onClick={() => setExpanded((value) => (value === 'preview' ? null : 'preview'))}
            >
              <Expand size={14} /> {expanded === 'preview' ? 'Split view' : 'Expand preview'}
            </button>
            <button className="reset-button" type="button" onClick={toggleFullscreen}>
              <Maximize2 size={14} /> {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </div>

        <div className="playground-subbar">
          <div className="playground-editor-tabs" role="tablist" aria-label="Editor panes">
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'split'}
              className={editorTab === 'split' ? 'active' : ''}
              onClick={() => setEditorTab('split')}
            >
              HTML + CSS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'html'}
              className={editorTab === 'html' ? 'active' : ''}
              onClick={() => {
                setEditorTab('html');
                setActiveEditor('html');
              }}
            >
              index.html
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === 'css'}
              className={editorTab === 'css' ? 'active' : ''}
              onClick={() => {
                setEditorTab('css');
                setActiveEditor('css');
              }}
            >
              styles.css
            </button>
          </div>

          {expanded === null && (
            <label className="playground-split-control">
              <span>Split {splitPercent}%</span>
              <input
                aria-label="Adjust editor and preview split"
                type="range"
                min={32}
                max={68}
                value={splitPercent}
                onChange={(event) => setSplitPercent(Number(event.target.value))}
              />
            </label>
          )}
        </div>

        <div
          className={`pro-playground-grid ${previewViewport === 'mobile' ? 'mobile-preview-mode' : ''} ${previewViewport === 'tablet' ? 'tablet-preview-mode' : ''
            } ${expanded === 'editor' ? 'editor-expanded' : ''} ${expanded === 'preview' ? 'preview-expanded' : ''
            }`}
          style={
            expanded === null
              ? ({ '--pg-split': `${splitPercent}%` } as React.CSSProperties)
              : undefined
          }
        >
          <motion.div layout transition={{ duration: MOTION_TIMING.standard, ease: MOTION_EASE }} className={`pro-editors active-${activeEditor} tab-${editorTab}`}>
            {editorTab !== 'css' && (
              <EditorPane
                title="index.html"
                language="html"
                value={html}
                onChange={setHtml}
                onActivate={() => setActiveEditor('html')}
                onRun={run}
                onSave={() => download('webcraft-preview.html', combinedHtml)}
                onFormat={formatAll}
                onFormatPane={formatOnlyHtml}
                onNextPane={() => {
                  const cssTarget = document.querySelector<HTMLElement>('[aria-label="styles.css editor"]');
                  if (cssTarget) cssTarget.focus();
                  else document.querySelector<HTMLButtonElement>('.pro-preview-head button')?.focus();
                }}
              />
            )}
            {editorTab !== 'html' && (
              <EditorPane
                title="styles.css"
                language="css"
                value={css}
                onChange={setCss}
                onActivate={() => setActiveEditor('css')}
                onRun={run}
                onSave={() => download('webcraft-preview.html', combinedHtml)}
                onFormat={formatAll}
                onFormatPane={formatOnlyCss}
                onNextPane={() => document.querySelector<HTMLButtonElement>('.pro-preview-head button')?.focus()}
              />
            )}
          </motion.div>

          <motion.div layout transition={{ duration: MOTION_TIMING.standard, ease: MOTION_EASE }} className="pro-preview">
            <div className="pro-preview-head">
              <span>
                PREVIEW · {previewViewport === 'mobile' ? '375px' : previewViewport === 'tablet' ? '768px' : '100%'}{' '}
                {previewStale ? '· LAST VALID VERSION' : '· AUTO RUN'}
              </span>
              <div>
                <button type="button" onClick={run}>
                  <Play size={13} /> Run
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewRevision((value) => value + 1);
                    report('Preview refreshed.');
                  }}
                >
                  <RotateCcw size={13} /> Refresh
                </button>
                <button type="button" onClick={() => copy(html, 'HTML')}>
                  <Copy size={13} /> Copy HTML
                </button>
                <button type="button" onClick={() => copy(css, 'CSS')}>
                  <Copy size={13} /> Copy CSS
                </button>
                <button type="button" onClick={() => download('index.html', html)}>
                  <Download size={13} /> HTML file
                </button>
                <button type="button" onClick={() => download('styles.css', css, 'text/css;charset=utf-8')}>
                  <Download size={13} /> CSS file
                </button>
                <button type="button" onClick={() => download('webcraft-preview.html', combinedHtml)}>
                  <Download size={13} /> Complete HTML
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key={error}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}
                  className="playground-error"
                  role="alert"
                >
                  {error}{' '}
                  {previewStale
                    ? 'The previous valid preview is still available.'
                    : 'The browser may repair this HTML; inspect the preview for the parsed result.'}
                </motion.p>
              )}
            </AnimatePresence>

            {isEmpty && (
              <p className="playground-empty" role="status">
                Editors are empty. Type HTML or CSS, or pick a starter template above.
              </p>
            )}

            <motion.div
              className="pro-preview-frame-wrap"
              animate={{
                maxWidth:
                  previewViewport === 'mobile' ? '375px' : previewViewport === 'tablet' ? '768px' : '100%',
              }}
              transition={{ duration: MOTION_TIMING.standard, ease: MOTION_EASE }}
            >
              <iframe key={previewRevision} title="Sandboxed HTML and CSS preview" sandbox="" srcDoc={previewDocument} />
            </motion.div>
          </motion.div>
        </div>

        <div className="playground-tip">
          <span>
            Focused editor: {activeEditor === 'html' ? 'HTML' : 'CSS'} · Shift+Alt+F Format · Ctrl/Cmd+Enter Run · Ctrl/Cmd+S Download · Tab/Shift+Tab indent
          </span>
          <span>Preview scripts are disabled (sandboxed iframe + strict CSP).</span>
        </div>

        <AnimatePresence>
          {(message || error) && (
            <motion.div
              key={message || error}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}
              role={error ? 'alert' : 'status'}
              className={error ? 'playground-toast error' : 'playground-toast'}
            >
              {message || error}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </MotionProvider>
  );
}
