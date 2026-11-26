'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type DomTreeNode = {
  path: number[];
  tag: string;
  id: string;
  classes: string[];
  textPreview: string;
  children: DomTreeNode[];
};

export function pathKey(path: number[]): string {
  return path.join('.');
}

export function buildDomTreeFromElement(root: Element, path: number[] = []): DomTreeNode[] {
  return Array.from(root.children).map((child, idx) => {
    const childPath = [...path, idx];
    const directText = Array.from(child.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent ?? '').trim())
      .filter(Boolean)
      .join(' ');
    return {
      path: childPath,
      tag: child.tagName.toLowerCase(),
      id: child.id,
      classes: Array.from(child.classList),
      textPreview: directText.length > 36 ? `${directText.slice(0, 36)}…` : directText,
      children: buildDomTreeFromElement(child, childPath),
    };
  });
}

export function collectAllNodeKeys(nodes: DomTreeNode[]): string[] {
  const keys: string[] = [];
  const walk = (list: DomTreeNode[]) => {
    for (const node of list) {
      if (node.children.length > 0 || node.textPreview) {
        keys.push(pathKey(node.path));
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return keys;
}

export function DomTreeVisualizer({
  nodes,
  selectedPath,
  expandedKeys,
  onToggleExpand,
  onSelectNode,
  onExpandAll,
  onCollapseAll,
}: {
  nodes: DomTreeNode[];
  selectedPath: number[];
  expandedKeys: Set<string>;
  onToggleExpand: (key: string) => void;
  onSelectNode: (path: number[]) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const selectedKey = pathKey(selectedPath);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedKey]);

  const visibleNodes: DomTreeNode[] = [];
  const collectVisible = (list: DomTreeNode[]) => {
    for (const n of list) {
      visibleNodes.push(n);
      if (expandedKeys.has(pathKey(n.path)) && n.children.length > 0) {
        collectVisible(n.children);
      }
    }
  };
  collectVisible(nodes);

  const handleTreeKeyDown = (e: React.KeyboardEvent, node: DomTreeNode, isExpanded: boolean, hasBranch: boolean) => {
    const key = pathKey(node.path);
    const idx = visibleNodes.findIndex((n) => pathKey(n.path) === key);
    if (e.key === 'ArrowDown' && idx >= 0 && idx < visibleNodes.length - 1) {
      e.preventDefault();
      onSelectNode(visibleNodes[idx + 1].path);
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      onSelectNode(visibleNodes[idx - 1].path);
    } else if (e.key === 'ArrowRight' && hasBranch && !isExpanded) {
      e.preventDefault();
      onToggleExpand(key);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (hasBranch && isExpanded) {
        onToggleExpand(key);
      } else if (node.path.length > 1) {
        onSelectNode(node.path.slice(0, -1));
      }
    }
  };

  const renderNode = (node: DomTreeNode, depth: number) => {
    const key = pathKey(node.path);
    const hasBranch = node.children.length > 0 || Boolean(node.textPreview);
    const isExpanded = expandedKeys.has(key);
    const isSelected = key === selectedKey;

    return (
      <div key={key} className="domv-branch">
        <div
          className={`domv-row ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          {hasBranch ? (
            <button
              type="button"
              className="domv-toggle"
              aria-label={isExpanded ? `Collapse <${node.tag}>` : `Expand <${node.tag}>`}
              aria-expanded={isExpanded}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(key);
              }}
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : (
            <span className="domv-toggle-spacer" />
          )}

          <button
            ref={isSelected ? selectedRef : null}
            type="button"
            role="treeitem"
            aria-selected={isSelected}
            aria-expanded={hasBranch ? isExpanded : undefined}
            className="domv-node-btn"
            aria-current={isSelected ? 'true' : undefined}
            onClick={() => onSelectNode(node.path)}
            onKeyDown={(e) => handleTreeKeyDown(e, node, isExpanded, hasBranch)}
          >
            <code className="domv-tag">&lt;{node.tag}&gt;</code>
            {node.id && <span className="domv-id">#{node.id}</span>}
            {node.classes.length > 0 && (
              <span className="domv-classes">.{node.classes.join('.')}</span>
            )}
            {!isExpanded && node.textPreview && (
              <span className="domv-inline-text">&ldquo;{node.textPreview}&rdquo;</span>
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="domv-children">
            {node.textPreview && (
              <div
                className="domv-text-node"
                style={{ paddingLeft: 26 + (depth + 1) * 14 }}
              >
                <span className="domv-text-badge">#text</span>
                <span>&ldquo;{node.textPreview}&rdquo;</span>
              </div>
            )}
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="domv-panel" aria-label="Interactive HTML DOM Tree">
      <div className="domv-header">
        <span className="dbg-bar-sub">DOM TREE (&lt;body&gt;)</span>
        <div className="domv-header-actions">
          <button type="button" onClick={onExpandAll}>
            Expand all
          </button>
          <button type="button" onClick={onCollapseAll}>
            Collapse
          </button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <p className="domv-empty">
          No HTML elements in <code>&lt;body&gt;</code> yet. Edit HTML below or choose a preset.
        </p>
      ) : (
        <div className="domv-tree" role="tree">
          {nodes.map((node) => renderNode(node, 0))}
        </div>
      )}
    </div>
  );
}
