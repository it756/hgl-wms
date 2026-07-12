"use client";

import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { useHScrollOverflow } from "./HScrollArea";

/**
 * Shared table primitives. Change header/row/cell styling here and it
 * applies to every table in the app that uses these components.
 */

export function Table({ className = "", children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full text-sm ${className}`} {...rest}>
      {children}
    </table>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="whitespace-nowrap shadow-[0_1px_0_0_rgba(226,232,240,1)]">{children}</tr>
    </thead>
  );
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  /** Pins this header cell to the left edge while the table scrolls horizontally. */
  pinned?: boolean;
}

export function Th({ align = "left", pinned = false, className = "", children, ...rest }: ThProps) {
  const hasOverflow = useHScrollOverflow();
  const isPinned = pinned && hasOverflow;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const pinnedClass = isPinned ? "sticky left-0 z-30" : "sticky z-20";
  return (
    <th
      className={`px-6 py-3.5 top-0 bg-slate-50 text-xs font-semibold text-slate-400 capitalize ${alignClass} ${pinnedClass} ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Tr({ className = "", children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`even:bg-slate-50/60 hover:bg-slate-100/70 transition-colors ${className}`} {...rest}>
      {children}
    </tr>
  );
}

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  /** Pins this cell to the left edge (needs an opaque background — supplied here). */
  pinned?: boolean;
}

export function Td({ align = "left", pinned = false, className = "", children, ...rest }: TdProps) {
  const hasOverflow = useHScrollOverflow();
  const isPinned = pinned && hasOverflow;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "";
  const pinnedClass = isPinned
    ? "sticky left-0 z-10 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
    : "";
  return (
    <td className={`px-6 py-3.5 ${alignClass} ${pinnedClass} ${className}`} {...rest}>
      {children}
    </td>
  );
}
