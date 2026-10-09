import { createClient } from "genlayer-js";
import { studionet, localnet } from "genlayer-js/chains";
import {
  NETWORK,
  RPC_URL,
  STUDIONET_CHAIN_ID_HEX,
  CONTRACT_ADDRESS,
} from "../config";
import { Bet, Config, Side, toBigInt, toInt } from "./types";

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function getChain(): any {
  if (NETWORK === "localnet") return localnet;
  // studionet is the default; testnet names fall back to studionet config but
  // with a different endpoint set via RPC_URL.
  return studionet;
}

/**
 * Create a genlayer-js client. When `address` is provided the client signs
 * transactions through the injected provider (window.ethereum).
 */
export function createTruthBetsClient(address?: string | null) {
  const config: any = { chain: getChain() };
  if (address) config.account = address as `0x${string}`;
  if (RPC_URL) config.endpoint = RPC_URL;
  return createClient(config) as any;
}

export function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

export function hasEthereumProvider(): boolean {
  return !!getProvider();
}

export async function requestAccounts(): Promise<string[]> {
  const provider = getProvider();
  if (!provider) throw new Error("No injected wallet found. Install MetaMask.");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  return accounts;
}

export async function getAccounts(): Promise<string[]> {
  const provider = getProvider();
  if (!provider) return [];
  try {
    return (await provider.request({ method: "eth_accounts" })) as string[];
  } catch {
    return [];
  }
}

/** Native GEN balance of an address, in wei. */
export async function getBalance(address: string): Promise<bigint> {
  const provider = getProvider();
  if (!provider) return 0n;
  try {
    const result = await provider.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });
    return BigInt(result as string);
  } catch {
    return 0n;
  }
}

export async function getChainId(): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  try {
    return (await provider.request({ method: "eth_chainId" })) as string;
  } catch {
    return null;
  }
}

/** Subscribe to wallet account changes. Returns an unsubscribe function. */
export function onAccountsChanged(
  handler: (accounts: string[]) => void,
): () => void {
  const provider = getProvider();
  if (!provider?.on) return () => {};
  provider.on("accountsChanged", handler as (...args: unknown[]) => void);
  return () =>
    provider.removeListener?.(
      "accountsChanged",
      handler as (...args: unknown[]) => void,
    );
}

/** Subscribe to network changes. Returns an unsubscribe function. */
export function onChainChanged(handler: (chainId: string) => void): () => void {
  const provider = getProvider();
  if (!provider?.on) return () => {};
  provider.on("chainChanged", handler as (...args: unknown[]) => void);
  return () =>
    provider.removeListener?.(
      "chainChanged",
      handler as (...args: unknown[]) => void,
    );
}

export function isStudioNetChainId(chainId: string | null | undefined): boolean {
  return !!chainId && chainId.toLowerCase() === STUDIONET_CHAIN_ID_HEX.toLowerCase();
}

async function addStudionet(provider: EthereumProvider) {
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: STUDIONET_CHAIN_ID_HEX,
        chainName: "GenLayer Studio",
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [],
      },
    ],
  });
}

async function switchToStudionet(provider: EthereumProvider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await addStudionet(provider);
    } else {
      throw err;
    }
  }

  const nextChainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (!isStudioNetChainId(nextChainId)) {
    throw new Error("Could not place wallet on StudioNet.");
  }
}

export async function ensureNetwork(provider: EthereumProvider) {
  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (!isStudioNetChainId(chainId)) {
    await switchToStudionet(provider);
  }

  const verifiedChainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (!isStudioNetChainId(verifiedChainId)) {
    throw new Error("Could not place wallet on StudioNet.");
  }
}

/**
 * Connect the injected wallet and ensure it is on the GenLayer network.
 * Returns the active address.
 */
export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("No injected wallet found. Install MetaMask.");

  const accounts = await requestAccounts();
  if (!accounts.length) throw new Error("No accounts available.");

  try {
    await ensureNetwork(provider);
  } catch {
    // Fail closed: any failure to land on StudioNet (including the user
    // rejecting the switch) must not let the wallet proceed.
    throw new Error("Could not place wallet on StudioNet. Please switch the wallet to StudioNet and try again.");
  }
  return accounts[0];
}

export function formatAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const GEN_DECIMALS = 18n;
const GEN_ONE = 10n ** GEN_DECIMALS;

/** Parse a decimal GEN string (e.g. "100" or "12.5") into wei, exactly. */
export function parseGen(input: string): bigint {
  const s = input.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error("Invalid GEN amount");
  }
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(Number(GEN_DECIMALS))).slice(
    0,
    Number(GEN_DECIMALS),
  );
  return BigInt(whole) * GEN_ONE + BigInt(fracPadded || "0");
}

/** Format a wei amount as a human-readable GEN string. */
export function formatGen(wei: bigint | string | number): string {
  const w = BigInt(wei);
  const sign = w < 0n ? "-" : "";
  const abs = w < 0n ? -w : w;
  const whole = abs / GEN_ONE;
  const frac = (abs % GEN_ONE)
    .toString()
    .padStart(Number(GEN_DECIMALS), "0")
    .replace(/0+$/, "");
  return `${sign}${whole.toLocaleString()}${frac ? "." + frac : ""} GEN`;
}

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
    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "FINALIZED" as any,
      retries,
      interval,
    });

    const status = String(receipt?.status ?? receipt?.state ?? "").toUpperCase();
    const hasSuccessfulStatus = !status || ["FINALIZED", "SUCCESS", "CONFIRMED", "EXECUTED", "OK"].includes(status);

    if (!receipt || !hasSuccessfulStatus) {
      const statusText = status || "unknown";
      throw new Error(`Transaction was not finalized successfully: ${statusText}`);
    }

    return receipt;
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
