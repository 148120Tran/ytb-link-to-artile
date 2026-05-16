"use client";

type PreviewPanelProps = {
  html: string;
};

export default function PreviewPanel({ html }: PreviewPanelProps) {
  if (!html) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
        The rich HTML preview appears here after generation.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.45)]">
      <div className="text-xs uppercase tracking-[0.35em] text-white/60">
        Rich HTML preview
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl bg-white text-slate-900">
        <div
          className="max-h-[520px] overflow-y-auto p-6 text-base leading-7"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
