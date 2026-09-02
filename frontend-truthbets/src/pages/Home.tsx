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
        <div className="orb-field" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
        <div className="container">
          <span className="eyebrow">
            <span className="pulse" /> GenLayer Intelligent Contract — StudioNet
          </span>
          <h1>
            Bets that read
            <br />
            <span className="grad">what they resolve.</span>
          </h1>
          <p className="lede">
            Two parties deposit GEN on opposite sides of a factual claim. At
            resolution time, GenLayer&apos;s AI validators fetch the evidence and
            rule TRUE, FALSE or UNCLEAR. The winning side takes both stakes; an
            unclear verdict refunds everyone.
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
              <div className="stat-value">
                {config ? formatGen(config.escrow_locked) : "—"}
              </div>
              <div className="stat-label">Locked in escrow</div>
            </div>
            <div className="stat">
              <div className="stat-value">3</div>
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
                The proposer picks a claim and their side (TRUE or FALSE), then
                deposits a stake. An acceptor matches the stake on the opposite
                side. Both stakes sit in escrow.
              </p>
            </div>
            <div className="step">
              <div className="step-n">STEP 02</div>
              <h3>Resolution time</h3>
              <p>
                Once the resolution time arrives, anyone can trigger
                resolution. Validators fetch the optional evidence URL and read
                public sources.
              </p>
            </div>
            <div className="step">
              <div className="step-n">STEP 03</div>
              <h3>AI validators rule</h3>
              <p>
                Consensus returns TRUE or FALSE — the matching side takes both
                stakes. UNCLEAR refunds both parties. If consensus never
                resolves, the bet goes stale and everyone is refunded.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <h2 className="section-title">
            One AI call per bet — <span className="accent">no moderation, no disputes</span>
          </h2>
          <p className="muted" style={{ maxWidth: 720, marginBottom: 26 }}>
            Truth Bets is deliberately minimal: a single non-deterministic step
            (resolution) and one escrow shape. The whole state machine is{" "}
            <code>OPEN → LOCKED → RESOLVED | REFUNDED | CANCELLED</code>.
            Unusable verdicts fail closed (the bet stays locked for a retry),
            and a stale bet refunds both sides instead of letting anyone win a
            bet the network could not judge.
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
