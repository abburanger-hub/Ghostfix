"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  const clear = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
  }, []);

  // Start immediately — called on click
  const start = useCallback(() => {
    clear();
    startedRef.current = true;
    setVisible(true);
    setProgress(0);

    let p = 0;
    intervalRef.current = setInterval(() => {
      // Fast at first, then slow down as it approaches 85%
      const increment = p < 30 ? 12 : p < 60 ? 6 : p < 80 ? 2 : 0.5;
      p = Math.min(p + increment + Math.random() * 4, 85);
      setProgress(p);
      if (p >= 85) clearInterval(intervalRef.current!);
    }, 60);
  }, [clear]);

  // Complete — called when route actually changes
  const complete = useCallback(() => {
    clear();
    setProgress(100);
    completeTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      startedRef.current = false;
    }, 350);
  }, [clear]);

  // Listen for clicks on links and buttons — start immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement | null;
      const button = target.closest("button[type='submit']") as HTMLButtonElement | null;

      // Only intercept internal navigation links (not external, not hash-only)
      if (link) {
        const href = link.getAttribute("href") ?? "";
        const isExternal = link.target === "_blank" || href.startsWith("http") || href.startsWith("//");
        const isHashOnly = href.startsWith("#");
        if (!isExternal && !isHashOnly && href !== "") {
          start();
        }
      } else if (button) {
        // Form submit buttons that navigate (e.g. team filter)
        const form = button.closest("form");
        if (form?.method === "get" || form?.getAttribute("method") === "GET") {
          start();
        }
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [start]);

  // Complete when the route actually finishes loading
  useEffect(() => {
    if (startedRef.current) {
      complete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed left-0 top-0 z-[9999] h-[2px] w-full"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 shadow-[0_0_8px_2px_rgba(99,102,241,0.6)] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0, transition: progress === 100 ? "width 150ms ease-out, opacity 350ms ease-in 200ms" : "width 150ms ease-out" }}
      />
    </div>
  );
}
