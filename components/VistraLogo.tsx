'use client';

import { useId } from 'react';

export type VistraLogoVariant = 'full' | 'icon' | 'compact';

export interface VistraLogoProps {
  variant?: VistraLogoVariant;
  /** Height of the logo in pixels. Defaults to 32 (full), 26 (compact), or 24 (icon). */
  size?: number;
  className?: string;
  /** Set true when paired with adjacent visible brand text or inside a labelled button. */
  decorative?: boolean;
  label?: string;
}

/**
 * Reusable Vistra brand mark and wordmark component.
 * Supports full (symbol + wordmark), compact (mobile nav), and icon-only variants.
 */
export function VistraLogo({
  variant = 'full',
  size,
  className = '',
  decorative = false,
  label = 'Vistra',
}: VistraLogoProps) {
  const uid = useId().replace(/:/g, '');
  const leftGradId = `vistra-l-${uid}`;
  const rightGradId = `vistra-r-${uid}`;

  const defaultHeight = variant === 'full' ? 32 : variant === 'compact' ? 26 : 24;
  const height = size ?? defaultHeight;

  const accessibilityProps = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': label };

  if (variant === 'icon') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={height}
        height={height}
        fill="none"
        className={`vistra-logo vistra-logo--icon ${className}`.trim()}
        {...accessibilityProps}
      >
        <defs>
          <linearGradient id={leftGradId} x1="8" y1="10" x2="34" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6D28D9" />
            <stop offset="65%" stopColor="#5B21B6" />
            <stop offset="100%" stopColor="#431693" />
          </linearGradient>
          <linearGradient id={rightGradId} x1="25" y1="54" x2="56" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="52%" stopColor="#9B7AF7" />
            <stop offset="100%" stopColor="#C4B5FD" />
          </linearGradient>
        </defs>
        <path
          d="M8.5 11.5C7.9 10.5 8.6 9.5 9.8 9.5H20.4C21.6 9.5 22.7 10.1 23.3 11.1L36.2 33.4L29.6 45.2C27.9 48.2 24.4 48.2 22.7 45.2L8.5 11.5Z"
          fill={`url(#${leftGradId})`}
        />
        <path
          d="M23.5 46.8C25.2 49.8 27.9 53.5 32 53.5C36.1 53.5 38.8 50.1 40.5 47.1L55.5 11.5C56.1 10.5 55.4 9.5 54.2 9.5H43.6C42.4 9.5 41.3 10.1 40.7 11.1L27.1 35.1C25.3 38.3 24.2 42.9 23.5 46.8Z"
          fill={`url(#${rightGradId})`}
        />
      </svg>
    );
  }

  const isCompact = variant === 'compact';
  const viewBox = isCompact ? '0 0 184 48' : '0 0 206 52';
  const aspectRatio = isCompact ? 184 / 48 : 206 / 52;
  const width = Math.round(height * aspectRatio);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={width}
      height={height}
      fill="none"
      className={`vistra-logo vistra-logo--${variant} ${className}`.trim()}
      {...accessibilityProps}
    >
      <defs>
        <linearGradient id={leftGradId} x1="4" y1="6" x2="28" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6D28D9" />
          <stop offset="65%" stopColor="#5B21B6" />
          <stop offset="100%" stopColor="#431693" />
        </linearGradient>
        <linearGradient id={rightGradId} x1="20" y1="46" x2="48" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="52%" stopColor="#9B7AF7" />
          <stop offset="100%" stopColor="#C4B5FD" />
        </linearGradient>
      </defs>
      <g transform={isCompact ? 'scale(0.9)' : undefined}>
        <path
          d="M4.5 8.5C3.9 7.6 4.6 6.5 5.8 6.5H15.4C16.5 6.5 17.5 7.1 18.1 8.1L29.6 28.2L23.6 38.9C22.1 41.6 18.9 41.6 17.4 38.9L4.5 8.5Z"
          fill={`url(#${leftGradId})`}
        />
        <path
          d="M18.1 40.3C19.6 43 22.1 46.5 25.8 46.5C29.5 46.5 32 43.3 33.5 40.6L47.1 8.5C47.7 7.6 47 6.5 45.8 6.5H36.2C35.1 6.5 34.1 7.1 33.5 8.1L21.3 29.8C19.7 32.7 18.7 36.8 18.1 40.3Z"
          fill={`url(#${rightGradId})`}
        />
        <text
          x="56"
          y="38"
          fill="#0F0F1A"
          fontFamily="'Sora', 'Poppins', system-ui, -apple-system, sans-serif"
          fontSize="34"
          fontWeight="600"
          letterSpacing="-0.8"
        >
          Vistra
        </text>
        <path
          d="M186 4L188.1 10.4L194.5 12.5L188.1 14.6L186 21L183.9 14.6L177.5 12.5L183.9 10.4L186 4Z"
          fill="#6D28D9"
        />
      </g>
    </svg>
  );
}
