'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Cpu, Pause, Play, Sparkles } from 'lucide-react';
import { createPreviewDocument, validateCss } from '../app/playground';
import {
  ANIMATION_COMPARISONS,
  CSS_PERF_EXPERIMENTS,
  PIPELINE_STAGES,
  type PipelineStageId,
} from '../app/rendering-pipeline';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { RangeControl } from './VisualizationEngine';

export function RenderingPipelineStudio() {
  // 1. Pipeline Stage & CSS Property Impact Explorer
  const [activeStageId, setActiveStageId] = useState<PipelineStageId>('layout');
  const [perfExpId, setPerfExpId] = useState(CSS_PERF_EXPERIMENTS[0].id);
  const [toggleB, setToggleB] = useState(false);

  // 2. Animation Comparison State
  const [compId, setCompId] = useState(ANIMATION_COMPARISONS[0].id);
  const [running, setRunning] = useState(true);
  const [durationMs, setDurationMs] = useState(1100);
  const [elementCount, setElementCount] = useState(8);

  const activeComp = ANIMATION_COMPARISONS.find((c) => c.id === compId) ?? ANIMATION_COMPARISONS[0];
  const [cssA, setCssA] = useState(activeComp.cssA);
  const [cssB, setCssB] = useState(activeComp.cssB);

  useEffect(() => {
    setCssA(activeComp.cssA);
    setCssB(activeComp.cssB);
  }, [activeComp]);

  // 3. Real Browser Performance Measurements (rAF + PerformanceObserver)
  const [perfMetrics, setPerfMetrics] = useState<{
    avgFrameMs: number | null;
    maxFrameMs: number | null;
    samples: number;
    longTaskSupported: boolean;
    longTaskCount: number;
    layoutShiftSupported: boolean;
    layoutShiftScore: number;
  }>({
    avgFrameMs: null,
    maxFrameMs: null,
    samples: 0,
    longTaskSupported: false,
    longTaskCount: 0,
    layoutShiftSupported: false,
    layoutShiftScore: 0,
  });

  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const supported =
      typeof PerformanceObserver !== 'undefined' && Array.isArray(PerformanceObserver.supportedEntryTypes)
        ? PerformanceObserver.supportedEntryTypes
        : [];
    const longTaskSupported = supported.includes('longtask');
    const layoutShiftSupported = supported.includes('layout-shift');

    setPerfMetrics((prev) => ({
      ...prev,
      longTaskSupported,
      layoutShiftSupported,
    }));

    const observers: PerformanceObserver[] = [];

    if (longTaskSupported) {
      try {
        const obs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            setPerfMetrics((prev) => ({ ...prev, longTaskCount: prev.longTaskCount + entries.length }));
          }
        });
        obs.observe({ entryTypes: ['longtask'] });
        observers.push(obs);
      } catch {
        /* Not supported in this context */
      }
    }

    if (layoutShiftSupported) {
      try {
        const obs = new PerformanceObserver((list) => {
          let added = 0;
          for (const entry of list.getEntries()) {
            const ls = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
            if (!ls.hadRecentInput && typeof ls.value === 'number') {
              added += ls.value;
            }
          }
          if (added > 0) {
            setPerfMetrics((prev) => ({
              ...prev,
              layoutShiftScore: Math.round((prev.layoutShiftScore + added) * 1000) / 1000,
            }));
          }
        });
        obs.observe({ entryTypes: ['layout-shift'] });
        observers.push(obs);
      } catch {
        /* Not supported in this context */
      }
    }

    return () => {
      for (const o of observers) o.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!running || typeof window === 'undefined') {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      return;
    }

    let last = performance.now();
    const deltas: number[] = [];

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (dt > 0 && dt < 250) {
        deltas.push(dt);
        if (deltas.length > 30) deltas.shift();
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const max = Math.max(...deltas);
        setPerfMetrics((prev) => ({
          ...prev,
          avgFrameMs: Math.round(avg * 10) / 10,
          maxFrameMs: Math.round(max * 10) / 10,
          samples: deltas.length,
        }));
      }
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [running]);

  const activeStage = PIPELINE_STAGES.find((s) => s.id === activeStageId) ?? PIPELINE_STAGES[0];
  const activePerfExp = CSS_PERF_EXPERIMENTS.find((e) => e.id === perfExpId) ?? CSS_PERF_EXPERIMENTS[0];

  const pipelineDemoDoc = useMemo(() => {
    const val = toggleB ? activePerfExp.valueB : activePerfExp.valueA;
    const html = `<div class="demo-row"><div class="demo-box">${activePerfExp.cssProp}: ${val}</div><div class="demo-sibling">Sibling</div></div>`;
    const css = `body{margin:0;padding:12px;font-family:system-ui,sans-serif;background:#fff}
.demo-row{display:flex;align-items:center;gap:10px}
.demo-box{padding:12px;border:2px solid #6366f1;border-radius:8px;background:#eef2ff;color:#1e1b4b;font-size:12px;font-weight:700;transition:all 240ms ease;${activePerfExp.cssProp}:${val}}
.demo-sibling{padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-size:12px;color:#475569}`;
    return createPreviewDocument(html, css);
  }, [activePerfExp, toggleB]);

  const buildAnimDoc = (rawCss: string, count: number) => {
    const boxes = Array.from({ length: count }, (_, i) => `<div class="anim-box">${i + 1}</div>`).join('');
    const wrapper = `body{margin:0;padding:12px;font-family:system-ui,sans-serif;background:#fff}
.anim-wrap{display:flex;flex-wrap:wrap;gap:6px;--dur:${durationMs}ms}
.anim-box{width:48px;height:32px;display:grid;place-items:center;border-radius:6px;background:#6366f1;color:#fff;font-size:11px;font-weight:700;animation-play-state:${running ? 'running' : 'paused'} !important}`;
    const safeCss = validateCss(rawCss) === null ? rawCss : '';
    return createPreviewDocument(`<div class="anim-wrap">${boxes}</div>`, `${wrapper}\n${safeCss}`);
  };

  const docA = useMemo(
    () => buildAnimDoc(cssA, compId === 'single-vs-many' ? 1 : Math.min(elementCount, 12)),
    [cssA, compId, elementCount, durationMs, running]
  );
  const docB = useMemo(
    () => buildAnimDoc(cssB, elementCount),
    [cssB, elementCount, durationMs, running]
  );

  return (
    <div className="rp-studio">
      {/* 1. Browser Rendering Pipeline */}
      <div className="rp-section">
        <div className="so-header">
          <div>
            <span className="eyebrow-line">
              <Cpu size={12} /> BROWSER RENDERING PIPELINE (CONCEPTUAL MODEL)
            </span>
            <h2>From HTML &amp; CSS to Pixels</h2>
          </div>
          <span className="rp-badge">Conceptual Pipeline Model</span>
        </div>

        <div className="rp-pipeline-steps" role="tablist" aria-label="Browser rendering pipeline stages">
          {PIPELINE_STAGES.map((stage) => {
            const impacted = activePerfExp.stages.includes(stage.id);
            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={activeStageId === stage.id}
                className={`rp-stage-btn ${activeStageId === stage.id ? 'active' : ''} ${impacted ? 'impacted' : ''}`}
                onClick={() => setActiveStageId(stage.id)}
              >
                <small>Stage {stage.step}</small>
                <strong>{stage.title}</strong>
                {impacted && <span className="rp-impact-dot">Triggered by {activePerfExp.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="rp-stage-detail">
          <div className="rp-detail-grid">
            <div>
              <span>What happens</span>
              <p>{activeStage.whatHappens}</p>
            </div>
            <div>
              <span>Why the browser performs it</span>
              <p>{activeStage.why}</p>
            </div>
            <div>
              <span>Inputs</span>
              <p>{activeStage.inputs}</p>
            </div>
            <div>
              <span>Passes to next stage</span>
              <p>{activeStage.nextStageReceives}</p>
            </div>
          </div>
        </div>

        {/* CSS Performance Explorer */}
        <div className="rp-perf-bar">
          <div className="rp-perf-controls">
            <span>Compare CSS change impact:</span>
            <div className="ps-token-pills">
              {CSS_PERF_EXPERIMENTS.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  className={perfExpId === exp.id ? 'active' : ''}
                  onClick={() => {
                    setPerfExpId(exp.id);
                    setToggleB(false);
                  }}
                >
                  <code>{exp.label}</code>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={() => setToggleB((v) => !v)}
            >
              Toggle {activePerfExp.cssProp}: {toggleB ? activePerfExp.valueA : activePerfExp.valueB}
            </button>
          </div>
          <div className="property-explain">
            <Sparkles size={15} />
            <p>{activePerfExp.note}</p>
          </div>
          <div className="so-iframe-wrap" style={{ minHeight: 84 }}>
            <iframe
              title="CSS performance impact preview"
              sandbox="allow-same-origin"
              srcDoc={pipelineDemoDoc}
              style={{ minHeight: 84, height: 84 }}
            />
          </div>
        </div>
      </div>

      {/* 2. Animation Comparison + Real Browser Performance Measurements */}
      <div className="rp-section">
        <div className="so-header">
          <div>
            <span className="eyebrow-line">
              <Activity size={12} /> ANIMATION COMPARISON &amp; REAL MEASUREMENTS
            </span>
            <h2>Compare Animation Strategies Live</h2>
          </div>
          <button
            type="button"
            className="reset-button"
            onClick={() => setRunning((r) => !r)}
          >
            {running ? <Pause size={13} /> : <Play size={13} />}
            {running ? 'Stop Animations' : 'Start Animations'}
          </button>
        </div>

        <div className="ps-presets">
          {ANIMATION_COMPARISONS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`viz-preset-btn ${compId === c.id ? 'active' : ''}`}
              onClick={() => setCompId(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="rp-anim-controls">
          <RangeControl label="Duration" value={durationMs} min={250} max={2400} step={50} unit="ms" onChange={setDurationMs} />
          <RangeControl label="Element count" value={elementCount} min={1} max={36} unit="" onChange={setElementCount} />
        </div>

        <div className="property-explain" style={{ margin: '0 14px' }}>
          <Sparkles size={15} />
          <p>{activeComp.explanation}</p>
        </div>

        <div className="rp-compare-grid">
          <div className="rp-compare-card">
            <div className="live-exp-pane-head light">
              <span>{activeComp.titleA}</span>
            </div>
            <div className="so-iframe-wrap">
              <iframe title="Animation Option A" sandbox="allow-same-origin" srcDoc={docA} />
            </div>
            <div className="live-exp-cm">
              <CodeMirrorEditor
                language="css"
                value={cssA}
                ariaLabel="Animation Option A CSS"
                onChange={setCssA}
                onFocus={() => {}}
                onRun={() => {}}
                onSave={() => {}}
                onFormat={() => {}}
                onNextPane={() => {}}
              />
            </div>
          </div>

          <div className="rp-compare-card">
            <div className="live-exp-pane-head light">
              <span>{activeComp.titleB}</span>
            </div>
            <div className="so-iframe-wrap">
              <iframe title="Animation Option B" sandbox="allow-same-origin" srcDoc={docB} />
            </div>
            <div className="live-exp-cm">
              <CodeMirrorEditor
                language="css"
                value={cssB}
                ariaLabel="Animation Option B CSS"
                onChange={setCssB}
                onFocus={() => {}}
                onRun={() => {}}
                onSave={() => {}}
                onFormat={() => {}}
                onNextPane={() => {}}
              />
            </div>
          </div>
        </div>

        {/* Real Browser Performance Measurements */}
        <div className="rp-metrics-panel" aria-label="Real browser performance measurements">
          <div className="rp-metrics-row">
            <div>
              <span>rAF Frame Interval (avg / max)</span>
              <strong>
                {perfMetrics.avgFrameMs !== null
                  ? `${perfMetrics.avgFrameMs}ms / ${perfMetrics.maxFrameMs}ms (${perfMetrics.samples} samples)`
                  : 'Paused'}
              </strong>
            </div>
            <div>
              <span>Long Tasks API (&gt;50ms)</span>
              <strong>
                {perfMetrics.longTaskSupported
                  ? `${perfMetrics.longTaskCount} observed`
                  : 'Not supported in this browser'}
              </strong>
            </div>
            <div>
              <span>Layout Shift API</span>
              <strong>
                {perfMetrics.layoutShiftSupported
                  ? `Score: ${perfMetrics.layoutShiftScore}`
                  : 'Not supported in this browser'}
              </strong>
            </div>
          </div>
          <p className="rp-honesty-note">
            Measurement scope: <code>requestAnimationFrame</code>, <code>PerformanceObserver(&apos;longtask&apos;)</code>, and{' '}
            <code>PerformanceObserver(&apos;layout-shift&apos;)</code> report real browser metrics where supported. Web JavaScript cannot directly read internal browser paint counts, layout counts, or GPU thread activity—the pipeline stages above are a conceptual model.
          </p>
        </div>
      </div>
    </div>
  );
}
