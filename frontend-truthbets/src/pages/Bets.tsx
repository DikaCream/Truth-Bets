import { useCallback, useEffect, useMemo, useState } from "react";
import BetCard from "../components/BetCard";
import { useTruthBets } from "../context/TruthBetsContext";
import type { Bet, Config } from "../lib/types";

const POLL_MS = 10000;

export default function Bets() {
  const { wallet, contract } = useTruthBets();
  const [bets, setBets] = useState<Bet[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const refresh = useCallback(async () => {
    try {
      const [all, cfg, mine] = await Promise.all([
        contract.listBets(0, 50),
        contract.getConfig(),
        wallet.address
          ? Promise.all([
              contract.listProposerBets(wallet.address, 0, 50),
              contract.listAcceptorBets(wallet.address, 0, 50),
            ])
          : Promise.resolve([[], []]),
      ]);
      setBets(all);
      setConfig(cfg);
      setMyBets([...mine[0], ...mine[1]]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bets.");
    } finally {
      setLoading(false);
    }
  }, [contract, wallet.address]);

  // Initial load + polling + a tick that flips countdowns every second.
  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const clock = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [refresh]);

  const runTx = useCallback(
    async (id: number, fn: () => Promise<string>) => {
      setBusyId(id);
      setError(null);
      try {
        const txHash = await fn();
        await contract.waitForReceipt(txHash);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Transaction failed.");
      } finally {
        setBusyId(null);
      }
    },
    [contract, refresh],
  );

  const actions = useMemo(
    () => ({
      onAccept: (bet: Bet) =>
        runTx(bet.id, () => contract.acceptBet(bet.id, bet.stake)),
      onCancel: (bet: Bet) => runTx(bet.id, () => contract.cancelBet(bet.id)),
      onResolve: (bet: Bet) => runTx(bet.id, () => contract.resolveBet(bet.id)),
      onCloseStale: (bet: Bet) =>
        runTx(bet.id, () => contract.closeStaleBet(bet.id)),
    }),
    [contract, runTx],
  );

  const myBetIds = useMemo(() => new Set(myBets.map((b) => b.id)), [myBets]);
  const otherBets = bets.filter((b) => !myBetIds.has(b.id));

  return (
    <div className="page container">
      <div className="page-head">
        <h1>All bets</h1>
        <p className="muted">
          Every open wager on-chain. Accept any <strong>OPEN</strong> bet by
          matching its stake; anyone can trigger <strong>resolve</strong> once
          the resolution time arrives.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {config && (
        <div className="stats-row" style={{ marginBottom: 26 }}>
          <div className="stat">
            <div className="stat-value">{config.bet_count}</div>
            <div className="stat-label">Total bets</div>
          </div>
          <div className="stat">
            <div className="stat-value">
              {config.escrow_locked === 0n
                ? "0"
                : config.escrow_locked.toString().slice(0, 8)}
            </div>
            <div className="stat-label">GEN in escrow (wei)</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading" role="status">
          <span className="spinner" aria-hidden="true" /> Loading bets…
        </div>
      ) : (
        <>
          {myBets.length > 0 && (
            <section style={{ marginBottom: 34 }}>
              <h2 className="section-title">
                Your bets <span className="accent">({myBets.length})</span>
              </h2>
              <div className="grid">
                {myBets.map((bet) => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    me={wallet.address}
                    busy={busyId === bet.id}
                    now={now}
                    {...actions}
                  />
                ))}
              </div>
            </section>
          )}

          <h2 className="section-title">
            All bets <span className="accent">({bets.length})</span>
          </h2>
          {bets.length === 0 ? (
            <div className="empty">
              <p>No bets yet.</p>
              <p>
                <a href="/create">Create the first one →</a>
              </p>
            </div>
          ) : (
            <div className="grid">
              {otherBets.map((bet) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  me={wallet.address}
                  busy={busyId === bet.id}
                  now={now}
                  {...actions}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
