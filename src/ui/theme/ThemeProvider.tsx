import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AppPreferencesSnapshot, RepositoryResult } from "@/application/ports/document-repository";
import { appCopy } from "@/shared/i18n/ru";
import { Button } from "@/ui/primitives/button";
export type ThemePreference = "system" | "light" | "dark";
export interface ThemePreferenceStore {
  getPreferences(): Promise<RepositoryResult<AppPreferencesSnapshot>>;
  saveTheme(theme: ThemePreference, updatedAt: number): Promise<RepositoryResult<void>>;
}
export const themeMirrorKey = "markdown-reader.theme";
const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void } | null>(null);
function isThemePreference(value: string | null): value is ThemePreference { return value === "system" || value === "light" || value === "dark"; }
export function readThemeMirror(storage: Pick<Storage, "getItem"> = window.localStorage): ThemePreference { try { const value = storage.getItem(themeMirrorKey); return isThemePreference(value) ? value : "system"; } catch { return "system"; } }
export function resolveTheme(preference: ThemePreference, media: Pick<MediaQueryList, "matches"> = window.matchMedia("(prefers-color-scheme: dark)")): "dark" | "light" {
  return preference === "dark" || (preference === "system" && media.matches) ? "dark" : "light";
}
function applyTheme(preference: ThemePreference, preserveLayout: boolean): void {
  const theme = resolveTheme(preference);
  if (document.documentElement.dataset.theme !== theme && preserveLayout) window.dispatchEvent(new Event("markdown-reader:before-layout-change"));
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
export function ThemeProvider({ children, preferenceStore }: { children: ReactNode; preferenceStore?: ThemePreferenceStore }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemeMirror());
  const preferenceRef = useRef(preference);
  const hasUserSelectionRef = useRef(false);
  useLayoutEffect(() => {
    preferenceRef.current = preference;
    applyTheme(preference, false);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => { if (preference === "system") applyTheme("system", true); };
    media.addEventListener("change", updateSystemTheme);
    return () => { media.removeEventListener("change", updateSystemTheme); };
  }, [preference]);
  useEffect(() => {
    if (!preferenceStore) return;
    let active = true;
    void preferenceStore.getPreferences().then((result) => {
      if (!active || !result.ok || hasUserSelectionRef.current) return;
      if (result.value.theme !== preferenceRef.current) window.dispatchEvent(new Event("markdown-reader:before-layout-change"));
      setPreference(result.value.theme);
      writeThemeMirror(result.value.theme);
    });
    return () => { active = false; };
  }, [preferenceStore]);
  const updatePreference = (next: ThemePreference) => {
    if (next === preference) return;
    hasUserSelectionRef.current = true;
    window.dispatchEvent(new Event("markdown-reader:before-layout-change"));
    applyTheme(next, false);
    setPreference(next);
    if (!preferenceStore) { writeThemeMirror(next); return; }
    void preferenceStore.saveTheme(next, Date.now()).then((result) => { if (result.ok) writeThemeMirror(next); });
  };
  return <ThemeContext.Provider value={{ preference, setPreference: updatePreference }}>{children}</ThemeContext.Provider>;
}
function writeThemeMirror(preference: ThemePreference) { try { window.localStorage.setItem(themeMirrorKey, preference); } catch { /* Theme remains usable without localStorage. */ } }
export function useTheme() { const value = useContext(ThemeContext); if (!value) throw new Error("useTheme must be used inside ThemeProvider."); return value; }
export function ThemeToggle() { const { preference, setPreference } = useTheme(); const next = preference === "dark" ? "light" : "dark"; return <Button aria-label={appCopy.a11y.theme} className="theme-toggle" onPress={() => { setPreference(next); }} size="sm" variant="ghost">{next === "dark" ? appCopy.theme.dark : appCopy.theme.light}</Button>; }
export function ThemePreferenceSelect() {
  const { preference, setPreference } = useTheme();
  return <label className="theme-preference"><span className="sr-only">{appCopy.a11y.theme}</span><select aria-label={appCopy.a11y.theme} onChange={(event) => { if (isThemePreference(event.currentTarget.value)) setPreference(event.currentTarget.value); }} value={preference}>
    <option value="system">{appCopy.theme.system}</option>
    <option value="light">{appCopy.theme.light}</option>
    <option value="dark">{appCopy.theme.dark}</option>
  </select></label>;
}
