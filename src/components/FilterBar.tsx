'use client';

import { Filter } from 'lucide-react';

type Props = {
  products: string[];
  selectedProduct: string;
  onProductChange: (v: string) => void;
  period?: 'month' | 'quarter';
  onPeriodChange?: (v: 'month' | 'quarter') => void;
  showPeriod?: boolean;
};

export default function FilterBar({
  products,
  selectedProduct,
  onProductChange,
  period = 'month',
  onPeriodChange,
  showPeriod = false,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
      <Filter size={15} className="text-gray-400 shrink-0" />

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Product</label>
        <select
          value={selectedProduct}
          onChange={e => onProductChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Products</option>
          {products.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {showPeriod && onPeriodChange && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Group by</label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['month', 'quarter'] as const).map(p => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-3 py-1 capitalize transition-colors ${period === p ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
