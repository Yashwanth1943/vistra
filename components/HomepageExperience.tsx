'use client';

import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Box,
  Braces,
  Code2,
  Compass,
  Layers,
  MonitorPlay,
  PanelsTopLeft,
  RotateCcw,
  Sliders,
  Smartphone,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { CurriculumModule } from '../app/curriculum';
import { MOTION_EASE, MOTION_TIMING, MotionProvider } from './MotionPrimitives';

export type HomepageLessonSummary = {
  id: string;
  title: string;
  group: string;
  description?: string;
};

type HomepageExperienceProps = {
  lessonsCount: number;
  favoritesCount: number;
  curriculum: CurriculumModule[];
  allLessons: HomepageLessonSummary[];
  recentLessons: HomepageLessonSummary[];
  favoriteLessons: HomepageLessonSummary[];
  onNavigate: (tab: string) => void;
  onSelectGroup: (group: string) => void;
  onSelectLesson: (id: string) => void;
  onSelectModule: (module: CurriculumModule) => void;
};

const labDirectory = [
  { tab: 'HTML Playground', title: 'HTML Playground', desc: 'Toggle landmarks, forms, and tables to inspect the live DOM tree and browser render.', icon: Code2, accent: 'coral' },
  { tab: 'CSS Playground', title: 'CSS Properties Explorer', desc: 'Search 14 CSS categories and adjust any property value on a live target.', icon: Sliders, accent: 'indigo' },
  { tab: 'Flexbox lab', title: 'Flexbox Lab', desc: 'Control direction, wrap, justify-content, align-items, gaps, and item grow/shrink.', icon: Braces, accent: 'violet' },
  { tab: 'Grid lab', title: 'Grid Lab', desc: 'Configure columns, rows, named areas, auto-flow, alignment, and cell spanning.', icon: MonitorPlay, accent: 'cyan' },
  { tab: 'Positioning', title: 'Positioning Lab', desc: 'Compare static, relative, absolute, fixed, and sticky inside a scrollable stage.', icon: PanelsTopLeft, accent: 'amber' },
  { tab: 'Box model', title: 'Box Model Lab', desc: 'Inspect content, padding, border, and margin layers with border-box vs content-box.', icon: Box, accent: 'mint' },
  { tab: 'Responsive', title: 'Responsive Lab', desc: 'Resize viewport width and height to trigger @media (min-width) layout breakpoints.', icon: Smartphone, accent: 'indigo' },
  { tab: 'Transform & Animation Lab', title: 'Transform & Animation Lab', desc: 'Experiment with translate, rotate, scale, transform-origin, transitions, and keyframes.', icon: Wand2, accent: 'violet' },
  { tab: 'Playground', title: 'Code Playground', desc: 'Write full HTML and CSS in CodeMirror with live sandboxed preview and formatting.', icon: Layers, accent: 'cyan' },
];

export function HomepageExperience({
  lessonsCount,
  recentLessons,
  favoriteLessons,
  onNavigate,
  onSelectLesson,
}: HomepageExperienceProps) {
  const [mode, setMode] = useState<'flex' | 'grid' | 'box'>('flex');
  const [justify, setJustify] = useState('space-between');
  const [align, setAlign] = useState('center');
  const [gap, setGap] = useState(12);
  const [gridCols, setGridCols] = useState('repeat(3, 1fr)');
  const [boxPad, setBoxPad] = useState(20);
  const [boxSizing, setBoxSizing] = useState<'border-box' | 'content-box'>('border-box');

  const resetHero = () => {
    setJustify('space-between');
    setAlign('center');
    setGap(12);
    setGridCols('repeat(3, 1fr)');
    setBoxPad(20);
    setBoxSizing('border-box');
  };

  const generatedCss =
    mode === 'flex'
      ? `.container {\n  display: flex;\n  justify-content: ${justify};\n  align-items: ${align};\n  gap: ${gap}px;\n}`
      : mode === 'grid'
      ? `.grid {\n  display: grid;\n  grid-template-columns: ${gridCols};\n  gap: ${gap}px;\n}`
      : `.box {\n  width: 220px;\n  padding: ${boxPad}px;\n  border: 6px solid #7c5cff;\n  box-sizing: ${boxSizing};\n}`;

  return (
    <MotionProvider>
      <div className="viz-home">
        {/* FIRST SCREEN: IMMEDIATE WORKING EXPERIMENT */}
        <section className="viz-home-hero" aria-label="Interactive CSS Experiment">
          <div className="viz-home-hero-top">
            <div>
              <div className="eyebrow-line">
                <Sparkles size={13} /> SELECT PROPERTY → CHANGE VALUE → SEE RESULT
              </div>
              <h1>Don&apos;t just learn code. Make it come alive.</h1>
              <p>
                Experiment directly with CSS properties and watch how the browser lays out elements in real time.
              </p>
            </div>
            <div className="viz-home-hero-cta">
              <button type="button" className="primary-button" onClick={() => onNavigate('Flexbox lab')}>
                Open Flexbox Lab <ArrowRight size={15} />
              </button>
              <button type="button" className="reset-button" onClick={() => onNavigate('CSS Playground')}>
                Explore CSS Properties
              </button>
            </div>
          </div>

          <div className="viz-home-workbench">
            <div className="viz-workbench-bar">
              <div className="viz-mode-tabs" role="tablist" aria-label="Quick experiment mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'flex'}
                  className={mode === 'flex' ? 'active' : ''}
                  onClick={() => setMode('flex')}
                >
                  Flexbox
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'grid'}
                  className={mode === 'grid' ? 'active' : ''}
                  onClick={() => setMode('grid')}
                >
                  CSS Grid
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'box'}
                  className={mode === 'box' ? 'active' : ''}
                  onClick={() => setMode('box')}
                >
                  Box Model
                </button>
              </div>

              <div className="viz-workbench-actions">
                <button type="button" className="reset-button" onClick={resetHero}>
                  <RotateCcw size={13} /> Reset
                </button>
                <button
                  type="button"
                  className="subtle-link"
                  onClick={() => onNavigate(mode === 'flex' ? 'Flexbox lab' : mode === 'grid' ? 'Grid lab' : 'Box model')}
                >
                  Open full lab <ArrowRight size={13} />
                </button>
              </div>
            </div>

            <div className="viz-workbench-grid">
              {/* Property Controls */}
              <div className="viz-workbench-controls">
                {mode === 'flex' && (
                  <>
                    <div className="viz-control">
                      <div className="viz-control-head">
                        <span>justify-content</span>
                        <code>{justify}</code>
                      </div>
                      <div className="viz-segmented" role="group" aria-label="Home justify-content">
                        {['flex-start', 'center', 'space-between', 'space-evenly'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            className={justify === val ? 'active' : ''}
                            onClick={() => setJustify(val)}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="viz-control">
                      <div className="viz-control-head">
                        <span>align-items</span>
                        <code>{align}</code>
                      </div>
                      <div className="viz-segmented" role="group" aria-label="Home align-items">
                        {['flex-start', 'center', 'stretch'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            className={align === val ? 'active' : ''}
                            onClick={() => setAlign(val)}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="viz-control">
                      <div className="viz-control-head">
                        <span>gap</span>
                        <code>{gap}px</code>
                      </div>
                      <input type="range" min={0} max={32} value={gap} onChange={(e) => setGap(Number(e.target.value))} />
                    </label>
                  </>
                )}

                {mode === 'grid' && (
                  <>
                    <div className="viz-control">
                      <div className="viz-control-head">
                        <span>grid-template-columns</span>
                        <code>{gridCols}</code>
                      </div>
                      <div className="viz-segmented" role="group" aria-label="Home grid-template-columns">
                        {['repeat(2, 1fr)', 'repeat(3, 1fr)', '1fr 2fr 1fr'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            className={gridCols === val ? 'active' : ''}
                            onClick={() => setGridCols(val)}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="viz-control">
                      <div className="viz-control-head">
                        <span>gap</span>
                        <code>{gap}px</code>
                      </div>
                      <input type="range" min={0} max={32} value={gap} onChange={(e) => setGap(Number(e.target.value))} />
                    </label>
                  </>
                )}

                {mode === 'box' && (
                  <>
                    <div className="viz-control">
                      <div className="viz-control-head">
                        <span>box-sizing</span>
                        <code>{boxSizing}</code>
                      </div>
                      <div className="viz-segmented" role="group" aria-label="Home box-sizing">
                        {(['border-box', 'content-box'] as const).map((val) => (
                          <button
                            key={val}
                            type="button"
                            className={boxSizing === val ? 'active' : ''}
                            onClick={() => setBoxSizing(val)}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="viz-control">
                      <div className="viz-control-head">
                        <span>padding</span>
                        <code>{boxPad}px</code>
                      </div>
                      <input type="range" min={4} max={40} value={boxPad} onChange={(e) => setBoxPad(Number(e.target.value))} />
                    </label>
                  </>
                )}

                <pre className="viz-home-code">
                  <code>{generatedCss}</code>
                </pre>
              </div>

              {/* Live Rendered Result */}
              <div className="viz-workbench-stage">
                {mode === 'flex' && (
                  <div
                    className="viz-home-flex-stage"
                    style={{
                      display: 'flex',
                      justifyContent: justify,
                      alignItems: align,
                      gap: `${gap}px`,
                    }}
                  >
                    {['01', '02', '03'].map((item, idx) => (
                      <motion.div
                        layout
                        transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}
                        key={item}
                        className={`viz-stage-chip c${idx}`}
                      >
                        <strong>{item}</strong>
                        <small>Flex item</small>
                      </motion.div>
                    ))}
                  </div>
                )}

                {mode === 'grid' && (
                  <div
                    className="viz-home-grid-stage"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: gridCols,
                      gap: `${gap}px`,
                    }}
                  >
                    {['01', '02', '03', '04', '05', '06'].map((item, idx) => (
                      <motion.div
                        layout
                        transition={{ duration: MOTION_TIMING.fast, ease: MOTION_EASE }}
                        key={item}
                        className={`viz-stage-chip c${idx % 3}`}
                      >
                        <strong>{item}</strong>
                      </motion.div>
                    ))}
                  </div>
                )}

                {mode === 'box' && (
                  <div className="viz-home-box-stage">
                    <div
                      className="viz-home-box-demo"
                      style={{
                        width: 220,
                        padding: boxPad,
                        border: '6px solid #6366f1',
                        boxSizing: boxSizing,
                      }}
                    >
                      <span>
                        {boxSizing === 'border-box'
                          ? `Total: 220px (Content ${220 - boxPad * 2 - 12}px)`
                          : `Content: 220px (Total ${220 + boxPad * 2 + 12}px)`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* VISUAL LABS LAUNCHPAD */}
        <section className="viz-home-section">
          <div className="viz-section-head">
            <div>
              <span className="section-kicker">INTERACTIVE LABORATORIES</span>
              <h2>Pick a CSS or HTML lab to experiment directly</h2>
            </div>
            <button type="button" className="subtle-link" onClick={() => onNavigate('Playground')}>
              Open Code Playground <ArrowRight size={14} />
            </button>
          </div>

          <div className="viz-lab-grid">
            {labDirectory.map((lab) => (
              <button
                key={lab.tab}
                type="button"
                className={`viz-lab-card accent-${lab.accent}`}
                onClick={() => onNavigate(lab.tab)}
              >
                <div className="viz-lab-icon">
                  <lab.icon size={18} />
                </div>
                <strong>{lab.title}</strong>
                <p>{lab.desc}</p>
                <span>
                  Launch lab <ArrowRight size={13} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* OPTIONAL CONCEPT REFERENCE & PRACTICE STRIP */}
        <section className="viz-home-section viz-reference-strip">
          <div className="viz-ref-card">
            <div>
              <span className="section-kicker">OPTIONAL REFERENCE</span>
              <h3>{lessonsCount} Concept Reference Guides &amp; 14 Practice Challenges</h3>
              <p>
                Need syntax details or want to test your CSS intuition? Browse the optional concept reference or jump into Practice Studio.
              </p>
            </div>
            <div className="viz-ref-actions">
              <button type="button" className="reset-button" onClick={() => onNavigate('Learn')}>
                <BookOpen size={14} /> Concept Reference ({lessonsCount})
              </button>
              <button type="button" className="reset-button" onClick={() => onNavigate('Practice')}>
                <Compass size={14} /> Practice Studio (14)
              </button>
            </div>
          </div>

          {(recentLessons.length > 0 || favoriteLessons.length > 0) && (
            <div className="viz-saved-row">
              {recentLessons.length > 0 && (
                <div className="viz-saved-group">
                  <span>Recent concepts:</span>
                  {recentLessons.map((item) => (
                    <button key={item.id} type="button" onClick={() => onSelectLesson(item.id)}>
                      {item.title}
                    </button>
                  ))}
                </div>
              )}
              {favoriteLessons.length > 0 && (
                <div className="viz-saved-group">
                  <span>Saved:</span>
                  {favoriteLessons.map((item) => (
                    <button key={item.id} type="button" onClick={() => onSelectLesson(item.id)}>
                      {item.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </MotionProvider>
  );
}
