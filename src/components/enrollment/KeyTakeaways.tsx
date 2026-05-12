import type { CohortSummary } from '@/lib/sheets';

interface Props {
  cohorts: CohortSummary[];
}

const PROGRAM_COLORS: Record<string, string> = {
  Wharton: 'bg-blue-700',
  CBSEE: 'bg-teal-600',
};

export default function KeyTakeaways({ cohorts }: Props) {
  const wharton = cohorts.find((c) => c.program === 'Wharton');
  const cbsee = cohorts.find((c) => c.program === 'CBSEE');

  const enrolled = cohorts.reduce((s, c) => s + c.enrolled, 0);
  const goals = cohorts.reduce((s, c) => s + c.goal, 0);
  const bothText = `Combined, ${enrolled.toLocaleString()} of ${goals.toLocaleString()} total seats have been filled across both programs. Wharton faces greater enrollment pressure relative to its shorter timeline.`;

  const items = [
    wharton && { label: 'Wharton', color: PROGRAM_COLORS['Wharton'], text: wharton.keyTakeaway },
    cbsee && { label: 'CBSEE', color: PROGRAM_COLORS['CBSEE'], text: cbsee.keyTakeaway },
    { label: 'Both', color: 'bg-gray-600', text: bothText },
  ].filter(Boolean) as { label: string; color: string; text: string }[];

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-5 mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
        Key Takeaways
      </h3>
      <div className="space-y-4">
        {items.map(({ label, color, text }) => (
          <div key={label} className="flex gap-3">
            <div className={`shrink-0 w-10 h-10 rounded-full ${color} flex items-center justify-center text-xs font-semibold text-white`}>
              {label}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
