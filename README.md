# Truth Bets

A betting dapp on [GenLayer](https://genlayer.com)'s StudioNet. Two wallets
put GEN on opposite sides of a claim; when the deadline hits, the network's
validators check the facts and settle it.

The verdict is TRUE, FALSE, or UNCLEAR. Match the verdict and you take the
pot. UNCLEAR sends both stakes back.

## How a bet goes

The proposer funds a claim, an acceptor matches it, the deadline passes, and
the validators write a verdict. In order:

1. The proposer writes a claim, picks TRUE or FALSE, sets a resolution time,
   and sends a stake.
2. An acceptor matches that stake and automatically gets the other side.
3. Anyone can call `resolve_bet` once the resolution time has passed. The
   validators read the evidence and agree on a verdict; the winning side
   receives `2 × stake`.

The contract runs one AI call per bet and holds one escrow shape. No
moderation, no dispute system.

## Live state

Contract on StudioNet: `0x74e2b3B85090A3674A2f8bD50C76341371a297f0`

It was deployed with 5/5 validator agreement in tx
`0xb1b0ca5cdd9e12c448718706f5e528cf744f8770a2b55bd026e26b655c3c33c8`.

The frontend lives at https://truth-bets.vercel.app and talks directly to that
contract (chain id 61999). As of September 2026 it has two open bets on it,
both staked at 0.001 GEN, so the board is not empty when you open the site.

## Repository layout

```
contracts/truth_bets.py        the contract, one file
tests/direct/                  local tests with mocked web + LLM
tests/integration/             StudioNet tests against real consensus
frontend-truthbets/            Vite + React app
scripts/setup.sh               environment bootstrap
scripts/verify-truthbets.sh    lint + tests in one command
```

## Quickstart

```bash
./scripts/setup.sh               # Python venv + deps (official PyPI via pip.conf)
./scripts/setup.sh --frontend    # also install frontend deps
source .venv/bin/activate
```

### Frontend

```bash
cd frontend-truthbets
cp .env.example .env       # optional: config.ts falls back to the live contract
npm run dev                # http://localhost:5173
```

Connect a GenLayer wallet on StudioNet (chain id 61999), then you can create a
bet, take an OPEN one, cancel your own open bet, resolve after the deadline,
or close a stale one. Wallet connect is MetaMask-compatible.

## Tests

```bash
./scripts/verify-truthbets.sh                # genvm-lint + direct tests
./scripts/verify-truthbets.sh --frontend     # + typecheck & build
./scripts/verify-truthbets.sh --integration  # + StudioNet consensus tests (~5 min)
```

The direct tests mock the validator's web fetch and LLM and cover the full
state machine. The integration tests run the real consensus pipeline on
StudioNet.

## Redeploying the contract

You need the `genlayer` CLI (`npm i -g genlayer`), a keystore, and the
StudioNet profile:

```bash
genlayer network set studionet
genlayer account create           # or import an existing keystore
genlayer deploy contracts/truth_bets.py
```

Then point the frontend at the new address via `VITE_CONTRACT_ADDRESS`.

## What the contract refuses to do

- Evidence URLs must be public https on a standard port. Localhost, private
  IPs, and `.local`/`.internal` hosts are rejected in any spelling, because
  the validators fetch these URLs themselves.
- Claim and evidence text is treated as data. Prompt fences and markers are
  scrubbed before the text reaches the model.
- Verdicts compare byte-for-byte; only the reasoning text can differ.
- An unusable verdict keeps the bet LOCKED for five minutes, capped at five
  attempts. Seven days after the deadline, anyone can close the bet and both
  sides get their stake back.
- `escrow_locked` is updated on every state change, so the contract never
  loops over bets just to count its own holdings.

## Disclaimer

Experimental code, use at your own risk. The validators, not the repo
authors, decide every bet.