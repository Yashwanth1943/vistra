const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};

const { curriculum, topicGroup } = require('../app/curriculum.ts');
const { explainConcept, conceptContentSource, splitExampleForPlayground } = require('../app/concept-content.ts');
const { buildExamples, comparisons } = require('../app/learning-tools.ts');
const { createPreviewDocument, starterTemplates, validateCss, validateHtml } = require('../app/playground.ts');

const concepts = curriculum.flatMap(module => module.topics.map(title => ({
  id: `${module.id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  title,
  group: topicGroup(module.id),
  description: `Explore ${title}.`,
  concept: `The browser applies ${title} according to its layout and cascade rules.`,
  example: `/* ${title} */`,
  takeaway: `Inspect ${title} in context.`,
})));

test('every curriculum concept receives complete structured explanation content', () => {
  assert.equal(concepts.length, 143);
  const required = ['introduction','definition','importance','mechanics','syntax','example','playground','visualResult','experiment','commonMistakes','applications','related','question','answer'];
  for (const concept of concepts) {
    const content = explainConcept(concept, curriculum);
    for (const field of required) {
      assert.ok(content[field], `${concept.title} is missing ${field}`);
      if (Array.isArray(content[field])) assert.ok(content[field].length, `${concept.title} has empty ${field}`);
    }
    assert.equal(typeof content.commonMistakes[0], 'string');
  }
});

test('all seven sidebar groups have valid curriculum assignments', () => {
  const expectedCounts = {
    HTML: 18,
    CSS: 43,
    Flexbox: 29,
    Grid: 22,
    Positioning: 9,
    Responsive: 11,
    Tailwind: 11,
  };
  const counts = Object.fromEntries(Object.keys(expectedCounts).map(group => [group, 0]));
  for (const concept of concepts) {
    assert.ok(concept.group in expectedCounts, `Unexpected group ${concept.group} for ${concept.title}`);
    counts[concept.group] += 1;
  }
  assert.deepEqual(counts, expectedCounts);
  assert.equal(Object.values(counts).reduce((sum, n) => sum + n, 0), 143);
  const responsiveGrid = concepts.find(c => c.title.toLowerCase() === 'responsive grid');
  assert.equal(responsiveGrid?.group, 'Responsive');
  const gridColumns = concepts.find(c => c.title.toLowerCase() === 'grid columns');
  assert.equal(gridColumns?.group, 'Grid');
});

test('all related concept references resolve to valid curriculum topics or supported labs', () => {
  const validTitles = new Set(concepts.map(c => c.title.toLowerCase()));
  const supportedLabs = new Set(['flexbox lab', 'grid lab', 'box model', 'positioning', 'responsive', 'compare', 'playground']);
  for (const concept of concepts) {
    const content = explainConcept(concept, curriculum);
    for (const rel of content.related) {
      const normalized = rel.toLowerCase();
      assert.ok(
        validTitles.has(normalized) || supportedLabs.has(normalized),
        `Unresolved related reference "${rel}" on concept "${concept.title}"`
      );
    }
  }
});

test('playground example routing separates HTML and CSS cleanly across all 143 concepts', () => {
  for (const concept of concepts) {
    const content = explainConcept(concept, curriculum);
    const { html, css } = content.playground;
    assert.ok(html.trim().length > 0, `${concept.title} produced empty playground HTML`);
    assert.ok(css.trim().length > 0, `${concept.title} produced empty playground CSS`);
    const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(
      /<[a-zA-Z!]/.test(cssWithoutComments),
      false,
      `${concept.title} routed HTML tags into playground CSS: ${css}`
    );
    assert.equal(validateCss(css), null, `${concept.title} produced invalid playground CSS: ${validateCss(css)}`);
  }
  const combined = splitExampleForPlayground(
    '<button class="btn">Hi</button>\n<style>.btn { color: red; }</style>',
    { title: 'Sample', group: 'CSS' }
  );
  assert.equal(combined.html, '<button class="btn">Hi</button>');
  assert.equal(combined.css, '.btn { color: red; }');
});

test('content source audit classifies all concepts and confirms 100% authored coverage', () => {
  const counts = concepts.reduce((result, concept) => {
    result[conceptContentSource(concept)] += 1;
    return result;
  }, { authored: 0, 'property-guided': 0, generated: 0 });
  assert.equal(counts.authored + counts['property-guided'] + counts.generated, 143);
  assert.equal(counts.authored, 143);
  assert.equal(counts['property-guided'], 0);
  assert.equal(counts.generated, 0);
  const uniqueIds = new Set(concepts.map(c => c.id));
  assert.equal(uniqueIds.size, 143);
  console.log('Content sources:', counts);
});

test('all editable examples and comparisons have usable source and explanations', () => {
  assert.equal(buildExamples.length, 12);
  assert.ok(comparisons.length >= 20);
  for (const example of buildExamples) {
    assert.ok(example.html.includes('<'));
    assert.ok(example.css.trim());
    assert.ok(example.concepts.length);
  }
  for (const comparison of comparisons) {
    assert.ok(comparison.leftMeaning && comparison.rightMeaning && comparison.difference && comparison.use);
    assert.ok(comparison.code && comparison.confusion);
  }
});

test('playground CSS validation accepts common valid syntax and catches unclosed rules', () => {
  assert.equal(validateCss('.card { color: red; background: url("image.png"); } /* ok */'), null);
  assert.match(validateCss('.card { color: red;') || '', /not closed/);
  assert.match(validateCss('.card { content: "unfinished; }') || '', /quote/);
  assert.match(validateCss('.card }') || '', /Unexpected/);
});

test('playground reports recoverable HTML tag problems without blocking browser parsing', () => {
  assert.equal(validateHtml('<main><h1>Title</h1><img alt="sample"></main>'), null);
  assert.match(validateHtml('<main><p>Open') || '', /no matching closing tag/);
  assert.match(validateHtml('</main>') || '', /no matching opening tag/);
  assert.equal(validateHtml('<script>const fake = "<main>";</script><main>OK</main>'), null);
});

test('preview document strips scripts, blocks style breakout, handles local styles.css safely, and contains all required starters', () => {
  const doc = createPreviewDocument('<main>Safe</main><script>throw new Error("bad")</script>', '.card { color: red; }</style><script>alert(1)</script>');
  assert.match(doc, /<main>Safe<\/main>/);
  assert.doesNotMatch(doc, /throw new Error/);
  assert.doesNotMatch(doc, /alert\(1\)/);
  assert.match(doc, /<\\\/style>/);
  assert.match(doc, /Content-Security-Policy/);
  assert.match(doc, /default-src 'none'/);
  assert.match(doc, /style-src 'unsafe-inline'/);

  const inlineConcept = concepts.find(c => c.title === 'Inline, internal, and external CSS');
  const inlineContent = explainConcept(inlineConcept, curriculum);
  assert.match(inlineContent.playground.html, /styles\.css/);
  assert.match(inlineContent.playground.html, /style="/);
  assert.match(inlineContent.playground.html, /<style>/);
  const externalCssDoc = createPreviewDocument(inlineContent.playground.html, inlineContent.playground.css);
  assert.doesNotMatch(externalCssDoc, /<link\b[^>]*href=["']styles\.css["']/i);
  assert.match(externalCssDoc, /\.external-note/);

  const thirdPartyDoc = createPreviewDocument('<link rel="stylesheet" href="https://example.com/app.css">', 'body{}');
  assert.match(thirdPartyDoc, /default-src 'none'/);

  assert.equal(starterTemplates.length, 5);
  assert.deepEqual(starterTemplates.map(item => item.name), ['Basic HTML website','Responsive card layout','Flexbox navigation','CSS Grid gallery','Responsive landing page']);
});
