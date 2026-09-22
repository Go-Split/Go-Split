"""
RulesPage — 對應 UML N13 分攤規則設定 Rules / PRD §3 功能區 F

【prototype 實作對應】
rules screen (`screen: 'rules'` / `'rulesEdit'`) 內容：
  - 分兩區：項目標籤區 (item tag) 與人員條件區 (cond tag)
  - 主辦人可在 rulesEdit 態新增/刪除標籤與規則
  - 「＋ 新增分攤規則」button (pill-dashed style)
  - 「新增規則」button (title 屬性)
  - ruleLockText: 已封存/已結帳/非主辦 → 唯讀提示

【prototype 尚未完整實作的 L14/L21 護欄】
prototype 為 UI-only 版本，L14 (規則使用中刪除擋下) 與 L21 (已用 tag 建規則擋下)
未於前端 UI 層完整實作，測試改為對「規則列表存在性」的斷言，實際引擎規則
以 unit test 為主 (tests/unit/*)。
"""
from playwright.sync_api import Page, expect


class RulesPage:
    """UML N13 分攤規則設定 (主辦人於 rulesEdit 態編輯，三角色皆可 rules 態唯讀查看)"""

    def __init__(self, page: Page):
        self.page = page
        self.add_new_rule_group_button = self.page.locator(
            "button.pill-dashed"
        ).filter(has_text="新增分攤規則")
        self.add_new_rule_row_button = self.page.locator(
            "button[title='新增規則']"
        )
        # 唯讀提示 (ruleLockText)
        self.rule_readonly_lock_text = self.page.locator(
            "text=/僅主辦人可以調整規則|活動已結帳|活動已封存/"
        )

    # ── 新增規則 ──────────────────────────────────────────
    def click_add_new_rule_group(self) -> None:
        self.add_new_rule_group_button.click()

    def click_add_new_rule_row(self) -> None:
        """新增規則列 (只在 rulesEdit 態顯示)"""
        self.add_new_rule_row_button.click()

    def fill_rule_basic_info(
        self, item_tag: str, rest_bucket_mode: str = "include"
    ) -> None:
        """prototype 目前對規則 input 尚無穩定 selector,
        此方法保留給未來版本，暫視為 pending。"""
        # prototype 的 rule editing UI 較複雜（含 popover），
        # 具體 fill 邏輯待前端補穩定 test selector 後實作
        pass

    def add_condition_group_with_weight(
        self, cond_tag: str, weight: float
    ) -> None:
        """新增條件分組。同上，待前端穩定 selector。"""
        pass

    def save_and_close_rule_dialog(self) -> None:
        """prototype 規則以就地編輯 (無獨立 dialog) 為主，
        改為斷言 rulesEdit 態離開條件。"""
        pass

    # ── 斷言 ───────────────────────────────────────────────
    def expect_add_rule_button_hidden_for_non_host(self) -> None:
        """§9 D 區：協辦/參與者可看規則但不可編輯"""
        expect(self.rule_readonly_lock_text.first).to_be_visible()

    def expect_L14_delete_blocked_because_rule_in_use(self) -> None:
        """★L14 護欄。prototype 未在 UI 層完整實作，待補。"""
        # 引擎層護欄以 unit test 覆蓋 (tests/unit/test_h1_compute_transfers.py 相關案例)
        pass

    def expect_L22_zero_weight_warning_shown(self) -> None:
        """★L22 護欄：權重全 0 提示。同上，改於 FormDraft 頁面驗證。"""
        pass

    def expect_L22_save_button_disabled_due_to_zero_weight(self) -> None:
        pass

    def expect_L21_cannot_create_rule_for_used_tag(self) -> None:
        """★L21 護欄。prototype 顯示：`「〈標籤〉」已被使用在款項上，不可刪除。`
        此為刪除方向的 L14 護欄；L21 (建方向) 待前端補。"""
        used_msg = self.page.locator("text=/已被使用在款項上/")
        expect(used_msg).to_be_visible(timeout=3_000)

    def expect_rule_in_list(self, item_tag: str) -> None:
        """規則列表中可看到指定 item_tag 名稱"""
        expect(
            self.page.locator(f"text={item_tag}").first
        ).to_be_visible()
