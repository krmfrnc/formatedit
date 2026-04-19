import type { ReactNode } from 'react';
import { Navbar } from '../_components/Navbar';
import { Footer } from '../_components/Footer';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
