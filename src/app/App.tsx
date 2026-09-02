import { BrowserRouter, Route, Routes } from "react-router";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<BootstrapScreen />} path="/" />
      </Routes>
    </BrowserRouter>
  );
}

function BootstrapScreen() {
  return (
    <main className="app-shell" aria-labelledby="bootstrap-title">
      <section className="app-shell__content">
        <p className="app-shell__eyebrow">P00-T01</p>
        <h1 id="bootstrap-title">Markdown Reader</h1>
        <p>
          Bootstrap готовит строгий локальный React/Vite фундамент для будущей
          browser-only Markdown-читалки.
        </p>
      </section>
    </main>
  );
}
