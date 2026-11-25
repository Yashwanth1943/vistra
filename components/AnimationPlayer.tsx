'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';

export type AnimationStep = { title: string; caption: string; code?: string };

export function AnimationPlayer({ title, steps, renderStage, onStepChange }: {
  title: string;
  steps: AnimationStep[];
  renderStage: (step: number) => ReactNode;
  onStepChange?: (step: number) => void;
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const current = steps[step];
  const goTo = (next: number) => {
    const safeStep = Math.max(0, Math.min(steps.length - 1, next));
    setStep(safeStep);
    onStepChange?.(safeStep);
    if (safeStep === steps.length - 1) setPlaying(false);
  };

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => { if (reducedMotion) setPlaying(false); }, [reducedMotion]);

  useEffect(() => {
    if (!playing || reducedMotion || steps.length < 2) return;
    const timer = window.setTimeout(() => {
      if (step >= steps.length - 1) setPlaying(false);
      else goTo(step + 1);
    }, 2500 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, step, speed, steps.length, reducedMotion]);

  return <section className="animation-player" aria-label={title}>
    <div className="animation-player-head"><div><span className="section-kicker">GUIDED DEMONSTRATION</span><h2>{title}</h2></div><span className="animation-step-count">Step {step + 1} of {steps.length}</span></div>
    <div className="animation-stage" aria-live="polite">{renderStage(step)}</div>
    <div className="animation-caption" aria-live="polite"><strong>{current.title}</strong><span>{current.caption}</span></div>
    {current.code && <pre className="animation-code"><code>{current.code}</code></pre>}
    <div className="animation-controls">
      <button type="button" aria-label="Reset demonstration" onClick={() => { setPlaying(false); goTo(0); }}><RotateCcw size={14}/><span>Reset</span></button>
      <button type="button" aria-label="Previous step" disabled={step === 0} onClick={() => goTo(step - 1)}><SkipBack size={14}/><span>Previous</span></button>
      <button type="button" className="animation-play" aria-label={reducedMotion ? 'Advance one step' : playing ? 'Pause demonstration' : 'Play demonstration'} onClick={() => { if (reducedMotion) { goTo(step === steps.length - 1 ? 0 : step + 1); setPlaying(false); return; } if (step === steps.length - 1) goTo(0); setPlaying(value => !value); }}>{playing && !reducedMotion ? <Pause size={14}/> : <Play size={14}/>}<span>{reducedMotion ? 'Next step' : playing ? 'Pause' : 'Play'}</span></button>
      <button type="button" aria-label="Next step" disabled={step === steps.length - 1} onClick={() => goTo(step + 1)}><span>Next</span><SkipForward size={14}/></button>
      <label className="animation-speed">Speed<select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label>
      <progress aria-label="Demonstration progress" max={steps.length - 1 || 1} value={step}/>
      {reducedMotion && <span className="animation-motion-note">Reduced motion is on · Play advances one step.</span>}
    </div>
  </section>;
}
