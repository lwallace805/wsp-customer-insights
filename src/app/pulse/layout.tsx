export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white -mx-6 -my-8 px-6 py-8">
      {children}
    </div>
  );
}
