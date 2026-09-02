"""Shared helpers for Truth Bets direct-mode tests."""

import json
import sys
from datetime import datetime

import pytest

# A fixed "now" for deterministic time travel. Unix 1767225600.
BASE_ISO = "2030-01-01T00:00:00Z"


def to_hex(addr_bytes):
    """Convert address bytes to checksummed hex matching contract output."""
    if hasattr(addr_bytes, "as_hex"):
        return addr_bytes.as_hex
    from genlayer.py.types import Address

    return Address(addr_bytes).as_hex


def addr(addr_bytes):
    """Build an Address object for TreeMap[Address, ...] lookups."""
    from genlayer.py.types import Address

    if isinstance(addr_bytes, Address):
        return addr_bytes
    return Address(addr_bytes)


def set_time(iso_str: str) -> None:
    """Advance the contract's view of block time.

    The direct VM's ``warp()`` does not refresh ``message_raw['datetime']``,
    which is what the contract's ``_now()`` reads, so we mutate it directly.
    """
    import genlayer.gl as gl

    gl.message_raw["datetime"] = iso_str


@pytest.fixture(autouse=True)
def _reset_block_time():
    """Keep block time deterministic across tests.

    ``genlayer.gl`` is imported once per session, so ``message_raw['datetime']``
    leaks between tests. Reset it to a fixed base before and after each test.
    """
    _reset()
    yield
    _reset()


def _reset():
    if "genlayer.gl" in sys.modules:
        gl = sys.modules["genlayer.gl"]
        if getattr(gl, "message_raw", None) is not None:
            gl.message_raw["datetime"] = BASE_ISO


# Base block time is 2030-01-01T00:00:00Z (see BASE_ISO above).
BET_CLAIM = "Bitcoin closes above $100,000 USD on 2026-01-01."
EVIDENCE_URL = "https://example.com/evidence"
# Resolution one day after BASE_ISO, i.e. 2030-01-02T00:00:00Z.
RESOLUTION_ISO = "2030-01-02T00:00:00Z"


def iso_to_ts(iso_str: str) -> int:
    return int(datetime.fromisoformat(iso_str.replace("Z", "+00:00")).timestamp())


RESOLUTION_TS = iso_to_ts(RESOLUTION_ISO)


def mock_resolution(vm, verdict="TRUE", reason="Claim is verifiably correct.", evidence_body="Evidence: on-chain data supports the claim."):
    """Mock the validator's web fetch and judge LLM for a Truth Bets resolution."""
    if evidence_body is not None:
        vm.mock_web(r".*example\.com.*", {"status": 200, "body": evidence_body})
    vm.mock_llm(
        r".*truth bet.*",
        json.dumps({"verdict": verdict, "reason": reason}),
    )


def create_bet(
    contract, vm, proposer, claim=BET_CLAIM, evidence_url="", stake=100,
    side="TRUE", resolution_ts=RESOLUTION_TS,
):
    """Proposer creates a bet with the exact stake; returns its int id."""
    vm.sender = proposer
    vm.value = stake
    bid = int(contract.create_bet(claim, evidence_url, resolution_ts, stake, side))
    vm.value = 0
    return bid


def funded_bet(contract, vm, proposer, acceptor, **kwargs):
    """Create a bet and have the acceptor match it; returns its int id."""
    stake = kwargs.get("stake", 100)
    bid = create_bet(contract, vm, proposer, **kwargs)
    vm.sender = acceptor
    vm.value = stake
    contract.accept_bet(bid)
    vm.value = 0
    return bid