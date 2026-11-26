'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Columns2, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react';

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="viz-control">
      <div className="viz-control-head">
        <span>{label}</span>
        <code>{value}</code>
      </div>
      <div className="viz-segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="viz-control">
      <div className="viz-control-head">
        <span>{label}</span>
        <code>{value}</code>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="viz-control">
      <div className="viz-control-head">
        <span>{label}</span>
        <code>
          {value}
          {unit}
        </code>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function NumberControl({
  label,
  value,
  min,
  max,
  unit = 'px',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="viz-control">
      <div className="viz-control-head">
        <span>{label}</span>
        <code>
          {value}
          {unit}
        </code>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
      />
    </label>
  );
}

export function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="viz-control viz-color-control">
      <div className="viz-control-head">
        <span>{label}</span>
        <code>{value}</code>
      </div>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="viz-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function CountControl({
  label,
  value,
  min = 1,
  max = 12,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="viz-control">
      <div className="viz-control-head">
        <span>{label}</span>
        <code>{value}</code>
      </div>
      <div className="viz-counter">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus size={13} />
        </button>
        <span>{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

export function LabHeader({
  eyebrow,
  title,
  copy,
  presets,
  activePreset,
  onPreset,
  compareEnabled,
  onToggleCompare,
  onReset,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  presets?: { id: string; label: string }[];
  activePreset?: string;
  onPreset?: (id: string) => void;
  compareEnabled?: boolean;
  onToggleCompare?: () => void;
  onReset: () => void;
}) {
  return (
    <div className="viz-header">
      <div>
        <div className="eyebrow-line">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      <div className="viz-header-actions">
        {presets && onPreset && (
          <div className="viz-presets" role="group" aria-label="Presets">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`viz-preset-btn ${activePreset === p.id ? 'active' : ''}`}
                onClick={() => onPreset(p.id)}
              >
                <Sparkles size={12} /> {p.label}
              </button>
            ))}
          </div>
        )}
        {onToggleCompare && (
          <button
            type="button"
            className={`reset-button ${compareEnabled ? 'active' : ''}`}
            onClick={onToggleCompare}
            aria-pressed={compareEnabled}
          >
            <Columns2 size={14} /> {compareEnabled ? 'Exit compare' : 'Compare values'}
          </button>
        )}
        <button type="button" className="reset-button" onClick={onReset}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}

export function DualCodeOutput({
  css,
  html,
  highlightProp,
  onReset,
}: {
  css: string;
  html?: string;
  highlightProp?: string;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<'css' | 'html'>('css');
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const activeCode = tab === 'html' && html ? html : css;

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(activeCode);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setCopied(false);
        timer.current = null;
      }, 1300);
    } catch {
      setCopied(false);
    }
  };

  const lines = activeCode.split('\n');

  return (
    <div className="visual-code">
      <div className="visual-code-head">
        <div className="viz-code-tabs" role="tablist" aria-label="Generated code">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'css'}
            className={tab === 'css' ? 'active' : ''}
            onClick={() => setTab('css')}
          >
            CSS
          </button>
          {html && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'html'}
              className={tab === 'html' ? 'active' : ''}
              onClick={() => setTab('html')}
            >
              HTML
            </button>
          )}
        </div>
        <div>
          <button type="button" onClick={onReset}>
            <RotateCcw size={13} /> Reset
          </button>
          <button type="button" onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : `Copy ${tab.toUpperCase()}`}
          </button>
        </div>
      </div>
      <pre>
        <code>
          {lines.map((line, i) => {
            const isHighlighted =
              Boolean(highlightProp) &&
              tab === 'css' &&
              line.toLowerCase().includes(highlightProp!.toLowerCase());
            return (
              <span key={i} className={isHighlighted ? 'viz-code-line highlight' : 'viz-code-line'}>
                {line}
                {i < lines.length - 1 ? '\n' : ''}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
