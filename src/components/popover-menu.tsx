import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portal-rendered dropdown, fixed-positioned from the trigger's bounding
 * rect. A menu inside a table wrapped in `overflow-x-auto` +
 * `overflow-hidden` (for the card's rounded corners) — an absolutely
 * positioned menu gets silently clipped on rows near the bottom/edge
 * of that scroll area. Rendering to `document.body` with `position: fixed`
 * escapes all ancestor clipping and stays correctly placed regardless of
 * table scroll.
 */
export function PopoverMenu({
  anchorRef, align = "right", onClose, children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: "left" | "right";
  onClose: () => void;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos(
        align === "right"
          ? { top: rect.bottom + 6, right: window.innerWidth - rect.right }
          : { top: rect.bottom + 6, left: rect.left },
      );
    };
    place();
    // Reposition (or close, for scroll) so the menu never drifts from its
    // trigger if the page scrolls/resizes while it's open.
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [anchorRef, align, onClose]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [anchorRef, onClose]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-44 rounded-[3px] border border-border bg-card shadow-lg py-1 overflow-hidden"
      style={{ top: pos.top, left: pos.left, right: pos.right }}
    >
      {children}
    </div>,
    document.body,
  );
}
