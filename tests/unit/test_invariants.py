"""
四條不變量 — hypothesis property-based testing
I1  Σ shares == amount        (整體守恆)
I2  shares[m] >= 0            (非負)
I3  Σ transfers == Σ |net|/2  (轉帳守恆)
I4  沒有自付自收              (無 self-loop)
"""
import pytest
from hypothesis import given, strategies as st, settings, assume
from tests.support.engine import (
    allocate, settle_remainder, compute_transfers, aggregate_net
)
from tests.fixtures.outdoor_template import OUTDOOR_MEMBERS, OUTDOOR_RULES


# ── I1: allocate + settle_remainder 守恆 ─────────────────
@pytest.mark.unit
@pytest.mark.zombies_i
@settings(max_examples=100)
@given(
    amount=st.integers(min_value=0, max_value=10_000_000),
    weights=st.dictionaries(
        keys=st.sampled_from(["a", "b", "c", "d"]),
        values=st.floats(min_value=0.1, max_value=10.0, allow_nan=False),
        min_size=1, max_size=4
    )
)
def test_I1_allocate_settle_conservation(amount, weights):
    """I1：對任意 amount 與 weights，Σ (base + settled) == amount"""
    alloc = allocate(amount, weights)
    result = settle_remainder(alloc["base"], alloc["remainder"], payer=None,
                              members_order=list(weights.keys()))
    total = sum(result.values()) if result else 0
    # allocate 可能因權重全 0 使 base 為空
    if not weights:
        assert alloc["remainder"] == amount
    else:
        assert total + (alloc["remainder"] if not result else 0) == amount


# ── I2: shares 非負 ─────────────────────────────────────
@pytest.mark.unit
@pytest.mark.zombies_i
@settings(max_examples=100)
@given(
    amount=st.integers(min_value=0, max_value=1_000_000),
    weights=st.dictionaries(
        keys=st.sampled_from(["a", "b", "c"]),
        values=st.floats(min_value=0.1, max_value=5.0, allow_nan=False),
        min_size=1, max_size=3
    )
)
def test_I2_shares_non_negative(amount, weights):
    """I2：所有分攤額 >= 0"""
    alloc = allocate(amount, weights)
    for mid, share in alloc["base"].items():
        assert share >= 0


# ── I3: transfers 總額 == Σ |net|/2 ─────────────────────
@pytest.mark.unit
@pytest.mark.zombies_i
@settings(max_examples=50)
@given(
    a=st.integers(min_value=-10000, max_value=10000),
    b=st.integers(min_value=-10000, max_value=10000),
)
def test_I3_transfer_conservation(a, b):
    """I3：hub 模型下 total_transfer == Σ|非主辦成員 net|"""
    net = {"host": -(a + b), "p1": a, "p2": b}
    transfers = compute_transfers(net, "host")
    total_transfer = sum(t["amount"] for t in transfers)
    # hub 模型：主辦以外每人各走一次轉帳
    expected = sum(abs(v) for k, v in net.items() if k != "host")
    assert total_transfer == expected


# ── I4: 沒有自付自收 ────────────────────────────────────
@pytest.mark.unit
@pytest.mark.zombies_i
@settings(max_examples=50)
@given(
    net_vals=st.lists(
        st.integers(min_value=-5000, max_value=5000),
        min_size=2, max_size=6
    )
)
def test_I4_no_self_loop(net_vals):
    """I4：任何轉帳 from != to"""
    # 建 net，最後一位為主辦調整為使總和 = 0
    keys = [f"m{i}" for i in range(len(net_vals))]
    net_vals[-1] = -sum(net_vals[:-1])
    net = dict(zip(keys, net_vals))
    host = keys[0]
    transfers = compute_transfers(net, host)
    for t in transfers:
        assert t["from"] != t["to"], f"self-loop 出現: {t}"


# ── 綜合：outdoor fixture 四不變量同時成立 ─────────────
@pytest.mark.unit
@pytest.mark.regression
def test_INV_ALL_outdoor_fixture():
    """整合驗證：烤肉/露營 fixture 四條不變量同時成立"""
    from tests.fixtures.outdoor_template import OUTDOOR_ITEMS

    net = aggregate_net(OUTDOOR_ITEMS, OUTDOOR_RULES, OUTDOOR_MEMBERS)
    # I1: 全體收付平衡（Σ net = 0）
    assert sum(net.values()) == 0

    # I2: split_detail 每筆均 >= 0（在 F0 測試已驗證）
    transfers = compute_transfers(net, "m_kai")

    # I3: hub 模型 total_transfer == Σ|非主辦成員 net|
    total_t = sum(t["amount"] for t in transfers)
    expected = sum(abs(v) for k, v in net.items() if k != "m_kai")
    assert total_t == expected

    # I4: 沒有自付自收
    for t in transfers:
        assert t["from"] != t["to"]

    # L10 護欄：所有轉帳必涉及主辦
    for t in transfers:
        assert "m_kai" in (t["from"], t["to"])
