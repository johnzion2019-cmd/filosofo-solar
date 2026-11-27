"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, ChartColumn, Check, ChevronLeft, Cpu, LayoutDashboard, MapPin, MoreHorizontal, Settings, SunMedium } from "lucide-react";
import { usePlant } from "@/components/plant-context";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatAgo, sourceLabel } from "@/lib/format";
import type { DataSource } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: ChartColumn },
  { href: "/inverter", label: "Inverter", icon: Cpu },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

function modeVariant(mode: DataSource): "warning" | "success" | "info" {
  if (mode === "deye") return "success";
  if (mode === "bridge") return "info";
  return "warning";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  const home = pathname === "/";
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/15 text-primary">
            <SunMedium className="size-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">Filosofo Solar</div>
            <div className="text-xs text-muted-foreground">Negros Oriental</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <NavLinks pathname={pathname} />
        </nav>
      </aside>
      <div className={cn("min-w-0 flex-1", home ? "pb-20 md:pb-8" : "pb-24 md:pb-10")}>
        <PullToRefresh />
        {home ? null : <TopBar pathname={pathname} />}
        <main className={home ? "px-3 pt-3 md:px-6" : "px-4 py-4 md:px-8"}>{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#070b14]/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          <NavLinks pathname={pathname} compact />
        </div>
      </nav>
    </div>
  );
}

function NavLinks({ pathname, compact = false }: { pathname: string; compact?: boolean }) {
  const { data } = usePlant();
  return (
    <>
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
              compact && "flex-col gap-1 px-1 py-1.5 text-[11px]",
            )}
          >
            <Icon className="size-4" />
            {item.label}
            {item.href === "/alerts" && data && data.unreadAlerts > 0 ? (
              <span className={cn("grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white", compact ? "absolute right-2 top-0" : "ml-auto")}>
                {data.unreadAlerts}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

function TopBar({ pathname }: { pathname: string }) {
  const { data, receivedAt } = usePlant();
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 20_000);
    return () => clearInterval(timer);
  }, []);
  const name = data?.plant.name ?? "Filosofo";
  const location = data?.plant.location ?? "Negros Oriental";
  const ago =
    data?.updatedAt != null
      ? formatAgo(data.updatedAt, data.clockNow + (Date.now() - receivedAt))
      : "waiting";
  void tick;

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-[#070b14]/80 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {pathname === "/" ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/5 md:hidden">
              <SunMedium className="size-4 text-amber-200" />
            </span>
          ) : (
            <Link href="/" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/5" aria-label="Back to overview">
              <ChevronLeft className="size-4" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight">{name}</h1>
            <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
              <span>{ago}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {location}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data ? <Badge variant={modeVariant(data.mode)}>{sourceLabel(data.mode)}</Badge> : null}
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full bg-white/5 hover:bg-white/10"
            aria-label="Switch plant or inverter"
            onClick={() => setOpen(true)}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>
      {data?.clockNote ? <p className="mt-2 text-xs leading-relaxed text-amber-100/80">{data.clockNote}</p> : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="mb-3 text-base font-semibold text-primary">Plant data</DialogTitle>
          <SwitcherRow
            label="Plant data"
            active={pathname === "/"}
            onClick={() => {
              setOpen(false);
              router.push("/");
            }}
          />
          <SwitcherRow
            label={`Inverter (${data?.inverter.serial ?? "2508073177"})`}
            active={pathname.startsWith("/inverter")}
            onClick={() => {
              setOpen(false);
              router.push("/inverter");
            }}
          />
          <button type="button" className="mt-3 w-full py-3 text-sm text-muted-foreground" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function SwitcherRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between border-b border-border py-4 text-left text-sm">
      <span>{label}</span>
      {active ? <Check className="size-4 text-primary" /> : null}
    </button>
  );
}
