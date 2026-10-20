import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { magColor } from "@/lib/meteo";

export function Panel({ title, action, children, className, testId }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={cn("rounded-2xl border border-tt-border bg-tt-card p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-tt-text">{title}</h3>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 py-6 text-sm text-tt-muted", className)} role="status">
      <Loader2 className="size-4 animate-spin text-tt-accent" /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border border-tt-orange/30 bg-[#431407]/40 p-3 text-sm text-[#FDBA74]", className)} role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-semibold text-tt-lilac underline-offset-2 hover:underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 py-6 text-sm text-tt-muted", className)}>
      <Inbox className="size-4" /> {message}
    </div>
  );
}

export function RatingBadge({ rating, mag, className, testId }: { rating: string; mag: number | null; className?: string; testId?: string }) {
  const c = magColor(mag);
  return (
    <span
      data-testid={testId}
      className={cn("inline-flex items-center justify-center rounded-md px-1.5 py-0.5 tt-mono text-[11px] font-bold", className)}
      style={{ color: c, background: `${c}1F`, boxShadow: `inset 0 0 0 1px ${c}55` }}
    >
      {rating}
    </span>
  );
}

export function Metric({ label, value, sub, testId, tone }: { label: string; value: ReactNode; sub?: ReactNode; testId?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-tt-border bg-tt-bg2/60 p-3">
      <div className="tt-label !text-[10px]">{label}</div>
      <div data-testid={testId} className="tt-mono mt-1 text-lg font-semibold text-tt-text" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-tt-muted">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 data-testid="page-title" className="text-2xl font-semibold tracking-tight text-tt-text sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-tt-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SourceNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] leading-relaxed text-tt-muted", className)}>{children}</p>;
}
