"""
F2 allocate — ZOMBIES-TDD 10 案例
對應 SPEC-ENGINE v1.1 §3
"""
import pytest
from tests.support.engine import allocate


@pytest.mark.unit
@pytest.mark.zombies_z
class TestF2Zero:
    def test_F2_Z_01_zero_amount(self):
        r = allocate(0, {"a": 1.0, "b": 1.0})
        assert r["base"] == {"a": 0, "b": 0}
        assert r["remainder"] == 0

    def test_F2_Z_02_empty_weights_L22(self):
        """★L22：權重空不 throw，全額進 remainder"""
        r = allocate(100, {})
        assert r["base"] == {}
        assert r["remainder"] == 100

    def test_F2_Z_03_all_zero_weights(self):
        r = allocate(100, {"a": 0, "b": 0})
        assert r["remainder"] == 100


@pytest.mark.unit
@pytest.mark.zombies_o
class TestF2One:
    def test_F2_O_01_single_member_gets_all(self):
        r = allocate(500, {"a": 1.0})
        assert r["base"] == {"a": 500}
        assert r["remainder"] == 0


@pytest.mark.unit
@pytest.mark.zombies_m
class TestF2Many:
    def test_F2_M_01_even_divide(self):
        r = allocate(300, {"a": 1, "b": 1, "c": 1})
        assert r["base"] == {"a": 100, "b": 100, "c": 100}
        assert r["remainder"] == 0

    def test_F2_M_02_C9a_remainder_1(self):
        """C9-a 黃金範例前置：101 / 3 → base 33*3, rem 2"""
        r = allocate(101, {"a": 1, "b": 1, "c": 1})
        assert r["base"] == {"a": 33, "b": 33, "c": 33}
        assert r["remainder"] == 2

    def test_F2_M_03_ratio_weights(self):
        """權重 2:1:1 → 400 / 4 * 2 = 200"""
        r = allocate(400, {"a": 2, "b": 1, "c": 1})
        assert r["base"] == {"a": 200, "b": 100, "c": 100}
        assert r["remainder"] == 0


@pytest.mark.unit
@pytest.mark.zombies_b
class TestF2Boundary:
    def test_F2_B_01_one_dollar_three_people(self):
        r = allocate(1, {"a": 1, "b": 1, "c": 1})
        assert sum(r["base"].values()) + r["remainder"] == 1


@pytest.mark.unit
@pytest.mark.zombies_e
class TestF2Exception:
    def test_F2_E_01_negative_amount_raises(self):
        with pytest.raises(ValueError):
            allocate(-100, {"a": 1})

    def test_F2_E_02_invariant_conservation(self):
        """I1 守恆：base 總和 + remainder == amount"""
        r = allocate(9999, {"a": 3, "b": 7, "c": 5})
        assert sum(r["base"].values()) + r["remainder"] == 9999
