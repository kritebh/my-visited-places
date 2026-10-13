export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "theme";
export const THEME_COLORS = { light: "#f9f9f7", dark: "#0d0d0d" };

/**
 * Runs inline in <head> before first paint so a forced theme never flashes.
 * Kept dependency-free and stringified into the page.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;

const EVENT = "themechange";

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {}
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
  applyThemeColor();
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Browser/PWA status bar colour. A forced theme overrides both media-scoped
 * tags; "system" restores each tag's own colour. Only writes on change, so it
 * is safe to call from a MutationObserver.
 */
export function applyThemeColor() {
  const pref = getThemePref();
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = (m.getAttribute("media") ?? "").includes("dark") ? THEME_COLORS.dark : THEME_COLORS.light;
    const want = pref === "system" ? own : THEME_COLORS[pref];
    if (m.content !== want) m.content = want;
  }
}

/** Calls back when the preference or the OS scheme changes. */
export function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function resolvedScheme(): "light" | "dark" {
  const pref = getThemePref();
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
