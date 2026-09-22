"""
test_host_full_lifecycle.py — 主辦人全生命週期整合測試（重要 E2E）

覆蓋 UML 節點：
  N06 活動列表 Home
  N07 建立活動 + 選擇情境模板 (K 區)
  N08 活動主頁 Event Dashboard
  N09 角色與權限判斷（主辦人分支）
  N13 分攤規則設定 Rules
  N14 前端草稿層 Form Draft
  N15 整筆提交 Atomic Commit
  N17 全掃驗證
  N21 更新全域 Store

對應規格：§6-§11 全流程、C12 atomic、L14 三鎖、L22 除零擋存
"""
import pytest
from tests.e2e.pages.home_page import HomePage
from tests.e2e.pages.event_dashboard_page import EventDashboardPage
from tests.e2e.pages.rules_page import RulesPage
from tests.e2e.pages.form_draft_page import FormDraftPage
from tests.fixtures.outdoor_template import (
    HOST_MEMBER,
    CO_ORGANIZER_MEMBER,
    PARTICIPANT_MEMBER,
)


class TestHostFullLifecycle:
    """主辦人：N06 → N07 → N08 → N13 → N14 → N15 → N21 全流程"""

    def test_B_zone_N07_create_new_event_with_outdoor_template(
        self, host_page
    ):
        """N07: 建立活動 + 選 outdoor 情境模板 (K 區、C26 建立後不可換)"""
        home = HomePage(host_page)
        home.expect_create_event_button_visible_for_host()
        home.create_new_event_with_template(
            event_name="週末烤肉行程", template_id="outdoor"
        )
        # 建立後應直達 N08 活動主頁
        dashboard = EventDashboardPage(host_page)
        dashboard.expect_host_only_actions_visible()

    def test_D_zone_N08_N09_role_gate_all_host_actions_visible(
        self, host_page
    ):
        """N08 → N09 角色判斷：主辦見所有操作入口"""
        dashboard = EventDashboardPage(host_page)
        dashboard.expect_host_only_actions_visible()

    def test_F_zone_N13_add_rule_for_food_expense(self, host_page):
        """N13 分攤規則設定：主辦新增「食材」規則
        對應 API POST /events/{id}/rules
        """
        dashboard = EventDashboardPage(host_page)
        dashboard.open_rules_settings_page()

        rules = RulesPage(host_page)
        rules.open_add_rule_dialog()
        rules.fill_rule_basic_info(item_tag="食材", rest_bucket_mode="include")
        rules.add_condition_group_with_weight(cond_tag="全體", weight=1.0)
        rules.save_and_close_rule_dialog()
        rules.expect_rule_in_list(item_tag="食材")

    def test_G_zone_N14_N15_add_item_via_atomic_commit(self, host_page):
        """N14 → N15: 新增款項卡 + 兩筆細項 → 整筆提交
        對應 API POST /events/{id}/items (C12 atomic)
        """
        dashboard = EventDashboardPage(host_page)
        dashboard.open_recording_form_draft_page()

        form = FormDraftPage(host_page)
        form.select_payer_by_member_display_name(HOST_MEMBER.display_name)
        form.fill_detail_row_at_index(
            row_index=0,
            detail_name="漢堡肉",
            amount_in_ntd=500,
            item_tag="食材",
        )
        form.click_add_another_detail_row()
        form.fill_detail_row_at_index(
            row_index=1,
            detail_name="炭火",
            amount_in_ntd=200,
            item_tag="食材",
        )
        form.submit_all_details_as_atomic_commit()
        form.expect_successful_commit_redirects_to_dashboard()

    def test_G_zone_N15_atomic_commit_rejects_all_on_one_bad_detail_C12(
        self, host_page
    ):
        """★C12 核心測試：一筆錯 → 整張退回 → 停留原頁 → 內容保留"""
        dashboard = EventDashboardPage(host_page)
        dashboard.open_recording_form_draft_page()

        form = FormDraftPage(host_page)
        form.select_payer_by_member_display_name(HOST_MEMBER.display_name)
        form.fill_detail_row_at_index(
            row_index=0,
            detail_name="正常品項",
            amount_in_ntd=500,
            item_tag="食材",
        )
        form.click_add_another_detail_row()
        form.fill_detail_row_at_index(
            row_index=1,
            detail_name="金額不符",
            amount_in_ntd=0,  # 觸發 C10 差額文案
            item_tag="食材",
        )
        form.submit_all_details_as_atomic_commit()
        # ★C12 三件套斷言
        form.expect_C12_stays_on_form_after_validation_failure()
        form.expect_C11_error_count_summary_at_top(expected_count=1)
        form.expect_error_shown_on_detail_row_at_index(row_index=1)
