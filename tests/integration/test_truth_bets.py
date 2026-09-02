"""Integration tests for Truth Bets — require GenLayer Studio running.

Run with: gltest --network studionet tests/integration/test_truth_bets.py -v -s

These exercise the real consensus pipeline: two wallets fund a bet on opposite
sides of a claim, and at resolution time GenLayer's AI validators fetch the
evidence URL, judge the claim, and reach an equivalence-principle verdict. The
verdict itself is a genuine consensus result (not byte-for-byte reproducible),
so the tests assert the *mechanism*: the bet reaches a terminal RESOLVED /
REFUNDED state, the winner is one of the two parties, and the escrow returns
to zero.

The full state machine (cancel, UNCLEAR refunds, stale close, throttling,
fail-closed paths) is covered exhaustively by the fast direct-mode tests
(tests/direct/test_truth_bets.py), which mock web + LLM and don't need Studio.
"""

import time

import pytest
from genlayer_py.types import CalldataAddress
from gltest import get_accounts, get_contract_factory
from gltest.assertions import tx_execution_succeeded

# A maximally stable public https page, used as the bet's evidence source. The
# claim asserts something about this page so validators can verify it by
# fetching the evidence URL during resolution.
EVIDENCE_URL = "https://example.com/"
CLAIM = (
    "The page served at " + EVIDENCE_URL + " contains the text 'Example Domain'."
)
STAKE = 100
# Resolution time must be strictly in the future of the validators' clock, so
# the test sets it a comfortable margin ahead of wall-clock time.
RESOLUTION_OFFSET_SECONDS = 120
TERMINAL_STATUSES = {"RESOLVED", "REFUNDED"}
MAX_WAIT_SECONDS = 180
POLL_SECONDS = 5


def _deploy(account):
    factory = get_contract_factory("TruthBets")
    contract = factory.deploy(account=account)

    # Freshly deployed: no bets, no locked escrow.
    assert contract.get_bet_count(args=[]).call() == 0
    config = contract.get_config(args=[]).call()
    assert config["bet_count"] == 0
    assert config["escrow_locked"] == 0
    return contract


def _get_bet(contract, bet_id):
    return contract.get_bet(args=[bet_id]).call()


def _wait_for_terminal(contract, bet_id):
    """Poll get_bet until resolution reaches a terminal state or time out."""
    deadline = time.time() + MAX_WAIT_SECONDS
    while time.time() < deadline:
        bet = _get_bet(contract, bet_id)
        if bet is not None and bet["status"] in TERMINAL_STATUSES:
            return bet
        time.sleep(POLL_SECONDS)
    return _get_bet(contract, bet_id)


@pytest.mark.integration
def test_create_accept_resolve_reaches_consensus():
    # Two distinct wallets: the proposer and the acceptor.
    accounts = get_accounts()
    proposer, acceptor = accounts[0], accounts[1]
    contract = _deploy(account=proposer)

    # Proposer funds a bet on the TRUE side.
    resolution_ts = int(time.time()) + RESOLUTION_OFFSET_SECONDS
    receipt = contract.create_bet(
        args=[CLAIM, EVIDENCE_URL, resolution_ts, STAKE, "TRUE"],
    ).transact(value=STAKE, wait_interval=10000, wait_retries=15)
    assert tx_execution_succeeded(receipt)

    bet = _get_bet(contract, 1)
    assert bet is not None
    assert bet["status"] == "OPEN"
    assert bet["proposer"].lower() == proposer.address.lower()
    assert bet["proposer_side"] == "TRUE"
    assert contract.get_config(args=[]).call()["escrow_locked"] == STAKE

    # Acceptor matches the stake and takes the FALSE side.
    contract = contract.connect(acceptor)
    receipt = contract.accept_bet(
        args=[1],
    ).transact(value=STAKE, wait_interval=10000, wait_retries=15)
    assert tx_execution_succeeded(receipt)

    bet = _get_bet(contract, 1)
    assert bet["status"] == "LOCKED"
    assert bet["acceptor"].lower() == acceptor.address.lower()
    assert bet["acceptor_side"] == "FALSE"
    assert contract.get_config(args=[]).call()["escrow_locked"] == 2 * STAKE

    # Resolution is permissionless; anyone may call it once the time has come.
    # Reverts (block time not yet at resolution_time, or consensus hiccups) are
    # retried until the transaction succeeds.
    contract = contract.connect(proposer)
    deadline = time.time() + MAX_WAIT_SECONDS
    resolved = False
    while time.time() < deadline and not resolved:
        try:
            receipt = contract.resolve_bet(
                args=[1],
            ).transact(wait_interval=10000, wait_retries=30)
            resolved = tx_execution_succeeded(receipt)
        except Exception:
            pass
        if not resolved:
            time.sleep(POLL_SECONDS)

    bet = _wait_for_terminal(contract, 1)
    assert bet is not None, "bet should exist after funding"
    # Real consensus must reach a terminal verdict (never stuck LOCKED when
    # validators can fetch the evidence and parse the JSON verdict).
    assert bet["status"] in TERMINAL_STATUSES
    assert bet["attempts"] >= 1
    # The escrow is fully settled either way: winner takes all or both refunded.
    assert contract.get_config(args=[]).call()["escrow_locked"] == 0
    if bet["status"] == "RESOLVED":
        assert bet["verdict"] in ("TRUE", "FALSE")
        winner = bet["winner"].lower()
        assert winner in (proposer.address.lower(), acceptor.address.lower())
        assert isinstance(bet["verdict_reason"], str) and bet["verdict_reason"]
    else:  # REFUNDED
        assert bet["verdict"] == "UNCLEAR"


@pytest.mark.integration
def test_views_reflect_bet_state():
    accounts = get_accounts()
    proposer = accounts[2]
    contract = _deploy(account=proposer)

    resolution_ts = int(time.time()) + RESOLUTION_OFFSET_SECONDS
    receipt = contract.create_bet(
        args=[CLAIM, EVIDENCE_URL, resolution_ts, 250, "FALSE"],
    ).transact(value=250, wait_interval=10000, wait_retries=15)
    assert tx_execution_succeeded(receipt)

    # list_bets and list_proposer_bets expose the same record.
    listed = contract.list_bets(args=[0, 50]).call()
    assert len(listed) == 1
    assert listed[0]["id"] == 1
    assert listed[0]["proposer_side"] == "FALSE"
    assert listed[0]["status"] == "OPEN"

    # Address-typed args must be encoded as addresses (CalldataAddress); a
    # plain hex string is sent as text and fails the VM's TreeMap lookup.
    mine = contract.list_proposer_bets(
        args=[CalldataAddress(proposer.address), 0, 50]
    ).call()
    assert len(mine) == 1
    assert mine[0]["id"] == 1
    assert contract.get_config(args=[]).call()["bet_count"] == 1
