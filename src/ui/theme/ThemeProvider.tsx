import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { appCopy } from "@/shared/i18n/ru";
import { Button } from "@/ui/primitives/button";
export type ThemePreference = "system" | "light" | "dark";
const themeMirrorKey = "markdown-reader.theme";
const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void } | null>(null);
function isThemePreference(value: string | null): value is ThemePreference { return value === "system" || value === "light" || value === "dark"; }
export function readThemeMirror(storage: Pick<Storage, "getItem"> = window.localStorage): ThemePreference { try { const value = storage.getItem(themeMirrorKey); return isThemePreference(value) ? value : "system"; } catch { return "system"; } }
function applyTheme(preference: ThemePreference) { const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; document.documentElement.style.colorScheme = dark ? "dark" : "light"; }
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemeMirror());
  useEffect(() => { applyTheme(preference); try { window.localStorage.setItem(themeMirrorKey, preference); } catch { /* Theme remains usable without localStorage. */ } const media = window.matchMedia("(prefers-color-scheme: dark)"); const updateSystemTheme = () => { if (preference === "system") applyTheme("system"); }; media.addEventListener("change", updateSystemTheme); return () => { media.removeEventListener("change", updateSystemTheme); }; }, [preference]);
  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const value = useContext(ThemeContext); if (!value) throw new Error("useTheme must be used inside ThemeProvider."); return value; }
export function ThemeToggle() { const { preference, setPreference } = useTheme(); const next = preference === "dark" ? "light" : "dark"; return <Button aria-label={appCopy.a11y.theme} onPress={() => { setPreference(next); }} size="sm" variant="ghost">{next === "dark" ? appCopy.theme.dark : appCopy.theme.light}</Button>; }
