interface CaseItemProps {
  title: string;
  status: string;
  date: string;
  isLast?: boolean;
  preview: string;
  onClick?: () => void;
  onDelete?: () => void;
}

export function CaseItem({ title, status, date, isLast, preview, onClick, onDelete }: CaseItemProps) {
  return (
    <div className={`${!isLast ? "border-b border-border/40" : ""}`}>
      <div className="group flex items-center gap-3 p-4 hover:bg-bg-secondary/40 transition-colors">
        <button
          type="button"
          onClick={onClick}
          disabled={!onClick}
          className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left disabled:cursor-default"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="p-2.5 rounded-xl bg-bg-secondary/40 text-text-secondary group-hover:text-text-primary transition-colors">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
                <path d="M9 13h6" />
                <path d="M9 17h4" />
              </svg>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-text-primary/90 group-hover:text-text-primary transition-colors">{title}</span>
              <span className="text-[13px] text-text-secondary">{date}</span>
              <span className="truncate text-xs text-text-secondary/80">{preview}</span>
            </div>
          </div>
          <div className="flex items-center">
            <span
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                status === "Completed"
                  ? "bg-state-success/10 text-state-success border-state-success/20"
                  : status === "Analyzing"
                  ? "bg-state-warning/10 text-state-warning border-state-warning/20"
                  : "bg-accent-gold/10 text-accent-gold border-accent-gold/20"
              }`}
            >
              {status}
            </span>
          </div>
        </button>

        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-bg-card text-text-secondary transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            aria-label={`Delete ${title}`}
            title="Delete"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
