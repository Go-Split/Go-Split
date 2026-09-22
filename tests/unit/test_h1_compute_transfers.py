"""
H1 computeTransfers — ZOMBIES-TDD 8 案例（含 L10 hub-only 護欄）
對應 SPEC-ENGINE v1.1 §6 / L10
"""
import pytest
from tests.support.engine import compute_transfers, aggregate_net
from tests.fixtures.outdoor_template import (
    OUTDOOR_MEMBERS, OUTDOOR_RULES, OUTDOOR_ITEMS
)


@pytest.mark.unit
@pytest.mark.zombies_z
class TestH1Zero:
    def test_H1_Z_01_all_settled(self):
        """全部 net=0 → 空轉帳"""
        net = {"m_kai": 0, "m_hao": 0, "m_mei": 0}
        assert compute_transfers(net, "m_kai") == []


@pytest.mark.unit
@pytest.mark.zombies_o
class TestH1One:
    def test_H1_O_01_single_debtor(self):
        """單一欠款人 → 一筆轉帳給主辦"""
        net = {"m_kai": 100, "m_hao": -100, "m_mei": 0}
        r = compute_transfers(net, "m_kai")
        assert r == [{"from": "m_hao", "to": "m_kai", "amount": 100}]


@pytest.mark.unit
@pytest.mark.zombies_m
class TestH1Many:
    def test_H1_M_01_hub_only_flow(self):
        """★L10 護欄：只透過主辦人；非主辦成員之間無轉帳"""
        net = {"m_kai": 200, "m_hao": -50, "m_mei": -80, "m_jia": -70}
        r = compute_transfers(net, "m_kai")
        # 全部應涉及主辦
        for t in r:
            assert "m_kai" in (t["from"], t["to"]), \
                f"L10 違反：非主辦之間出現轉帳 {t}"

    def test_H1_M_02_host_zero_but_still_relay(self):
        """★L10：主辦淨額 0 但仍必須做代收代付（不可省略）"""
        # 阿豪多付 300，小美/佳蓉各欠 150 → 主辦淨額 0，仍需 hub 關轉
        net = {"m_kai": 0, "m_hao": 300, "m_mei": -150, "m_jia": -150}
        r = compute_transfers(net, "m_kai")
        # 應有 3 筆
        assert len(r) == 3
        # 阿豪 → 主辦收 300；小美/佳蓉各 → 主辦付 150
        by_pair = {(t["from"], t["to"]): t["amount"] for t in r}
        assert by_pair.get(("m_kai", "m_hao")) == 300
        assert by_pair.get(("m_mei", "m_kai")) == 150
        assert by_pair.get(("m_jia", "m_kai")) == 150


@pytest.mark.unit
@pytest.mark.zombies_b
class TestH1Boundary:
    def test_H1_B_01_no_self_loop(self):
        """I4 不變量：沒有自付自收"""
        net = {"m_kai": 500, "m_hao": -500}
        r = compute_transfers(net, "m_kai")
        for t in r:
            assert t["from"] != t["to"]

    def test_H1_B_02_positive_amounts_only(self):
        """所有 amount > 0"""
        net = {"m_kai": 100, "m_hao": -30, "m_mei": -70}
        r = compute_transfers(net, "m_kai")
        assert all(t["amount"] > 0 for t in r)


@pytest.mark.unit
@pytest.mark.zombies_i
class TestH1Interface:
    def test_H1_I_01_integration_with_aggregate(self):
        """整合：outdoor fixture 全流程 net → transfers"""
        net = aggregate_net(OUTDOOR_ITEMS, OUTDOOR_RULES, OUTDOOR_MEMBERS)
        transfers = compute_transfers(net, "m_kai")
        # I3：轉帳總額 == Σ |net| / 2
        total_transfer = sum(t["amount"] for t in transfers)
        # hub 模型：主辦以外每人各走一次轉帳
        expected = sum(abs(v) for k, v in net.items() if k != "m_kai")
        assert total_transfer == expected


@pytest.mark.unit
@pytest.mark.zombies_e
class TestH1Exception:
    def test_H1_E_01_all_net_conservation(self):
        """Σ net == 0（付款守恆）"""
        net = aggregate_net(OUTDOOR_ITEMS, OUTDOOR_RULES, OUTDOOR_MEMBERS)
        assert sum(net.values()) == 0
