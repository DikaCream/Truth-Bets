# Truth Bets

AI-judged binary bets on [GenLayer](https://genlayer.com)'s intelligent network.

Two parties deposit GEN on opposite sides of a factual claim. At resolution
time, GenLayer's AI validators fetch public evidence, judge the claim and reach
consensus on **TRUE / FALSE / UNCLEAR**. The winning side takes both stakes;
UNCLEAR refunds everyone back their stake.

## How it works

```
OPEN ──accept──> LOCKED ──resolve──> RESOLVED   (winner takes 2× stake)
  │                       │
  └──cancel──> CANCELLED  └──UNCLEAR──> REFUNDED  (stakes returned)
                          └──stale 7 days──> REFUNDED  (fail closed)
```

1. **Proposer** creates a bet: claim + optional evidence URL + resolution
   time + stake, and picks the TRUE or FALSE side.
2. **Acceptor** matches the stake and automatically takes the opposite side.
3. Anyone calls `resolve_bet` once resolution time arrives. Validators judge
   the claim with live web access (the evidence URL is fetched SSRF-safely)
   and reach an equivalence-principle consensus. The winning side receives
   `2 × stake`.

One AI call per bet, one escrow shape, no moderation, no disputes.

## Deployed contract

| Network | Address |
|---|---|
| StudioNet | `0x74e2b3B85090A3674A2f8bD50C76341371a297f0` |

Verified on-chain at deploy time: 5/5 validators **AGREE**, status ACCEPTED
(tx `0xb1b0ca5cdd9e12c448718706f5e528cf744f8770a2b55bd026e26b655c3c33c8`).

## Live app

The production frontend is deployed on Vercel and wired to the live StudioNet
contract — SPA routes (`/bets`, `/create`), wallet connection (StudioNet,
chain id 61999) and the full create → accept → resolve flow run against the
on-chain contract; no mock data.

**https://truth-bets.vercel.app**

## Repository layout

```
contracts/truth_bets.py        # the TruthBets contract (single file)
tests/direct/                  # fast deterministic tests (mocked web + LLM)
tests/integration/             # StudioNet consensus tests (real fetch + LLM)
frontend-truthbets/            # Vite + React dapp UI (list, create, accept, resolve)
scripts/setup.sh               # one-shot env bootstrap for flaky networks
scripts/verify-truthbets.sh    # lint + tests (+ optional frontend / integration)
```

## Quickstart

```bash
./scripts/setup.sh               # Python venv + deps (official PyPI via pip.conf)
./scripts/setup.sh --frontend    # + install frontend deps
source .venv/bin/activate
```

### Frontend

```bash
cd frontend-truthbets
cp .env.example .env       # optional — config.ts falls back to the live contract
npm run dev                # http://localhost:5173
```

Connect a GenLayer wallet on StudioNet (chain id **61999**) with some GEN to
create and accept bets. The UI supports: browse all bets, create a bet, accept
an open bet, resolve when the time comes, cancel your open bet, and close a
stale bet.

## Tests

```bash
./scripts/verify-truthbets.sh                # genvm-lint + direct tests
./scripts/verify-truthbets.sh --frontend     # + frontend typecheck & build
./scripts/verify-truthbets.sh --integration  # + StudioNet consensus tests (~5 min)
```

Direct tests mock the validator's web fetch and LLM, covering the full state
machine (cancel, UNCLEAR refunds, stale close, retry throttling, fail-closed
paths). Integration tests exercise the real consensus pipeline on StudioNet.

## Redeploying the contract

Requires the `genlayer` CLI (`npm i -g genlayer`), an account keystore and the
StudioNet network profile:

```bash
genlayer network set studionet
genlayer account create           # or import an existing keystore
genlayer deploy contracts/truth_bets.py
```

Point the frontend at the new address via `VITE_CONTRACT_ADDRESS`.

## Security & failure modes

- **SSRF-safe fetch** — evidence URLs must be public, default-port, https;
  localhost, private/reserved IP ranges and `.local`/`.internal`-style hosts
  are rejected in every spelling.
- **Prompt-injection resistant** — claim/evidence text is framed as data to
  judge and structural markers (`<<<`, fences, BEGIN/END) are neutralized
  before being placed in the prompt.
- **Equivalence principle** — consensus compares verdict strings byte-exactly
  (TRUE/FALSE/UNCLEAR); reasoning text may differ between validators.
- **Fail closed** — unparseable verdicts or disagreement never pay out a guess:
  the bet stays LOCKED, retries are throttled (5-min cooldown, max 5 attempts)
  and after 7 days past resolution anyone can close it stale, refunding both
  sides.
- **Escrow invariant** — `escrow_locked` equals the funds held in OPEN/LOCKED
  bets and is tracked incrementally on every transition.

## Disclaimer

Experimental software — use at your own risk. Bets are judged by GenLayer's
validator consensus, not by the authors of this repository.