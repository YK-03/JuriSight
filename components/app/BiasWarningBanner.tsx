export function BiasWarningBanner({ text }: { text: string | null }) {
  if (!text) return null;

  return (
    <div className="flex gap-3 rounded-lg border border-[#FED7AA] bg-[#FFF7ED] px-5 py-4">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 text-[#D97706]" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-[#92400E]">Assessment Reliability Notice</p>
        <p className="mt-1 text-[13px] text-[#B45309]">{text}</p>
      </div>
    </div>
  );
}
