'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, Heart, Sparkles } from 'lucide-react';
import { explainConcept, type ConceptSource } from '../app/concept-content';
import { curriculum } from '../app/curriculum';
import { ConceptDemonstration } from './ConceptDemonstrations';

export function ConceptExperience({ lesson, saved, onToggleFavorite, onOpenExample, onExplore, onPractice }:{lesson:ConceptSource;saved:boolean;onToggleFavorite:()=>void;onOpenExample:(html:string,css:string,title:string)=>void;onExplore:(title:string)=>void;onPractice:()=>void}) {
  const content=useMemo(()=>explainConcept(lesson,curriculum),[lesson]);
  const [revealed,setRevealed]=useState(false);const [answer,setAnswer]=useState('');const [copied,setCopied]=useState(false);
  const copiedTimer=useRef<number|null>(null);
  useEffect(()=>()=>{if(copiedTimer.current!==null)window.clearTimeout(copiedTimer.current);},[]);
  const code=content.example;
  const copy=async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);if(copiedTimer.current!==null)window.clearTimeout(copiedTimer.current);copiedTimer.current=window.setTimeout(()=>{setCopied(false);copiedTimer.current=null;},1200);}catch{setCopied(false);}};
  return <article className="concept-experience"><div className="concept-meta"><span>{lesson.group}</span><span>{lesson.level??'Explore'}</span><span>{lesson.time??'Self-paced'}</span></div><div className="concept-title-row"><div><h1>{lesson.title}</h1><p>{content.introduction}</p></div><button className={`favorite-button ${saved?'saved':''}`} onClick={onToggleFavorite} aria-pressed={saved}><Heart size={15}/>{saved?'Saved':'Save concept'}</button></div>
    <section className="concept-section intro-panel"><span className="section-kicker">IN A SENTENCE</span><p className="concept-definition">{content.definition}</p><div className="concept-why"><strong>Why it matters</strong><p>{content.importance}</p></div></section>
    <ConceptDemonstration title={lesson.title} group={lesson.group}/>
    <section className="concept-section"><div className="concept-section-heading"><span>01</span><h2>How it works</h2></div><p>{content.mechanics}</p></section>
    <section className="concept-section"><div className="concept-section-heading"><span>02</span><h2>Syntax and example</h2></div><div className="syntax-reference"><span>SYNTAX</span><pre><code>{content.syntax}</code></pre></div><div className="code-output-card"><div><span>STARTER CODE</span><button onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/ >}{copied?'Copied':'Copy code'}</button></div><pre><code>{code}</code></pre></div><p className="expected-result"><strong>What to look for</strong>{content.visualResult}</p><div className="concept-diagram" aria-label="Illustration of a web concept"><div className="diagram-label">BROWSER VIEW</div><div className="diagram-window"><i/><i/><i/><div><b>{lesson.title}</b><span>{content.visualResult}</span></div></div></div><button className="text-button" onClick={()=>onOpenExample(content.playground.html,content.playground.css,lesson.title)}>Open this example in the playground <ArrowRight size={14}/></button></section>
    <section className="concept-section experiment-panel"><div className="concept-section-heading"><span>03</span><h2>Try an experiment</h2></div><p>{content.experiment}</p><button className="primary-button" onClick={()=>onExplore(lesson.group==='Flexbox'?'Flexbox lab':lesson.group==='Grid'?'Grid lab':lesson.title.toLowerCase().includes('box')?'Box model':lesson.group==='Responsive'?'Responsive':lesson.group==='Positioning'?'Positioning':'Playground')}>Open a related experiment <ArrowRight size={15}/></button></section>
    <section className="concept-section"><div className="concept-section-heading"><span>04</span><h2>Common mistakes</h2></div><ul>{content.commonMistakes.map(item=><li key={item}>{item}</li>)}</ul></section>
    <section className="concept-section"><div className="concept-section-heading"><span>05</span><h2>Where you’ll use it</h2></div><p>{content.applications}</p></section>
    <section className="concept-section related-section"><div className="concept-section-heading"><span>06</span><h2>Related concepts</h2></div><div className="related-links">{content.related.map(title=><button key={title} onClick={()=>onExplore(title)}>{title}<ArrowRight size={13}/></button>)}</div></section>
    <section className="concept-section knowledge-check"><div className="concept-section-heading"><Sparkles size={15}/><h2>Quick knowledge check</h2></div><p>{content.question}</p><div className="knowledge-actions"><input aria-label="Your answer" placeholder="Type your answer, then reveal" value={answer} onChange={event=>{setAnswer(event.target.value);setRevealed(false)}}/><button className="primary-button" onClick={()=>setRevealed(true)} disabled={!answer.trim()}>Reveal answer</button></div>{revealed&&<div className="answer-reveal"><strong>Answer</strong><p>{content.answer}</p></div>}</section>
    <footer className="concept-footer"><span>Explore at your own pace. No prerequisites.</span><button onClick={onPractice}>Try a related challenge <ArrowRight size={14}/></button></footer>
  </article>;
}
