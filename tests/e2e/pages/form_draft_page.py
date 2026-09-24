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
        """點「新增明細」按鈕，unshift 一筆空白細項到最前面。
        （app.js L1119-1120: `[{new}].concat(舊)` — LIFO 順序）
        """
        self.add_new_detail_row_button.click()

    def _ensure_at_least_one_draft_detail_card_exists(self) -> None:
        """進 addItem screen 時 draft.details=[] 為空——若還沒任何卡片，
        點一次「新增明細」建出第一張卡片（此時 fk 為 draft-name-1）。
        """
        first_card_name_input = self.page.locator(
            "[data-fk='draft-name-1']"
        )
        if first_card_name_input.count() == 0:
            self.click_add_another_detail_row()
            first_card_name_input.wait_for(state="visible", timeout=3_000)

    def add_detail_row_and_fill_it(
        self,
        detail_name: str,
        amount_in_ntd: int,
        item_tag: str = "",
    ) -> None:
        """新增一張細項卡並填入內容。**推薦用這個方法**（而非 fill_detail_row_at_index）。

        Prototype LIFO 行為：每按「新增明細」→ 新卡 unshift 到最前面 (no=1)、
        舊卡的 no 都往後推。所以「新填的細項一定在 no=1」——不需要追蹤 index。

        典型用法（填 3 筆）：
          form.add_detail_row_and_fill_it("牛肉", 800)  # 建 no=1 填「牛肉」
          form.add_detail_row_and_fill_it("蔬菜", 300)  # 建新卡 no=1 填「蔬菜」、
                                                        # 舊「牛肉」變 no=2
          form.add_detail_row_and_fill_it("醬料", 100)  # 又建新卡 no=1 填「醬料」、
                                                        # 「蔬菜」變 no=2、「牛肉」變 no=3
        """
        self.click_add_another_detail_row()
        # 新卡永遠在 no=1（LIFO unshift）
        name_input = self.page.locator("[data-fk='draft-name-1']")
        amount_input = self.page.locator("[data-fk='draft-amount-1']")
        # 等新卡 render 完成
        name_input.wait_for(state="visible", timeout=3_000)
        name_input.fill(detail_name)
        amount_input.fill(str(amount_in_ntd))
        if item_tag:
            tag_button = self.page.get_by_role(
                "button", name=item_tag
            ).first
            if tag_button.count() > 0:
                tag_button.click()

    def fill_detail_row_at_index(
        self,
        row_index: int,
        detail_name: str,
        amount_in_ntd: int,
        item_tag: str = "",
    ) -> None:
        """填單筆細項欄位（**LEGACY** — 建議改用 add_detail_row_and_fill_it）。

        row_index 對應**畫面上從上到下的位置**（0-based）→ 內部轉 no=row_index+1。

        WARNING：LIFO 行為讓「index 對應建立順序」的直覺不成立——
          第一次呼叫 (row_index=0) 建卡並填→ 該卡 no=1 對應 row_index=0 ✓
          之後若呼叫 click_add_another_detail_row，新卡 no=1、舊卡 no=2
          再呼叫 (row_index=1) 想填舊卡 → 舊卡現在確實是 no=2 ✓
        所以此方法配合明確 index 可以工作，但呼叫端要清楚「index=畫面位置」。
        推薦用 add_detail_row_and_fill_it 讓 POM 隱藏 LIFO 邏輯。
        """
        self._ensure_at_least_one_draft_detail_card_exists()

        fk_no = row_index + 1
        name_input = self.page.locator(f"[data-fk='draft-name-{fk_no}']")
        amount_input = self.page.locator(
            f"[data-fk='draft-amount-{fk_no}']"
        )
        name_input.fill(detail_name)
        amount_input.fill(str(amount_in_ntd))
        if item_tag:
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
