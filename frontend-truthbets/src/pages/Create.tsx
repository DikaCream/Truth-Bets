import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTruthBets } from "../context/TruthBetsContext";
import { parseGen } from "../lib/client";
import { MAX_CLAIM_CHARS, MAX_STAKE_GEN, MIN_CLAIM_CHARS } from "../config";

interface FieldErrors {
  claim?: string;
  side?: string;
  stake?: string;
  resolution?: string;
  evidence?: string;
}

export default function Create() {
  const { wallet, contract } = useTruthBets();
  const navigate = useNavigate();

  const [claim, setClaim] = useState("");
  const [side, setSide] = useState<"TRUE" | "FALSE">("TRUE");
  const [stake, setStake] = useState("");
  const [resolution, setResolution] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const c = claim.trim();
    if (c.length < MIN_CLAIM_CHARS || c.length > MAX_CLAIM_CHARS) {
      errors.claim = `Claim must be ${MIN_CLAIM_CHARS}-${MAX_CLAIM_CHARS} characters.`;
    }
    if (!stake.trim()) {
      errors.stake = "Stake is required.";
    } else {
      try {
        const wei = parseGen(stake);
        const maxWei = BigInt(MAX_STAKE_GEN) * 10n ** 18n;
        if (wei <= 0n) errors.stake = "Stake must be greater than zero.";
        else if (wei > maxWei)
          errors.stake = `Stake must be ${MAX_STAKE_GEN} GEN or less.`;
      } catch {
        errors.stake = "Enter a valid GEN amount (e.g. 10 or 2.5).";
      }
    }
    if (!resolution) {
      errors.resolution = "Pick a resolution time.";
    } else {
      const unix = Math.floor(new Date(resolution).getTime() / 1000);
      if (Number.isNaN(unix) || unix <= Math.floor(Date.now() / 1000)) {
        errors.resolution = "Resolution time must be in the future.";
      }
    }
    if (evidenceUrl.trim()) {
      const u = evidenceUrl.trim();
      if (!/^https:\/\/[^\s]+$/i.test(u)) {
        errors.evidence = "Evidence URL must be a public https:// URL.";
      }
    }
    return errors;
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!wallet.address) {
      setSubmitError("Connect your wallet first.");
      return;
    }
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      const stakeWei = parseGen(stake);
      const resolutionTs = Math.floor(new Date(resolution).getTime() / 1000);
      const txHash = await contract.createBet(
        claim.trim(),
        evidenceUrl.trim(),
        resolutionTs,
        stakeWei,
        side,
      );
      await contract.waitForReceipt(txHash);
      navigate("/bets");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create bet.");
      setBusy(false);
    }
  }

  return (
    <div className="page container page narrow">
      <div className="page-head">
        <h1>Create a bet</h1>
        <p className="muted">
          You propose a factual claim and pick your side. Anyone can accept by
          matching your stake on the opposite side. At resolution time,
          GenLayer's AI validators fetch the evidence and rule{" "}
          <strong>TRUE</strong>, <strong>FALSE</strong> or{" "}
          <strong>UNCLEAR</strong> — the winning side takes both stakes, and an
          unclear verdict refunds everyone.
        </p>
      </div>

      {submitError && <div className="error-banner">{submitError}</div>}
      {!wallet.address && (
        <div className="notice">
          Connect your wallet to fund a bet. StudioNet is gasless — bets only
          need the GEN stake.
        </div>
      )}

      <form className="form panel" onSubmit={onSubmit} noValidate>
        <label>
          Claim (what the validators will judge)
          <textarea
            rows={4}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            aria-invalid={!!fieldErrors.claim || undefined}
            placeholder='e.g. "Bitcoin closes above $100,000 USD on 2026-01-01."'
          />
          <span className={`char-count ${claim.length >= MIN_CLAIM_CHARS && claim.length <= MAX_CLAIM_CHARS ? "ok" : ""}`}>
            {claim.length} / {MAX_CLAIM_CHARS}
          </span>
          {fieldErrors.claim && (
            <span className="field-error">{fieldErrors.claim}</span>
          )}
        </label>

        <div className="side-picker" role="radiogroup" aria-label="Your side">
          <button
            type="button"
            className={`side-option side-opt-true ${side === "TRUE" ? "selected" : ""}`}
            aria-pressed={side === "TRUE"}
            onClick={() => setSide("TRUE")}
            aria-invalid={!!fieldErrors.side || undefined}
          >
            <span className="side-sign">▲ TRUE</span>
            <span>the claim is true</span>
          </button>
          <button
            type="button"
            className={`side-option side-opt-false ${side === "FALSE" ? "selected" : ""}`}
            aria-pressed={side === "FALSE"}
            onClick={() => setSide("FALSE")}
            aria-invalid={!!fieldErrors.side || undefined}
          >
            <span className="side-sign">▼ FALSE</span>
            <span>the claim is false</span>
          </button>
        </div>
        {fieldErrors.side && (
          <span className="field-error">{fieldErrors.side}</span>
        )}

        <label>
          Stake (GEN, sent with your bet)
          <input
            type="text"
            inputMode="decimal"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            placeholder={`e.g. 10 (max ${MAX_STAKE_GEN} GEN)`}
            aria-invalid={!!fieldErrors.stake || undefined}
          />
          {fieldErrors.stake && (
            <span className="field-error">{fieldErrors.stake}</span>
          )}
        </label>

        <label>
          Resolution time (local time)
          <input
            type="datetime-local"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            aria-invalid={!!fieldErrors.resolution || undefined}
          />
          {fieldErrors.resolution && (
            <span className="field-error">{fieldErrors.resolution}</span>
          )}
        </label>

        <label>
          Evidence URL (optional, must be public https)
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://… — validators may fetch this during resolution"
            aria-invalid={!!fieldErrors.evidence || undefined}
          />
          {fieldErrors.evidence && (
            <span className="field-error">{fieldErrors.evidence}</span>
          )}
        </label>

        <button className="primary" type="submit" disabled={busy || !wallet.address}>
          {busy ? "Submitting…" : `Fund bet with ${stake.trim() || "…"} GEN`}
        </button>
      </form>
    </div>
  );
}
