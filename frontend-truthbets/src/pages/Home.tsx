import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTruthBets } from "../context/TruthBetsContext";
import { formatGen } from "../lib/client";
import type { Config } from "../lib/types";

export default function Home() {
  const { contract } = useTruthBets();
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    contract
      .getConfig()
      .then(setConfig)
      .catch(() => {});
  }, [contract]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">
            <span className="pulse" /> Live on GenLayer StudioNet
          </span>
          <h1>
            Back a claim.
            <br />
            <span className="grad">The network checks the facts.</span>
          </h1>
          <p className="lede">
            Two wallets bet GEN on opposite sides of a claim. When the deadline
            hits, GenLayer's validators look at the evidence and rule TRUE,
            FALSE, or UNCLEAR. Your side matches the verdict and you take the
            pot; an UNCLEAR call sends both stakes back.
          </p>
          <div className="hero-cta">
            <Link to="/bets" className="primary">
              Browse bets
            </Link>
            <Link to="/create" className="ghost">
              Create a bet
            </Link>
          </div>
          <div className="stats-row">
            <div className="stat">
              <div className="stat-value">{config?.bet_count ?? "—"}</div>
              <div className="stat-label">Bets on-chain</div>
            </div>
            <div className="stat">
              <div className="stat-value amber">
                {config ? formatGen(config.escrow_locked) : "—"}
              </div>
              <div className="stat-label">Locked in escrow</div>
            </div>
            <div className="stat">
              <div className="stat-value lime">3</div>
              <div className="stat-label">Possible verdicts</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">
            How it <span className="accent">works</span>
          </h2>
          <div className="steps">
            <div className="step">
              <div className="step-n">STEP 01</div>
              <h3>Fund both sides</h3>
              <p>
                The proposer writes a claim, picks TRUE or FALSE, and sends a
                stake. An acceptor matches that stake and takes the other side.
                Both amounts sit in escrow until the deadline.
              </p>
            </div>
            <div className="step">
              <div className="step-n">STEP 02</div>
              <h3>Resolution time</h3>
              <p>
                When the resolution time arrives, anyone can trigger it.
                Validators fetch the evidence URL and read public sources.
              </p>
            </div>
            <div className="step">
              <div className="step-n">STEP 03</div>
              <h3>Validators rule</h3>
              <p>
                Consensus comes back TRUE or FALSE and the matching side takes
                the pot. UNCLEAR refunds both parties. If consensus never
                decides, the bet goes stale and everyone gets their stake back.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <h2 className="section-title">
            One AI call per bet.{" "}
            <span className="accent">No moderation. No disputes.</span>
          </h2>
          <p className="muted" style={{ maxWidth: 720, marginBottom: 26 }}>
            Truth Bets stays small on purpose: a single non-deterministic step
            at resolution and one escrow shape. The whole state machine is{" "}
            <code>OPEN → LOCKED → RESOLVED | REFUNDED | CANCELLED</code>. A
            verdict nobody can parse leaves the bet LOCKED for a retry, and a
            bet nobody resolves within seven days refunds both sides instead of
            handing the pot to someone.
          </p>
          <div className="cta-band">
            <Link to="/create" className="primary">
              Put a claim to the test →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}