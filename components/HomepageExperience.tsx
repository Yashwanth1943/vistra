'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  Code2,
  Compass,
  Layers,
  MonitorPlay,
  Search,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import type { CurriculumModule } from '../app/curriculum';
import { MOTION_EASE, MOTION_TIMING, MotionProvider, ScrollReveal, WordReveal } from './MotionPrimitives';
import { PlaygroundStudio } from './PlaygroundStudio';

gsap.registerPlugin(ScrollTrigger);

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

const techCards = [
  { tag: 'HTML', title: 'Semantic structure', desc: 'Meaningful landmarks, forms, and accessible document trees.', tab: 'Learn' },
  { tag: 'CSS', title: 'Cascade & box model', desc: 'Spacing, specificity, borders, and predictable sizing.', tab: 'Box model' },
  { tag: 'Flexbox', title: 'One-dimensional flow', desc: 'Main axis, cross axis, alignment, and wrapping.', tab: 'Flexbox lab' },
  { tag: 'Grid', title: 'Two-dimensional tracks', desc: 'Columns, rows, fr units, and responsive auto-fit.', tab: 'Grid lab' },
  { tag: 'Positioning', title: 'Flow & stacking', desc: 'Relative, absolute, fixed, sticky, and z-index contexts.', tab: 'Positioning' },
  { tag: 'Responsive', title: 'Fluid viewports', desc: 'Mobile-first breakpoints and container-aware layouts.', tab: 'Responsive' },
];

const flexSteps = [
  {
    id: 'flex-row',
    label: '01 · Direction',
    title: 'Row main axis',
    note: 'flex-direction: row arranges items horizontally along the main axis.',
    css: `.flex-stage {\n  display: flex;\n  flex-direction: row;\n  justify-content: flex-start;\n  align-items: center;\n  gap: 12px;\n}`,
    style: { display: 'flex', flexDirection: 'row' as const, justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'nowrap' as const, gap: '12px' },
  },
  {
    id: 'flex-justify',
    label: '02 · Justify',
    title: 'Space distribution',
    note: 'justify-content: space-between distributes remaining main-axis space between items.',
    css: `.flex-stage {\n  display: flex;\n  flex-direction: row;\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n}`,
    style: { display: 'flex', flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' as const, gap: '12px' },
  },
  {
    id: 'flex-align',
    label: '03 · Align',
    title: 'Cross-axis stretch',
    note: 'align-items: stretch expands items across the cross axis to fill the container height.',
    css: `.flex-stage {\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  align-items: stretch;\n  gap: 12px;\n}`,
    style: { display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', alignItems: 'stretch', flexWrap: 'nowrap' as const, gap: '12px' },
  },
  {
    id: 'flex-wrap',
    label: '04 · Wrap',
    title: 'Multi-line wrapping',
    note: 'flex-wrap: wrap lets items flow onto new lines when horizontal space runs out.',
    css: `.flex-stage {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: space-around;\n  align-items: center;\n  gap: 14px;\n}`,
    style: { display: 'flex', flexDirection: 'row' as const, justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap' as const, gap: '14px' },
  },
];

const gridSteps = [
  {
    id: 'grid-cols',
    label: '01 · Columns',
    title: 'Equal fractional tracks',
    note: 'repeat(3, 1fr) creates three proportional columns with a 12px gap.',
    css: `.grid-stage {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  grid-template-rows: auto;\n  gap: 12px;\n}`,
    style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' },
    spanFirst: false,
  },
  {
    id: 'grid-span',
    label: '02 · Placement',
    title: 'Spanning two columns',
    note: 'grid-column: span 2 lets the featured item occupy two column tracks.',
    css: `.grid-stage {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 12px;\n}\n.item--featured { grid-column: span 2; }`,
    style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' },
    spanFirst: true,
  },
  {
    id: 'grid-asymmetric',
    label: '03 · Rows & Tracks',
    title: 'Asymmetric tracks + gap',
    note: '1fr 2fr 1fr weights the middle track while increasing gap to 20px.',
    css: `.grid-stage {\n  display: grid;\n  grid-template-columns: 1fr 2fr 1fr;\n  grid-template-rows: 84px 72px;\n  gap: 20px;\n}`,
    style: { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gridTemplateRows: '84px 72px', gap: '20px' },
    spanFirst: false,
  },
];

const practiceCards = [
  {
    id: 'semantic',
    tag: 'HTML',
    title: 'Give the page structure',
    prompt: 'Which element marks the primary content landmark of a document?',
    answer: '<main>',
    options: ['<section>', '<main>', '<aside>'],
    feedback: '<main> identifies the central content for browsers and assistive technologies.',
  },
  {
    id: 'flex',
    tag: 'Flexbox',
    title: 'Distribute on the main axis',
    prompt: 'Push the first and last flex items to opposite ends of the row.',
    answer: 'justify-content: space-between;',
    options: ['align-items: stretch;', 'justify-content: space-between;', 'flex-wrap: wrap;'],
    feedback: 'justify-content controls free-space distribution along the main axis.',
  },
  {
    id: 'grid',
    tag: 'CSS Grid',
    title: 'Create equal grid tracks',
    prompt: 'Define three proportional columns that share remaining space.',
    answer: 'repeat(3, 1fr)',
    options: ['repeat(3, 1fr)', '100px 100px', 'flex: 1 1 33%'],
    feedback: 'fr tracks divide available grid space proportionally after gaps.',
  },
];

export function HomepageExperience({
  lessonsCount,
  favoritesCount,
  curriculum,
  allLessons,
  recentLessons,
  favoriteLessons,
  onNavigate,
  onSelectGroup,
  onSelectLesson,
  onSelectModule,
}: HomepageExperienceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const visualStoryRef = useRef<HTMLElement>(null);

  const [heroLayer, setHeroLayer] = useState<'html' | 'css' | 'js'>('css');
  const [conceptCategory, setConceptCategory] = useState<'All' | 'HTML' | 'CSS' | 'Flexbox' | 'Grid'>('All');
  const [conceptSearch, setConceptSearch] = useState('');
  const [visualEngine, setVisualEngine] = useState<'flexbox' | 'grid'>('flexbox');
  const [flexStep, setFlexStep] = useState(0);
  const [gridStep, setGridStep] = useState(0);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add(
        {
          motionOk: '(prefers-reduced-motion: no-preference)',
          desktopMotion: '(min-width: 960px) and (prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const { motionOk, desktopMotion } = context.conditions ?? {};

          if (motionOk) {
            gsap.to('.sc-hero-parallax', {
              y: -36,
              ease: 'none',
              scrollTrigger: {
                trigger: '.sc-hero',
                start: 'top top',
                end: 'bottom top',
                scrub: 0.6,
              },
            });

            gsap.fromTo(
              '.sc-final-parallax',
              { y: 20 },
              {
                y: -20,
                ease: 'none',
                scrollTrigger: {
                  trigger: '.sc-final',
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 0.7,
                },
              }
            );
          }

          if (desktopMotion && visualStoryRef.current) {
            ScrollTrigger.create({
              trigger: visualStoryRef.current,
              start: 'top 50%',
              end: 'bottom 50%',
              onUpdate: (self) => {
                const p = self.progress;
                setFlexStep(Math.min(flexSteps.length - 1, Math.floor(p * flexSteps.length)));
                setGridStep(Math.min(gridSteps.length - 1, Math.floor(p * gridSteps.length)));
              },
            });
          }
        }
      );
    }, root);

    return () => {
      ctx.revert();
      mm.revert();
    };
  }, []);

  const filteredConcepts = useMemo(() => {
    const q = conceptSearch.trim().toLowerCase();
    return allLessons
      .filter((item) => (conceptCategory === 'All' ? true : item.group === conceptCategory))
      .filter((item) =>
        q ? `${item.title} ${item.group} ${item.description ?? ''}`.toLowerCase().includes(q) : true
      )
      .slice(0, 6);
  }, [allLessons, conceptCategory, conceptSearch]);

  const currentFlex = flexSteps[flexStep];
  const currentGrid = gridSteps[gridStep];

  return (
    <MotionProvider>
      <div ref={rootRef} className="sc-homepage">
        {/* SECTION 01 — HERO (LIGHT) */}
        <section className="sc-section sc-light sc-hero" aria-label="Hero">
          <div className="sc-hero-grid-bg sc-hero-parallax" aria-hidden="true" />
          <div className="sc-hero-inner">
            <div className="sc-hero-copy">
              <motion.div
                className="eyebrow-line"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION_TIMING.standard, ease: MOTION_EASE }}
              >
                <Sparkles size={14} /> WEBCRAFT ACADEMY
              </motion.div>

              <h1 className="sc-hero-title">
                <WordReveal text="Don't just learn code. Make it come alive." accentFromWord={4} />
              </h1>

              <motion.p
                className="sc-hero-sub"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION_TIMING.standard, delay: 0.28, ease: MOTION_EASE }}
              >
                Explore concepts, experiment with code, and discover how the web really works.
              </motion.p>

              <motion.div
                className="welcome-actions"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION_TIMING.standard, delay: 0.36, ease: MOTION_EASE }}
              >
                <button className="primary-button" onClick={() => onNavigate('Learn')}>
                  Explore concepts <ArrowRight size={16} />
                </button>
                <button className="text-button" onClick={() => onNavigate('Playground')}>
                  Open playground <Code2 size={16} />
                </button>
              </motion.div>
            </div>

            <motion.div
              className="sc-hero-visual"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: MOTION_TIMING.reveal, delay: 0.18, ease: MOTION_EASE }}
            >
              <div className="sc-float-pills" aria-hidden="true">
                {(['html', 'css', 'js'] as const).map((layer, i) => (
                  <motion.span
                    key={layer}
                    className={`sc-float-pill ${layer}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: MOTION_TIMING.fast, delay: 0.22 + i * 0.06, ease: MOTION_EASE }}
                  >
                    {layer === 'html' ? '</> HTML' : layer === 'css' ? '{ } CSS' : 'JS'}
                  </motion.span>
                ))}
              </div>

              <div className="sc-stack-card">
                <div className="sc-stack-head">
                  <div className="sc-dots">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="sc-layer-tabs" role="tablist" aria-label="Code layer preview">
                    {(['html', 'css', 'js'] as const).map((layer) => (
                      <button
                        key={layer}
                        type="button"
                        role="tab"
                        aria-selected={heroLayer === layer}
                        className={heroLayer === layer ? 'active' : ''}
                        onClick={() => setHeroLayer(layer)}
                      >
                        {layer.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sc-stack-code">
                  {heroLayer === 'html' && (
                    <pre>
                      <code>
                        <span className="code-purple">&lt;main</span>{' '}
                        <span className="code-blue">class</span>=
                        <span className="code-green">"canvas"</span>
                        <span className="code-purple">&gt;</span>
                        {'\n  '}
                        <span className="code-purple">&lt;h1&gt;</span>Hello, web!
                        <span className="code-purple">&lt;/h1&gt;</span>
                        {'\n  '}
                        <span className="code-purple">&lt;button&gt;</span>Run
                        <span className="code-purple">&lt;/button&gt;</span>
                        {'\n'}
                        <span className="code-purple">&lt;/main&gt;</span>
                      </code>
                    </pre>
                  )}
                  {heroLayer === 'css' && (
                    <pre>
                      <code>
                        <span className="code-blue">.canvas</span> {'{\n  '}
                        <span className="code-purple">display</span>: flex;{'\n  '}
                        <span className="code-purple">justify-content</span>: space-between;{'\n  '}
                        <span className="code-purple">align-items</span>: center;{'\n}'}
                      </code>
                    </pre>
                  )}
                  {heroLayer === 'js' && (
                    <pre>
                      <code>
                        <span className="code-blue">button</span>.addEventListener(
                        <span className="code-green">'click'</span>, () =&gt; {'{\n  '}
                        card.<span className="code-purple">classList</span>.toggle(
                        <span className="code-green">'active'</span>);{'\n});'}
                      </code>
                    </pre>
                  )}
                </div>

                <div className={`sc-stack-preview layer-${heroLayer}`}>
                  <span className="sc-preview-pill">
                    {heroLayer === 'html'
                      ? 'DOM Structure'
                      : heroLayer === 'css'
                        ? 'Flex Layout Applied'
                        : 'Interactive State'}
                  </span>
                  <div className="sc-preview-demo">
                    <strong>Hello, web!</strong>
                    <span className="sc-preview-btn">Run</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.a
            href="#section-intro"
            className="sc-scroll-cue"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            <span>Scroll to explore</span>
            <ArrowDown size={14} />
          </motion.a>
        </section>

        {/* SECTION 02 — INTRODUCTION (DARK) */}
        <section id="section-intro" className="sc-section sc-dark sc-intro">
          <ScrollReveal className="sc-intro-head">
            <span className="section-kicker sc-kicker-dark">SECTION 02 · PHILOSOPHY</span>
            <h2>Your curiosity is your curriculum.</h2>
            <p>
              No rigid lockstep tracks. Open any topic, adjust live CSS rules in visual labs, and
              build intuition by seeing how the browser responds.
            </p>
          </ScrollReveal>

          <div className="sc-tech-grid">
            {techCards.map((item, idx) => (
              <motion.button
                key={item.tag}
                type="button"
                className="sc-tech-card"
                onClick={() => onNavigate(item.tab)}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: MOTION_TIMING.standard, delay: idx * 0.05, ease: MOTION_EASE }}
                whileHover={{ y: -3 }}
              >
                <span className="sc-tech-tag">{item.tag}</span>
                <strong>{item.title}</strong>
                <p>{item.desc}</p>
                <span className="sc-tech-link">
                  Open <ArrowRight size={13} />
                </span>
              </motion.button>
            ))}
          </div>

          <div className="sc-dark-stats">
            <div>
              <BookOpen size={17} />
              <strong>{lessonsCount}</strong>
              <span>Concepts</span>
            </div>
            <div>
              <MonitorPlay size={17} />
              <strong>5</strong>
              <span>Visual labs</span>
            </div>
            <div>
              <Trophy size={17} />
              <strong>{favoritesCount}</strong>
              <span>Saved</span>
            </div>
            <div>
              <Target size={17} />
              <strong>14</strong>
              <span>Challenges</span>
            </div>
          </div>
        </section>

        {/* SECTION 03 — CONCEPT EXPLORATION (LIGHT) */}
        <section className="sc-section sc-light sc-concepts">
          <ScrollReveal className="section-heading">
            <div>
              <span className="section-kicker">SECTION 03 · CONCEPT LIBRARY</span>
              <h2>Explore anything. Understand everything.</h2>
            </div>
            <button className="subtle-link" onClick={() => onNavigate('Learn')}>
              All {lessonsCount} concepts <ArrowRight size={15} />
            </button>
          </ScrollReveal>

          <div className="sc-filter-bar">
            <div className="sc-category-pills" role="tablist" aria-label="Filter concepts by category">
              {(['All', 'HTML', 'CSS', 'Flexbox', 'Grid'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={conceptCategory === cat}
                  className={conceptCategory === cat ? 'active' : ''}
                  onClick={() => setConceptCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <label className="sc-concept-search">
              <Search size={14} />
              <input
                value={conceptSearch}
                onChange={(e) => setConceptSearch(e.target.value)}
                placeholder="Filter concepts (e.g. grid, box, flex)..."
                aria-label="Filter concept library"
              />
            </label>
          </div>

          <AnimatePresence mode="popLayout">
            <motion.div layout className="sc-concept-cards">
              {filteredConcepts.map((item, idx) => (
                <motion.button
                  layout
                  key={item.id}
                  type="button"
                  className="sc-concept-card"
                  onClick={() => onSelectLesson(item.id)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.24, delay: idx * 0.03, ease: MOTION_EASE }}
                  whileHover={{ y: -3 }}
                >
                  <span className="sc-concept-group">{item.group}</span>
                  <strong>{item.title}</strong>
                  <p>{item.description ?? `Explore ${item.title.toLowerCase()} with live examples.`}</p>
                  <span className="sc-concept-go">
                    Read lesson <ArrowRight size={13} />
                  </span>
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>

          {filteredConcepts.length === 0 && (
            <p className="sc-empty-filter">
              No concepts match “{conceptSearch}”. Try clearing the filter or browsing{' '}
              <button type="button" className="subtle-link" onClick={() => onSelectGroup('CSS')}>
                all lessons
              </button>.
            </p>
          )}

          <div className="section-block">
            <div className="section-heading">
              <div>
                <span className="section-kicker">CURRICULUM MODULES</span>
                <h3>Start from any of the 14 modules</h3>
              </div>
            </div>
            <div className="module-grid">
              {curriculum.slice(0, 6).map((mod) => (
                <button key={mod.id} className="module-card" onClick={() => onSelectModule(mod)}>
                  <span>{mod.title}</span>
                  <small>{mod.topics.length} concepts · open in any order</small>
                </button>
              ))}
            </div>
          </div>

          {recentLessons.length > 0 && (
            <div className="section-block">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">PICK UP YOUR EXPLORATION</span>
                  <h3>Recently explored</h3>
                </div>
              </div>
              <div className="module-grid">
                {recentLessons.map((item) => (
                  <button key={item.id} className="module-card" onClick={() => onSelectLesson(item.id)}>
                    <span>{item.title}</span>
                    <small>{item.group} · explore again</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {favoriteLessons.length > 0 && (
            <div className="section-block">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">SAVED FOR LATER</span>
                  <h3>Your favorite concepts</h3>
                </div>
              </div>
              <div className="module-grid">
                {favoriteLessons.map((item) => (
                  <button key={item.id} className="module-card" onClick={() => onSelectLesson(item.id)}>
                    <span>{item.title}</span>
                    <small>{item.group} · saved</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 04 — VISUAL LEARNING (DARK) */}
        <section ref={visualStoryRef} className="sc-section sc-dark sc-visual-learning">
          <div className="sc-visual-head">
            <div>
              <span className="section-kicker sc-kicker-dark">SECTION 04 · VISUAL LABS</span>
              <h2>See the code. Understand the behaviour.</h2>
            </div>
            <div className="sc-engine-switch" role="tablist" aria-label="Choose layout engine">
              <button
                type="button"
                role="tab"
                aria-selected={visualEngine === 'flexbox'}
                className={visualEngine === 'flexbox' ? 'active' : ''}
                onClick={() => setVisualEngine('flexbox')}
              >
                <Braces size={14} /> Flexbox
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visualEngine === 'grid'}
                className={visualEngine === 'grid' ? 'active' : ''}
                onClick={() => setVisualEngine('grid')}
              >
                <MonitorPlay size={14} /> CSS Grid
              </button>
            </div>
          </div>

          {visualEngine === 'flexbox' ? (
            <div className="sc-visual-body">
              <div className="sc-dark-pills" role="tablist" aria-label="Flexbox demonstration steps">
                {flexSteps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={flexStep === idx}
                    className={flexStep === idx ? 'active' : ''}
                    onClick={() => setFlexStep(idx)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="sc-story-grid">
                <div className="sc-dark-stage-card">
                  <div className="sc-stage-bar dark">
                    <span>LIVE FLEX CONTAINER</span>
                    <span>{currentFlex.title}</span>
                  </div>
                  <div className="sc-dark-stage" style={currentFlex.style}>
                    {['01', '02', '03', '04'].map((n, idx) => (
                      <motion.div
                        layout
                        transition={{ duration: MOTION_TIMING.standard, ease: MOTION_EASE }}
                        key={n}
                        className={`sc-dark-item ${idx === 0 ? 'featured' : ''}`}
                        style={flexStep === 3 ? { flex: '0 1 110px' } : undefined}
                      >
                        <strong>{n}</strong>
                        <small>{idx === 0 ? 'Featured' : 'Flex item'}</small>
                      </motion.div>
                    ))}
                  </div>
                  <p className="sc-dark-caption">{currentFlex.note}</p>
                </div>

                <div className="sc-story-code-card">
                  <div className="sc-stage-bar dark">
                    <span>APPLIED CSS</span>
                    <button
                      type="button"
                      className="sc-inline-lab-btn"
                      onClick={() => onNavigate('Flexbox lab')}
                    >
                      Open Flexbox lab <ArrowRight size={12} />
                    </button>
                  </div>
                  <pre>
                    <code>{currentFlex.css}</code>
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="sc-visual-body">
              <div className="sc-dark-pills" role="tablist" aria-label="Grid demonstration steps">
                {gridSteps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={gridStep === idx}
                    className={gridStep === idx ? 'active' : ''}
                    onClick={() => setGridStep(idx)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="sc-story-grid">
                <div className="sc-dark-stage-card">
                  <div className="sc-stage-bar dark">
                    <span>LIVE GRID CONTAINER</span>
                    <span>{currentGrid.title}</span>
                  </div>
                  <div className="sc-dark-stage" style={currentGrid.style}>
                    {['01', '02', '03', '04', '05'].map((n, idx) => (
                      <motion.div
                        layout
                        transition={{ duration: MOTION_TIMING.standard, ease: MOTION_EASE }}
                        key={n}
                        className={`sc-dark-item ${idx === 0 ? 'featured' : ''}`}
                        style={idx === 0 && currentGrid.spanFirst ? { gridColumn: 'span 2' } : undefined}
                      >
                        <strong>{n}</strong>
                        <small>{idx === 0 ? 'Featured' : 'Grid cell'}</small>
                      </motion.div>
                    ))}
                  </div>
                  <p className="sc-dark-caption">{currentGrid.note}</p>
                </div>

                <div className="sc-story-code-card">
                  <div className="sc-stage-bar dark">
                    <span>APPLIED CSS</span>
                    <button
                      type="button"
                      className="sc-inline-lab-btn"
                      onClick={() => onNavigate('Grid lab')}
                    >
                      Open Grid lab <ArrowRight size={12} />
                    </button>
                  </div>
                  <pre>
                    <code>{currentGrid.css}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 05 — PLAYGROUND (LIGHT) */}
        <section className="sc-section sc-light sc-playground-wrap">
          <ScrollReveal className="sc-pg-intro">
            <span className="section-kicker">SECTION 05 · LIVE WORKBENCH</span>
            <h2>Your ideas deserve a playground.</h2>
            <p>
              Edit real HTML and CSS below, switch starter templates, inspect syntax errors, or open
              the full-screen workbench.
            </p>
          </ScrollReveal>
          <PlaygroundStudio />
        </section>

        {/* SECTION 06 — PRACTICE STUDIO (DARK) */}
        <section className="sc-section sc-dark sc-practice-story">
          <ScrollReveal className="sc-visual-head">
            <div>
              <span className="section-kicker sc-kicker-dark">SECTION 06 · PRACTICE STUDIO</span>
              <h2>Learn by building. Improve by experimenting.</h2>
            </div>
            <button className="primary-button" onClick={() => onNavigate('Practice')}>
              Open all 14 challenges <ArrowRight size={15} />
            </button>
          </ScrollReveal>

          <div className="sc-practice-grid">
            {practiceCards.map((card, index) => {
              const chosen = practiceAnswers[card.id];
              const isCorrect = chosen === card.answer;
              return (
                <motion.article
                  key={card.id}
                  className="sc-dark-practice-card"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: MOTION_TIMING.standard, delay: index * 0.07, ease: MOTION_EASE }}
                >
                  <span className="sc-tech-tag">{card.tag}</span>
                  <h3>{card.title}</h3>
                  <p>{card.prompt}</p>
                  <div className="sc-dark-options">
                    {card.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={
                          chosen === opt ? (isCorrect ? 'correct' : 'wrong') : ''
                        }
                        onClick={() =>
                          setPracticeAnswers((prev) => ({ ...prev, [card.id]: opt }))
                        }
                      >
                        <code>{opt}</code>
                      </button>
                    ))}
                  </div>
                  <AnimatePresence mode="wait">
                    {chosen && (
                      <motion.div
                        key={chosen}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`sc-mini-feedback ${isCorrect ? 'correct' : 'wrong'}`}
                      >
                        {isCorrect ? <Check size={14} /> : <X size={14} />}
                        <span>{isCorrect ? card.feedback : 'Not quite — try another option.'}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* SECTION 07 — FINAL CTA (LIGHT) */}
        <section className="sc-section sc-light sc-final">
          <div className="sc-final-parallax" aria-hidden="true" />
          <ScrollReveal className="sc-final-content">
            <span className="section-kicker">SECTION 07 · START BUILDING</span>
            <h2>Your next idea starts here.</h2>
            <p>
              Jump into any of the {lessonsCount} concepts, experiment in the 5 visual labs, or test
              your skills in Practice Studio.
            </p>
            <div className="sc-final-actions">
              <button className="primary-button" onClick={() => onNavigate('Learn')}>
                Browse {lessonsCount} concepts <ArrowRight size={16} />
              </button>
              <button className="reset-button" onClick={() => onNavigate('Playground')}>
                <Compass size={15} /> Open Playground
              </button>
            </div>
          </ScrollReveal>
        </section>
      </div>
    </MotionProvider>
  );
}
