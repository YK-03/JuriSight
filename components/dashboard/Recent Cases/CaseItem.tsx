interface CaseItemProps {
  title: string;
  date: string;
  isLast?: boolean;
  preview: string;
  onClick?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  /** Risk score badge, e.g. "62 • Moderate Risk" */
  riskBadge?: string | null;
}

export function CaseItem({ title, date, isLast, preview, onClick, onDelete, onShare, riskBadge }: CaseItemProps) {
  const getBadgeClasses = () => {
    if (riskBadge) {
      // Parse numeric score from badge text for color coding
      const score = parseInt(riskBadge, 10);
      if (!isNaN(score)) {
        if (score >= 70) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
        if (score >= 40) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      }
    }

    return "bg-accent-gold/10 text-accent-gold border-accent-gold/20";
  };

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
          {riskBadge && (
            <div className="flex items-center">
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${getBadgeClasses()}`}
              >
                {riskBadge}
              </span>
            </div>
          )}
        </button>

        {onShare ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-bg-card text-text-secondary transition-colors hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label={`Share ${title}`}
            title="Copy share link"
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
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/>
              <line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
            </svg>
          </button>
        ) : null}

        {onDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
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
