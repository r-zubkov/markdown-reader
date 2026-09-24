(() => {
  try {
    const preference = globalThis.localStorage.getItem("markdown-reader.theme");
    const dark = preference === "dark"
      || (preference !== "light" && globalThis.matchMedia("(prefers-color-scheme: dark)").matches);
    const theme = dark ? "dark" : "light";
    globalThis.document.documentElement.dataset.theme = theme;
    globalThis.document.documentElement.style.colorScheme = theme;
  } catch {
    // The application reconciles the IndexedDB preference after startup.
  }
})();
