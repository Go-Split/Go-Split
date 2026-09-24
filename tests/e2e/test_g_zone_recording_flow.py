"""
test_g_zone_recording_flow.py — G 區記帳流程專門測試

覆蓋 UML 節點：
  N12 記帳：新增 / 編輯款項
  N14 前端草稿層 Form Draft
  N15 整筆提交 Atomic Commit
  N17 全掃驗證（判斷菱形）
  N20 顯示紅框與筆數摘要（異常分支）
  N21 更新全域 Store（成功分支）

對應規格：
  §4 功能區 G：記帳
  C10 差額文案
  C11 多細項同時異常展開＋筆數摘要
  C12 整筆提交 atomic（★核心）
  L20 前端草稿層
  L22 除零擋存
"""
import pytest
from tests.e2e.pages.event_dashboard_page import EventDashboardPage
from tests.e2e.pages.form_draft_page import FormDraftPage
from tests.fixtures.outdoor_template import HOST_MEMBER


class TestG_zone_N14_form_draft:
    """N14 前端草稿層行為"""

    def test_G_zone_N14_L20_draft_layer_preserves_content_on_navigate(
        self, host_event_page
    ):
        """★L20 前端草稿層：內容不即時存後端，跳頁時保留"""
        # 需搭配前端實作，此處提供 skeleton
        pass

    def test_G_zone_N14_add_multiple_detail_rows(self, host_event_page):
        """N14: 一張款項卡可加多筆細項"""
        dashboard = EventDashboardPage(host_event_page)
        dashboard.open_recording_form_draft_page()

        form = FormDraftPage(host_event_page)
        form.select_payer_by_member_display_name(HOST_MEMBER.display_name)
        # 每次呼叫 add_detail_row_and_fill_it 都建新卡並填內容
        # LIFO: 新卡永遠 no=1，POM 內部處理
        form.add_detail_row_and_fill_it("牛肉", 800, "食材")
        form.add_detail_row_and_fill_it("蔬菜", 300, "食材")
        # 尚未提交 → 停留原頁
        # 由 N15 測試接續


class TestG_zone_N15_atomic_commit_success:
    """N15→N17→N21 成功路徑"""

    def test_G_zone_N15_all_details_valid_persists_to_backend(
        self, host_event_page
    ):
        """N15 全部通過 → 更新全域 Store → 回 N08"""
        dashboard = EventDashboardPage(host_event_page)
        dashboard.open_recording_form_draft_page()

        form = FormDraftPage(host_event_page)
        form.select_payer_by_member_display_name(HOST_MEMBER.display_name)
        form.add_detail_row_and_fill_it("碳", 200, "食材")
        form.submit_all_details_as_atomic_commit()
        form.expect_successful_commit_redirects_to_dashboard()


class TestG_zone_N15_N17_N20_atomic_commit_failure:
    """N15→N17→N20 失敗路徑（C12 核心測試群）"""

    @pytest.mark.xfail(
        reason=(
            "★規格與實作落差：C12 要求「一筆細項不合法 → 整張退回」，"
            "但 prototype (app.js L1079-1082) 對 amount 只擋「空字串」與「非數字」，"
            "不擋「金額=0」——0 被視為合法整數。因此 amount=0 的細項提交後成功離開 "
            "addItem screen 進入 event 頁，違反 C12「停留原頁」預期。"
            "後端接入引擎規則後（L22 除零檢查）可轉為 pass。"
        ),
        strict=True,
    )
    def test_G_zone_C12_one_bad_detail_rejects_entire_card(self, host_event_page):
        """★C12 核心：一筆細項 amount=0（除零違規）→ 整張退回"""
        dashboard = EventDashboardPage(host_event_page)
        dashboard.open_recording_form_draft_page()

        form = FormDraftPage(host_event_page)
        form.select_payer_by_member_display_name(HOST_MEMBER.display_name)
        form.add_detail_row_and_fill_it("正常品項", 500, "食材")
        form.add_detail_row_and_fill_it("違規品項", 0, "食材")
        form.submit_all_details_as_atomic_commit()

        form.expect_C12_stays_on_form_after_validation_failure()

    @pytest.mark.xfail(
        reason=(
            "★規格與實作落差：C11 要求「多筆錯誤逐一顯示 + 頂部筆數摘要」，"
            "同 C12 的根源——prototype 不擋 amount=0，此測試三筆 amount=0 "
            "全部視為合法，無錯誤提示可驗證。後端接入後可轉為 pass。"
        ),
        strict=True,
    )
    def test_G_zone_C11_multiple_bad_details_all_shown_with_count_summary(
        self, host_event_page
    ):
        """★C11：多筆異常同時展開 + 頂部筆數摘要"""
        dashboard = EventDashboardPage(host_event_page)
        dashboard.open_recording_form_draft_page()

        form = FormDraftPage(host_event_page)
        form.select_payer_by_member_display_name(HOST_MEMBER.display_name)
        # 三筆全錯（amount=0）
        for i in range(3):
            form.add_detail_row_and_fill_it(f"錯品項{i}", 0, "食材")
        form.submit_all_details_as_atomic_commit()

        form.expect_C11_error_count_summary_at_top(expected_count=3)
        for i in range(3):
            form.expect_error_shown_on_detail_row_at_index(row_index=i)

    def test_G_zone_C10_total_mismatch_shows_diff_message(self, host_event_page):
        """★C10：金額合計與品項金額差 → 顯示差額文案"""
        # 需前端支援「款項總金額」欄位與細項總和的差異偵測
        pass

    @pytest.mark.skip(reason="需引擎規則配合觸發 L22 除零")
    def test_G_zone_L22_zero_weight_all_excluded_blocks_submit(
        self, host_event_page
    ):
        """★L22：權重全 0 情境 A → 擋存 + 即時提示"""
        dashboard = EventDashboardPage(host_event_page)
        dashboard.open_recording_form_draft_page()

        form = FormDraftPage(host_event_page)
        # ... 設計除零情境
        form.expect_L22_zero_participant_blocks_submit()
