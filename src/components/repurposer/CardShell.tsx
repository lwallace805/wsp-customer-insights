"use client";

import { useState, ReactNode } from "react";

type CardShellProps = {
  title: string;
  badge?: string;
  copyText: string;
  children: ReactNode;
};

export function CardShell({ title, badge, copyText, children }: CardShellProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {badge && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {badge}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
