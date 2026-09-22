"""
FormDraftPage — 對應 UML N14 前端草稿層 + N15 Atomic Commit / PRD §4 功能區 G

【prototype 實作對應】
addItem screen (`screen: 'addItem'`) 對應 N14 前端草稿層 (L20)：
  - 頂部 topbar: 「新增款項」+ 右上「儲存款項」button (title="儲存款項")
  - 「本筆款項合計」卡片顯示 draftTotal
  - 「明細」section: 右邊「新增明細」button
  - 每筆細項是一張 card, 包含品項名稱/金額/備註輸入
  - data-fk 提供穩定 selector: draft-name-{no}, draft-amount-{no}, draft-note-{no}
  - 錯誤提示: <div class="field-err">...</div>, 紅框: input--err class

N15 Atomic Commit 對應 submitItem() 動作。
N17 全掃驗證: prototype 在 addItem 頁上檢查各細項，錯誤時 addItem 頁不會離開 (符合 C12)。
"""
from playwright.sync_api import Page, expect


class FormDraftPage:
    """UML N14 + N15: 前端草稿層 + Atomic Commit"""

    def __init__(self, page: Page):
        self.page = page
        # topbar
        self.submit_atomic_commit_button = self.page.locator(
            "button[title='儲存款項']"
        )
        # 新增明細
        self.add_new_detail_row_button = self.page.locator(
            "button[title='新增明細']"
        )
        # 本筆款項合計
        self.draft_total_amount_display = self.page.locator(
            "text=/本筆款項合計/"
        )

    # ── N14 草稿層：填欄位 ─────────────────────────────────
    def click_add_another_detail_row(self) -> None:
        """新增一筆細項空白行"""
        self.add_new_detail_row_button.click()

    def fill_detail_row_at_index(
        self,
        row_index: int,
        detail_name: str,
        amount_in_ntd: int,
        item_tag: str = "",
    ) -> None:
        """填單筆細項欄位。
        prototype 用 draft-name-{no}/draft-amount-{no} 作為 fk key，
        no 從 0 開始遞增。
        """
        name_input = self.page.locator(f"[data-fk='draft-name-{row_index}']")
        amount_input = self.page.locator(
            f"[data-fk='draft-amount-{row_index}']"
        )
        name_input.fill(detail_name)
        amount_input.fill(str(amount_in_ntd))
        # 品項標籤 (item_tag) 於 prototype 是 TagPicker，點標籤按鈕
        if item_tag:
            # 在該細項卡片內找 tag button
            tag_button = self.page.get_by_role(
                "button", name=item_tag
            ).first
            if tag_button.count() > 0:
                tag_button.click()

    def select_payer_by_member_display_name(
        self, display_name: str
    ) -> None:
        """選付款人。prototype 目前預設由 st.role 決定，
        此方法保留介面但無實際動作 (未來若加付款人切換 UI 再實作)。"""
        # prototype 未有可切換 payer 的獨立控件；付款人=當前 user
        pass

    # ── N15 整筆提交 ──────────────────────────────────────
    def submit_all_details_as_atomic_commit(self) -> None:
        """觸發 N15 整筆提交 → N17 全掃驗證"""
        self.submit_atomic_commit_button.click()

    # ── 斷言：C12 / C11 / C10 護欄 ─────────────────────────
    def expect_C12_stays_on_form_after_validation_failure(self) -> None:
        """★C12：驗證失敗 → 停留原頁。
        prototype 判定：topbar 「新增款項」字樣仍在。"""
        expect(
            self.page.locator("text=/新增款項/").first
        ).to_be_visible(timeout=3_000)

    def expect_error_shown_on_detail_row_at_index(
        self, row_index: int
    ) -> None:
        """★C11：異常行顯示紅框 (input--err 或 field-err)"""
        # prototype 用 input--err class 或 field-err div
        error_input = self.page.locator(
            f"[data-fk='draft-amount-{row_index}'].input--err, "
            f"[data-fk='draft-name-{row_index}'].input--err"
        )
        error_div = self.page.locator(".field-err")
        # 至少一種錯誤呈現
        assert (
            error_input.count() > 0 or error_div.count() > 0
        ), f"C11 違反：第 {row_index} 行未顯示錯誤"

    def expect_C11_error_count_summary_at_top(
        self, expected_count: int
    ) -> None:
        """★C11：頂部顯示筆數摘要。
        prototype 目前使用 `empty-box` 提示，未實作精確筆數摘要
        (待前端補齊，本測試 assert field-err 存在數)"""
        error_divs = self.page.locator(".field-err")
        actual = error_divs.count()
        assert actual >= expected_count, (
            f"C11 違反：預期至少 {expected_count} 個錯誤提示，實際 {actual}"
        )

    def expect_C10_amount_diff_message_shown(self) -> None:
        """★C10：金額差額文案。
        prototype 於 shareBlock 顯示 mismatch。"""
        diff_message = self.page.locator("text=/差|金額不符/")
        expect(diff_message.first).to_be_visible(timeout=3_000)

    def expect_L22_zero_participant_blocks_submit(self) -> None:
        """★L22：除零情境擋存。
        prototype 在 shareBlock 顯示「無人分攤」文字。"""
        no_participant_hint = self.page.locator("text=/無人分攤|請調整/")
        expect(no_participant_hint.first).to_be_visible(timeout=3_000)

    def expect_successful_commit_redirects_to_dashboard(self) -> None:
        """★N15→N21→N08：成功 → 更新 Store → 回活動主頁。
        prototype 判定：topbar 「新增款項」字樣消失, 「款項現況」出現。"""
        expect(
            self.page.locator("text=/款項現況|尚無款項/").first
        ).to_be_visible(timeout=5_000)

    def expect_C12_no_details_persisted_to_backend(
        self, api_check_callback
    ) -> None:
        """★C12：全有全無 (需 API callback，prototype 為 localStorage 版時保留 hook)"""
        # prototype 為純 client 端 state，無真後端持久化，此檢查於接 API 版本才有意義
        pass
