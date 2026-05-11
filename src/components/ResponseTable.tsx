'use client';

import { useState } from 'react';
import { categorize } from '@/lib/nps';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Response = {
  id: string;
  score: number;
  date: string;
  product: string;
  comment: string;
  respondent: string;
};

const PAGE_SIZE = 20;
const CATEGORY_STYLES = {
  promoter:  'bg-emerald-100 text-emerald-800',
  passive:   'bg-amber-100 text-amber-800',
  detractor: 'bg-red-100 text-red-800',
};

type Props = { responses: Response[] };

export default function ResponseTable({ responses }: Props) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(responses.length / PAGE_SIZE);
  const visible = responses.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!responses.length) {
    return <div className="text-center py-12 text-gray-400">No responses found.</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Product</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Comment</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(r => {
            const cat = categorize(r.score);
            return (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-800">{r.score}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CATEGORY_STYLES[cat]}`}>
                    {cat}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{r.product}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.comment || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, responses.length)} of {responses.length}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
