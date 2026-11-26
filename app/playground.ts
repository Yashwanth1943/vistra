import type { BuildExample } from './learning-tools';

export type PlaygroundTemplate = BuildExample & { name: string };

export const starterTemplates: PlaygroundTemplate[] = [
  {
    id: 'basic-website', name: 'Basic HTML website', title: 'Basic HTML website', category: 'HTML',
    description: 'A semantic one-page site with a small linked stylesheet.', concepts: ['semantic HTML', 'external CSS', 'links'],
    html: '<header class="site-header"><a href="#home">Northstar</a><nav aria-label="Main navigation"><a href="#about">About</a><a href="#work">Work</a></nav></header>\n<main id="home"><section class="hero"><p>FIELD NOTES</p><h1>Make room for better ideas.</h1><a href="#about">Read the story</a></section><section id="about"><h2>A small, thoughtful studio</h2><p>Structure content with meaning, then style the result.</p></section></main>\n<footer id="work">Made for the open web.</footer>',
    css: '* { box-sizing: border-box; }\nbody { margin: 0; color: #20263a; font: 16px/1.6 Arial, sans-serif; }\n.site-header { display: flex; justify-content: space-between; padding: 1rem 6vw; border-bottom: 1px solid #e5e8ef; }\nnav { display: flex; gap: 1rem; }\na { color: #4f60cf; }\n.hero { min-height: 65vh; display: grid; align-content: center; gap: 1rem; padding: 3rem 8vw; background: #f3f5ff; }\nh1 { max-width: 12ch; font-size: clamp(2.5rem, 7vw, 5rem); line-height: 1; }\nmain section + section, footer { padding: 2rem 8vw; }',
  },
  {
    id: 'responsive-cards', name: 'Responsive card layout', title: 'Responsive card layout', category: 'CSS Grid',
    description: 'An auto-fit card grid adapts without a breakpoint for each column count.', concepts: ['Grid', 'auto-fit', 'minmax()', 'gap'],
    html: '<main class="catalog"><p class="eyebrow">THE COLLECTION</p><h1>Ideas worth keeping.</h1><div class="cards"><article><span>01</span><h2>Typography</h2><p>Make information easy to read.</p></article><article><span>02</span><h2>Layout</h2><p>Give each part room to work.</p></article><article><span>03</span><h2>Color</h2><p>Build a useful visual language.</p></article></div></main>',
    css: '* { box-sizing: border-box; }\nbody { margin: 0; padding: 2rem; color: #20263a; font: 15px Arial, sans-serif; }\n.catalog { max-width: 70rem; margin: auto; }\n.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 1rem; }\narticle { padding: 1.4rem; border: 1px solid #e1e5ee; border-radius: 10px; background: white; }\narticle span { color: #5667d8; font-size: .8rem; }\narticle p { color: #758097; line-height: 1.6; }',
  },
  {
    id: 'flex-navigation', name: 'Flexbox navigation', title: 'Flexbox navigation', category: 'Flexbox',
    description: 'A flexible navigation row uses auto margin to push its links to the end.', concepts: ['Flexbox', 'main axis', 'gap', 'auto margin'],
    html: '<header class="bar"><a class="brand" href="#home">FIELDWORK</a><nav aria-label="Main"><a href="#journal">Journal</a><a href="#about">About</a><a class="button" href="#join">Join us</a></nav></header><main id="home"><h1>Work with the grain.</h1><p>Try changing the direction, gap, or wrapping behavior.</p></main>',
    css: '* { box-sizing: border-box; }\nbody { margin: 0; color: #25312f; font: 15px Arial, sans-serif; }\n.bar { display: flex; align-items: center; gap: 1rem; padding: 1rem 6vw; border-bottom: 1px solid #e3e9e5; }\n.brand { color: #25312f; font-weight: 700; text-decoration: none; }\nnav { display: flex; align-items: center; gap: 1.25rem; margin-left: auto; }\nnav a { color: #65736e; text-decoration: none; }\nnav .button { padding: .65rem .9rem; border-radius: 5px; background: #273d35; color: white; }\nmain { padding: 8vh 8vw; }\nh1 { font-size: clamp(2.5rem, 6vw, 5rem); }\n@media (max-width: 560px) { .bar, nav { flex-wrap: wrap; } }',
  },
  {
    id: 'grid-gallery', name: 'CSS Grid gallery', title: 'CSS Grid gallery', category: 'CSS Grid',
    description: 'A featured tile spans two columns while the other items auto-place.', concepts: ['Grid', 'grid-column', 'auto-placement', 'gap'],
    html: '<main class="gallery"><h1>Selected work</h1><article class="feature">01 · Field notes</article><article>02 · Slow mornings</article><article>03 · Open spaces</article><article>04 · Small rituals</article></main>',
    css: '* { box-sizing: border-box; }\nbody { margin: 0; padding: 2rem; color: #20263a; font: 15px Arial, sans-serif; }\n.gallery { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; max-width: 70rem; margin: auto; }\nh1 { grid-column: 1 / -1; }\narticle { min-height: 160px; display: flex; align-items: end; padding: 1rem; border-radius: 8px; background: #e6eaff; }\n.feature { grid-column: span 2; background: #e3f0ea; }\n@media (max-width: 600px) { .gallery { grid-template-columns: 1fr; } .feature { grid-column: auto; } }',
  },
  {
    id: 'responsive-landing', name: 'Responsive landing page', title: 'Responsive landing page', category: 'Responsive design',
    description: 'A mobile-first hero and two-column feature section adapt at a content-driven breakpoint.', concepts: ['mobile-first', 'media queries', 'Grid', 'clamp()'],
    html: '<main class="landing"><nav><strong>STUDIO / 08</strong><a href="#approach">Approach</a><a href="#contact">Contact</a></nav><section class="hero"><p>DESIGN FOR EVERY DAY</p><h1>Good work starts with a better question.</h1><a class="cta" href="#approach">Explore the studio</a></section><section class="features" id="approach"><h2>Room to think.</h2><p>Build a layout that responds to the space around its content, from a narrow phone to a wide desktop.</p></section><footer id="contact">Say hello · studio@example.test</footer></main>',
    css: '* { box-sizing: border-box; }\nbody { margin: 0; color: #20263a; font: 16px/1.6 Arial, sans-serif; }\n.landing { max-width: 90rem; margin: auto; padding: 1rem 6vw; }\nnav { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }\nnav strong { margin-right: auto; }\n.hero { display: grid; align-content: center; min-height: 65vh; max-width: 55rem; }\n.hero h1 { margin: .4rem 0 1.5rem; font-size: clamp(2.8rem, 8vw, 6rem); line-height: .98; }\n.cta { width: fit-content; padding: .8rem 1rem; background: #5366df; color: white; text-decoration: none; border-radius: 5px; }\n.features { display: grid; gap: 1rem; padding: 2rem 0; border-top: 1px solid #e6e9f0; }\n@media (min-width: 48rem) { .features { grid-template-columns: 1fr 1fr; gap: 3rem; } }',
  },
];

export function validateCss(css: string): string | null {
  const stack: string[] = [];
  let quote: '"' | "'" | null = null;
  let comment = false;
  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    const next = css[i + 1];
    if (comment) {
      if (char === '*' && next === '/') { comment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (char === '\\') { i += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '*') { comment = true; i += 1; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{' || char === '(' || char === '[') stack.push(char);
    if (char === '}' || char === ')' || char === ']') {
      const expected = char === '}' ? '{' : char === ')' ? '(' : '[';
      if (stack.pop() !== expected) return `Unexpected “${char}” near character ${i + 1}. Check the surrounding CSS rule.`;
    }
  }
  if (quote) return 'A quoted CSS value is not closed. Add the matching quote before running the preview.';
  if (comment) return 'A CSS comment is not closed. Add */ before running the preview.';
  if (stack.length) return `A CSS “${stack.at(-1)}” is not closed. Check the matching bracket or rule.`;
  return null;
}

export function validateHtml(markup: string): string | null {
  const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const cleaned = markup.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  const stack: string[] = [];
  for (const match of cleaned.matchAll(/<(\/)?([a-z][\w:-]*)\b[^>]*>/gi)) {
    const closing = Boolean(match[1]);
    const name = match[2].toLowerCase();
    if (!closing && (voidElements.has(name) || /\/\s*>$/.test(match[0]))) continue;
    if (!closing) { stack.push(name); continue; }
    const openAt = stack.lastIndexOf(name);
    if (openAt === -1) return `Closing tag </${name}> has no matching opening tag. The browser may repair this markup automatically.`;
    stack.splice(openAt);
  }
  if (stack.length) return `Opening tag <${stack[stack.length - 1]}> has no matching closing tag. The browser may repair this markup automatically.`;
  return null;
}

export function createPreviewDocument(html: string, css: string): string {
  const safeMarkup = html
    .replace(/<script\b[^>]*>(?:[\s\S]*?<\/script\s*>|[\s\S]*$)/gi, '<!-- scripts are disabled in the preview -->')
    .replace(/<!--[\s\S]*?-->|<link\b(?=[^>]*\bhref=["'](?:\.\/)?styles\.css["'])[^>]*>/gi, (match) =>
      match.startsWith('<!--') ? match : '<!-- local styles.css is inlined into the preview -->'
    );
  const safeStyles = css.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '/* script-like text removed from CSS */')
    .replace(/<\/style/gi, '<\\/style');
  const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>${safeStyles}</style></head><body>${safeMarkup}</body></html>`;
}
