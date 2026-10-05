'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

type Props = {
  as?: ElementType;
  className?: string;
  delay?: number;
  children: ReactNode;
};

// Fades its children in the first time they scroll into view. Shows them at once
// when IntersectionObserver is missing or the visitor prefers reduced motion.
export default function Reveal({ as: Tag = 'div', className = '', delay = 0, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduce || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`ui-reveal ${seen ? 'is-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
