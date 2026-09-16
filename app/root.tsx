import { useEffect, useRef } from 'react';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation, useRouteError } from 'react-router';
import { SkipLinks } from './components/layout/SkipLinks';
import { SiteHeader } from './components/layout/SiteHeader';
import { SiteFooter } from './components/layout/SiteFooter';
import { NotFoundContent } from './routes/not-found';
import './styles/tokens.css'; import './styles/reset.css'; import './styles/typography.css'; import './styles/layout.css';
import './styles/components.css'; import './styles/scenes.css'; import './styles/reduced-motion.css'; import './styles/print.css';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        <SkipLinks />
        <SiteHeader />
        {children}
        <SiteFooter />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/** Client navigation moves focus to the page's main landmark so keyboard and screen-reader users land on the new content. */
function RouteFocusManager() {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (location.hash) return;
    document.getElementById('content')?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);
  return null;
}

export default function App() {
  return (
    <>
      <RouteFocusManager />
      <main id="content" tabIndex={-1}><Outlet /></main>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main id="content" tabIndex={-1}>
      {notFound ? <NotFoundContent /> : (
        <section className="page-body"><h1>Something went wrong</h1><p>The page could not be displayed. The navigation above still works.</p></section>
      )}
    </main>
  );
}
