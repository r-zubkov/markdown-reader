/** Vitest boundary stub; production builds resolve the plugin's generated virtual module. */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
