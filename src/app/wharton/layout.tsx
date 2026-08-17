import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wharton Online — Enrollments',
  description: 'Current-cohort enrollments by program, from Wall Street Prep.',
  // This surface is password-shared, not public. Keep it out of search indexes.
  robots: { index: false, follow: false, nocache: true },
};

export default function WhartonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {children}
    </div>
  );
}
