'use client';

import type { ReactNode } from 'react';
import { MotionConfig, motion } from 'motion/react';

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export const MOTION_TIMING = {
  fast: 0.2,
  standard: 0.38,
  reveal: 0.5,
  stagger: 0.055,
} as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function WordReveal({
  text,
  accentFromWord,
  className = '',
}: {
  text: string;
  accentFromWord?: number;
  className?: string;
}) {
  const words = text.split(' ');
  return (
    <span className={className}>
      {words.map((word, index) => {
        const isAccent = accentFromWord !== undefined && index >= accentFromWord;
        return (
          <motion.span
            key={`${word}-${index}`}
            className={`sc-word ${isAccent ? 'accent' : ''}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: MOTION_TIMING.standard,
              delay: 0.04 + index * MOTION_TIMING.stagger,
              ease: MOTION_EASE,
            }}
          >
            {word}{' '}
          </motion.span>
        );
      })}
    </span>
  );
}

export function ScrollReveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{
        duration: MOTION_TIMING.reveal,
        delay,
        ease: MOTION_EASE,
      }}
    >
      {children}
    </motion.div>
  );
}
