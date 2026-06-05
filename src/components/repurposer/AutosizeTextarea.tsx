"use client";

import { TextareaHTMLAttributes, useEffect, useRef } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
};

export function AutosizeTextarea({ value, className = "", ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={`block w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 ${className}`}
      {...rest}
    />
  );
}
