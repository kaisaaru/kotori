"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ScrollRevealOptions {
  /** Threshold before triggering (0-1). Default 0.1 */
  threshold?: number;
  /** Root margin for earlier/later trigger. Default "0px 0px -40px 0px" */
  rootMargin?: string;
  /** Only trigger once. Default true */
  once?: boolean;
}

/**
 * Custom hook for scroll-reveal animations using IntersectionObserver.
 * Returns a ref to attach to the element + boolean `isVisible`.
 *
 * Usage:
 *   const [ref, isVisible] = useScrollReveal();
 *   <div ref={ref} className={`kb-reveal ${isVisible ? "kb-visible" : ""}`}>
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {}
): [React.RefObject<T | null>, boolean] {
  const { threshold = 0.1, rootMargin = "0px 0px -40px 0px", once = true } = options;
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip on reduced-motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, isVisible];
}

/**
 * Lightweight component wrapper for scroll-reveal.
 * Accepts delay (stagger index) for cascading animations.
 */
export function useStaggerReveal<T extends HTMLElement = HTMLDivElement>(
  index: number,
  options: ScrollRevealOptions = {}
): [React.RefObject<T | null>, boolean, React.CSSProperties] {
  const [ref, isVisible] = useScrollReveal<T>(options);
  const style: React.CSSProperties = {
    transitionDelay: `${index * 80}ms`,
  };
  return [ref, isVisible, style];
}
