"""
test_participant_readonly_journey.py — 參與者（Participant）唯讀路徑

覆蓋 UML 節點：
  N04b 首次加入
  N08 活動主頁 Event Dashboard
  N09 角色與權限判斷（參與者分支）
  N11 唯讀檢視：款項與個人摘要
  N22 結帳後活動頁 H2（參與者分支）
  N23 檢視個人收支明細

對應規格：
  §2 角色矩陣（Participant 唯讀）
  §5.3 H2 協辦/參與者結帳後唯讀無操作
  C13 應分攤 = 我的視角
"""
import pytest
from tests.e2e.pages.home_page import HomePage
from tests.e2e.pages.event_dashboard_page import EventDashboardPage
from tests.e2e.pages.settlement_page import SettledDashboardH2Page


class TestParticipantReadonlyJourney:

    def test_B_zone_N06_participant_home_no_create_button(self, member_page):
        """B 區：參與者於活動列表看不到建立活動按鈕"""
        home = HomePage(member_page)
        home.expect_create_event_button_hidden_for_non_host()

    def test_D_zone_N08_N09_N11_participant_sees_readonly_only(
        self, member_page
    ):
        """N09 分支：參與者只見唯讀入口"""
        dashboard = EventDashboardPage(member_page)
        dashboard.expect_readonly_view_for_participant()
        dashboard.expect_settle_button_hidden_for_participant()

    @pytest.mark.skip(reason="待補：需活動結帳後的 storage_state")
    def test_H_zone_N22_N23_participant_can_view_personal_summary_after_settled(
        self, member_page
    ):
        """N22 → N23：結帳後參與者可看個人收支明細"""
        settled_page = SettledDashboardH2Page(member_page)
        settled_page.expect_H2_banner_readonly_state_shown()
        settled_page.open_personal_net_summary()

    @pytest.mark.skip(reason="待補：需活動結帳後的 storage_state")
    def test_H_zone_N24_transfers_h3_hidden_for_participant_C31(
        self, member_page
    ):
        """★§5.4 H3 + C31：參與者看不到付款流向清單入口"""
        settled_page = SettledDashboardH2Page(member_page)
        settled_page.expect_transfers_h3_hidden_for_non_host()

    def test_F_zone_N13_participant_can_view_rules_readonly(
        self, member_page
    ):
        """N13 分攤規則：三角色皆可唯讀查看（PRD §9 D 區）"""
        dashboard = EventDashboardPage(member_page)
        dashboard.expect_rules_editing_hidden_for_non_host()
