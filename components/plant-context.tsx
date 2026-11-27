"use client";

import { createContext, useContext } from "react";
import type { DashboardData } from "@/components/models";
import { useJson } from "@/components/use-json";

type PlantState = ReturnType<typeof useJson<DashboardData>>;

const PlantContext = createContext<PlantState | null>(null);

export function PlantProvider({ children }: { children: React.ReactNode }) {
  const state = useJson<DashboardData>("/api/dashboard", 15_000);
  return <PlantContext.Provider value={state}>{children}</PlantContext.Provider>;
}

export function usePlant(): PlantState {
  const value = useContext(PlantContext);
  if (!value) throw new Error("usePlant must be used inside PlantProvider");
  return value;
}
