"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap + Escape + restore focus for modal dialogs (PL10).
 * Pass `open` and a stable `onClose` (Escape / optional callers).
 * Optionally pass `initialFocusRef` for the preferred first focus target.
 */
export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  initialFocusRef?: React.RefObject<HTMLElement | null>
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const panel = panelRef.current;
    if (!panel) return;

    const focusInitial = () => {
      const preferred = initialFocusRef?.current;
      if (preferred && panel.contains(preferred)) {
        preferred.focus();
        return;
      }
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    };

    // Defer so the panel is in the DOM
    const t = window.setTimeout(focusInitial, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true" &&
          el.tabIndex !== -1
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown, true);
      const prev = previousFocusRef.current;
      if (prev && document.contains(prev)) {
        prev.focus();
      }
      previousFocusRef.current = null;
    };
  }, [open, onClose, initialFocusRef]);

  return panelRef;
}
