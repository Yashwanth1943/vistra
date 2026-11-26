'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, BookOpen, Braces, Check, ChevronDown, ChevronRight, CircleHelp, Clock, Code2, FolderKanban, LayoutDashboard, Menu, MessageSquare, MonitorPlay, MousePointerClick, Search, Sliders, Sparkles, Wand2, X, Zap, Box, PanelsTopLeft, Smartphone, Hammer } from 'lucide-react';
import { curriculum, topicGroup } from './curriculum';
import { trackLabVisit } from './student-store';
const VisualizerSuite=dynamic(()=>import('../components/VisualizerSuite').then(module=>module.VisualizerSuite),{loading:()=> <p role="status">Loading visualizer…</p>});
const PracticeStudio=dynamic(()=>import('../components/PracticeStudio').then(module=>module.PracticeStudio),{loading:()=> <p role="status">Loading practice studio…</p>});
const PlaygroundStudio=dynamic(()=>import('../components/PlaygroundStudio').then(module=>module.PlaygroundStudio),{loading:()=> <p role="status">Loading playground…</p>});
const ConceptExperience=dynamic(()=>import('../components/ConceptExperience').then(module=>module.ConceptExperience),{loading:()=> <p role="status">Loading concept…</p>});
const HomepageExperience=dynamic(()=>import('../components/HomepageExperience').then(module=>module.HomepageExperience),{loading:()=> <p role="status">Loading overview…</p>});
const ComparisonLibrary=dynamic(()=>import('../components/LearningTools').then(module=>module.ComparisonLibrary));
const PredictDiscover=dynamic(()=>import('../components/LearningTools').then(module=>module.PredictDiscover));
const BuildExampleLibrary=dynamic(()=>import('../components/LearningTools').then(module=>module.BuildExampleLibrary));
const HtmlPlaygroundLab=dynamic(()=>import('../components/ExploreLabs').then(module=>module.HtmlPlaygroundLab),{loading:()=> <p role="status">Loading HTML Playground…</p>});
const CssPropertiesExplorer=dynamic(()=>import('../components/ExploreLabs').then(module=>module.CssPropertiesExplorer),{loading:()=> <p role="status">Loading CSS Playground…</p>});
const TransformAnimationLab=dynamic(()=>import('../components/ExploreLabs').then(module=>module.TransformAnimationLab),{loading:()=> <p role="status">Loading Transform Lab…</p>});
const CssVisualDebugger=dynamic(()=>import('../components/CssVisualDebugger').then(module=>module.CssVisualDebugger),{loading:()=> <p role="status">Loading Visual Debugger…</p>});
const StudentWorkspace=dynamic(()=>import('../components/StudentWorkspace').then(module=>module.StudentWorkspace),{loading:()=> <p role="status">Loading workspace…</p>});
const FeedbackModal=dynamic(()=>import('../components/FeedbackWidget').then(module=>module.FeedbackModal));
import { comparisons, buildExamples, type BuildExample } from './learning-tools';

type Lesson = { id: string; title: string; group: string; time: string; level: string; description: string; concept: string; example: string; takeaway: string };
const featuredLessons: Lesson[] = [
  { id:'semantic', title:'Semantic HTML', group:'HTML', time:'12 min', level:'Foundations', description:'Give your page meaningful structure with elements that describe what each section does.', concept:'Semantic elements tell browsers, assistive technologies and other developers what a part of your page represents. Use them instead of choosing every element just for its appearance.', example:'<header>\n  <h1>My portfolio</h1>\n</header>\n<main>\n  <article>\n    <h2>About me</h2>\n    <p>I build for the web.</p>\n  </article>\n</main>\n<footer>Made with care</footer>', takeaway:'Choose an element for its meaning first. CSS controls how it looks.' },
  { id:'forms', title:'Forms & inputs', group:'HTML', time:'15 min', level:'Foundations', description:'Collect information with labels, inputs, buttons and helpful form structure.', concept:'A form groups controls that collect user input. Connect each label to its input with the for and id attributes so the form is easier to use with a mouse, keyboard or screen reader.', example:'<form>\n  <label for="email">Email</label>\n  <input id="email" type="email"\n    placeholder="you@example.com" />\n  <button type="submit">Join</button>\n</form>', takeaway:'Every input should have a clear, programmatically connected label.' },
  { id:'box-model', title:'The CSS box model', group:'CSS', time:'10 min', level:'Foundations', description:'Understand content, padding, border and margin — the building blocks of spacing.', concept:'Every element is a rectangular box. Content sits inside padding, then border, then margin outside. With box-sizing: border-box, declared width includes padding and border.', example:'.card {\n  width: 280px;\n  padding: 24px;\n  border: 2px solid #d8dce5;\n  margin: 16px;\n  box-sizing: border-box;\n}', takeaway:'Use border-box to make sizing more predictable.' },
  { id:'flex-direction', title:'Flex direction', group:'Flexbox', time:'12 min', level:'Layout', description:'Choose the main axis and arrange items in a row or a column.', concept:'Flexbox is a one-dimensional layout system. flex-direction decides the main axis: row flows horizontally and column flows vertically. The cross axis is perpendicular to the main axis.', example:'.container {\n  display: flex;\n  flex-direction: row;\n  gap: 12px;\n}', takeaway:'The main axis follows flex-direction; the cross axis runs across it.' },
  { id:'justify', title:'Justify content', group:'Flexbox', time:'10 min', level:'Layout', description:'Distribute free space along the main axis.', concept:'justify-content positions and distributes flex items along the main axis. Its result changes when you change flex-direction because the main axis changes too.', example:'.container {\n  display: flex;\n  justify-content: space-between;\n}', takeaway:'Think “main axis” rather than always thinking horizontal.' },
  { id:'align', title:'Align items', group:'Flexbox', time:'10 min', level:'Layout', description:'Align items across the cross axis of a flex container.', concept:'align-items controls how items line up on the cross axis. For a row, that is usually vertical. For a column, that is usually horizontal.', example:'.container {\n  display: flex;\n  align-items: center;\n  min-height: 180px;\n}', takeaway:'justify-content = main axis. align-items = cross axis.' },
  { id:'grow-shrink', title:'Grow, shrink & basis', group:'Flexbox', time:'16 min', level:'Layout', description:'Control how flex items share available space and respond when space is tight.', concept:'flex-grow distributes positive free space. flex-shrink controls how items reduce when there is not enough room. flex-basis sets the starting size before free space is distributed.', example:'.item { flex: 1 1 180px; }\n.featured { flex-grow: 2; }', takeaway:'The shorthand is flex: grow shrink basis.' },
  { id:'grid-columns', title:'Grid columns & rows', group:'Grid', time:'14 min', level:'Layout', description:'Create two-dimensional layouts with explicit columns and rows.', concept:'CSS Grid lets you define rows and columns together. The fr unit shares available space proportionally. repeat() keeps repeated tracks concise.', example:'.grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 16px;\n}', takeaway:'Use Grid when you need control over rows and columns together.' },
  { id:'responsive-grid', title:'Responsive grid', group:'Responsive', time:'12 min', level:'Responsive', description:'Build layouts that adapt to available width without hard-coding every breakpoint.', concept:'auto-fit with minmax() lets Grid create as many columns as comfortably fit. Each column can shrink to a minimum and grow to fill remaining space.', example:'.cards {\n  display: grid;\n  grid-template-columns:\n    repeat(auto-fit, minmax(220px, 1fr));\n  gap: 20px;\n}', takeaway:'minmax() + auto-fit is a powerful starting point for responsive card grids.' },
];
const lessons: Lesson[] = curriculum.flatMap(module => module.topics.map(title => {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const featured = featuredLessons.find(item => item.id === id || item.title.toLowerCase() === title.toLowerCase());
  return featured ? { ...featured, group: topicGroup(module.id) } : { id: `${module.id}-${id}`, title, group: topicGroup(module.id), time: 'Explore', level: module.title.split('·').slice(1).join('·').trim(), description: `Explore ${title.toLowerCase()} and see how it shapes a real web page.`, concept: `${title} is one of the building blocks used to create and style websites. Try the example, then change a value in the playground to observe what changes.`, example: topicGroup(module.id) === 'HTML' ? `<section>\n  <h2>${title}</h2>\n  <p>Build something for the web.</p>\n</section>` : `.example {\n  ${title.includes('gap') ? 'gap: 16px;' : title.toLowerCase().replace(/ /g, '-') + ': initial;'}\n}`, takeaway: `Change one value at a time to understand how ${title.toLowerCase()} affects the result.` };
}));
const normalizeSavedIds = (values: unknown) => Array.isArray(values) ? [...new Set(values.flatMap(value => {
  if (typeof value !== 'string') return [];
  const exact = lessons.find(item => item.id === value);
  if (exact) return [exact.id];
  const normalizedTitle = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const normalizedValue = normalizedTitle(value);
  const previousId = lessons.find(item => normalizedTitle(item.title) === normalizedValue || item.id.endsWith(`-${normalizedValue}`));
  return previousId ? [previousId.id] : [];
}))] : [];

function persistBrowserState(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Storage may be disabled or full; keep the in-memory session usable. */}}

export default function Home() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [playgroundStarter,setPlaygroundStarter]=useState<BuildExample|undefined>(undefined);
  const [activeLesson, setActiveLesson] = useState(lessons[0].id);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [completed] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const topbarSearchRef = useRef<HTMLInputElement>(null);
  const learnSearchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { try { const savedFavorites = normalizeSavedIds(JSON.parse(localStorage.getItem('webcraft:favorites') || '[]')); const savedRecent = normalizeSavedIds(JSON.parse(localStorage.getItem('webcraft:recent') || '[]')).slice(0, 6); setFavorites(savedFavorites); setRecent(savedRecent); persistBrowserState('webcraft:favorites',savedFavorites); persistBrowserState('webcraft:recent',savedRecent); } catch { /* Ignore invalid saved browser data. */ } }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const target = activeTab === 'Learn' && learnSearchRef.current ? learnSearchRef.current : topbarSearchRef.current;
        if (target) {
          target.focus();
          target.select();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab]);
  const lesson = lessons.find(l => l.id === activeLesson) ?? lessons[0];
  const filteredLessons = useMemo(() => lessons.filter(l => `${l.title} ${l.group} ${l.description}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const exploreNav = [
    {name:'Overview',label:'Overview',icon:LayoutDashboard},
    {name:'HTML Playground',label:'HTML Playground',icon:Code2},
    {name:'CSS Playground',label:'CSS Playground',icon:Sliders},
  ];
  const labNav = [
    {name:'Flexbox lab',label:'Flexbox',icon:Braces},
    {name:'Grid lab',label:'Grid',icon:MonitorPlay},
    {name:'Positioning',label:'Positioning',icon:PanelsTopLeft},
    {name:'Box model',label:'Box Model',icon:Box},
    {name:'Responsive',label:'Responsive Design',icon:Smartphone},
    {name:'Transform & Animation Lab',label:'Transform & Animation',icon:Wand2},
  ];
  const toolsNav = [
    {name:'Playground',label:'Code Playground',icon:Code2},
    {name:'Visual Debugger',label:'CSS Visual Debugger',icon:MousePointerClick},
    {name:'Learn',label:'Concept Reference',icon:BookOpen},
  ];
  const workspaceNav = [
    {name:'Saved Experiments',label:'Saved Experiments',icon:FolderKanban},
    {name:'Recent Activity',label:'Recent Activity',icon:Clock},
  ];
  const hiddenNav = [{name:'Compare',label:'Compare',icon:PanelsTopLeft},{name:'Predict',label:'Predict',icon:Sparkles},{name:'Examples',label:'Examples',icon:Hammer},{name:'Build & Experiment',label:'Build & Experiment',icon:Hammer},{name:'Practice',label:'Practice Studio',icon:Sparkles}];
  useEffect(() => {
    trackLabVisit(activeTab);
  }, [activeTab]);
  const selectLesson = (id:string) => { setActiveLesson(id); setActiveTab('Learn'); setShowMobileNav(false); setRecent(previous => { const next = [id, ...previous.filter(item => item !== id)].slice(0, 6); persistBrowserState('webcraft:recent',next); return next; }); };
  const toggleFavorite = (id:string) => setFavorites(previous => { const next = previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]; persistBrowserState('webcraft:favorites',next); return next; });

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <aside className={`sidebar ${showMobileNav?'sidebar-open':''}`} aria-label="Primary navigation">
      <div className="sidebar-top">
        <div className="brand"><div className="brand-mark"><Code2 size={16}/></div><span>webcraft<span className="brand-light">academy</span></span><button className="mobile-close" onClick={()=>setShowMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
        <div className="sidebar-section-label">Explore</div>
        <nav className="side-nav" aria-label="Explore">
          {exploreNav.map(item => <button key={item.name} aria-current={activeTab===item.name?'page':undefined} className={`nav-item ${activeTab===item.name?'active':''}`} onClick={()=>{setActiveTab(item.name);setShowMobileNav(false)}}><item.icon size={15}/><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-section-label">CSS Visual Labs</div>
        <nav className="side-nav" aria-label="CSS Visual Labs">
          {labNav.map(item => <button key={item.name} aria-current={activeTab===item.name?'page':undefined} className={`nav-item ${activeTab===item.name?'active':''}`} onClick={()=>{setActiveTab(item.name);setShowMobileNav(false)}}><item.icon size={15}/><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-section-label">Developer Tools</div>
        <nav className="side-nav" aria-label="Developer Tools">
          {toolsNav.map(item => <button key={item.name} aria-current={activeTab===item.name?'page':undefined} className={`nav-item ${activeTab===item.name?'active':''}`} onClick={()=>{setActiveTab(item.name);setShowMobileNav(false)}}><item.icon size={15}/><span>{item.label}</span>{item.name==='Learn'&&<span className="nav-count">{lessons.length}</span>}</button>)}
        </nav>
        <div className="sidebar-section-label">My Workspace</div>
        <nav className="side-nav" aria-label="My Workspace">
          {workspaceNav.map(item => <button key={item.name} aria-current={activeTab===item.name?'page':undefined} className={`nav-item ${activeTab===item.name?'active':''}`} onClick={()=>{setActiveTab(item.name);setShowMobileNav(false)}}><item.icon size={15}/><span>{item.label}</span></button>)}
        </nav>
        {hiddenNav.map(item => <button key={item.name} style={{display:'none'}} className={`nav-item ${activeTab===item.name?'active':''}`} onClick={()=>{setActiveTab(item.name);setShowMobileNav(false)}}><item.icon size={15}/><span>{item.name}</span></button>)}
      </div>
      <div className="sidebar-bottom"><div className="mentor-avatar">W</div><div className="sidebar-bottom-info"><strong>Learning space</strong><span>Beginner track</span></div><ChevronDown size={14} className="muted-icon"/></div>
    </aside>
    {showMobileNav&&<button className="scrim" onClick={()=>setShowMobileNav(false)} aria-label="Close navigation"/>}
    <main id="main-content" tabIndex={-1} className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" onClick={()=>setShowMobileNav(true)} aria-label="Open menu"><Menu size={20}/></button><button className="breadcrumb" onClick={()=>setActiveTab('Overview')}>Explore</button><label className="global-search"><Search size={14}/><input ref={topbarSearchRef} value={query} onFocus={()=>setActiveTab('Learn')} onChange={e=>{setQuery(e.target.value);setActiveTab('Learn')}} placeholder="Search concepts" aria-label="Search concepts"/><kbd>⌘ K</kbd></label><ChevronRight size={14}/><span className="breadcrumb-current">{activeTab}</span></div><div className="topbar-right"><button type="button" className="reset-button" onClick={()=>setShowFeedback(true)} aria-label="Send lab feedback"><MessageSquare size={13}/><span>Feedback</span></button><div className="streak"><Zap size={15}/><span>Keep learning</span></div><button className="help-button" onClick={()=>setShowHelp(true)} title="Keyboard shortcuts and help" aria-label="Keyboard shortcuts and help"><CircleHelp size={18}/></button><div className="user-avatar" aria-hidden="true">Y</div></div></header>
      <div className="content-wrap">
        {activeTab==='HTML Playground'?<HtmlPlaygroundLab onOpenCodePlayground={()=>setActiveTab('Playground')}/>:null}
        {activeTab==='CSS Playground'?<CssPropertiesExplorer/>:null}
        {activeTab==='Visual Debugger'?<CssVisualDebugger/>:null}
        {(activeTab==='Saved Experiments'||activeTab==='Recent Activity'||activeTab==='My Workspace')?<StudentWorkspace initialSection={activeTab==='Recent Activity'?'recent':'saved'} recentConcepts={recent.map(id=>lessons.find(item=>item.id===id)).filter((item):item is Lesson=>Boolean(item)).map(({id,title,group})=>({id,title,group}))} favoriteConcepts={favorites.map(id=>lessons.find(item=>item.id===id)).filter((item):item is Lesson=>Boolean(item)).map(({id,title,group})=>({id,title,group}))} onNavigate={tab=>setActiveTab(tab)} onSelectConcept={id=>selectLesson(id)} onOpenFeedback={()=>setShowFeedback(true)}/>:null}
        {activeTab==='Transform & Animation Lab'?<TransformAnimationLab/>:null}
        {activeTab==='Playground'?<PlaygroundStudio key={playgroundStarter?.id??'default'} starter={playgroundStarter}/>:null}
        {activeTab==='Compare'?<ComparisonLibrary/>:null}
        {activeTab==='Predict'?<PredictDiscover/>:null}
        {activeTab==='Examples'?<BuildExampleLibrary onOpen={example=>{setPlaygroundStarter(example);setActiveTab('Playground')}}/>:null}
        {activeTab==='Practice'?<PracticeStudio/>:null}
        {(['Flexbox lab','Grid lab','Box model','Positioning','Responsive'].includes(activeTab))&&<VisualizerSuite tab={activeTab as 'Flexbox lab'|'Grid lab'|'Box model'|'Positioning'|'Responsive'}/>}
        {activeTab==='Overview'&&<HomepageExperience
          lessonsCount={lessons.length}
          favoritesCount={favorites.length}
          curriculum={curriculum}
          allLessons={lessons.map(({id,title,group,description})=>({id,title,group,description}))}
          recentLessons={recent.map(id=>lessons.find(item=>item.id===id)).filter((item):item is Lesson=>Boolean(item)).map(({id,title,group})=>({id,title,group}))}
          favoriteLessons={favorites.map(id=>lessons.find(item=>item.id===id)).filter((item):item is Lesson=>Boolean(item)).map(({id,title,group})=>({id,title,group}))}
          onNavigate={tab=>setActiveTab(tab)}
          onSelectGroup={group=>{setActiveTab('Learn');setQuery(group)}}
          onSelectLesson={id=>selectLesson(id)}
          onSelectModule={mod=>selectLesson(lessons.find(item=>item.title===mod.topics[0])?.id ?? lessons[0].id)}
        />}
        {activeTab==='Learn'&&<section className="learning-layout"><div className="lesson-list-panel"><div className="eyebrow-line">THE LEARNING LIBRARY</div><h1>Learn by layers.</h1><p className="panel-intro">Small, focused lessons. Clear explanations. Code you can try.</p><div className="search-box"><Search size={16}/><input ref={learnSearchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search lessons..."/><kbd>⌘ K</kbd></div><div className="learn-group-pills" role="tablist" aria-label="Filter library groups">{['All','HTML','CSS','Flexbox','Grid','Positioning','Responsive','Tailwind'].map(g=><button key={g} type="button" role="tab" aria-selected={groupFilter===g} className={groupFilter===g?'active':''} onClick={()=>setGroupFilter(g)}>{g}</button>)}</div>{query.trim()&&<div className="search-discoveries">{comparisons.filter(item=>item.title.toLowerCase().includes(query.toLowerCase())).slice(0,3).map(item=><button key={item.id} onClick={()=>setActiveTab("Compare")}>Compare: {item.title} <ArrowRight size={12}/></button>)}{buildExamples.filter(item=>item.title.toLowerCase().includes(query.toLowerCase())||item.concepts.some(term=>term.toLowerCase().includes(query.toLowerCase()))).slice(0,3).map(item=><button key={item.id} onClick={()=>{setPlaygroundStarter(item);setActiveTab("Playground")}}>Example: {item.title} <ArrowRight size={12}/></button>)}<button onClick={()=>setActiveTab("Practice")}>Practice challenges <ArrowRight size={12}/></button></div>}<div className="lesson-groups">{['HTML','CSS','Flexbox','Grid','Positioning','Responsive','Tailwind'].filter(g=>groupFilter==='All'||groupFilter===g).map(group=><div className="lesson-group" key={group} data-group={group}><div className="group-heading">{group}<span>{lessons.filter(l=>l.group===group).length}</span></div>{filteredLessons.filter(l=>l.group===group).map(l=><button key={l.id} onClick={()=>selectLesson(l.id)} className={`lesson-list-item ${activeLesson===l.id?'selected':''}`}><span className={`lesson-dot ${completed.includes(l.id)?'done':''}`}>{completed.includes(l.id)?<Check size={11}/>:null}</span><span>{l.title}</span>{favorites.includes(l.id)&&<i className="fav-dot" title="Saved concept"/>}<small>{l.time}</small></button>)}</div>)}</div></div><article className="lesson-content"><ConceptExperience key={lesson.id} lesson={lesson} saved={favorites.includes(lesson.id)} onToggleFavorite={()=>toggleFavorite(lesson.id)} onOpenExample={(exampleHtml,exampleCss,title)=>{setPlaygroundStarter({id:`lesson-${lesson.id}`,title,category:lesson.group,description:lesson.description,concepts:[lesson.group],html:exampleHtml,css:exampleCss});setActiveTab("Playground")}} onExplore={title=>{const found=lessons.find(item=>item.title.toLowerCase()===title.toLowerCase());if(found)selectLesson(found.id);else{const lower=title.toLowerCase();setActiveTab(lower.includes("grid")?"Grid lab":lower.includes("flex")?"Flexbox lab":lower.includes("box")?"Box model":lower.includes("position")?"Positioning":lower.includes("responsive")?"Responsive":lower==="compare"?"Compare":"Playground")}}} onPractice={()=>setActiveTab("Practice")}/></article></section>}
        {activeTab==='Build & Experiment'&&<section className="lab-page"><div className="page-heading"><div><div className="eyebrow-line">OPEN ENDED PRACTICE</div><h1>Build something small.</h1><p>Start with the working playground and shape a profile card, landing page, or layout of your own.</p></div><button className="primary-button" onClick={()=>setActiveTab('Playground')}>Open playground <ArrowRight size={16}/></button></div><div className="course-grid"><button className="course-card" onClick={()=>{setPlaygroundStarter(undefined);setActiveTab('Playground')}}><div className="course-icon blue"><Code2 size={20}/></div><h3>Profile card</h3><p>Personalize a compact introduction with spacing, color, and type.</p><div className="course-card-bottom">Start building <ArrowRight size={15}/></div></button><button className="course-card" onClick={()=>setActiveTab('Flexbox lab')}><div className="course-icon purple"><Braces size={20}/></div><h3>Explore a layout</h3><p>Try different directions and alignment before building a page.</p><div className="course-card-bottom">Open Flexbox lab <ArrowRight size={15}/></div></button></div></section>}
      </div>
      <footer className="footer"><span>Made for curious minds.</span><span>WebCraft Academy <span className="footer-dot">·</span> Learn by building</span></footer>
    </main>
    {showFeedback&&<FeedbackModal activeLab={activeTab} onClose={()=>setShowFeedback(false)}/>}
    {showHelp&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-modal-title"><div className="modal-card"><div className="modal-head"><h2 id="help-modal-title"><CircleHelp size={16}/> Keyboard Shortcuts</h2><button type="button" className="ws-icon-btn" onClick={()=>setShowHelp(false)} aria-label="Close help dialog"><X size={16}/></button></div><div className="modal-shortcuts"><div><kbd>Ctrl / ⌘ + K</kbd><span>Focus concept search</span></div><div><kbd>Ctrl / ⌘ + Enter</kbd><span>Run preview</span></div><div><kbd>Shift + Alt + F</kbd><span>Format HTML &amp; CSS</span></div><div><kbd>Ctrl / ⌘ + S</kbd><span>Save or export</span></div><div><kbd>Ctrl + M</kbd><span>Switch editor pane</span></div></div><div className="modal-actions"><button type="button" className="primary-button" onClick={()=>setShowHelp(false)}>Got it</button></div></div></div>}
  </div>;
}
