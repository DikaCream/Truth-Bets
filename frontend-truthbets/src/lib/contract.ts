import { CONTRACT_ADDRESS } from "../config";
import { Bet, Config, Side, toBigInt, toInt } from "./types";

function fromMapLike(v: any): Record<string, any> {
  if (v instanceof Map) {
    const out: Record<string, any> = {};
    v.forEach((val: any, key: any) => {
      out[String(key)] = val;
    });
    return out;
  }
  return (v ?? {}) as Record<string, any>;
}

function toBet(v: any): Bet {
  const o = fromMapLike(v);
  return {
    id: toInt(o.id),
    proposer: String(o.proposer ?? ""),
    proposer_side: String(o.proposer_side ?? "") as Side,
    acceptor: String(o.acceptor ?? ""),
    acceptor_side: String(o.acceptor_side ?? "") as Side | "",
    claim: String(o.claim ?? ""),
    evidence_url: String(o.evidence_url ?? ""),
    stake: toBigInt(o.stake),
    resolution_time: toInt(o.resolution_time),
    status: String(o.status) as Bet["status"],
    verdict: String(o.verdict ?? "") as Bet["verdict"],
    winner: String(o.winner ?? ""),
    verdict_reason: String(o.verdict_reason ?? ""),
    attempts: toInt(o.attempts),
    last_resolved_at: toInt(o.last_resolved_at),
    created_at: toInt(o.created_at),
    accepted_at: toInt(o.accepted_at),
    stale_at: toInt(o.stale_at),
  };
}

function toConfig(v: any): Config {
  const o = fromMapLike(v);
  return {
    bet_count: toInt(o.bet_count),
    escrow_locked: toBigInt(o.escrow_locked),
    resolution_cooldown_seconds: toInt(o.resolution_cooldown_seconds),
    max_resolution_attempts: toInt(o.max_resolution_attempts),
    stale_after_resolution_seconds: toInt(o.stale_after_resolution_seconds),
    max_stake_gen: toInt(o.max_stake_gen),
  };
}

/**
 * Typed wrapper over the deployed TruthBets contract.
 * Read methods work without an account; write methods sign via the client.
 */
export class TruthBets {
  constructor(private client: any, private address: string = CONTRACT_ADDRESS) {}

  private async read(functionName: string, args: unknown[] = []): Promise<any> {
    return this.client.readContract({
      address: this.address as `0x${string}`,
      functionName,
      args,
    });
  }

  private async write(
    functionName: string,
    args: unknown[],
    value: bigint = 0n,
  ): Promise<string> {
    const txHash = await this.client.writeContract({
      address: this.address as `0x${string}`,
      functionName,
      args,
      value,
    });
    return txHash as string;
  }

  async waitForReceipt(txHash: string, retries = 40, interval = 3000): Promise<any> {
    return this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as any,
      retries,
      interval,
    });
  }

  // ---- reads ----------------------------------------------------------
  async getConfig(): Promise<Config> {
    return toConfig(await this.read("get_config"));
  }

  async getBet(id: number): Promise<Bet | null> {
    const v = await this.read("get_bet", [id]);
    if (v == null) return null;
    return toBet(v);
  }

  async getBetCount(): Promise<number> {
    return toInt(await this.read("get_bet_count"));
  }

  async listBets(offset = 0, limit = 50): Promise<Bet[]> {
    const v = await this.read("list_bets", [offset, limit]);
    return Array.isArray(v) ? v.map(toBet) : [];
  }

  async listProposerBets(proposer: string, offset = 0, limit = 50): Promise<Bet[]> {
    const v = await this.read("list_proposer_bets", [proposer, offset, limit]);
    return Array.isArray(v) ? v.map(toBet) : [];
  }

  async listAcceptorBets(acceptor: string, offset = 0, limit = 50): Promise<Bet[]> {
    const v = await this.read("list_acceptor_bets", [acceptor, offset, limit]);
    return Array.isArray(v) ? v.map(toBet) : [];
  }

  // ---- writes ---------------------------------------------------------
  /** Proposer funds a bet and picks their side. `stakeWei` is sent as value. */
  async createBet(
    claim: string,
    evidenceUrl: string,
    resolutionTime: number,
    stakeWei: bigint,
    proposerSide: Side,
  ): Promise<string> {
    return this.write(
      "create_bet",
      [claim, evidenceUrl, resolutionTime, stakeWei, proposerSide],
      stakeWei,
    );
  }

  /** Acceptor matches the stake (sent as value) and takes the opposite side. */
  async acceptBet(betId: number, stakeWei: bigint): Promise<string> {
    return this.write("accept_bet", [betId], stakeWei);
  }

  /** Proposer backs out while the bet is still OPEN; stake is returned. */
  async cancelBet(betId: number): Promise<string> {
    return this.write("cancel_bet", [betId]);
  }

  /** Permissionless at/after resolution time; runs validator consensus. */
  async resolveBet(betId: number): Promise<string> {
    return this.write("resolve_bet", [betId]);
  }

  /** Fail closed after the stale window; refunds both parties. */
  async closeStaleBet(betId: number): Promise<string> {
    return this.write("close_stale_bet", [betId]);
  }
}
