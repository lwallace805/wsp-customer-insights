interface Props {
  label: string;
  value: number;
  compareValue: number;
  compareLabel: string;
  showPercent?: boolean;
}

export default function VarianceRow({ label, value, compareValue, compareLabel, showPercent }: Props) {
  const diff = value - compareValue;
  const positive = diff >= 0;
  const color = positive ? 'text-emerald-400' : 'text-red-400';
  const sign = positive ? '+' : '';

  return (
    <div className="flex items-center justify-between py-1.5 border-t border-white/10">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-medium ${color}`}>
        {sign}{diff} vs. {compareLabel} {compareValue}
        {showPercent && (
          <span className="ml-2 text-xs opacity-75">
            ({sign}{((diff / compareValue) * 100).toFixed(1)}% {positive ? 'ahead' : 'behind'})
          </span>
        )}
      </span>
    </div>
  );
}
