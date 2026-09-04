import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollManager from './ScrollManager';
import BackToTop from '@/components/ui/BackToTop';

/**
 * The persistent shell. Only `<Outlet />` swaps between routes, so the header
 * keeps its state and the browser keeps its paint work to the page body.
 */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollManager />
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}

export default Layout;
