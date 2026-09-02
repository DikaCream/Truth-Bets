import type { Bet } from "../lib/types";
import { formatAddress, formatGen } from "../lib/client";
import Countdown from "./Countdown";
import { SideChip, StatusBadge, VerdictBadge } from "./StatusBadge";

interface BetCardProps {
  bet: Bet;
  me: string | null;
  busy: boolean;
  now: number; // unix seconds
  onAccept: (bet: Bet) => void;
  onCancel: (bet: Bet) => void;
  onResolve: (bet: Bet) => void;
  onCloseStale: (bet: Bet) => void;
}

export default function BetCard({
  bet,
  me,
  busy,
  now,
  onAccept,
  onCancel,
  onResolve,
  onCloseStale,
}: BetCardProps) {
  const isProposer = !!me && me.toLowerCase() === bet.proposer.toLowerCase();
  const isAcceptor = !!me && bet.acceptor && me.toLowerCase() === bet.acceptor.toLowerCase();
  const canResolve =
    bet.status === "LOCKED" && now >= bet.resolution_time;
  const canCloseStale =
    bet.status === "LOCKED" && now >= bet.stale_at;
  const awaitingOpponent = bet.status === "OPEN" && !isProposer;

  return (
    <article className="card bet-card">
      <div className="row">
        <StatusBadge status={bet.status} />
        <span className="muted mono bet-id">#{bet.id}</span>
      </div>

      <h3 className="bet-claim">{bet.claim}</h3>

      {bet.evidence_url && (
        <a
          href={bet.evidence_url}
          target="_blank"
          rel="noreferrer"
          className="mono bet-evidence"
          title="Evidence source the validators may fetch"
        >
          {bet.evidence_url}
        </a>
      )}

      <div className="row bet-sides">
        <span className="side-group">
          <SideChip side={bet.proposer_side} />
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            {isProposer ? "you" : formatAddress(bet.proposer)}
          </span>
        </span>
        <span className="muted">vs</span>
        <span className="side-group">
          {bet.acceptor ? (
            <>
              <SideChip side={bet.acceptor_side as "TRUE" | "FALSE"} />
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                {isAcceptor ? "you" : formatAddress(bet.acceptor)}
              </span>
            </>
          ) : (
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              awaiting opponent…
            </span>
          )}
        </span>
      </div>

      <div className="row">
        <span className="price bet-stake">
          {formatGen(bet.stake)} <span className="muted">each side</span>
        </span>
        {bet.status === "OPEN" && (
          <Countdown target={bet.resolution_time} prefix="Resolves in" />
        )}
        {bet.status === "LOCKED" && !canResolve && (
          <Countdown target={bet.resolution_time} prefix="Resolves in" />
        )}
        {bet.status === "LOCKED" && canResolve && !canCloseStale && (
          <Countdown target={bet.stale_at} prefix="Stale in" passed="Stale window open" />
        )}
      </div>

      {bet.status === "RESOLVED" && (
        <div className="bet-outcome">
          <div className="row">
            <VerdictBadge verdict={bet.verdict} />
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Winner:{" "}
              <strong>
                {bet.winner && bet.winner.toLowerCase() === (me ?? "").toLowerCase()
                  ? "you"
                  : formatAddress(bet.winner)}
              </strong>{" "}
              takes {formatGen(bet.stake * 2n)}
            </span>
          </div>
          {bet.verdict_reason && (
            <p className="muted bet-reason">{bet.verdict_reason}</p>
          )}
        </div>
      )}
      {bet.status === "REFUNDED" && (
        <div className="bet-outcome">
          <div className="row">
            <VerdictBadge verdict={bet.verdict} />
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Both sides refunded {formatGen(bet.stake)} each
            </span>
          </div>
          {bet.verdict_reason && (
            <p className="muted bet-reason">{bet.verdict_reason}</p>
          )}
        </div>
      )}

      <div className="row bet-actions">
        {bet.status === "OPEN" && isProposer && (
          <button
            className="danger small"
            disabled={busy}
            onClick={() => onCancel(bet)}
          >
            Cancel bet
          </button>
        )}
        {awaitingOpponent && me && (
          <button
            className="buy"
            disabled={busy}
            onClick={() => onAccept(bet)}
          >
            Accept — pay {formatGen(bet.stake)}
          </button>
        )}
        {awaitingOpponent && !me && (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Connect a wallet to accept this bet
          </span>
        )}
        {canResolve && (
          <>
            <button
              className="primary"
              disabled={busy}
              onClick={() => onResolve(bet)}
            >
              Resolve — validators judge
            </button>
            {canCloseStale && (
              <button
                className="ghost small"
                disabled={busy}
                onClick={() => onCloseStale(bet)}
                title="Consensus never resolved this — refund both sides"
              >
                Close stale (refund both)
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
