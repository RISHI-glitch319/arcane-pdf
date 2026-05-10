"use client";

import type { ReactNode } from "react";

type LivePreviewCardProps = {
  dark: boolean;
  title: string;
  caption: string;
  children: ReactNode;
};

export function LivePreviewCard({ dark, title, caption, children }: LivePreviewCardProps) {
  return (
    <section
      className={`rounded-[2.25rem] border p-5 md:p-6 transition-all ${
        dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${dark ? "text-slate-500" : "text-slate-400"}`}>
            Live Preview
          </p>
          <h2 className={`text-sm font-black uppercase tracking-wide ${dark ? "text-white" : "text-slate-900"}`}>{title}</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] ${
            dark ? "bg-[#CC208E]/10 text-[#f472b6]" : "bg-[#CC208E]/10 text-[#CC208E]"
          }`}
        >
          {caption}
        </span>
      </div>
      {children}
    </section>
  );
}

type PdfPreviewProps = {
  url: string | null;
  title: string;
  dark: boolean;
  emptyLabel: string;
  className?: string;
};

export function PdfPreview({ url, title, dark, emptyLabel, className = "" }: PdfPreviewProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border min-h-[260px] ${
        dark ? "border-white/10 bg-black/20" : "border-slate-200 bg-white"
      } ${className}`}
    >
      {url ? (
        <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} title={title} className="h-full min-h-[260px] w-full border-none" />
      ) : (
        <div className={`flex min-h-[260px] items-center justify-center px-6 text-center text-xs font-bold uppercase tracking-[0.25em] ${dark ? "text-slate-600" : "text-slate-400"}`}>
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

export function ImagePreview({ url, title, dark, emptyLabel, className = "" }: PdfPreviewProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border min-h-[260px] flex items-center justify-center p-2 ${
        dark ? "border-white/10 bg-black/20" : "border-slate-200 bg-white"
      } ${className}`}
    >
      {url ? (
        <img src={url} alt={title} className="h-full w-full object-contain rounded-[1.25rem]" />
      ) : (
        <div className={`flex min-h-[260px] w-full items-center justify-center px-6 text-center text-xs font-bold uppercase tracking-[0.25em] ${dark ? "text-slate-600" : "text-slate-400"}`}>
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

export function formatPreviewSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(bytes / 1024, 0.1).toFixed(1)} KB`;
}
