"use client";

import { useEffect } from "react";
import SplitCalculator from "@/components/SplitCalculator";
import TripCalculator from "@/components/TripCalculator";
import { ModeTabs, useStoredState } from "@/components/ui";

type Mode = "meal" | "trip";

export default function App() {
  const [{ mode }, setMode] = useStoredState<{ mode: Mode }>("calculator-mode", { mode: "meal" });

  // 網址帶 #trip 或 #meal 時直接開啟該模式，方便分享連結
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash === "trip" || hash === "meal") setMode({ mode: hash });
  }, [setMode]);

  const tabs = <ModeTabs mode={mode} onChange={(m) => setMode({ mode: m })} />;

  return mode === "meal" ? <SplitCalculator tabs={tabs} /> : <TripCalculator tabs={tabs} />;
}
