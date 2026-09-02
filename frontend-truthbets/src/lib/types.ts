/**
 * Types mirroring the TruthBets contract state.
 *
 * Stake and escrow amounts are stored on-chain in wei and returned by the node
 * as number, bigint or string depending on magnitude; every helper normalizes
 * them to bigint. Small ints (ids, counts, timestamps) are normalized to
 * number.
 */

export type BetStatus = "OPEN" | "LOCKED" | "RESOLVED" | "REFUNDED" | "CANCELLED";
export type Side = "TRUE" | "FALSE";
export type Verdict = "" | "TRUE" | "FALSE" | "UNCLEAR";

export interface Bet {
  id: number;
  proposer: string;
  proposer_side: Side;
  acceptor: string; // "" until someone accepts
  acceptor_side: Side | ""; // "" until someone accepts
  claim: string;
  evidence_url: string; // optional public https URL validators may fetch
  stake: bigint; // wei
  resolution_time: number; // unix seconds
  status: BetStatus;
  verdict: Verdict;
  winner: string; // "" unless a side won
  verdict_reason: string;
  attempts: number;
  last_resolved_at: number;
  created_at: number;
  accepted_at: number;
  stale_at: number; // resolution_time + stale_after_resolution_seconds
}

export interface Config {
  bet_count: number;
  escrow_locked: bigint; // wei
  resolution_cooldown_seconds: number;
  max_resolution_attempts: number;
  stale_after_resolution_seconds: number;
  max_stake_gen: number;
}

export function toInt(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return Number(v);
  return 0;
}

export function toBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.round(v));
  if (typeof v === "string") return BigInt(v);
  return 0n;
}
