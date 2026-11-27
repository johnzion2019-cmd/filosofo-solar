"use client";

import { useEffect, useRef, useState } from "react";
import { usePlant } from "@/components/plant-context";
import { cn } from "@/lib/utils";

const THRESHOLD = 65;

export function PullToRefresh() {
  const { reload } = usePlant();
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<"idle" | "pull" | "release" | "refresh">("idle");
  const startY = useRef(0);
  const pulling = useRef(false);
  const phaseRef = useRef(phase);
  const offsetRef = useRef(0);
  phaseRef.current = phase;

  useEffect(() => {
    function onStart(event: TouchEvent) {
      if (phaseRef.current === "refresh") return;
      if (window.scrollY > 0) {
        pulling.current = false;
        return;
      }
      startY.current = event.touches[0].clientY;
      pulling.current = true;
    }

    function onMove(event: TouchEvent) {
      if (!pulling.current || phaseRef.current === "refresh") return;
      if (window.scrollY > 0) {
        pulling.current = false;
        setOffset(0);
        setPhase("idle");
        return;
      }
      const dy = event.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setOffset(0);
        setPhase("idle");
        return;
      }
      const next = Math.min(120, dy * 0.5);
      offsetRef.current = next;
      setOffset(next);
      setPhase(dy > THRESHOLD ? "release" : "pull");
      if (dy > 10 && event.cancelable) event.preventDefault();
    }

    function onEnd() {
      if (!pulling.current) return;
      pulling.current = false;
      if (phaseRef.current === "release") {
        setPhase("refresh");
        setOffset(64);
        void reload().finally(() => {
          setPhase("idle");
          setOffset(0);
          offsetRef.current = 0;
        });
        return;
      }
      setPhase("idle");
      setOffset(0);
      offsetRef.current = 0;
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [reload]);

  if (phase === "idle" && offset === 0) return null;

  const label = phase === "refresh" ? "Refreshing..." : phase === "release" ? "Release to refresh" : "Pull to refresh";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center md:hidden"
      style={{ transform: `translateY(${Math.max(0, offset - 12)}px)` }}
      aria-live="polite"
    >
      <div className={cn("rounded-full border border-white/20 bg-black/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur")}>
        {label}
      </div>
    </div>
  );
}
