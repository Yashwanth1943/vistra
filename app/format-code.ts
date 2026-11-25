import prettier from 'prettier/standalone';
import parserHtml from 'prettier/plugins/html';
import parserPostcss from 'prettier/plugins/postcss';

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype',
]);

export function formatHtmlSync(markup: string): string {
  const trimmed = markup.trim();
  if (!trimmed) return '';

  const tokens = trimmed
    .replace(/>\s+</g, '>\n<')
    .split(/(<[^>]+>)/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const lines: string[] = [];
  let depth = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const next = tokens[i + 1];
    const afterNext = tokens[i + 2];

    const isClosing = /^<\/([a-z][\w:-]*)\s*>$/i.exec(token);
    if (isClosing) {
      depth = Math.max(0, depth - 1);
      lines.push(`${'  '.repeat(depth)}${token}`);
      continue;
    }

    const isOpening = /^<([a-z!][\w:-]*)(?:\s[^>]*)?>$/i.exec(token);
    if (isOpening) {
      const tag = isOpening[1].toLowerCase();
      const selfClosing = VOID_TAGS.has(tag) || /\/\s*>$/.test(token);

      // Keep simple inline leaf elements like <h1>Hello</h1> on one line
      if (
        !selfClosing &&
        next &&
        !next.startsWith('<') &&
        next.length <= 60 &&
        afterNext &&
        new RegExp(`^<\\/${tag}\\s*>$`, 'i').test(afterNext)
      ) {
        lines.push(`${'  '.repeat(depth)}${token}${next}${afterNext}`);
        i += 2;
        continue;
      }

      // Keep empty tag pairs like <div></div> on one line
      if (!selfClosing && next && new RegExp(`^<\\/${tag}\\s*>$`, 'i').test(next)) {
        lines.push(`${'  '.repeat(depth)}${token}${next}`);
        i += 1;
        continue;
      }

      lines.push(`${'  '.repeat(depth)}${token}`);
      if (!selfClosing) depth += 1;
      continue;
    }

    lines.push(`${'  '.repeat(depth)}${token}`);
  }

  return lines.join('\n');
}

export function formatCssSync(styles: string): string {
  const trimmed = styles.trim();
  if (!trimmed) return '';

  let result = '';
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    const next = trimmed[i + 1];

    if (quote) {
      result += ch;
      if (ch === '\\' && next) {
        result += next;
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      result += ch;
      continue;
    }

    if (ch === '(') {
      parenDepth += 1;
      result += ch;
      continue;
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      result += ch;
      continue;
    }

    if (ch === '{' && parenDepth === 0) {
      result = result.replace(/[ \t]+$/, '') + ' {\n';
      depth += 1;
      result += '  '.repeat(depth);
      while (trimmed[i + 1] === ' ' || trimmed[i + 1] === '\t' || trimmed[i + 1] === '\n') i += 1;
      continue;
    }

    if (ch === '}' && parenDepth === 0) {
      depth = Math.max(0, depth - 1);
      result = result.replace(/[ \t\n]+$/, '') + '\n' + '  '.repeat(depth) + '}\n';
      if (depth === 0) result += '\n';
      else result += '  '.repeat(depth);
      while (trimmed[i + 1] === ' ' || trimmed[i + 1] === '\t' || trimmed[i + 1] === '\n') i += 1;
      continue;
    }

    if (ch === ';' && parenDepth === 0) {
      result += ';\n' + '  '.repeat(depth);
      while (trimmed[i + 1] === ' ' || trimmed[i + 1] === '\t' || trimmed[i + 1] === '\n') i += 1;
      continue;
    }

    if (ch === ':' && parenDepth === 0 && depth > 0) {
      result = result.replace(/[ \t]+$/, '') + ': ';
      while (trimmed[i + 1] === ' ' || trimmed[i + 1] === '\t') i += 1;
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      if (!result.endsWith('\n') && !result.endsWith('  ')) result += ' ';
      continue;
    }

    if ((ch === ' ' || ch === '\t') && (result.endsWith(' ') || result.endsWith('\n'))) {
      continue;
    }

    result += ch;
  }

  return result.replace(/\n{3,}/g, '\n\n').trim();
}

export async function formatHtml(markup: string): Promise<string> {
  if (!markup.trim()) return '';
  const formatted = await prettier.format(markup, {
    parser: 'html',
    plugins: [parserHtml],
    tabWidth: 2,
    useTabs: false,
    printWidth: 64,
    htmlWhitespaceSensitivity: 'ignore',
  });
  return formatHtmlSync(formatted.trimEnd());
}

export async function formatCss(styles: string): Promise<string> {
  if (!styles.trim()) return '';
  const formatted = await prettier.format(styles, {
    parser: 'css',
    plugins: [parserPostcss],
    tabWidth: 2,
    useTabs: false,
    printWidth: 72,
  });
  return formatted.trimEnd();
}
