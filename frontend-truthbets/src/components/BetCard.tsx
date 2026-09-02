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
  const canResolve = bet.status === "LOCKED" && now >= bet.resolution_time;
  const canCloseStale = bet.status === "LOCKED" && now >= bet.stale_at;
  const awaitingOpponent = bet.status === "OPEN" && !isProposer;
  const pot = bet.acceptor ? bet.stake * 2n : bet.stake;

  const proposerOnTrue = bet.proposer_side === "TRUE";

  return (
    <article className="card bet-card">
      <div className="row bet-head">
        <span className="bet-id mono">BET #{bet.id}</span>
        <StatusBadge status={bet.status} />
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

      {/* two-sided market strip */}
      <div className="market" role="group" aria-label="Sides and stakes">
        <div
          className={`market-col mc-true ${
            bet.acceptor || proposerOnTrue ? "mc-active" : "mc-dim"
          }`}
        >
          <div className="market-rowside">
            <SideChip side="TRUE" />
            <span className="market-stake">{formatGen(bet.stake)}</span>
          </div>
          <span className="market-party">
            {isProposer && proposerOnTrue ? "you" : formatAddress(bet.proposer)}
          </span>
          <span className="market-role">proposer</span>
        </div>
        <span className="market-vs">vs</span>
        <div
          className={`market-col mc-false ${
            bet.acceptor && !proposerOnTrue ? "mc-active" : "mc-dim"
          }`}
        >
          {bet.acceptor ? (
            <>
              <div className="market-rowside">
                <SideChip side={bet.acceptor_side as "TRUE" | "FALSE"} />
                <span className="market-stake">{formatGen(bet.stake)}</span>
              </div>
              <span className="market-party">
                {isAcceptor ? "you" : formatAddress(bet.acceptor)}
              </span>
              <span className="market-role">acceptor</span>
            </>
          ) : (
            <span className="market-wait">awaiting opponent…</span>
          )}
        </div>
      </div>

      <div className="row bet-pot">
        <span className="bet-pot-label">Pot</span>
        <span className="pot">{formatGen(pot)}</span>
        {bet.status === "OPEN" && !isProposer && (
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            to win {formatGen(bet.stake * 2n)}
          </span>
        )}
      </div>

      <div className="row">
        {bet.status === "OPEN" && (
          <Countdown target={bet.resolution_time} prefix="Resolves in" />
        )}
        {bet.status === "LOCKED" && !canResolve && (
          <Countdown target={bet.resolution_time} prefix="Resolves in" />
        )}
        {bet.status === "LOCKED" && canResolve && !canCloseStale && (
          <Countdown target={bet.stale_at} prefix="Stale in" passed="Stale window open" />
        )}
        {(bet.status === "RESOLVED" || bet.status === "REFUNDED") && (
          <span className="bet-pot-label" style={{ textTransform: "none" }}>
            closed {bet.verdict_reason ? "· see verdict" : ""}
          </span>
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