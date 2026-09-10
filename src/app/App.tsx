import { Component, type ReactNode, useEffect, useRef } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation, useParams } from "react-router";
import { getDocumentRepository, initializeRepository } from "@/app/app-services";
import { LibraryScreen } from "@/features/library/LibraryScreen";
import { MobilePlatformSpike } from "@/features/mobile-platform-spike/MobilePlatformSpike";
import { VirtualReaderSpikeFromLocation } from "@/features/reader-spike/VirtualReaderSpike";
import { appCopy } from "@/shared/i18n/ru";
import { ThemeProvider, ThemeToggle } from "@/ui/theme/ThemeProvider";

export function App() {
  const repository = getDocumentRepository();
  useEffect(() => { void initializeRepository(); }, []);
  return <ThemeProvider preferenceStore={repository}><BrowserRouter><AppErrorBoundary><RouteFocusManager /><Routes><Route element={<AppFrame><LibraryScreen repository={repository} /></AppFrame>} path="/" /><Route element={<ReaderScreen />} path="/documents/:documentId" />{import.meta.env.DEV ? <><Route element={<MobilePlatformSpike />} path="/spikes/mobile-platform" /><Route element={<VirtualReaderSpikeFromLocation />} path="/spikes/virtual-reader" /></> : null}<Route element={<NotFoundScreen />} path="*" /></Routes></AppErrorBoundary><GlobalStatusRegion /></BrowserRouter></ThemeProvider>;
}

function AppFrame({ children, reader = false }: { children: ReactNode; reader?: boolean }) {
  return <div className="app-frame"><a className="skip-link" href={reader ? "#document-content" : "#main-content"}>{reader ? appCopy.a11y.skipToDocument : appCopy.a11y.skipToMain}</a><AppHeader />{children}</div>;
}

function AppHeader() {
  return <header className="app-header"><Link className="app-header__brand" to="/">{appCopy.productName}</Link><nav aria-label={appCopy.a11y.primaryNavigation} className="app-header__nav"><Link to="/">{appCopy.navigation.library}</Link><ThemeToggle /></nav></header>;
}

function ReaderScreen() {
  const { documentId } = useParams();
  if (!documentId) return <NotFoundScreen />;
  return <AppFrame reader><ReaderToolbar /><main className="screen screen--reader" id="main-content"><article aria-labelledby="reader-title" className="screen__content" id="document-content" tabIndex={-1}><p className="screen__eyebrow">{appCopy.reader.eyebrow}</p><h1 data-route-heading="true" id="reader-title" tabIndex={-1}>{appCopy.reader.title}</h1><p className="screen__description">{appCopy.reader.placeholderDescription}</p></article></main></AppFrame>;
}

function ReaderToolbar() { return <nav aria-label={appCopy.a11y.readerToolbar} className="reader-toolbar"><Link to="/">{appCopy.navigation.backToLibrary}</Link><span className="reader-toolbar__title">{appCopy.reader.toolbarTitle}</span></nav>; }

function NotFoundScreen() { return <AppFrame><main className="screen" id="main-content" tabIndex={-1}><section aria-labelledby="not-found-title" className="screen__content"><p className="screen__eyebrow">{appCopy.notFound.eyebrow}</p><h1 data-route-heading="true" id="not-found-title" tabIndex={-1}>{appCopy.notFound.title}</h1><p className="screen__description">{appCopy.notFound.description}</p><Link className="screen__link" to="/">{appCopy.navigation.toLibrary}</Link></section></main></AppFrame>; }

function RouteFocusManager() {
  const location = useLocation(); const previousPath = useRef<string | undefined>(undefined);
  useEffect(() => { const path = `${location.pathname}${location.search}`; if (previousPath.current !== undefined && previousPath.current !== path) document.querySelector<HTMLElement>("[data-route-heading='true']")?.focus(); previousPath.current = path; }, [location.pathname, location.search]);
  return null;
}

function GlobalStatusRegion() { return <div aria-atomic="true" aria-live="polite" className="global-status" role="status" />; }
interface AppErrorBoundaryState { hasError: boolean }
class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  public override state: AppErrorBoundaryState = { hasError: false };
  public static getDerivedStateFromError(): AppErrorBoundaryState { return { hasError: true }; }
  public override componentDidCatch() { /* Never expose content or stack details. */ }
  public override render() { return this.state.hasError ? <NotFoundScreen /> : this.props.children; }
}
