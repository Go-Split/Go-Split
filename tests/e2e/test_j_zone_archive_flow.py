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
    """N26 結清活動 → N27 封存（走已結帳的主辦活動「系友會春酒」）"""

    def test_J_zone_N26_L11_finalize_button_enabled_regardless_of_payments(
        self, host_settled_event_page
    ):
        """★L11：封存無前置條件，即使無任何繳款動作，按鈕仍可按"""
        settled = SettledDashboardH2Page(host_settled_event_page)
        settled.open_transfers_h3_list_host_only()

        transfers = TransfersH3Page(host_settled_event_page)
        transfers.expect_L11_archive_button_enabled_regardless_of_payment_state()

    @pytest.mark.skip(
        reason=(
            "POM 待實作 + 規格落差雙重問題："
            "Prototype (app.js archiveEvent L651) 直接 setState({archived: true, "
            "screen: 'home'})——無獨立確認 dialog，違反 §11 J 區補強 v0.9。"
            "TransfersH3Page.expect_archive_confirmation_shows_irreversible_only "
            "目前為 pass 空實作。前端補確認 dialog + POM 補斷言後可轉為真測試。"
        )
    )
    def test_J_zone_N27_archive_confirm_dialog_shows_irreversible_only(
        self, host_settled_event_page
    ):
        """★§11 J 區補強（C31 修訂 v0.12）：
        確認框僅明示「不可還原」，不再提及繳款狀態。
        """
        settled = SettledDashboardH2Page(host_settled_event_page)
        settled.open_transfers_h3_list_host_only()

        transfers = TransfersH3Page(host_settled_event_page)
        transfers.click_finalize_and_archive_activity()
        transfers.expect_archive_confirmation_shows_irreversible_only()

    def test_J_zone_N27_confirm_writes_archived_true(
        self, host_settled_event_page
    ):
        """N27 確認 → archived=true → N28 全區完全唯讀。
        Prototype 直接封存（無 dialog），點按即完成。"""
        settled = SettledDashboardH2Page(host_settled_event_page)
        settled.open_transfers_h3_list_host_only()

        transfers = TransfersH3Page(host_settled_event_page)
        transfers.click_finalize_and_archive_activity()
        # prototype archiveEvent 後直接 setState({screen: 'home'})——
        # 從 home 頁可看到該活動的 pill 已變成「已封存」
        from playwright.sync_api import expect
        expect(
            host_settled_event_page.locator(".pill-archived").first
        ).to_be_visible(timeout=5_000)


class TestJ_zone_N28_fully_readonly_state:
    """N28 全區完全唯讀
    
    prototype (data.js L31) 預埋一個已封存活動「七月生日會」(archived=true)，
    但 role='member'。用 member_page 進 home、點該活動可驗封存後行為。
    """

    def test_J_zone_N28_archived_dashboard_shows_readonly_banner(
        self, member_page
    ):
        """§11 J 區：封存後、完全唯讀"""
        # data.js L31: '七月生日會' role='member' archived=true
        cards = member_page.locator("button.card, button.card-pad").filter(
            has_text="七月生日會"
        )
        cards.first.click()
        # 進封存後的活動——應可見「已封存」pill
        from playwright.sync_api import expect
        expect(
            member_page.locator(".pill-archived").first
        ).to_be_visible(timeout=5_000)

    @pytest.mark.skip(
        reason=(
            "POM 待實作：進封存活動後點選 sidebar「分帳產出」查看四維度，"
            "本 flow 需要進 archived screen 的 sidebar 導覽——目前 POM 未支援。"
        )
    )
    def test_J_zone_N28_archived_can_still_view_four_dimensions(
        self, member_page
    ):
        """§11 J 區：可檢視 = 完整分帳四維度仍可唯讀檢視"""
        pass

    def test_J_zone_N28_archived_out_of_scope_no_unarchive_button(
        self, member_page
    ):
        """★§11 J Out of Scope：不提供解除封存"""
        # 進封存活動
        cards = member_page.locator("button.card, button.card-pad").filter(
            has_text="七月生日會"
        )
        cards.first.click()
        # 反向斷言：畫面上無「解除封存」相關按鈕
        from playwright.sync_api import expect
        unarchive_texts = member_page.locator(
            "text=/解除封存|取消封存|還原|unarchive/i"
        )
        expect(unarchive_texts).to_have_count(0)
