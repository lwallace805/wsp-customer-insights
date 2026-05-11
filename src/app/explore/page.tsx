'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Field = { name: string; type: string };
type Table = { id: string; name: string; fields: Field[]; sampleRecords: Record<string, unknown>[] };

export default function ExplorePage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/explore')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setTables(d.tables);
        if (d.tables.length > 0) setOpen({ [d.tables[0].id]: true });
      })
      .catch(() => setError('Failed to connect to Airtable. Check your .env.local credentials.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Connecting to Airtable…</div>;

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-3">
        <p className="font-semibold text-gray-800">Connection Error</p>
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        <div className="text-sm text-gray-500 text-left bg-gray-50 rounded-xl p-4 space-y-1">
          <p className="font-medium text-gray-700">To fix this:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open <code className="bg-gray-200 px-1 rounded">.env.local</code> in the project folder</li>
            <li>Set <code className="bg-gray-200 px-1 rounded">AIRTABLE_API_KEY</code> to your Personal Access Token</li>
            <li>Set <code className="bg-gray-200 px-1 rounded">AIRTABLE_BASE_ID</code> to your base ID (starts with <code className="bg-gray-200 px-1 rounded">app</code>)</li>
            <li>Restart the dev server with <code className="bg-gray-200 px-1 rounded">npm run dev</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Explorer</h1>
        <p className="text-gray-500 mt-1">
          Use this page to find your table and field names, then update <code className="bg-gray-100 px-1 rounded">.env.local</code> so the dashboard knows where to look.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
        <p className="font-medium">How to use this page:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
          <li>Find which table holds your NPS data and note the table name</li>
          <li>Find the field with scores (0–10), the date field, and the product/segment field</li>
          <li>Do the same for your SurveyMonkey table</li>
          <li>Add those names to <code className="bg-amber-100 px-1 rounded">.env.local</code> (variables listed below)</li>
        </ol>
      </div>

      <div className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs font-mono space-y-1 overflow-x-auto">
        <p className="text-gray-400"># Add these to .env.local once you know your field names:</p>
        <p>NPS_TABLE_NAME=<span className="text-emerald-400">YourNPSTableName</span></p>
        <p>NPS_SCORE_FIELD=<span className="text-emerald-400">YourScoreFieldName</span></p>
        <p>NPS_DATE_FIELD=<span className="text-emerald-400">YourDateFieldName</span></p>
        <p>NPS_PRODUCT_FIELD=<span className="text-emerald-400">YourProductFieldName</span></p>
        <p>NPS_COMMENT_FIELD=<span className="text-emerald-400">YourCommentFieldName</span></p>
        <p>SURVEY_TABLE_NAME=<span className="text-emerald-400">YourSurveyTableName</span></p>
        <p>SURVEY_DATE_FIELD=<span className="text-emerald-400">YourDateFieldName</span></p>
        <p>SURVEY_PRODUCT_FIELD=<span className="text-emerald-400">YourProductFieldName</span></p>
      </div>

      <div className="space-y-3">
        {tables.map(table => (
          <div key={table.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpen(o => ({ ...o, [table.id]: !o[table.id] }))}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {open[table.id] ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                <span className="font-semibold text-gray-900">{table.name}</span>
                <span className="text-xs text-gray-400">{table.fields.length} fields</span>
              </div>
            </button>

            {open[table.id] && (
              <div className="border-t border-gray-100 px-6 py-4 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Fields</p>
                  <div className="flex flex-wrap gap-2">
                    {table.fields.map(f => (
                      <div key={f.name} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
                        <span className="font-medium text-gray-800">{f.name}</span>
                        <span className="text-gray-400 ml-1">({f.type})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {table.sampleRecords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Sample records</p>
                    <div className="space-y-2">
                      {table.sampleRecords.map((record, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 text-xs font-mono overflow-x-auto">
                          {Object.entries(record).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-gray-500 shrink-0">{k}:</span>
                              <span className="text-gray-800 truncate">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
