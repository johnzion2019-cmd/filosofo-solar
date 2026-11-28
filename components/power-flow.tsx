"use client";

import { useEffect, useState } from "react";
import { Battery, House, SunMedium, UtilityPole, X } from "lucide-react";
import { batteryFlowLabel, batteryFlowState } from "@/lib/battery";
import type { Sample } from "@/lib/types";
import { formatPowerParts } from "@/lib/format";
import { cn } from "@/lib/utils";

type FlowProps = { sample: Sample };

function duration(watts: number): number {
  const span = Math.min(Math.abs(watts), 4500) / 4500;
  return 3.3 - span * 2;
}

function Particles({ d, color, watts }: { d: string; color: string; watts: number }) {
  const dur = duration(watts);
  return (
    <g className="flow-particle">
      {[0, 1, 2].map((index) => (
        <circle key={index} r="3.4" fill={color}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${(dur / 3) * index}s`} path={d} />
        </circle>
      ))}
    </g>
  );
}

function Node({
  x,
  y,
  label,
  watts,
  preferKw,
  icon,
  tone,
  detail,
}: {
  x: number;
  y: number;
  label: string;
  watts: number;
  preferKw?: boolean;
  icon: React.ReactNode;
  tone: string;
  detail?: string;
}) {
  const parts = formatPowerParts(Math.abs(watts), preferKw);
  return (
    <div
      className="absolute w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#0b1220]/80 px-2.5 py-2 shadow-lg backdrop-blur-md"
      style={{ left: `${(x / 640) * 100}%`, top: `${(y / 460) * 100}%` }}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-white/75">
        <span className={cn("grid size-5 place-items-center rounded-full", tone)}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tabular text-base leading-none text-white">{parts.value}</span>
        <span className="text-[11px] text-white/70">{parts.unit}</span>
      </div>
      {detail ? <div className="mt-1 text-[10px] text-white/60">{detail}</div> : null}
    </div>
  );
}

export function PowerFlow({ sample }: FlowProps) {
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const pvToHouse = "M 168 118 C 190 150, 220 160, 268 196";
  const gridImport = "M 488 118 C 450 150, 400 170, 330 214";
  const gridExport = "M 330 214 C 400 170, 450 150, 488 118";
  const batteryOut = "M 470 332 C 430 310, 380 290, 328 250";
  const batteryIn = "M 328 250 C 380 290, 430 310, 470 332";
  const offGrid = sample.gridStatus === "off-grid";
  const batteryFlow = batteryFlowState(sample.batteryW);
  const batteryDetail = batteryFlowLabel(batteryFlow);
  const gridDetail = offGrid ? "Off grid" : sample.gridW < -25 ? "Export" : sample.gridW > 25 ? "Import" : "Idle";

  return (
    <section className="glass relative overflow-hidden rounded-3xl" aria-label="Power flow">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className="grid size-7 place-items-center rounded-full bg-white/10">
            <House className="size-4" />
          </span>
          Power flow
        </h2>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", offGrid ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200")}>
          {offGrid ? "Off-grid" : "On-grid"}
        </span>
      </div>
      <div className="relative mx-auto aspect-[640/460] w-full max-w-3xl">
        <svg viewBox="0 0 640 460" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a2744" />
              <stop offset="55%" stopColor="#121a2e" />
              <stop offset="100%" stopColor="#0c101c" />
            </linearGradient>
            <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb37a" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffb37a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="100%" stopColor="#0f2744" />
            </linearGradient>
          </defs>
          <rect width="640" height="460" fill="url(#dusk)" />
          <rect x="0" y="250" width="640" height="90" fill="url(#horizon)" />
          {[
            [80, 40],
            [140, 70],
            [520, 36],
            [580, 84],
            [40, 110],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" fill="white" opacity="0.7" />
          ))}
          <ellipse cx="300" cy="400" rx="190" ry="22" fill="#7eb6ff" opacity="0.08" />
          <path d="M150 360 L150 250 L250 214 L250 292 Z" fill="#18243a" stroke="#314864" />
          <path d="M250 292 L250 214 L390 214 L390 340 L250 340 Z" fill="#121c30" stroke="#314864" />
          <path d="M168 268 L168 232 L232 206 L232 242 Z" fill="url(#panel)" stroke="#60a5fa" />
          {[0, 1, 2, 3].map((row) => (
            <line key={row} x1={176 + row * 2} y1={262 - row * 8} x2={224} y2={232 - row * 4} stroke="#93c5fd" strokeOpacity="0.35" />
          ))}
          <g opacity="0.9">
            {Array.from({ length: 5 }, (_, col) =>
              Array.from({ length: 6 }, (_, row) => (
                <circle key={`${col}-${row}`} cx={278 + col * 16} cy={232 + row * 14} r="2.2" fill="#d7e4f8" opacity="0.35" />
              )),
            )}
          </g>
          <rect x="176" y="292" width="34" height="28" rx="2" fill="#f6c27a" opacity="0.9" />
          <rect x="300" y="268" width="46" height="34" rx="2" fill="#f3b56a" opacity="0.85" />
          <path d="M150 360 C220 348, 360 352, 430 368 L430 410 L150 410 Z" fill="#0e2033" opacity="0.85" />
          <path d={pvToHouse} fill="none" stroke="#3dd68c" strokeOpacity="0.35" strokeWidth="2" />
          <path d={gridImport} fill="none" stroke="#c4b5fd" strokeOpacity={offGrid ? 0.12 : 0.4} strokeWidth="2" />
          <path d={batteryOut} fill="none" stroke="#49d2ff" strokeOpacity="0.4" strokeWidth="2" />
          {motion && sample.pvW > 20 ? <Particles d={pvToHouse} color="#3dd68c" watts={sample.pvW} /> : null}
          {motion && !offGrid && sample.gridW > 30 ? <Particles d={gridImport} color="#c4b5fd" watts={sample.gridW} /> : null}
          {motion && !offGrid && sample.gridW < -30 ? <Particles d={gridExport} color="#c4b5fd" watts={sample.gridW} /> : null}
          {motion && batteryFlow === "discharging" ? <Particles d={batteryOut} color="#49d2ff" watts={sample.batteryW} /> : null}
          {motion && batteryFlow === "charging" ? <Particles d={batteryIn} color="#49d2ff" watts={sample.batteryW} /> : null}
        </svg>
        <Node x={150} y={78} label="PV" watts={sample.pvW} icon={<SunMedium className="size-3" />} tone="bg-emerald-400/20 text-emerald-200" />
        <Node
          x={500}
          y={86}
          label="Grid"
          watts={sample.gridW}
          preferKw
          icon={<UtilityPole className="size-3" />}
          tone="bg-violet-400/20 text-violet-100"
          detail={gridDetail}
        />
        {offGrid ? (
          <div className="absolute flex items-center gap-1 text-[11px] font-medium text-rose-300" style={{ left: "68%", top: "27%" }}>
            <X className="size-3" /> Off grid
          </div>
        ) : null}
        <Node x={250} y={188} label="Load" watts={sample.loadW} icon={<House className="size-3" />} tone="bg-amber-400/20 text-amber-100" />
        <Node
          x={470}
          y={348}
          label="Battery"
          watts={sample.batteryW}
          preferKw={Math.abs(sample.batteryW) >= 1000 || sample.batteryW === 0}
          icon={<Battery className="size-3" />}
          tone="bg-sky-400/20 text-sky-100"
          detail={`${sample.batterySoc.toFixed(0)}% · ${batteryDetail}`}
        />
      </div>
      <p className="sr-only">
        PV {Math.round(sample.pvW)} watts, load {Math.round(sample.loadW)} watts, battery {Math.round(sample.batteryW)} watts at{" "}
        {sample.batterySoc.toFixed(0)} percent, grid {Math.round(sample.gridW)} watts, {sample.gridStatus}.
      </p>
    </section>
  );
}
