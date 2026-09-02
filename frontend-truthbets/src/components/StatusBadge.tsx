import type { BetStatus, Verdict } from "../lib/types";

const STATUS_LABEL: Record<BetStatus, string> = {
  OPEN: "Awaiting opponent",
  LOCKED: "Both sides funded",
  RESOLVED: "Resolved",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export function StatusBadge({ status }: { status: BetStatus }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

const VERDICT_LABEL: Record<Exclude<Verdict, "">, string> = {
  TRUE: "TRUE",
  FALSE: "FALSE",
  UNCLEAR: "UNCLEAR",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (!verdict) return null;
  return (
    <span className={`badge verdict-${verdict.toLowerCase()}`}>
      {VERDICT_LABEL[verdict as Exclude<Verdict, "">]}
    </span>
  );
}

export function SideChip({ side }: { side: "TRUE" | "FALSE" }) {
  return <span className={`side-chip side-${side.toLowerCase()}`}>{side}</span>;
}
