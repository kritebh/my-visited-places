"use client";

import { useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { applyThemeColor, setThemePref, type ThemePref } from "@/lib/theme";
import { useColorScheme, useThemePref } from "@/lib/useMedia";

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const satisfies readonly { value: ThemePref; label: string; icon: unknown }[];

/** Segmented System / Light / Dark control. */
export function ThemeToggle() {
  const pref = useThemePref();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          onClick={() => setThemePref(value)}
          className={clsx(
            "flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-sm font-medium transition",
            pref === value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}

/** One-tap switch between light and dark (leaves "System" behind). */
export function ThemeButton({ className }: { className?: string }) {
  const scheme = useColorScheme();
  const next = scheme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setThemePref(next)}
      className={clsx("rounded-xl p-2.5 text-ink-2 hover:bg-surface-2", className)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {scheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

/**
 * Keeps theme-color tags in line with the chosen theme. Next renders them
 * after hydration and again on client navigation, so watch <head>.
 */
export function ThemeSync() {
  useEffect(() => {
    applyThemeColor();
    const obs = new MutationObserver(applyThemeColor);
    obs.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
    return () => obs.disconnect();
  }, []);
  return null;
}
