#!/usr/bin/env bash
# Truth Bets verification loop — contract only; KAVI files are never touched.
#
# Usage:
#   ./scripts/verify-truthbets.sh                # lint + direct tests
#   ./scripts/verify-truthbets.sh --frontend     # + frontend typecheck & build
#   ./scripts/verify-truthbets.sh --integration  # + StudioNet integration tests
#
# Flags can be combined. Requires scripts/setup.sh to have been run once.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VENV="$ROOT/.venv"

if [ ! -x "$VENV/bin/pytest" ]; then
    echo "venv missing — run ./scripts/setup.sh first" >&2
    exit 1
fi

DO_FRONTEND=0
DO_INTEGRATION=0
for arg in "$@"; do
    case "$arg" in
        --frontend) DO_FRONTEND=1 ;;
        --integration) DO_INTEGRATION=1 ;;
        *)
            echo "unknown option: $arg" >&2
            exit 1
            ;;
    esac
done

echo "==> genvm-lint contracts/truth_bets.py"
"$VENV/bin/genvm-lint" check contracts/truth_bets.py

echo "==> direct tests (tests/direct/test_truth_bets.py)"
"$VENV/bin/pytest" tests/direct/test_truth_bets.py -q

if [ "$DO_FRONTEND" -eq 1 ]; then
    echo "==> frontend-truthbets typecheck"
    (cd frontend-truthbets && npm run typecheck)
    echo "==> frontend-truthbets build"
    (cd frontend-truthbets && npm run build)
fi

if [ "$DO_INTEGRATION" -eq 1 ]; then
    echo "==> StudioNet integration tests (needs network; ~5 min)"
    "$VENV/bin/gltest" --network studionet tests/integration/test_truth_bets.py -v -s
fi

echo "==> All Truth Bets checks passed."
