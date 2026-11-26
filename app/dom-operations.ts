/**
 * Safe, isolated HTML DOM parsing, serialization, and experimentation utilities.
 * Uses DOMParser on untrusted student HTML without touching the parent application DOM.
 */

export function sanitizeUntrustedHtml(raw: string): string {
  return raw
    .replace(/<script\b[^>]*>(?:[\s\S]*?<\/script\s*>|[\s\S]*$)/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function formatElement(el: Element, depth: number): string {
  const indent = '  '.repeat(depth);
  const tag = el.tagName.toLowerCase();
  const attrs = Array.from(el.attributes)
    .map((a) => (a.value === '' && (a.name === 'required' || a.name === 'disabled') ? a.name : `${a.name}="${a.value.replace(/"/g, '&quot;')}"`))
    .join(' ');
  const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;

  if (VOID_TAGS.has(tag)) {
    return `${indent}${openTag}`;
  }

  const children = Array.from(el.childNodes).filter(
    (node) => node.nodeType === 1 || (node.nodeType === 3 && Boolean(node.textContent?.trim()))
  );

  if (children.length === 0) {
    return `${indent}${openTag}</${tag}>`;
  }

  if (children.length === 1 && children[0].nodeType === 3) {
    const text = (children[0].textContent ?? '').trim();
    return `${indent}${openTag}${text}</${tag}>`;
  }

  const inner = children
    .map((node) => {
      if (node.nodeType === 3) {
        return `${'  '.repeat(depth + 1)}${(node.textContent ?? '').trim()}`;
      }
      return formatElement(node as Element, depth + 1);
    })
    .join('\n');

  return `${indent}${openTag}\n${inner}\n${indent}</${tag}>`;
}

export function serializeBodyHtml(body: Element): string {
  return Array.from(body.children)
    .map((child) => formatElement(child, 0))
    .join('\n');
}

export function getElementByPath(root: Element, path: number[]): Element | null {
  let cur: Element | null = root;
  for (const idx of path) {
    if (!cur || !cur.children[idx]) return null;
    cur = cur.children[idx];
  }
  return cur;
}

export function getPathForElement(root: Element, target: Element): number[] {
  const path: number[] = [];
  let cur: Element | null = target;
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
    const idx = Array.from(parent.children).indexOf(cur);
    if (idx === -1) break;
    path.unshift(idx);
    cur = parent;
  }
  return path;
}

export type DomMutationResult = {
  html: string;
  nextPath: number[];
};

function runDomMutation(
  rawHtml: string,
  path: number[],
  mutate: (doc: Document, target: Element) => number[] | void
): DomMutationResult | null {
  if (typeof DOMParser === 'undefined') return null;
  const parser = new DOMParser();
  const parsed = parser.parseFromString(sanitizeUntrustedHtml(rawHtml), 'text/html');
  const target = getElementByPath(parsed.body, path);
  if (!target) return null;
  const nextPath = mutate(parsed, target) ?? path;
  return {
    html: serializeBodyHtml(parsed.body),
    nextPath,
  };
}

export function addChildElement(
  rawHtml: string,
  path: number[],
  tagName: string,
  textContent: string
): DomMutationResult | null {
  const safeTag = tagName.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'div';
  return runDomMutation(rawHtml, path, (doc, target) => {
    if (VOID_TAGS.has(target.tagName.toLowerCase())) return path;
    const child = doc.createElement(safeTag);
    if (!VOID_TAGS.has(safeTag)) {
      child.textContent = textContent.trim() || `New <${safeTag}>`;
    } else if (safeTag === 'input') {
      child.setAttribute('type', 'text');
      child.setAttribute('placeholder', 'New input');
    } else if (safeTag === 'img') {
      child.setAttribute('alt', 'Image');
    }
    target.appendChild(child);
    return [...path, target.children.length - 1];
  });
}

export function removeElementAtPath(rawHtml: string, path: number[]): DomMutationResult | null {
  if (path.length === 0) return null;
  return runDomMutation(rawHtml, path, (doc, target) => {
    const parent = target.parentElement;
    if (!parent) return [];
    const parentPath = path.slice(0, -1);
    const idx = path[path.length - 1];
    target.remove();
    if (parent.children.length > 0) {
      return [...parentPath, Math.min(idx, parent.children.length - 1)];
    }
    if (parentPath.length > 0) return parentPath;
    return doc.body.children.length > 0 ? [0] : [];
  });
}

export function updateElementText(
  rawHtml: string,
  path: number[],
  nextText: string
): DomMutationResult | null {
  return runDomMutation(rawHtml, path, (doc, target) => {
    if (VOID_TAGS.has(target.tagName.toLowerCase())) return;
    const firstText = Array.from(target.childNodes).find((n) => n.nodeType === 3 && n.textContent?.trim());
    if (target.children.length === 0) {
      target.textContent = nextText;
    } else if (firstText) {
      firstText.textContent = nextText;
    } else {
      target.prepend(doc.createTextNode(nextText));
    }
  });
}

export function setElementAttribute(
  rawHtml: string,
  path: number[],
  attrName: string,
  attrValue: string
): DomMutationResult | null {
  const cleanName = attrName.trim().toLowerCase().replace(/[^a-z0-9:-]/g, '');
  if (!cleanName || cleanName.startsWith('on')) return null;
  return runDomMutation(rawHtml, path, (_doc, target) => {
    target.setAttribute(cleanName, attrValue);
  });
}

export function removeElementAttribute(
  rawHtml: string,
  path: number[],
  attrName: string
): DomMutationResult | null {
  return runDomMutation(rawHtml, path, (_doc, target) => {
    target.removeAttribute(attrName);
  });
}

export function setElementClasses(
  rawHtml: string,
  path: number[],
  classesRaw: string
): DomMutationResult | null {
  const cleaned = classesRaw
    .split(/\s+/)
    .map((c) => c.trim().replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .join(' ');
  return runDomMutation(rawHtml, path, (_doc, target) => {
    if (cleaned) {
      target.setAttribute('class', cleaned);
    } else {
      target.removeAttribute('class');
    }
  });
}

export function reorderSiblingElement(
  rawHtml: string,
  path: number[],
  direction: 'up' | 'down'
): DomMutationResult | null {
  if (path.length === 0) return null;
  return runDomMutation(rawHtml, path, (_doc, target) => {
    const parent = target.parentElement;
    if (!parent) return path;
    const idx = path[path.length - 1];
    if (direction === 'up' && idx > 0 && target.previousElementSibling) {
      parent.insertBefore(target, target.previousElementSibling);
      return [...path.slice(0, -1), idx - 1];
    }
    if (direction === 'down' && idx < parent.children.length - 1 && target.nextElementSibling) {
      parent.insertBefore(target.nextElementSibling, target);
      return [...path.slice(0, -1), idx + 1];
    }
    return path;
  });
}
