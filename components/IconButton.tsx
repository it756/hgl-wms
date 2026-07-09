"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

type IconButtonVariant = "neutral" | "danger" | "success" | "accent";

const VARIANT_STYLES: Record<IconButtonVariant, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
  danger: "border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100",
  success: "border-teal-200 bg-teal-50 text-[#005c55] hover:bg-teal-100",
  accent: "border-[#BCE3DE] bg-[#E6F4F1] text-[#005c55] hover:bg-[#D5EFEA]",
};

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: IconButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
}

interface TooltipPosition {
  top: number;
  left: number;
  placement: "top" | "bottom";
}

const TOOLTIP_MARGIN = 8;
const TOP_CLEARANCE = 32;

export default function IconButton({
  icon,
  label,
  onClick,
  href,
  variant = "neutral",
  disabled,
  type = "button",
}: IconButtonProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<TooltipPosition | null>(null);

  function showTooltip() {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const hasRoomAbove = rect.top > TOP_CLEARANCE;
    setPos({
      left: rect.left + rect.width / 2,
      top: hasRoomAbove ? rect.top - TOOLTIP_MARGIN : rect.bottom + TOOLTIP_MARGIN,
      placement: hasRoomAbove ? "top" : "bottom",
    });
  }

  function hideTooltip() {
    setPos(null);
  }

  const controlClassName = `cursor-pointer rounded-lg border p-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_STYLES[variant]}`;

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {href ? (
        <Link href={href} aria-label={label} className={controlClassName}>
          {icon}
        </Link>
      ) : (
        <button
          type={type}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={controlClassName}
        >
          {icon}
        </button>
      )}
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: `translate(-50%, ${pos.placement === "top" ? "-100%" : "0"})`,
            }}
            className="pointer-events-none z-100 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-white shadow-lg"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
