import { PortalNav } from './PortalNav';
import { PortalFooter } from './PortalFooter';

/**
 * Page frame: nav, content, footer, with a skip link ahead of everything so a
 * keyboard user is not made to tab through the header on every page.
 */
export function AppShell({ navRight, children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <PortalNav right={navRight} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PortalFooter />
    </div>
  );
}

export default AppShell;
