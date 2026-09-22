"""
F3 settleRemainder — ZOMBIES-TDD 7 案例
對應 SPEC-ENGINE v1.1 §4 / C9-a 黃金範例
"""
import pytest
from tests.support.engine import settle_remainder
from tests.fixtures.outdoor_template import CASE_C9A


@pytest.mark.unit
@pytest.mark.zombies_z
class TestF3Zero:
    def test_F3_Z_01_no_remainder(self):
        base = {"a": 100, "b": 100}
        assert settle_remainder(base, 0, "a") == base


@pytest.mark.unit
@pytest.mark.zombies_o
class TestF3One:
    def test_F3_O_01_single_dollar_to_payer(self):
        base = {"a": 33, "b": 33}
        r = settle_remainder(base, 1, "a")
        assert r == {"a": 34, "b": 33}


@pytest.mark.unit
@pytest.mark.zombies_m
class TestF3Many:
    def test_F3_M_01_C9a_golden(self):
        """★ C9-a：101 元三人均分，餘 2 回付款人 → 付款人 35"""
        base = {"m_kai": 33, "m_hao": 33, "m_mei": 33}
        r = settle_remainder(base, 2, "m_kai")
        assert r == CASE_C9A["expected"]

    def test_F3_M_02_payer_not_in_base_fallback(self):
        """付款人不在 base → 按 order 輪流 +1"""
        base = {"a": 10, "b": 10}
        r = settle_remainder(base, 2, payer="X", members_order=["a", "b"])
        # X 不在 base，改 a, b 各 +1
        assert r == {"a": 11, "b": 11}


@pytest.mark.unit
@pytest.mark.zombies_b
class TestF3Boundary:
    def test_F3_B_01_remainder_equals_member_count(self):
        base = {"a": 10, "b": 10, "c": 10}
        r = settle_remainder(base, 3, "X", members_order=["a", "b", "c"])
        assert r == {"a": 11, "b": 11, "c": 11}


@pytest.mark.unit
@pytest.mark.zombies_i
class TestF3Interface:
    def test_F3_I_01_immutability(self):
        base = {"a": 10, "b": 10}
        original = dict(base)
        settle_remainder(base, 1, "a")
        assert base == original  # 不修改輸入


@pytest.mark.unit
@pytest.mark.zombies_e
class TestF3Exception:
    def test_F3_E_01_invariant_sum_preserved(self):
        """I1 守恆：Σ result == Σ base + remainder"""
        base = {"a": 33, "b": 33, "c": 33}
        r = settle_remainder(base, 2, "a")
        assert sum(r.values()) == sum(base.values()) + 2
