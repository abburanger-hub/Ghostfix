"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // On route change: run a quick complete animation
    setVisible(true);
    setProgress(0);

    // Quickly jump to 90% then wait for the route to finish
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += Math.random() * 18 + 8;
      if (p >= 90) {
        p = 90;
        clearInterval(intervalRef.current!);
      }
      setProgress(p);
    }, 80);

    // After a short pause, complete to 100% and hide
    timerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 500);

    return () => {
      clearInterval(intervalRef.current!);
      clearTimeout(timerRef.current!);
    };
  }, [pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed left-0 top-0 z-[9999] h-[2px] w-full"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 shadow-[0_0_8px_2px_rgba(99,102,241,0.6)] transition-all duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
