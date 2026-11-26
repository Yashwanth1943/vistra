/**
 * Spec-accurate Real-DOM CSS Stacking Context, Trigger Detection & Paint Order Analyzer.
 * Inspects actual computed styles from an iframe Window rather than assuming every
 * positioned element creates a stacking context.
 */

import { getPathForElement } from './dom-operations';

export type StackingTriggerInfo = {
  createsContext: boolean;
  triggers: string[];
};

export type StackingTreeNode = {
  path: number[];
  label: string;
  tag: string;
  position: string;
  zIndex: string;
  createsContext: boolean;
  triggers: string[];
  parentContextLabel: string;
  stackingLevel: string;
  paintOrderScore: number;
  children: StackingTreeNode[];
};

export type PaintOrderEntry = {
  path: number[];
  label: string;
  phase: string;
  zIndex: string;
  parentContextLabel: string;
  createsContext: boolean;
  triggers: string[];
  depth: number;
};

export function formatElementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${el.id}`;
  if (el.classList.length > 0) return `.${el.classList[0]}`;
  return `<${tag}>`;
}

export function detectStackingContextTriggers(
  el: Element,
  st: CSSStyleDeclaration,
  parentSt: CSSStyleDeclaration | null
): StackingTriggerInfo {
  const triggers: string[] = [];
  const tag = el.tagName.toLowerCase();

  if (tag === 'html' || tag === 'body') {
    triggers.push('Root element');
  }

  const pos = st.position;
  const z = st.zIndex;
  const hasNumericZ = z !== 'auto' && z !== '';

  if ((pos === 'relative' || pos === 'absolute') && hasNumericZ) {
    triggers.push(`position: ${pos} + z-index: ${z}`);
  }
  if (pos === 'fixed' || pos === 'sticky') {
    triggers.push(`position: ${pos}`);
  }

  if (parentSt) {
    const pDisp = parentSt.display;
    if ((pDisp === 'flex' || pDisp === 'inline-flex') && hasNumericZ) {
      triggers.push(`flex item + z-index: ${z}`);
    } else if ((pDisp === 'grid' || pDisp === 'inline-grid') && hasNumericZ) {
      triggers.push(`grid item + z-index: ${z}`);
    }
  }

  const opacityNum = parseFloat(st.opacity);
  if (Number.isFinite(opacityNum) && opacityNum < 1) {
    triggers.push(`opacity: ${st.opacity}`);
  }

  if (st.transform && st.transform !== 'none') {
    triggers.push('transform');
  }
  if (st.filter && st.filter !== 'none') {
    triggers.push('filter');
  }
  if ((st as CSSStyleDeclaration & { backdropFilter?: string }).backdropFilter &&
      (st as CSSStyleDeclaration & { backdropFilter?: string }).backdropFilter !== 'none') {
    triggers.push('backdrop-filter');
  }
  if (st.isolation === 'isolate') {
    triggers.push('isolation: isolate');
  }
  if (st.mixBlendMode && st.mixBlendMode !== 'normal') {
    triggers.push(`mix-blend-mode: ${st.mixBlendMode}`);
  }
  if (st.clipPath && st.clipPath !== 'none') {
    triggers.push('clip-path');
  }
  if (st.willChange && /\b(transform|opacity|filter|z-index)\b/.test(st.willChange)) {
    triggers.push(`will-change: ${st.willChange}`);
  }
  if (st.contain && /\b(layout|paint|strict|content)\b/.test(st.contain)) {
    triggers.push(`contain: ${st.contain}`);
  }

  return {
    createsContext: triggers.length > 0,
    triggers,
  };
}

function classifyStackingLevel(position: string, zIndex: string, createsContext: boolean): string {
  const num = Number(zIndex);
  if (zIndex !== 'auto' && Number.isFinite(num)) {
    if (num < 0) return `Negative z-index (${num})`;
    if (num > 0) return `Positive z-index (${num})`;
    return 'z-index: 0 (positioned/context)';
  }
  if (position !== 'static') {
    return createsContext ? 'Positioned context (z-index: auto)' : 'Positioned (z-index: auto)';
  }
  return createsContext ? 'Stacking context (auto / level 0)' : 'In-flow normal order';
}

function numericZSortKey(position: string, zIndex: string, createsContext: boolean): number {
  const num = Number(zIndex);
  if (zIndex !== 'auto' && Number.isFinite(num)) {
    if (num < 0) return 1000 + num;
    if (num > 0) return 4000 + num;
    return 3000;
  }
  if (position !== 'static' || createsContext) return 3000;
  return 2000;
}

export function analyzeStackingHierarchy(
  body: Element,
  win: Window
): {
  tree: StackingTreeNode[];
  paintOrder: PaintOrderEntry[];
  flatByPath: Map<string, StackingTreeNode>;
} {
  const flatByPath = new Map<string, StackingTreeNode>();

  const buildNode = (
    el: Element,
    parentSt: CSSStyleDeclaration | null,
    parentContextLabel: string
  ): StackingTreeNode => {
    const st = win.getComputedStyle(el);
    const label = formatElementLabel(el);
    const { createsContext, triggers } = detectStackingContextTriggers(el, st, parentSt);
    const path = getPathForElement(body, el);
    const nextParentCtx = createsContext ? `${label}${triggers[0] ? ` (${triggers[0]})` : ''}` : parentContextLabel;

    const children = Array.from(el.children).map((child) => buildNode(child, st, nextParentCtx));
    const node: StackingTreeNode = {
      path,
      label,
      tag: el.tagName.toLowerCase(),
      position: st.position,
      zIndex: st.zIndex,
      createsContext,
      triggers,
      parentContextLabel,
      stackingLevel: classifyStackingLevel(st.position, st.zIndex, createsContext),
      paintOrderScore: numericZSortKey(st.position, st.zIndex, createsContext),
      children,
    };
    flatByPath.set(path.join('.'), node);
    return node;
  };

  const bodySt = win.getComputedStyle(body);
  const tree = Array.from(body.children).map((child) => buildNode(child, bodySt, '<body> (root)'));

  // Build CSS2.1 Appendix E style paint order walk per stacking context
  const paintOrder: PaintOrderEntry[] = [];
  const walkContext = (nodes: StackingTreeNode[], depth: number) => {
    const sorted = [...nodes].sort((a, b) => a.paintOrderScore - b.paintOrderScore);
    for (const node of sorted) {
      let phase = 'Normal flow';
      if (node.paintOrderScore < 2000) phase = 'Negative z-index (-)';
      else if (node.paintOrderScore >= 4000) phase = `Positive z-index (${node.zIndex})`;
      else if (node.paintOrderScore === 3000) phase = node.createsContext ? 'Level 0 / Context' : 'Positioned (auto)';

      paintOrder.push({
        path: node.path,
        label: node.label,
        phase,
        zIndex: node.zIndex,
        parentContextLabel: node.parentContextLabel,
        createsContext: node.createsContext,
        triggers: node.triggers,
        depth,
      });

      if (node.children.length > 0) {
        walkContext(node.children, node.createsContext ? depth + 1 : depth);
      }
    }
  };

  walkContext(tree, 0);

  return { tree, paintOrder, flatByPath };
}
