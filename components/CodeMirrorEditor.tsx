'use client';

import { useEffect, useRef } from 'react';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { HighlightStyle, bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';

type EditorLanguage = 'html' | 'css';

const darkEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#181d2c',
      color: '#dce4f7',
      height: '100%',
      width: '100%',
      fontSize: '12.5px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    '.cm-scroller': {
      overflowY: 'auto',
      overflowX: 'hidden',
      lineHeight: '1.65',
    },
    '.cm-content': {
      padding: '10px 8px 10px 0',
      caretColor: '#ffffff',
      minWidth: '0',
    },
    '.cm-line': {
      wordBreak: 'break-word',
    },
    '.cm-gutters': {
      backgroundColor: '#181d2c',
      color: '#5a6582',
      borderRight: '1px solid #252d42',
      minWidth: '40px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 10px 0 8px',
      fontSize: '11px',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(83, 102, 223, 0.08)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(83, 102, 223, 0.12)',
      color: '#a8b5d8',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(83, 102, 223, 0.32)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(130, 170, 255, 0.22)',
      outline: '1px solid rgba(130, 170, 255, 0.5)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      backgroundColor: '#21283c',
      border: '1px solid #35405f',
      borderRadius: '7px',
      color: '#dce4f7',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: '#5366df',
      color: '#ffffff',
    },
  },
  { dark: true }
);

const darkHighlightStyle = HighlightStyle.define([
  { tag: [tags.tagName, tags.angleBracket], color: '#c792ea' },
  { tag: [tags.attributeName, tags.propertyName], color: '#f78c6c' },
  { tag: [tags.attributeValue, tags.string, tags.color], color: '#c3e88d' },
  { tag: [tags.className, tags.labelName, tags.definition(tags.variableName)], color: '#82aaff' },
  { tag: [tags.keyword, tags.definitionKeyword], color: '#c792ea' },
  { tag: [tags.number, tags.unit], color: '#f78c6c' },
  { tag: [tags.comment], color: '#6b7794', fontStyle: 'italic' },
  { tag: [tags.punctuation, tags.bracket], color: '#8994b0' },
]);

export function CodeMirrorEditor({
  language,
  value,
  ariaLabel,
  onChange,
  onFocus,
  onRun,
  onSave,
  onFormat,
  onNextPane,
}: {
  language: EditorLanguage;
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onRun: () => void;
  onSave: () => void;
  onFormat: () => void;
  onNextPane: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacksRef = useRef({ onChange, onFocus, onRun, onSave, onFormat, onNextPane });
  callbacksRef.current = { onChange, onFocus, onRun, onSave, onFormat, onNextPane };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        indentUnit.of('  '),
        history(),
        indentOnInput(),
        bracketMatching(),
        autocompletion(),
        language === 'html' ? html({ autoCloseTags: true }) : css(),
        darkEditorTheme,
        syntaxHighlighting(darkHighlightStyle),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              callbacksRef.current.onRun();
              return true;
            },
          },
          {
            key: 'Mod-s',
            run: () => {
              callbacksRef.current.onSave();
              return true;
            },
          },
          {
            key: 'Shift-Alt-f',
            run: () => {
              callbacksRef.current.onFormat();
              return true;
            },
          },
          {
            key: 'Mod-Shift-f',
            run: () => {
              callbacksRef.current.onFormat();
              return true;
            },
          },
          {
            key: 'Ctrl-m',
            run: () => {
              callbacksRef.current.onNextPane();
              return true;
            },
          },
          indentWithTab,
          ...completionKeymap,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.focusChanged && update.view.hasFocus) {
            callbacksRef.current.onFocus();
          }
          if (update.docChanged) {
            callbacksRef.current.onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally recreate editor only when language or ariaLabel changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      const prevHead = view.state.selection.main.head;
      const safeHead = Math.min(prevHead, value.length);
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        selection: { anchor: safeHead },
      });
    }
  }, [value]);

  return <div ref={hostRef} className="cm-host" />;
}
