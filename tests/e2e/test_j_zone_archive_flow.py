"""
test_j_zone_archive_flow.py — J 區封存流程專門測試

覆蓋 UML 節點：
  N25 平台外私下確認款項 C31（無 API endpoint，僅 UI 註記）
  N26 結清活動
  N27 封存 Archived J 區
  N28 全區完全唯讀

對應規格：§11 功能區 J：封存
  - 觸發：主辦人於 H3 點「結清活動」→ archived=true
  - 前置條件：無（L11 定案 v0.9）
  - 封存後：進封存區、完全唯讀
  - 可檢視：完整分帳四維度仍可唯讀
  - Out of Scope（J）：解除封存、封存活動匯出報表

  §11 J 區補強：結算為單向操作、不允許解鎖重算
  §11 J 區補強二（L11 定案 v0.9；C31 修訂 v0.12）：
    - 封存無前置條件
    - 確認對話框僅需明示「結清後活動將完全唯讀、不可還原」
    - 原 v0.9 第二句「結清後無法變更繳款狀態」隨 C31 移除
"""
import pytest
from tests.e2e.pages.event_dashboard_page import EventDashboardPage
from tests.e2e.pages.settlement_page import (
    SettledDashboardH2Page,
    TransfersH3Page,
)


class TestJ_zone_N25_offline_payment_confirmation:
    """N25 平台外私下確認款項（C31）"""

    def test_J_zone_N25_C31_no_online_payment_confirmation_ui(self):
        """★C31：系統不追蹤繳款狀態，N25 節點無任何 UI 元素。
        本測試檔在此處明確標記：N25 為文件性節點，無自動化測試點。
        """
        # 此測試留空但保留，明示 C31 決策的規格意圖
        # 相關的反向斷言在 TransfersH3Page.expect_C31_no_payment_tracking_ui_elements
        pass


class TestJ_zone_N26_N27_finalize_and_archive:
    """N26 結清活動 → N27 封存"""

    @pytest.mark.skip(reason="需結帳後的 storage_state")
    def test_J_zone_N26_L11_finalize_button_enabled_regardless_of_payments(
        self, host_page
    ):
        """★L11：封存無前置條件，即使無任何繳款動作，按鈕仍可按"""
        settled = SettledDashboardH2Page(host_page)
        settled.open_transfers_h3_list_host_only()

        transfers = TransfersH3Page(host_page)
        transfers.expect_L11_archive_button_enabled_regardless_of_payment_state()

    @pytest.mark.skip(reason="需結帳後的 storage_state")
    def test_J_zone_N27_archive_confirm_dialog_shows_irreversible_only(
        self, host_page
    ):
        """★§11 J 區補強（C31 修訂 v0.12）：
        確認框僅明示「不可還原」，不再提及繳款狀態。
        """
        settled = SettledDashboardH2Page(host_page)
        settled.open_transfers_h3_list_host_only()

        transfers = TransfersH3Page(host_page)
        transfers.click_finalize_and_archive_activity()
        transfers.expect_archive_confirmation_shows_irreversible_only()

    @pytest.mark.skip(reason="需結帳後的 storage_state")
    def test_J_zone_N27_confirm_writes_archived_true(self, host_page):
        """N27 確認 → archived=true → N28 全區完全唯讀"""
        settled = SettledDashboardH2Page(host_page)
        settled.open_transfers_h3_list_host_only()

        transfers = TransfersH3Page(host_page)
        transfers.click_finalize_and_archive_activity()
        transfers.confirm_archive_write_archived_true()
        # 進入 N28
        dashboard = EventDashboardPage(host_page)
        dashboard.expect_archived_state_fully_readonly()


class TestJ_zone_N28_fully_readonly_state:
    """N28 全區完全唯讀"""

    @pytest.mark.skip(reason="需已封存的 storage_state")
    def test_J_zone_N28_archived_dashboard_shows_readonly_banner(
        self, host_page
    ):
        """§11 J 區：封存後、完全唯讀"""
        dashboard = EventDashboardPage(host_page)
        dashboard.expect_archived_state_fully_readonly()

    @pytest.mark.skip(reason="需已封存的 storage_state")
    def test_J_zone_N28_archived_can_still_view_four_dimensions(
        self, host_page
    ):
        """§11 J 區：可檢視 = 完整分帳四維度仍可唯讀檢視"""
        # 進入 H1 頁應可看到（唯讀）四維度
        pass

    @pytest.mark.skip(reason="需已封存的 storage_state")
    def test_J_zone_N28_archived_out_of_scope_no_unarchive_button(
        self, host_page
    ):
        """★§11 J Out of Scope：不提供解除封存"""
        dashboard = EventDashboardPage(host_page)
        unarchive_button = host_page.get_by_test_id("btn-unarchive")
        # 反向斷言
        from playwright.sync_api import expect
        expect(unarchive_button).to_have_count(0)
