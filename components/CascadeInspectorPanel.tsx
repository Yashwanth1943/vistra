'use client';

import { useState } from 'react';
import {
  computeSpecificityDetailed,
  formatSpecificity,
  type CascadeDeclaration,
  type InheritedDeclaration,
} from '../app/css-cascade';

const SAMPLE_SELECTORS = [
  '#hero-note',
  '.card:is(.featured, #hero)',
  ':where(#a) .btn',
  'nav > a[href^="https"]::after',
];

export function CascadeInspectorPanel({
  targetLabel,
  declarations,
  inherited,
}: {
  targetLabel: string;
  declarations: CascadeDeclaration[];
  inherited: InheritedDeclaration[];
}) {
  const [selectorInput, setSelectorInput] = useState('.card:is(.featured, #hero)');
  const specResult = computeSpecificityDetailed(selectorInput);

  return (
    <div className="dbg-cascade-view">
      {/* Interactive Specificity Calculator */}
      <div className="cas-calc-box">
        <div className="cas-calc-head">
          <span>SPECIFICITY CALCULATOR</span>
          <div className="cas-samples">
            {SAMPLE_SELECTORS.map((s) => (
              <button key={s} type="button" onClick={() => setSelectorInput(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="cas-calc-input-row">
          <input
            aria-label="Test CSS selector specificity"
            value={selectorInput}
            onChange={(e) => setSelectorInput(e.target.value)}
            placeholder="Type any selector (e.g. :is(.a, #b) > p)"
          />
          {specResult.valid ? (
            <div className="cas-tuple" aria-label="Specificity tuple">
              <span title="IDs">ID: {specResult.specificity[0]}</span>
              <span title="Classes, attributes, pseudo-classes">CLS: {specResult.specificity[1]}</span>
              <span title="Elements and pseudo-elements">EL: {specResult.specificity[2]}</span>
              <strong>{formatSpecificity(specResult.specificity)}</strong>
            </div>
          ) : (
            <span className="cas-invalid">{specResult.error || 'Invalid selector'}</span>
          )}
        </div>
      </div>

      {/* Matching Rules & Cascade Order */}
      <h4>MATCHING RULES FOR {targetLabel} ({declarations.length})</h4>
      {declarations.length === 0 ? (
        <p className="dbg-empty-note">No authored CSS rules matched this element.</p>
      ) : (
        <div className="dbg-cascade-list">
          {declarations.map((d, idx) => (
            <div key={`${d.selector}-${d.property}-${idx}`} className={`dbg-cascade-row ${d.status}`}>
              <div className="dbg-cascade-main">
                <code>
                  {d.property}: {d.value}
                  {d.important ? ' !important' : ''};
                </code>
                <span className={`dbg-status ${d.status}`}>{d.status}</span>
              </div>
              <small>
                <span>#{d.order}</span> · <code>{d.selector}</code> · Specificity{' '}
                <strong>{formatSpecificity(d.specificity)}</strong> · {d.source}
              </small>
              <small className="cas-reason">
                {d.reason}
                {d.status === 'applied' && d.computedValue ? (
                  <>
                    {' '}· Computed (<code>getComputedStyle</code>): <code>{d.computedValue}</code>
                  </>
                ) : null}
              </small>
            </div>
          ))}
        </div>
      )}

      {/* Inherited Properties */}
      {inherited.length > 0 && (
        <>
          <h4 style={{ marginTop: 12 }}>INHERITED PROPERTIES</h4>
          <div className="dbg-prop-table">
            {inherited.map((item) => (
              <div key={item.property} className="dbg-prop-row">
                <code>
                  {item.property} <small>(from &lt;{item.fromTag}&gt;)</small>
                </code>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
