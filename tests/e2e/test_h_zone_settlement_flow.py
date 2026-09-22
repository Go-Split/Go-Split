"""
test_h_zone_settlement_flow.py — H 區結算全流程整合測試

覆蓋 UML 節點：
  N16 分帳產出 Settle H1
  N18 主辦中心轉帳計算 Hub L10
  N19 確認結帳（判斷菱形：確認/取消）
  N22 結帳後活動頁 H2
  N23 檢視個人收支明細
  N24 付款流向清單 H3

對應規格：
  §5 功能區 H 全區
  §14.5 結算主線
  L10 hub-only（所有轉帳線經主辦）
  C29 結算後編輯入口直接隱藏
  C31 H3 純檢視、繳款確認在平台外
  L11 封存無前置條件
"""
import pytest
from tests.e2e.pages.event_dashboard_page import EventDashboardPage
from tests.e2e.pages.settlement_page import (
    SettleH1Page,
    SettledDashboardH2Page,
    TransfersH3Page,
)
from tests.fixtures.outdoor_template import HOST_MEMBER


class TestH_zone_N16_N18_settle_h1_and_hub:
    """N16 分帳產出 + N18 Hub L10 計算"""

    @pytest.mark.skip(reason="需活動有款項的完整狀態才能結帳")
    def test_H_zone_N16_four_dimensions_all_shown(self, host_page):
        """N16 H1：四維度檢視全部呈現（應攤/實付/淨額/流向）"""
        dashboard = EventDashboardPage(host_page)
        dashboard.click_settle_h1_produce_settlement()

        settle = SettleH1Page(host_page)
        settle.expect_four_dimensions_all_visible()

    @pytest.mark.skip(reason="需活動有款項的完整狀態")
    def test_H_zone_N18_L10_all_transfers_route_through_host(
        self, host_page
    ):
        """★L10 hub-only 核心測試：所有 transfer 經主辦"""
        dashboard = EventDashboardPage(host_page)
        dashboard.click_settle_h1_produce_settlement()

        settle = SettleH1Page(host_page)
        settle.expect_L10_all_transfers_go_through_host_as_hub(
            host_member_id=HOST_MEMBER.member_id
        )


class TestH_zone_N19_confirmation_dialog:
    """N19 確認結帳判斷菱形"""

    @pytest.mark.skip(reason="需活動有款項的完整狀態")
    def test_H_zone_N19_cancel_returns_to_dashboard(self, host_page):
        """N19 取消 → 回 N08 活動主頁"""
        dashboard = EventDashboardPage(host_page)
        dashboard.click_settle_h1_produce_settlement()

        settle = SettleH1Page(host_page)
        settle.click_cancel_return_to_dashboard()

    @pytest.mark.skip(reason="需活動有款項的完整狀態")
    def test_H_zone_N19_confirm_dialog_shows_irreversible_warning(
        self, host_page
    ):
        """★§11 J 區補強：確認框明示「不可還原」"""
        dashboard = EventDashboardPage(host_page)
        dashboard.click_settle_h1_produce_settlement()

        settle = SettleH1Page(host_page)
        settle.click_confirm_settlement_open_dialog()
        settle.expect_irreversible_warning_shown_in_dialog()

    @pytest.mark.skip(reason="需活動有款項的完整狀態")
    def test_H_zone_N19_final_confirm_writes_snapshot_transitions_to_H2(
        self, host_page
    ):
        """N19 確認 → 寫入結帳快照 → N22 H2"""
        dashboard = EventDashboardPage(host_page)
        dashboard.click_settle_h1_produce_settlement()

        settle = SettleH1Page(host_page)
        settle.click_confirm_settlement_open_dialog()
        settle.confirm_final_settlement_write_snapshot()

        settled_dashboard = SettledDashboardH2Page(host_page)
        settled_dashboard.expect_H2_banner_readonly_state_shown()


class TestH_zone_N22_H2_settled_dashboard:
    """N22 結帳後活動頁 H2"""

    @pytest.mark.skip(reason="需結帳後的 storage_state")
    def test_H_zone_N22_H2_all_items_readonly_C29(self, host_page):
        """★C29：結帳後編輯入口直接隱藏"""
        settled = SettledDashboardH2Page(host_page)
        settled.expect_H2_banner_readonly_state_shown()
        settled.expect_C29_edit_entrypoints_hidden_after_settled()


class TestH_zone_N24_H3_transfers_list:
    """N24 付款流向清單 H3"""

    @pytest.mark.skip(reason="需結帳後的 storage_state")
    def test_H_zone_N24_H3_readonly_list_for_host_only(self, host_page):
        """N24: H3 為主辦專屬純檢視列表"""
        settled = SettledDashboardH2Page(host_page)
        settled.open_transfers_h3_list_host_only()

        transfers = TransfersH3Page(host_page)
        transfers.expect_transfers_rendered_as_readonly_list()

    @pytest.mark.skip(reason="需結帳後的 storage_state")
    def test_H_zone_N24_C31_no_payment_tracking_ui_at_all(self, host_page):
        """★C31 純檢視鐵三角：無勾選框、無通知按鈕、無繳款狀態欄"""
        settled = SettledDashboardH2Page(host_page)
        settled.open_transfers_h3_list_host_only()

        transfers = TransfersH3Page(host_page)
        transfers.expect_C31_no_payment_tracking_ui_elements()
