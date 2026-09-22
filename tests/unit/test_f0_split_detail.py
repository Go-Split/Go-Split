"""
F0 splitDetail — ZOMBIES-TDD 6 案例（含 L9 交通費護欄）
對應 SPEC-ENGINE v1.1 §5 / L9
"""
import pytest
from tests.support.engine import split_detail
from tests.fixtures.outdoor_template import (
    OUTDOOR_MEMBERS, OUTDOOR_RULES, OUTDOOR_ITEMS
)


@pytest.mark.unit
@pytest.mark.zombies_z
class TestF0Zero:
    def test_F0_Z_01_no_matching_rule_falls_back_to_all(self):
        """無 itemTag → no-rule 全員均分"""
        item = {"id": "x", "name": "神秘", "amount": 400,
                "itemTag": "unknown_tag", "payer": "m_kai"}
        r = split_detail(item, OUTDOOR_RULES, OUTDOOR_MEMBERS)
        assert r["meta"]["rest_mode"] == "no-rule"
        assert sum(r["shares"].values()) == 400
        assert len(r["shares"]) == 4  # 四人均分


@pytest.mark.unit
@pytest.mark.zombies_m
class TestF0Many:
    def test_F0_M_01_food_all_adults_plus_child_half(self):
        """R1+R2 交互：目前 spec 用 priority 取第一個 → R1"""
        item = {"id": "i1", "name": "牛五花", "amount": 1200,
                "itemTag": "food_meat", "payer": "m_kai"}
        r = split_detail(item, OUTDOOR_RULES, OUTDOOR_MEMBERS)
        assert r["meta"]["rule_id"] == "R1"
        assert sum(r["shares"].values()) == 1200

    def test_F0_M_02_site_fee_all_equal(self):
        """R5：場地費全員均分 2000/4 = 500"""
        item = {"id": "i5", "name": "營地費", "amount": 2000,
                "itemTag": "site_fee", "payer": "m_hao"}
        r = split_detail(item, OUTDOOR_RULES, OUTDOOR_MEMBERS)
        assert sum(r["shares"].values()) == 2000
        # 均分後每人 500
        assert all(v == 500 for v in r["shares"].values())


@pytest.mark.unit
@pytest.mark.zombies_b
class TestF0Boundary:
    def test_F0_B_01_L9_driver_excluded_from_transport(self):
        """★L9 護欄：R4 交通費 rest=exclude，開車者不分攤"""
        item = {"id": "i4", "name": "油錢", "amount": 1500,
                "itemTag": "transport_gas", "payer": "m_kai"}
        r = split_detail(item, OUTDOOR_RULES, OUTDOOR_MEMBERS)
        assert r["meta"]["rule_id"] == "R4"
        assert r["meta"]["rest_mode"] == "exclude"
        # 小凱(開車)必為 excluded-rest → share = 0
        assert r["shares"]["m_kai"] == 0
        assert "m_kai" in r["meta"]["excluded_rest"]
        # 其餘三人分攤 1500
        assert sum(r["shares"][m] for m in ["m_hao", "m_mei", "m_jia"]) == 1500

    def test_F0_B_02_L9_no_downgrade_to_no_rule(self):
        """★L9 護欄：即便 rest 段被排除也絕不降級為 no-rule"""
        item = {"id": "i4b", "name": "過路費", "amount": 300,
                "itemTag": "transport_toll", "payer": "m_kai"}
        r = split_detail(item, OUTDOOR_RULES, OUTDOOR_MEMBERS)
        assert r["meta"]["rest_mode"] == "exclude"  # 絕不能是 "no-rule"
        assert r["meta"]["rule_id"] == "R4"


@pytest.mark.unit
@pytest.mark.zombies_e
class TestF0Exception:
    def test_F0_E_01_invariant_conservation(self):
        """I1：每筆 item 分攤總和 == amount"""
        for item in OUTDOOR_ITEMS:
            r = split_detail(item, OUTDOOR_RULES, OUTDOOR_MEMBERS)
            assert sum(r["shares"].values()) == item["amount"], \
                f"item {item['id']} 未守恆"
