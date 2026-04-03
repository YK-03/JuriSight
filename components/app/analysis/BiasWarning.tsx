"use client";

export function BiasWarning({ text }: { text?: string }) {
  if (!text) return null;

  return (
    <div className="animate-fade-in-5 flex gap-3 rounded-xl border border-state-warning/30 bg-state-warning/8 px-5 py-4">
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-state-warning"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-state-warning">
          Assessment Reliability Notice
        </p>
        <p className="mt-1 text-[13px] text-text-secondary">{text}</p>
      </div>
    </div>
  );
}
