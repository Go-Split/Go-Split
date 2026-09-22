"""
F1 resolveWeight — ZOMBIES-TDD 12 案例
對應 SPEC-ENGINE v1.1 §2 / TEST-SCENARIOS.md F1
"""
import pytest
from tests.support.engine import resolve_weight
from tests.fixtures.outdoor_template import OUTDOOR_MEMBERS, OUTDOOR_RULES


# ── Z (Zero) 空集合 ───────────────────────────────────────
@pytest.mark.unit
@pytest.mark.zombies_z
class TestF1Zero:
    def test_F1_Z_01_no_matching_member(self):
        """condTags=['child'] 且無小孩 → 空 dict"""
        rule = {"weightMode": "equal", "weights": {}, "condTags": ["child"]}
        adults = [m for m in OUTDOOR_MEMBERS if not m["isChild"]]
        assert resolve_weight(rule, adults) == {}

    def test_F1_Z_02_empty_members(self):
        assert resolve_weight(OUTDOOR_RULES[0], []) == {}


# ── O (One) 單一元素 ─────────────────────────────────────
@pytest.mark.unit
@pytest.mark.zombies_o
class TestF1One:
    def test_F1_O_01_single_matching_member(self):
        """只有一位成員符合 driver 條件"""
        rule = {"weightMode": "equal", "weights": {}, "condTags": ["driver"]}
        result = resolve_weight(rule, OUTDOOR_MEMBERS)
        assert result == {"m_kai": 1.0}

    def test_F1_O_02_single_child(self):
        rule = {"weightMode": "equal", "weights": {}, "condTags": ["child"]}
        result = resolve_weight(rule, OUTDOOR_MEMBERS)
        assert result == {"m_jia": 1.0}


# ── M (Many) 多元素 ─────────────────────────────────────
@pytest.mark.unit
@pytest.mark.zombies_m
class TestF1Many:
    def test_F1_M_01_equal_all_matching(self):
        """R1 食物成人有吃 → 三位成人各 1"""
        rule = OUTDOOR_RULES[0]  # R1
        result = resolve_weight(rule, OUTDOOR_MEMBERS)
        assert set(result.keys()) == {"m_kai", "m_hao", "m_mei"}
        assert all(v == 1.0 for v in result.values())

    def test_F1_M_02_ratio_child_half(self):
        """R2 小孩半權"""
        rule = OUTDOOR_RULES[1]  # R2
        result = resolve_weight(rule, OUTDOOR_MEMBERS)
        assert result == {"m_jia": 0.5}

    def test_F1_M_03_drinker_only_two(self):
        """R3 酒類：主辦與協辦各 1"""
        rule = OUTDOOR_RULES[2]  # R3
        result = resolve_weight(rule, OUTDOOR_MEMBERS)
        assert set(result.keys()) == {"m_kai", "m_hao"}


# ── B (Boundary) 邊界 ────────────────────────────────────
@pytest.mark.unit
@pytest.mark.zombies_b
class TestF1Boundary:
    def test_F1_B_01_ratio_all_zero(self):
        """全部權重為 0 → 空 dict（不列入）"""
        rule = {"weightMode": "fixed", "weights": {"m_kai": 0, "m_hao": 0},
                "condTags": ["all"]}
        result = resolve_weight(rule, OUTDOOR_MEMBERS)
        assert result == {}

    def test_F1_B_02_fixed_partial(self):
        rule = {"weightMode": "fixed",
                "weights": {"m_kai": 2, "m_hao": 3},
                "condTags": ["all"]}
        result = resolve_weight(rule, OUTDOOR_MEMBERS)
        assert result == {"m_kai": 2.0, "m_hao": 3.0}


# ── I (Interfaces) 介面 ─────────────────────────────────
@pytest.mark.unit
@pytest.mark.zombies_i
class TestF1Interface:
    def test_F1_I_01_return_type_is_dict(self):
        result = resolve_weight(OUTDOOR_RULES[0], OUTDOOR_MEMBERS)
        assert isinstance(result, dict)
        assert all(isinstance(k, str) and isinstance(v, float)
                   for k, v in result.items())


# ── E (Exceptional) 例外 ────────────────────────────────
@pytest.mark.unit
@pytest.mark.zombies_e
class TestF1Exception:
    def test_F1_E_01_unknown_weight_mode(self):
        rule = {"weightMode": "quadratic", "weights": {}, "condTags": ["all"]}
        with pytest.raises(ValueError, match="unknown weightMode"):
            resolve_weight(rule, OUTDOOR_MEMBERS)

    def test_F1_E_02_missing_cond_tags_defaults_all(self):
        """未指定 condTags → 視為空集合 (all 才會全通過)"""
        rule = {"weightMode": "equal", "weights": {}}
        # 空 condTags 且無 "all" → 全通過 (member_matches_cond loop 無過濾條件)
        result = resolve_weight(rule, OUTDOOR_MEMBERS)
        assert len(result) == 4
