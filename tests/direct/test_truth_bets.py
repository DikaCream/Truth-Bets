"""Truth Bets direct-mode tests — happy path, escrow accounting, fail-closed."""

from tests.direct.conftest import (
    BET_CLAIM,
    EVIDENCE_URL,
    RESOLUTION_ISO,
    RESOLUTION_TS,
    addr,
    create_bet,
    funded_bet,
    mock_resolution,
    set_time,
    to_hex,
)


# ---------------------------------------------------------------- happy path
def test_proposer_wins_when_verdict_matches(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)

    b = contract.get_bet(bid)
    assert b["status"] == "LOCKED"
    assert b["acceptor"].lower() == to_hex(direct_bob).lower()
    assert b["acceptor_side"] == "FALSE"
    assert contract.get_config()["escrow_locked"] == 200

    set_time(RESOLUTION_ISO)
    mock_resolution(direct_vm, verdict="TRUE")
    contract.resolve_bet(bid)
    direct_vm.clear_mocks()

    b = contract.get_bet(bid)
    assert b["status"] == "RESOLVED"
    assert b["verdict"] == "TRUE"
    assert b["winner"].lower() == to_hex(direct_alice).lower()
    assert contract.get_config()["escrow_locked"] == 0


def test_acceptor_wins_when_verdict_opposes(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=50)

    set_time(RESOLUTION_ISO)
    mock_resolution(direct_vm, verdict="FALSE")
    contract.resolve_bet(bid)

    b = contract.get_bet(bid)
    assert b["status"] == "RESOLVED"
    assert b["verdict"] == "FALSE"
    assert b["winner"].lower() == to_hex(direct_bob).lower()
    assert contract.get_config()["escrow_locked"] == 0


def test_proposer_can_side_false(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(
        contract, direct_vm, direct_alice, direct_bob, side="FALSE", stake=100
    )

    assert contract.get_bet(bid)["proposer_side"] == "FALSE"
    assert contract.get_bet(bid)["acceptor_side"] == "TRUE"

    set_time(RESOLUTION_ISO)
    mock_resolution(direct_vm, verdict="FALSE")
    contract.resolve_bet(bid)

    b = contract.get_bet(bid)
    assert b["status"] == "RESOLVED"
    assert b["winner"].lower() == to_hex(direct_alice).lower()


def test_unclear_refunds_both(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)

    set_time(RESOLUTION_ISO)
    mock_resolution(direct_vm, verdict="UNCLEAR", reason="Not verifiable yet.")
    contract.resolve_bet(bid)

    b = contract.get_bet(bid)
    assert b["status"] == "REFUNDED"
    assert b["verdict"] == "UNCLEAR"
    assert b["winner"] == ""
    assert contract.get_config()["escrow_locked"] == 0


def test_evidence_url_is_fetched_and_weighed(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(
        contract, direct_vm, direct_alice, direct_bob,
        evidence_url=EVIDENCE_URL, stake=100,
    )
    assert contract.get_bet(bid)["evidence_url"] == EVIDENCE_URL

    set_time(RESOLUTION_ISO)
    mock_resolution(
        direct_vm,
        verdict="TRUE",
        evidence_body="Evidence: the exchange published settlement data.",
    )
    contract.resolve_bet(bid)
    assert contract.get_bet(bid)["status"] == "RESOLVED"


# ---------------------------------------------------------------- creation rules
def test_create_wrong_value_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 50
    with direct_vm.expect_revert("exact stake must be sent"):
        contract.create_bet(BET_CLAIM, "", RESOLUTION_TS, 100, "TRUE")
    direct_vm.value = 0


def test_create_zero_stake_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("stake must be greater than zero"):
        contract.create_bet(BET_CLAIM, "", RESOLUTION_TS, 0, "TRUE")


def test_create_bad_side_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    with direct_vm.expect_revert("proposer_side must be TRUE or FALSE"):
        contract.create_bet(BET_CLAIM, "", RESOLUTION_TS, 100, "MAYBE")
    direct_vm.value = 0


def test_create_past_resolution_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    # Unix 1000 (1970) is unambiguously in the past for any "now".
    with direct_vm.expect_revert("resolution_time must be in the future"):
        contract.create_bet(BET_CLAIM, "", 1000, 100, "TRUE")
    direct_vm.value = 0


def test_create_claim_too_short_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    with direct_vm.expect_revert("claim must be 5-2000 characters"):
        contract.create_bet("x", "", RESOLUTION_TS, 100, "TRUE")
    direct_vm.value = 0


def test_create_bad_evidence_url_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    for url in ("http://example.com/evidence", "https://localhost/evidence", "https://127.0.0.1/x"):
        direct_vm.sender = direct_alice
        direct_vm.value = 100
        with direct_vm.expect_revert("evidence_url must be a public https"):
            contract.create_bet(BET_CLAIM, url, RESOLUTION_TS, 100, "TRUE")
    direct_vm.value = 0


# ---------------------------------------------------------------- acceptance rules
def test_accept_wrong_value_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = create_bet(contract, direct_vm, direct_alice, stake=100)

    direct_vm.sender = direct_bob
    direct_vm.value = 99
    with direct_vm.expect_revert("exact stake must be sent"):
        contract.accept_bet(bid)
    direct_vm.value = 0


def test_accept_own_bet_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = create_bet(contract, direct_vm, direct_alice, stake=100)

    direct_vm.sender = direct_alice
    direct_vm.value = 100
    with direct_vm.expect_revert("a proposer cannot accept their own bet"):
        contract.accept_bet(bid)
    direct_vm.value = 0


def test_accept_twice_reverts(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = create_bet(contract, direct_vm, direct_alice, stake=100)

    direct_vm.sender = direct_bob
    direct_vm.value = 100
    contract.accept_bet(bid)
    direct_vm.value = 0

    direct_vm.sender = direct_charlie
    direct_vm.value = 100
    with direct_vm.expect_revert("bet is not open for acceptance"):
        contract.accept_bet(bid)
    direct_vm.value = 0


# ---------------------------------------------------------------- cancellation
def test_cancel_open_bet_refunds_proposer(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = create_bet(contract, direct_vm, direct_alice, stake=100)
    assert contract.get_config()["escrow_locked"] == 100

    direct_vm.sender = direct_alice
    contract.cancel_bet(bid)

    b = contract.get_bet(bid)
    assert b["status"] == "CANCELLED"
    assert contract.get_config()["escrow_locked"] == 0


def test_cancel_open_bet_after_resolution_time(direct_vm, direct_deploy, direct_alice):
    """An OPEN bet can never resolve; proposer must be able to recover after
    resolution time passes with no acceptor."""
    contract = direct_deploy("contracts/truth_bets.py")
    bid = create_bet(contract, direct_vm, direct_alice, stake=100)

    set_time(RESOLUTION_ISO)
    with direct_vm.expect_revert("bet is not funded"):
        contract.resolve_bet(bid)
    direct_vm.sender = direct_alice
    contract.cancel_bet(bid)
    assert contract.get_bet(bid)["status"] == "CANCELLED"
    assert contract.get_config()["escrow_locked"] == 0


def test_cancel_by_non_proposer_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = create_bet(contract, direct_vm, direct_alice, stake=100)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("only the proposer can cancel the bet"):
        contract.cancel_bet(bid)


def test_cancel_locked_bet_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("only an open bet can be cancelled"):
        contract.cancel_bet(bid)


# ---------------------------------------------------------------- resolution rules
def test_resolve_before_resolution_time_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)

    # Block time is BASE_ISO (2030-01-01), one day before resolution.
    mock_resolution(direct_vm)
    with direct_vm.expect_revert("resolution time has not arrived yet"):
        contract.resolve_bet(bid)


def test_resolve_when_open_reverts(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = create_bet(contract, direct_vm, direct_alice, stake=100)

    set_time(RESOLUTION_ISO)
    mock_resolution(direct_vm)
    with direct_vm.expect_revert("bet is not funded"):
        contract.resolve_bet(bid)


def test_double_resolve_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)

    set_time(RESOLUTION_ISO)
    mock_resolution(direct_vm, verdict="TRUE")
    contract.resolve_bet(bid)
    direct_vm.clear_mocks()

    with direct_vm.expect_revert("bet is not funded"):
        contract.resolve_bet(bid)


def test_failed_resolution_stays_locked_then_retry(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)

    set_time(RESOLUTION_ISO)
    # Validators return a verdict outside the allowed set -> fail closed.
    mock_resolution(direct_vm, verdict="MAYBE")
    contract.resolve_bet(bid)
    direct_vm.clear_mocks()

    b = contract.get_bet(bid)
    assert b["status"] == "LOCKED"  # fail closed, money untouched
    assert b["attempts"] == 1
    assert contract.get_config()["escrow_locked"] == 200

    # Cooldown: immediate retry reverts.
    mock_resolution(direct_vm, verdict="TRUE")
    with direct_vm.expect_revert("resolution was just attempted"):
        contract.resolve_bet(bid)

    # After the cooldown the retry succeeds.
    set_time("2030-01-02T00:05:00Z")  # 5 minutes later
    contract.resolve_bet(bid)
    assert contract.get_bet(bid)["status"] == "RESOLVED"
    assert contract.get_config()["escrow_locked"] == 0


def test_retry_limit_then_stale_close_refunds_both(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)

    set_time(RESOLUTION_ISO)
    for i in range(5):
        mock_resolution(direct_vm, verdict="MAYBE")
        contract.resolve_bet(bid)
        direct_vm.clear_mocks()
        set_time(f"2030-01-02T00:{5 * (i + 1):02d}:00Z")  # advance past cooldown

    b = contract.get_bet(bid)
    assert b["status"] == "LOCKED"
    assert b["attempts"] == 5
    assert contract.get_config()["escrow_locked"] == 200

    # Retry limit reached: resolution refuses, stale close works.
    mock_resolution(direct_vm, verdict="TRUE")
    with direct_vm.expect_revert("resolution retry limit reached"):
        contract.resolve_bet(bid)

    set_time("2030-01-09T00:00:00Z")  # 7 days past resolution, stale
    direct_vm.sender = direct_charlie  # anyone may close
    contract.close_stale_bet(bid)

    b = contract.get_bet(bid)
    assert b["status"] == "REFUNDED"
    assert b["verdict"] == "UNCLEAR"
    assert contract.get_config()["escrow_locked"] == 0


def test_stale_close_before_stale_window_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)

    set_time(RESOLUTION_ISO)
    with direct_vm.expect_revert("bet is not stale yet"):
        contract.close_stale_bet(bid)


# ---------------------------------------------------------------- escrow accounting
def test_escrow_accounting_multiple_bets(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")
    b1 = create_bet(contract, direct_vm, direct_alice, stake=100)
    b2 = create_bet(contract, direct_vm, direct_bob, stake=50)
    assert contract.get_config()["escrow_locked"] == 150

    # Bob accepts alice's bet -> +100 (both stakes locked).
    direct_vm.sender = direct_bob
    direct_vm.value = 100
    contract.accept_bet(b1)
    direct_vm.value = 0
    assert contract.get_config()["escrow_locked"] == 250

    # Bob cancels his own open bet -> -50.
    direct_vm.sender = direct_bob
    contract.cancel_bet(b2)
    assert contract.get_config()["escrow_locked"] == 200

    # Resolve b1 (verdict FALSE, alice is the TRUE side) -> -200.
    set_time(RESOLUTION_ISO)
    mock_resolution(direct_vm, verdict="FALSE")
    contract.resolve_bet(b1)
    assert contract.get_config()["escrow_locked"] == 0


# ---------------------------------------------------------------- views
def test_views(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/truth_bets.py")

    assert contract.get_bet(1) is None
    assert contract.get_config()["bet_count"] == 0

    bid = funded_bet(contract, direct_vm, direct_alice, direct_bob, stake=100)
    b = contract.get_bet(bid)
    assert b["claim"] == BET_CLAIM
    assert b["stake"] == 100
    assert b["status"] == "LOCKED"
    assert b["stale_at"] == RESOLUTION_TS + 7 * 86400

    bets = contract.list_bets(0, 10)
    assert len(bets) == 1
    assert bets[0]["id"] == bid

    proposer_bets = contract.list_proposer_bets(addr(direct_alice), 0, 10)
    assert len(proposer_bets) == 1
    assert contract.list_acceptor_bets(addr(direct_alice), 0, 10) == []

    # Acceptor's list shows the bet from their side.
    acceptor_bets = contract.list_acceptor_bets(addr(direct_bob), 0, 10)
    assert len(acceptor_bets) == 1
    assert acceptor_bets[0]["id"] == bid

    # Pagination caps at 50.
    assert contract.list_bets(1, 10) == []
    assert contract.list_bets(0, 0) == []
