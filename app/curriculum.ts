export type CurriculumModule = { id: string; title: string; topics: string[] };

// Collections are deliberately flat: every topic can be opened directly.
export const curriculum: CurriculumModule[] = [
  { id: 'html', title: '01 · Introduction to HTML', topics: ['What is HTML?', 'How websites work', 'HTML document structure', 'HTML elements and tags', 'Attributes', 'Headings and paragraphs', 'Links', 'Images', 'Lists', 'Tables', 'HTML forms', 'Semantic HTML'] },
  { id: 'css', title: '02 · Introduction to CSS', topics: ['What is CSS?', 'Why CSS is needed', 'Inline, internal, and external CSS', 'CSS syntax', 'Selectors introduction', 'Colors and backgrounds', 'Fonts and typography', 'Borders', 'Basic styling'] },
  { id: 'box-model', title: '03 · CSS Box Model', topics: ['Understanding the box model', 'Content', 'Padding', 'Border', 'Margin', 'Box model visualization', 'Width and height', 'Content-box versus border-box', 'Margin collapse', 'Practical spacing experiments'] },
  { id: 'website', title: '04 · HTML Files and Building a Website', topics: ['HTML file structure', 'Creating multiple HTML files', 'Linking CSS files', 'Linking pages using anchor elements', 'Structuring a multi-section website', 'Building a simple website using HTML and CSS'] },
  { id: 'selectors', title: '05 · CSS Selectors and Specificity', topics: ['Element selectors', 'Class selectors', 'ID selectors', 'Universal selector', 'Grouping selectors', 'Descendant selectors', 'Child selectors', 'Attribute selectors', 'Pseudo-classes', 'Pseudo-elements', 'Specificity', 'CSS cascade', 'Inheritance'] },
  { id: 'sizing', title: '06 · Sizing Elements and Box Sizing', topics: ['Width', 'Height', 'Min-width', 'Max-width', 'Min-height', 'Max-height', 'Percentage sizing', 'Viewport units', 'Overflow', 'Box-sizing', 'Responsive sizing'] },
  { id: 'flex-intro', title: '07 · Introduction to CSS Flexbox', topics: ['What is Flexbox?', 'Flex container', 'Flex items', 'Display flex', 'Main axis', 'Cross axis', 'Row and column directions', 'Understanding one-dimensional layouts'] },
  { id: 'flex-properties', title: '08 · CSS Flexbox Properties', topics: ['flex-direction', 'justify-content', 'align-items', 'align-self', 'flex-wrap', 'align-content', 'order', 'gap', 'Row gap', 'Column gap'] },
  { id: 'flex-sizing', title: '09 · Flexbox Sizing and Building Applications', topics: ['flex-grow', 'flex-shrink', 'flex-basis', 'Flex shorthand', 'Understanding available space', 'Flex item sizing', 'Responsive Flexbox', 'Building navigation bars', 'Building pricing layouts', 'Building profile cards', 'Building practical application layouts'] },
  { id: 'grid', title: '10 · CSS Grid 1: Fundamentals', topics: ['Introduction to CSS Grid', 'Grid container', 'Grid items', 'display: grid', 'Grid columns', 'Grid rows', 'grid-template-columns', 'grid-template-rows', 'Gap', 'Fractional units', 'repeat()'] },
  { id: 'grid-advanced', title: '11 · CSS Grid 2: Advanced Layouts', topics: ['grid-column', 'grid-row', 'grid-area', 'grid-template-areas', 'grid-auto-flow', 'auto-fit', 'auto-fill', 'minmax()', 'Implicit and explicit grids', 'Responsive grid layouts', 'Practical website layouts'] },
  { id: 'position', title: '12 · CSS Positioning', topics: ['Static', 'Relative', 'Absolute', 'Fixed', 'Sticky', 'Top, right, bottom, and left', 'Z-index', 'Stacking context', 'Positioning experiments'] },
  { id: 'tailwind', title: '13 · Introduction to Tailwind CSS', topics: ['What is Tailwind CSS?', 'Utility-first CSS', 'Installing and configuring Tailwind', 'Common utility classes', 'Spacing', 'Colors', 'Typography', 'Flexbox utilities', 'Grid utilities', 'Responsive utility classes', 'Building components using Tailwind'] },
  { id: 'responsive', title: '14 · Building Responsive Websites', topics: ['Responsive web design', 'Mobile-first approach', 'Viewport meta tag', 'Media queries', 'Breakpoints', 'Min-width and max-width conditions', 'Orientation', 'Responsive typography', 'Responsive Flexbox', 'Responsive Grid', 'Building complete responsive websites'] },
];

export const topicGroup = (moduleId: string) => {
  if (moduleId === 'html' || moduleId === 'website') return 'HTML';
  if (moduleId.startsWith('flex')) return 'Flexbox';
  if (moduleId.startsWith('grid')) return 'Grid';
  if (moduleId === 'position') return 'Positioning';
  if (moduleId === 'responsive') return 'Responsive';
  if (moduleId === 'tailwind') return 'Tailwind';
  return 'CSS';
};
