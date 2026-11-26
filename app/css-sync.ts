/**
 * Utilities for bidirectional synchronization between visual CSS controls
 * and raw CSS text without discarding unsupported declarations.
 */

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Finds the body range [start, end] of the first top-level rule matching `selector`.
 */
function findRuleBodyRange(css: string, selector: string): { start: number; end: number } | null {
  const escaped = escapeRegex(selector.trim());
  const regex = new RegExp(`(^|\\n|\\})\\s*${escaped}\\s*\\{`, 'g');
  const match = regex.exec(css);
  if (!match) return null;

  const openBraceIndex = css.indexOf('{', match.index + match[1].length);
  if (openBraceIndex === -1) return null;

  let depth = 1;
  let quote: '"' | "'" | null = null;
  for (let i = openBraceIndex + 1; i < css.length; i += 1) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start: openBraceIndex + 1, end: i };
      }
    }
  }
  return null;
}

/**
 * Parses `property: value;` declarations from a CSS rule body.
 */
function parseDeclarations(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  const cleaned = stripComments(body);
  for (const part of cleaned.split(';')) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = part.slice(0, colonIdx).trim().toLowerCase();
    const val = part.slice(colonIdx + 1).trim();
    if (prop && val) {
      result[prop] = val;
    }
  }
  return result;
}

/**
 * Extracts all declarations for a given CSS selector from `cssText`.
 */
export function extractRuleDeclarations(cssText: string, selector: string): Record<string, string> {
  const range = findRuleBodyRange(cssText, selector);
  if (!range) return {};
  return parseDeclarations(cssText.slice(range.start, range.end));
}

/**
 * Updates or inserts a single `property: value;` declaration inside the rule for `selector`,
 * preserving all other declarations (including unsupported custom CSS).
 */
export function patchCssRule(
  cssText: string,
  selector: string,
  property: string,
  value: string
): string {
  const range = findRuleBodyRange(cssText, selector);
  const declLine = `  ${property}: ${value};`;

  if (!range) {
    const trimmed = cssText.trimEnd();
    const prefix = trimmed ? `${trimmed}\n` : '';
    return `${prefix}${selector} {\n${declLine}\n}`;
  }

  const body = cssText.slice(range.start, range.end);
  const propRegex = new RegExp(`(^|\\n)([ \\t]*)${escapeRegex(property)}\\s*:\\s*[^;\\n]*;?`, 'i');
  let nextBody: string;

  if (propRegex.test(body)) {
    nextBody = body.replace(propRegex, (_, lead, indent) => `${lead}${indent || '  '}${property}: ${value};`);
  } else {
    const trimmedBody = body.replace(/\s+$/, '');
    nextBody = trimmedBody ? `${trimmedBody}\n${declLine}\n` : `\n${declLine}\n`;
  }

  return `${cssText.slice(0, range.start)}${nextBody}${cssText.slice(range.end)}`;
}

/**
 * Parses a pixel or unitless numeric value safely.
 */
export function parseNumericCss(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const match = raw.trim().match(/^-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Extracts the `@media (min-width: Npx)` breakpoint value from CSS if present.
 */
export function extractMediaBreakpoint(cssText: string, fallback: number): number {
  const match = cssText.match(/@media\s*\(\s*min-width\s*:\s*(\d+)px\s*\)/i);
  if (!match) return fallback;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Updates `@media (min-width: Npx)` breakpoint in CSS while keeping the rest intact.
 */
export function patchMediaBreakpoint(cssText: string, breakpointPx: number): string {
  const regex = /(@media\s*\(\s*min-width\s*:\s*)(\d+)(px\s*\))/i;
  if (regex.test(cssText)) {
    return cssText.replace(regex, `$1${breakpointPx}$3`);
  }
  return cssText;
}
