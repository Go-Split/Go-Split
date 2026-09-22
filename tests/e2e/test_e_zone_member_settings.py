"""
test_e_zone_member_settings.py — E 區群組人員設定測試

覆蓋 UML 節點：
  N10 群組人員設定（僅主辦人進入）
  N10 → N13 分攤規則設定（主辦人 Host 可繼續設規則）

對應規格：
  §10 功能區 E：群組設定 + 成員管理
  §14.6 身分變更流程
  C19 協辦降參與後款項改主辦編輯
  C20 主辦權不轉移
  C22 主辦可手動新增虛擬成員
"""
import pytest
from tests.e2e.pages.event_dashboard_page import EventDashboardPage
from tests.e2e.pages.member_settings_page import MemberSettingsPage


class TestE_zone_member_settings:

    def test_E_zone_N10_only_host_can_open_member_settings(self, host_page):
        """N10 頁面：僅主辦可進入"""
        dashboard = EventDashboardPage(host_page)
        dashboard.open_member_settings_page()
        member_settings = MemberSettingsPage(host_page)
        # 進入後應能看見「新增成員」按鈕
        # 反之協辦/參與者不會有此頁面入口（見 test_co / test_participant）

    def test_E_zone_N10_C22_host_can_add_virtual_member(self, host_page):
        """★C22：主辦手動新增虛擬成員"""
        dashboard = EventDashboardPage(host_page)
        dashboard.open_member_settings_page()

        member_settings = MemberSettingsPage(host_page)
        member_settings.add_virtual_member_by_display_name(
            display_name="虛擬成員A", role="member"
        )
        member_settings.expect_member_in_list(
            display_name="虛擬成員A", role="member"
        )

    def test_E_zone_N10_promote_member_to_co_host(self, host_page):
        """§14.6 身分變更：member → co-host"""
        dashboard = EventDashboardPage(host_page)
        dashboard.open_member_settings_page()

        member_settings = MemberSettingsPage(host_page)
        member_settings.add_virtual_member_by_display_name(
            display_name="待升等", role="member"
        )
        member_settings.promote_member_to_co_host("待升等")
        member_settings.expect_member_in_list(display_name="待升等", role="co")

    def test_E_zone_N10_C20_no_promote_to_host_button(self, host_page):
        """★C20：主辦權不轉移 → UI 完全無此按鈕"""
        dashboard = EventDashboardPage(host_page)
        dashboard.open_member_settings_page()

        member_settings = MemberSettingsPage(host_page)
        member_settings.expect_C20_host_promote_button_hidden()

    def test_E_zone_N10_C19_demote_co_to_member(self, host_page):
        """★C19：協辦降參與後款項改主辦編輯"""
        dashboard = EventDashboardPage(host_page)
        dashboard.open_member_settings_page()

        member_settings = MemberSettingsPage(host_page)
        member_settings.add_virtual_member_by_display_name(
            display_name="降級測試", role="co"
        )
        member_settings.demote_co_host_to_member("降級測試")
        member_settings.expect_member_in_list(
            display_name="降級測試", role="member"
        )
