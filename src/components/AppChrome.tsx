'use client';

import { usePathname } from 'next/navigation';
import NavBar from '@/components/NavBar';

/** /wharton is the external partner surface: it gets none of the hub's chrome —
 *  no internal nav (every link in it is a page the Wharton team can't open) and
 *  no shared page container, so it can own its own header and full width. Kept
 *  as a path test in one place rather than a second root layout, which would
 *  mean moving every existing route into a route group. */
export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/wharton' || pathname.startsWith('/wharton/')) return <>{children}</>;

  return (
    <>
      <NavBar />
      <main className="max-w-screen-2xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}
