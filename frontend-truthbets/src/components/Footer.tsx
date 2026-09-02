import { Link } from "react-router-dom";
import { CONTRACT_ADDRESS } from "../config";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p className="muted" style={{ maxWidth: 360, marginTop: 12 }}>
            Wager GEN on factual claims. GenLayer's AI validators read the
            evidence, rule TRUE / FALSE / UNCLEAR, and the winner takes both
            stakes.
          </p>
        </div>
        <div className="footer-col">
          <strong>Explore</strong>
          <Link to="/bets">All bets</Link>
          <Link to="/create">Create a bet</Link>
        </div>
        <div className="footer-col">
          <strong>Network</strong>
          <a href="https://genlayer.com" target="_blank" rel="noreferrer">
            GenLayer
          </a>
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer">
            Docs
          </a>
        </div>
        <div className="footer-col">
          <strong>Contract</strong>
          {CONTRACT_ADDRESS ? (
            <a
              href={`https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="mono"
            >
              {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)}
            </a>
          ) : (
            <span className="muted">Not configured</span>
          )}
        </div>
      </div>
    </footer>
  );
}
