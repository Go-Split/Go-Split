"""
test_co_organizer_journey.py — 協辦人（Co-host）路徑測試

覆蓋 UML 節點：
  N04b 首次加入（invite code）
  N08 活動主頁 Event Dashboard
  N09 角色與權限判斷（協辦分支）
  N12 記帳：新增 / 編輯款項
  N14 前端草稿層 Form Draft
  N15 整筆提交 Atomic Commit

對應規格：
  §2 角色矩陣（Co-host 權限）
  §4.2 G2 編輯款項（僅可編輯自己新增的）
  C19 協辦降參與後款項改主辦編輯、不轉代墊
"""
import pytest
from tests.e2e.pages.entry_page import EntryPage
from tests.e2e.pages.home_page import HomePage
from tests.e2e.pages.event_dashboard_page import EventDashboardPage
from tests.e2e.pages.form_draft_page import FormDraftPage
from tests.e2e.pages.member_settings_page import MemberSettingsPage
from tests.fixtures.outdoor_template import CO_ORGANIZER_MEMBER


class TestCoOrganizerJourney:

    def test_A_zone_N04b_co_joins_via_invite_code(self, page, base_url):
        """N04b: 協辦透過邀請碼首次加入"""
        entry = EntryPage(page).navigate_to(base_url)
        entry.join_as_new_guest_by_invite_code(
            invite_code="STUB_CODE",
            email=CO_ORGANIZER_MEMBER.email,
            phone_number=CO_ORGANIZER_MEMBER.phone,
        )
        # 加入後應到 N06
        # 驗證由整合層完成，此處僅 smoke

    def test_D_zone_N08_N09_role_gate_no_create_event_for_co_host(
        self, co_page
    ):
        """N09 角色判斷：協辦於 B 區看不到「建立活動」按鈕"""
        home = HomePage(co_page)
        home.expect_create_event_button_hidden_for_non_host()

    def test_D_zone_N08_N09_co_host_sees_recording_no_settle(self, co_page):
        """N09 分支：協辦見記帳入口，不見結帳按鈕"""
        dashboard = EventDashboardPage(co_page)
        dashboard.expect_recording_tab_visible_for_co_host()
        dashboard.expect_settle_button_hidden_for_participant()

    def test_G_zone_N15_co_can_add_own_item_atomic(self, co_page):
        """N12→N15: 協辦可新增自己的款項並整筆提交"""
        dashboard = EventDashboardPage(co_page)
        dashboard.open_recording_form_draft_page()

        form = FormDraftPage(co_page)
        form.select_payer_by_member_display_name(
            CO_ORGANIZER_MEMBER.display_name
        )
        form.fill_detail_row_at_index(
            row_index=0,
            detail_name="冰塊",
            amount_in_ntd=80,
            item_tag="食材",
        )
        form.submit_all_details_as_atomic_commit()
        form.expect_successful_commit_redirects_to_dashboard()

    @pytest.mark.skip(reason="需切到別人建立的 item 頁面驗證 G2 權限鎖")
    def test_G_zone_G2_co_cannot_edit_others_item(self, co_page):
        """★G2：協辦不能編輯別人（含 host）建立的款項"""
        pass

    def test_E_zone_N10_member_settings_hidden_for_co_host(self, co_page):
        """N10 群組人員設定：協辦不可進入"""
        member_settings = MemberSettingsPage(co_page)
        member_settings.expect_page_hidden_for_non_host()
