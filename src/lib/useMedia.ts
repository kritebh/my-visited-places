"use client";

import { useSyncExternalStore } from "react";
import { getThemePref, resolvedScheme, subscribeTheme, type ThemePref } from "./theme";

/** Subscribes to a media query; returns false during SSR. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The scheme actually on screen: the user's choice, else the OS setting. */
export function useColorScheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeTheme, resolvedScheme, () => "light");
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribeTheme, getThemePref, () => "system");
}
