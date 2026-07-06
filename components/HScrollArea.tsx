"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface HScrollAreaProps {
  children: ReactNode;
  className?: string;
  /** Tailwind max-height class for the scroll container, e.g. "max-h-[520px]". */
  maxHeightClassName?: string;
}

const DEFAULT_MAX_HEIGHT = "max-h-[65vh]";

/**
 * Wraps a table that may overflow both horizontally and vertically.
 *
 * - The container itself scrolls both axes but hides its native scrollbars
 *   (no visible y-axis scrollbar) — vertical scroll still works via wheel/trackpad.
 * - A docked horizontal scrollbar sits directly below the container, in normal
 *   layout flow (not floating), so it's always reachable without scrolling the
 *   page. It's driven purely by scrollLeft / (scrollWidth - clientWidth) math,
 *   both reading (container scroll -> thumb position) and writing
 *   (click/drag on the bar -> container.scrollLeft).
 * - Left/right edge fades hint at hidden horizontal content and track scroll
 *   position (fade out once you've scrolled all the way to that edge).
 * - The docked bar and edge fades only render when the table actually
 *   overflows its container's width, rechecked on mount, on resize, and
 *   whenever the content's own size changes (e.g. data loading in async).
 */
export default function HScrollArea({
  children,
  className = "",
  maxHeightClassName = DEFAULT_MAX_HEIGHT,
}: HScrollAreaProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const [hasOverflow, setHasOverflow] = useState(false);
  const [thumb, setThumb] = useState({ leftPct: 0, widthPct: 100 });
  const [fades, setFades] = useState({ left: false, right: false });

  const recomputeScrollState = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const scrollable = el.scrollWidth - el.clientWidth;
    if (scrollable <= 1) {
      setThumb({ leftPct: 0, widthPct: 100 });
      setFades({ left: false, right: false });
      return;
    }
    const widthPct = Math.max((el.clientWidth / el.scrollWidth) * 100, 4);
    const leftPct = (el.scrollLeft / scrollable) * (100 - widthPct);
    setThumb({ leftPct, widthPct });
    setFades({
      left: el.scrollLeft > 1,
      right: el.scrollLeft < scrollable - 1,
    });
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    function checkOverflow() {
      if (!el) return;
      setHasOverflow(el.scrollWidth > el.clientWidth + 1);
      recomputeScrollState();
    }

    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    window.addEventListener("resize", checkOverflow);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [recomputeScrollState]);

  function handleContentScroll() {
    recomputeScrollState();
  }

  function scrollToClientX(clientX: number) {
    const el = contentRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const scrollable = el.scrollWidth - el.clientWidth;
    if (scrollable <= 0) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    el.scrollLeft = pct * scrollable;
  }

  function handleTrackPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    scrollToClientX(e.clientX);
  }

  function handleTrackPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    scrollToClientX(e.clientX);
  }

  function handleTrackPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  return (
    <div className="relative">
      <div
        ref={contentRef}
        onScroll={handleContentScroll}
        className={`no-scrollbar overflow-auto ${maxHeightClassName} ${className}`}
      >
        {children}
      </div>

      {hasOverflow && (
        <>
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-150 ${
              fades.left ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-150 ${
              fades.right ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      )}

      {hasOverflow && (
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          className="relative mt-1.5 h-2 cursor-pointer rounded-full bg-slate-100"
        >
          <div
            style={{ left: `${thumb.leftPct}%`, width: `${thumb.widthPct}%` }}
            className="absolute top-0 h-2 cursor-grab rounded-full bg-slate-300 transition-colors hover:bg-slate-400 active:cursor-grabbing"
          />
        </div>
      )}
    </div>
  );
}
