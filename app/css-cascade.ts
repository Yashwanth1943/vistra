/**
 * Spec-accurate CSS Specificity Calculator & Real-DOM Cascade/Inheritance Analyzer.
 * Supports modern selectors (:is, :not, :where, :has, :nth-child(... of ...), combinators,
 * attributes, pseudo-elements), @layer cascade ordering, !important, inline styles,
 * shorthand/longhand interactions, and computed value comparison via getComputedStyle.
 */

export type Specificity = [number, number, number];

export type SpecificityResult = {
  specificity: Specificity;
  valid: boolean;
  error?: string;
};

export type CascadeDeclaration = {
  property: string;
  value: string;
  computedValue?: string;
  important: boolean;
  selector: string;
  specificity: Specificity;
  order: number;
  origin: 'author' | 'inline';
  layerName?: string;
  layerRank: number; // Higher = higher normal priority; unlayered = Infinity
  source: string;
  status: 'applied' | 'overridden';
  reason: string;
};

export type InheritedDeclaration = {
  property: string;
  value: string;
  fromTag: string;
};

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let depthParen = 0;
  let depthBracket = 0;
  let quote: '"' | "'" | null = null;
  let start = 0;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
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
    } else if (ch === '(') {
      depthParen += 1;
    } else if (ch === ')') {
      depthParen = Math.max(0, depthParen - 1);
    } else if (ch === '[') {
      depthBracket += 1;
    } else if (ch === ']') {
      depthBracket = Math.max(0, depthBracket - 1);
    } else if (ch === ',' && depthParen === 0 && depthBracket === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts;
}

function readBalanced(input: string, startIdx: number, openChar: '(' | '[' | '{', closeChar: ')' | ']' | '}'): { content: string; endIdx: number } | null {
  let depth = 1;
  let i = startIdx + 1;
  let quote: '"' | "'" | null = null;
  while (i < input.length && depth > 0) {
    const ch = input[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
    } else {
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === openChar) depth += 1;
      else if (ch === closeChar) depth -= 1;
    }
    i += 1;
  }
  if (depth !== 0) return null;
  return { content: input.slice(startIdx + 1, i - 1), endIdx: i };
}

function maxSpecificityOfList(listText: string, allowRelativeCombinator = false): SpecificityResult {
  const candidates = splitTopLevelCommas(listText).filter(Boolean);
  if (candidates.length === 0) {
    return { specificity: [0, 0, 0], valid: false, error: 'Empty selector argument' };
  }
  let best: Specificity = [0, 0, 0];
  let anyValid = false;
  for (const cand of candidates) {
    const res = computeSpecificityDetailed(cand, allowRelativeCombinator);
    if (res.valid) {
      anyValid = true;
      if (compareSpecificity(res.specificity, best) > 0) {
        best = res.specificity;
      }
    }
  }
  return anyValid
    ? { specificity: best, valid: true }
    : { specificity: [0, 0, 0], valid: false, error: 'Invalid selector inside pseudo-class' };
}

export function computeSpecificityDetailed(rawSelector: string, allowRelativeCombinator = false): SpecificityResult {
  const sel = rawSelector.trim();
  if (!sel) return { specificity: [0, 0, 0], valid: false, error: 'Empty selector' };

  // Handle selector list at top level by returning max specificity
  const topParts = splitTopLevelCommas(sel);
  if (topParts.length > 1) {
    return maxSpecificityOfList(sel, allowRelativeCombinator);
  }

  let a = 0;
  let b = 0;
  let c = 0;
  let i = 0;
  let expectingCompound = !allowRelativeCombinator;

  while (i < sel.length) {
    const ch = sel[i];

    // Whitespace or combinators
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '>' || ch === '+' || ch === '~') {
      if (expectingCompound) {
        return { specificity: [0, 0, 0], valid: false, error: `Unexpected combinator "${ch}"` };
      }
      expectingCompound = true;
      i += 1;
      continue;
    }

    // Universal selector
    if (ch === '*') {
      expectingCompound = false;
      i += 1;
      continue;
    }

    // ID selector
    if (ch === '#') {
      const m = sel.slice(i + 1).match(/^[a-zA-Z_-][a-zA-Z0-9_-]*/);
      if (!m) {
        return { specificity: [0, 0, 0], valid: false, error: 'Invalid ID selector' };
      }
      a += 1;
      expectingCompound = false;
      i += 1 + m[0].length;
      continue;
    }

    // Class selector
    if (ch === '.') {
      const m = sel.slice(i + 1).match(/^[a-zA-Z_-][a-zA-Z0-9_-]*/);
      if (!m) {
        return { specificity: [0, 0, 0], valid: false, error: 'Invalid class selector' };
      }
      b += 1;
      expectingCompound = false;
      i += 1 + m[0].length;
      continue;
    }

    // Attribute selector
    if (ch === '[') {
      const balanced = readBalanced(sel, i, '[', ']');
      if (!balanced || !balanced.content.trim()) {
        return { specificity: [0, 0, 0], valid: false, error: 'Unclosed or empty attribute selector' };
      }
      b += 1;
      expectingCompound = false;
      i = balanced.endIdx;
      continue;
    }

    // Pseudo-element or pseudo-class
    if (ch === ':') {
      const isDouble = sel[i + 1] === ':';
      const nameStart = i + (isDouble ? 2 : 1);
      const m = sel.slice(nameStart).match(/^[a-zA-Z_-][a-zA-Z0-9_-]*/);
      if (!m) {
        return { specificity: [0, 0, 0], valid: false, error: 'Invalid pseudo-selector' };
      }
      const pseudoName = m[0].toLowerCase();
      let nextIdx = nameStart + m[0].length;
      expectingCompound = false;

      if (sel[nextIdx] === '(') {
        const balanced = readBalanced(sel, nextIdx, '(', ')');
        if (!balanced) {
          return { specificity: [0, 0, 0], valid: false, error: `Unclosed parenthesis in :${pseudoName}()` };
        }
        nextIdx = balanced.endIdx;

        if (isDouble) {
          c += 1;
        } else if (pseudoName === 'where') {
          // :where() always contributes (0, 0, 0)
        } else if (pseudoName === 'is' || pseudoName === 'not' || pseudoName === 'has') {
          const inner = maxSpecificityOfList(balanced.content, pseudoName === 'has');
          if (!inner.valid) return inner;
          a += inner.specificity[0];
          b += inner.specificity[1];
          c += inner.specificity[2];
        } else if (pseudoName === 'nth-child' || pseudoName === 'nth-last-child') {
          b += 1;
          const ofMatch = balanced.content.match(/\bof\s+([\s\S]+)$/i);
          if (ofMatch) {
            const inner = maxSpecificityOfList(ofMatch[1]);
            if (!inner.valid) return inner;
            a += inner.specificity[0];
            b += inner.specificity[1];
            c += inner.specificity[2];
          }
        } else {
          b += 1;
        }
      } else if (isDouble || LEGACY_PSEUDO_ELEMENTS.has(pseudoName)) {
        c += 1;
      } else {
        b += 1;
      }

      i = nextIdx;
      continue;
    }

    // Type selector (including optional namespace prefix like svg|rect)
    const typeMatch = sel.slice(i).match(/^(?:[a-zA-Z_*-][a-zA-Z0-9_-]*\|)?[a-zA-Z][a-zA-Z0-9_-]*/);
    if (typeMatch) {
      c += 1;
      expectingCompound = false;
      i += typeMatch[0].length;
      continue;
    }

    return { specificity: [0, 0, 0], valid: false, error: `Unexpected token "${ch}"` };
  }

  if (expectingCompound) {
    return { specificity: [0, 0, 0], valid: false, error: 'Trailing combinator' };
  }

  return { specificity: [a, b, c], valid: true };
}

export function computeSpecificity(selector: string): Specificity {
  return computeSpecificityDetailed(selector).specificity;
}

export function compareSpecificity(a: Specificity, b: Specificity): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

export function formatSpecificity(s: Specificity): string {
  return `(${s[0]}, ${s[1]}, ${s[2]})`;
}

type ParsedDecl = { property: string; value: string; important: boolean };

type ParsedRule = {
  selectorList: string[];
  declarations: ParsedDecl[];
  layerName?: string;
  layerRank: number;
};

function parseDeclarations(body: string): ParsedDecl[] {
  const declarations: ParsedDecl[] = [];
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const property = part.slice(0, colon).trim().toLowerCase();
    let rawVal = part.slice(colon + 1).trim();
    if (!property || !rawVal) continue;
    const important = /!important\s*$/i.test(rawVal);
    if (important) {
      rawVal = rawVal.replace(/!important\s*$/i, '').trim();
    }
    declarations.push({ property, value: rawVal, important });
  }
  return declarations;
}

function parseCssRulesWithLayers(cssText: string): ParsedRule[] {
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const layerOrder: string[] = [];
  const registerLayer = (name: string) => {
    if (name && !layerOrder.includes(name)) layerOrder.push(name);
  };

  const rules: ParsedRule[] = [];

  const walk = (chunk: string, currentLayer?: string) => {
    let i = 0;
    while (i < chunk.length) {
      // Check for @layer statement ending with ';' before '{'
      const nextSemi = chunk.indexOf(';', i);
      const nextOpen = chunk.indexOf('{', i);

      if (nextSemi !== -1 && (nextOpen === -1 || nextSemi < nextOpen)) {
        const stmt = chunk.slice(i, nextSemi).trim();
        if (stmt.toLowerCase().startsWith('@layer')) {
          const names = stmt
            .slice(6)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          for (const n of names) registerLayer(n);
        }
        i = nextSemi + 1;
        continue;
      }

      if (nextOpen === -1) break;
      const header = chunk.slice(i, nextOpen).trim();

      const balanced = readBalanced(chunk, nextOpen, '{', '}');
      if (!balanced) break;
      i = balanced.endIdx;

      if (!header) continue;

      if (header.toLowerCase().startsWith('@layer')) {
        const rawLayerName = header.slice(6).trim() || '(anonymous)';
        const fullLayer = currentLayer ? `${currentLayer}.${rawLayerName}` : rawLayerName;
        registerLayer(fullLayer);
        walk(balanced.content, fullLayer);
        continue;
      }

      if (header.startsWith('@')) {
        // Recurse into @media / @supports blocks if needed? Only apply top-level or let rules inside work cleanly
        continue;
      }

      const selectorList = splitTopLevelCommas(header).filter(Boolean);
      const declarations = parseDeclarations(balanced.content);
      if (selectorList.length && declarations.length) {
        const rank = currentLayer ? layerOrder.indexOf(currentLayer) + 1 : Number.POSITIVE_INFINITY;
        rules.push({
          selectorList,
          declarations,
          layerName: currentLayer,
          layerRank: rank,
        });
      }
    }
  };

  walk(clean);
  return rules;
}

const SHORTHAND_LONGHANDS: Record<string, string[]> = {
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
  background: ['background-color'],
  gap: ['row-gap', 'column-gap'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  font: ['font-family', 'font-size', 'font-weight', 'line-height'],
};

function expandAffectedProperties(prop: string): string[] {
  return SHORTHAND_LONGHANDS[prop] ?? [prop];
}

function compareCascadePriority(a: Omit<CascadeDeclaration, 'status' | 'reason'>, b: Omit<CascadeDeclaration, 'status' | 'reason'>): number {
  // 1. Origin + !important
  // Priority order: normal author < normal inline < !important inline < !important author?
  // Per CSS spec: !important inline > !important author > normal inline > normal author
  if (a.important !== b.important) {
    return a.important ? 1 : -1;
  }

  if (a.origin !== b.origin) {
    // Same importance: inline always beats author
    return a.origin === 'inline' ? 1 : -1;
  }

  // 2. Cascade Layers (@layer)
  if (a.layerRank !== b.layerRank) {
    // For normal rules, higher layerRank (later layer or unlayered Infinity) wins.
    // For !important rules, lower layerRank (earlier @layer) beats later @layer and unlayered!
    return a.important ? b.layerRank - a.layerRank : a.layerRank - b.layerRank;
  }

  // 3. Specificity
  const specCmp = compareSpecificity(a.specificity, b.specificity);
  if (specCmp !== 0) return specCmp;

  // 4. Source order
  return a.order - b.order;
}

const INHERITED_PROPERTIES = [
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'text-align',
  'letter-spacing',
];

export function analyzeElementCascade(
  element: Element,
  cssText: string,
  win: Window
): {
  declarations: CascadeDeclaration[];
  inherited: InheritedDeclaration[];
} {
  const rules = parseCssRulesWithLayers(cssText);
  const matching: Omit<CascadeDeclaration, 'status' | 'reason'>[] = [];
  let order = 1;

  for (const rule of rules) {
    for (const selector of rule.selectorList) {
      let matches = false;
      try {
        matches = element.matches(selector);
      } catch {
        matches = false;
      }
      if (!matches) continue;
      const specRes = computeSpecificityDetailed(selector);
      if (!specRes.valid) continue;

      for (const decl of rule.declarations) {
        matching.push({
          property: decl.property,
          value: decl.value,
          important: decl.important,
          selector,
          specificity: specRes.specificity,
          order: order++,
          origin: 'author',
          layerName: rule.layerName,
          layerRank: rule.layerRank,
          source: rule.layerName ? `Style block · @layer ${rule.layerName}` : 'Style block',
        });
      }
    }
  }

  // Inline style="" attribute
  const inlineStyle = element.getAttribute('style');
  if (inlineStyle) {
    for (const decl of parseDeclarations(inlineStyle)) {
      matching.push({
        property: decl.property,
        value: decl.value,
        important: decl.important,
        selector: 'style=""',
        specificity: [0, 0, 0],
        order: order++,
        origin: 'inline',
        layerRank: Number.POSITIVE_INFINITY,
        source: 'Inline style=""',
      });
    }
  }

  // Resolve winners per longhand property (supporting shorthand <-> longhand overrides)
  const longhandWinners = new Map<string, Omit<CascadeDeclaration, 'status' | 'reason'>>();
  for (const item of matching) {
    for (const targetProp of expandAffectedProperties(item.property)) {
      const prev = longhandWinners.get(targetProp);
      if (!prev || compareCascadePriority(item, prev) >= 0) {
        longhandWinners.set(targetProp, item);
      }
    }
  }

  const computedStyle = win.getComputedStyle(element);

  const declarations: CascadeDeclaration[] = matching.map((item) => {
    const targets = expandAffectedProperties(item.property);
    const winningTargets = targets.filter((t) => longhandWinners.get(t) === item);
    const isApplied = winningTargets.length > 0;
    const computedValue =
      computedStyle.getPropertyValue(item.property) ||
      (targets.length > 1 ? computedStyle.getPropertyValue(targets[0]) : '');

    if (isApplied) {
      let reason = 'Highest priority matching rule';
      if (item.origin === 'inline') {
        reason = item.important ? 'Inline style with !important' : 'Inline style="" beats normal author selectors';
      } else if (item.important) {
        reason = item.layerName
          ? `!important in @layer ${item.layerName}`
          : '!important overrides normal declarations';
      } else if (item.layerName) {
        reason = `Wins in @layer ${item.layerName} at ${formatSpecificity(item.specificity)}`;
      } else if (winningTargets.length < targets.length) {
        reason = `Shorthand applies (${winningTargets.length}/${targets.length} sides; others overridden by longhand)`;
      }
      return {
        ...item,
        computedValue: computedValue || undefined,
        status: 'applied',
        reason,
      };
    }

    const overriding = longhandWinners.get(targets[0]);
    let reason = 'Overridden by later rule with equal priority';
    if (overriding) {
      if (overriding.origin === 'inline' && item.origin !== 'inline') {
        reason = 'Overridden by inline style="" attribute';
      } else if (overriding.important && !item.important) {
        reason = `Overridden by !important on ${overriding.selector}`;
      } else if (overriding.layerRank !== item.layerRank) {
        reason = overriding.layerName
          ? `Overridden by @layer ${overriding.layerName}`
          : 'Overridden by unlayered rule (higher than @layer)';
      } else if (compareSpecificity(overriding.specificity, item.specificity) > 0) {
        reason = `Overridden by higher specificity ${formatSpecificity(overriding.specificity)} on ${overriding.selector}`;
      } else if (overriding.property !== item.property) {
        reason = `Overridden by ${overriding.property} on ${overriding.selector}`;
      }
    }

    return {
      ...item,
      computedValue: computedValue || undefined,
      status: 'overridden',
      reason,
    };
  });

  // Inherited properties when no authored rule won that property on the element
  const inherited: InheritedDeclaration[] = [];
  const parent = element.parentElement;
  if (parent) {
    const parentStyle = win.getComputedStyle(parent);
    const parentTag = parent.tagName.toLowerCase();
    for (const prop of INHERITED_PROPERTIES) {
      if (!longhandWinners.has(prop)) {
        const val = parentStyle.getPropertyValue(prop);
        if (val) {
          inherited.push({ property: prop, value: val, fromTag: parentTag });
        }
      }
    }
  }

  return { declarations, inherited };
}
