import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WSP Analytics Hub',
  description: 'Marketing analytics, enrollment pacing, and customer insights for Wall Street Prep',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.className} h-full`}>
      <body className="min-h-full bg-gray-50 antialiased">
        <NavBar />
        <main className="max-w-screen-2xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
