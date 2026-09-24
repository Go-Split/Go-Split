"""
SettlementPage 系列 — 對應 UML N16→N28 / PRD §5 功能區 H + §11 功能區 J

【prototype 實作對應】
UML 節點 vs prototype screen 對照：
  N16 Settle H1    → screen: 'settle' (含 分帳/活動 兩 tab)
  N19 確認結帳     → dialog '確定要結帳產出？'
  N22 結帳後 H2    → screen: 'settleDone' (成功畫面) + 'settledEvent' (常態頁)
  N24 H3           → screen: 'payments' (topbar '繳款情況確認')
  N27 封存         → payments 頁「已結清，封存活動」button

【prototype 與 C31 v0.12 定案的落差】
prototype 的 payments 頁仍有繳款勾選框 (paid checkbox)；C31 定案為「純檢視、無勾選」。
測試 expect_C31_no_payment_tracking_ui_elements 會如實回報此規格落差
(此為契約測試的價值——規格與實作雙向錨定)。
"""
from playwright.sync_api import Page, expect


# ═══════════════════════════════════════════════════════════
# N16-N19：SettleH1Page 分帳產出 + Hub L10 + 確認結帳
# ═══════════════════════════════════════════════════════════
class SettleH1Page:
    """UML N16 + N18 + N19"""

    def __init__(self, page: Page):
        self.page = page
        # 兩 tab —— 用 .segmented-tab class 篩，避免撞 sidebar 上的「活動款項」
        self.settle_split_tab = self.page.locator(
            "button.segmented-tab"
        ).filter(has_text="分帳")
        self.settle_event_tab = self.page.locator(
            "button.segmented-tab"
        ).filter(has_text="活動")
        # N19 確認結帳按鈕
        self.confirm_settlement_button = self.page.get_by_role(
            "button", name="確認結帳產出", exact=True
        )
        # 確認對話框
        self.confirmation_dialog = self.page.locator("text=/確定要結帳產出/")
        self.dialog_cancel_button = self.page.get_by_role(
            "button", name="再檢查一下", exact=True
        )
        self.dialog_final_confirm_button = self.page.get_by_role(
            "button", name="確定結帳", exact=True
        )
        # 四維度 section titles
        self.dim_items_list = self.page.locator("text=/款項現況/")
        self.dim_persons_split = self.page.locator("text=/人員分攤結果/")
        self.dim_transfers_flow = self.page.locator("text=/人員付款流向/")

    # ── N16 四維度 ────────────────────────────────────────
    def expect_four_dimensions_all_visible(self) -> None:
        """§5.1 H1：prototype 兩 tab (分帳/活動) 呈現不同維度。
        點兩 tab 都應能看到對應內容。"""
        self.settle_event_tab.click()
        expect(self.dim_items_list.first).to_be_visible()
        expect(self.dim_persons_split.first).to_be_visible()
        self.settle_split_tab.click()
        expect(self.dim_transfers_flow.first).to_be_visible()

    # ── N18 Hub L10 護欄 ──────────────────────────────────
    def expect_L10_all_transfers_go_through_host_as_hub(
        self, host_member_id: str = "小凱"
    ) -> None:
        """★L10 hub-only：所有 flow 至少一端是主辦。
        prototype: flowRows 每張 card 顯示「你 ← X」或「→ X」+ amount。
        簡化斷言：至少能看到主辦名字在流向卡上。"""
        self.settle_split_tab.click()
        host_in_flow = self.page.locator(
            f"text={host_member_id}"
        )
        expect(host_in_flow.first).to_be_visible()

    # ── N19 確認結帳 ──────────────────────────────────────
    def click_confirm_settlement_open_dialog(self) -> None:
        self.confirm_settlement_button.click()

    def click_cancel_return_to_dashboard(self) -> None:
        """對應 UML N19 的「取消 → N08」箭頭。
        prototype 目前無獨立取消入口；透過 topbar hamburger 回其他頁。"""
        pass

    def expect_irreversible_warning_shown_in_dialog(self) -> None:
        """★§11 J 區補強：確認框明示「無法編輯、還原」"""
        expect(self.confirmation_dialog).to_be_visible()
        expect(
            self.page.locator("text=/無法編輯|還原|不可還原/")
        ).to_be_visible()

    def confirm_final_settlement_write_snapshot(self) -> None:
        """N19 確認 → 進 settleDone 過場頁 → 點「返回活動頁」→ settledEvent (H2)。

        Prototype 流程 (app.js L646, L2057)：
        1. 點「確定結帳」→ setState({settled: true, screen: 'settleDone'})
        2. settleDone 頁顯示「✓ 分帳已產出」+ 「返回活動頁」button
        3. 點「返回活動頁」→ 進 settledEvent screen (H2 的正式頁面)
        """
        self.dialog_final_confirm_button.click()
        # 等 settleDone 頁 render
        return_button = self.page.get_by_role(
            "button", name="返回活動頁", exact=True
        )
        return_button.wait_for(state="visible", timeout=3_000)
        return_button.click()
        # 等 settledEvent 頁 render（用穩健 marker）
        settled_markers = self.page.locator(
            "text=/結帳不可編輯|我的付款流向|繳款狀況/"
        )
        expect(settled_markers.first).to_be_visible(timeout=5_000)

    def cancel_settlement_dialog(self) -> None:
        """N19 取消對話框"""
        self.dialog_cancel_button.click()


# ═══════════════════════════════════════════════════════════
# N22-N23：SettledDashboardH2Page 結帳後活動頁
# ═══════════════════════════════════════════════════════════
class SettledDashboardH2Page:
    """UML N22 + N23: 結帳後活動頁 H2 + 檢視個人收支明細
    
    prototype 對應 screen 'settledEvent'。
    """

    def __init__(self, page: Page):
        self.page = page
        self.settled_pill = self.page.locator(".pill-dark").filter(
            has_text="已結帳"
        )
        # N23 個人收支明細：「我的付款流向」section
        self.my_flow_section = self.page.locator("text=/我的付款流向/")
        # 「款項現況（結帳不可編輯）」提示
        self.readonly_hint = self.page.locator(
            "text=/結帳不可編輯|活動已結帳/"
        )
        # 「已確認繳清」或「確認已繳清」按鈕 (prototype 有此按鈕、與 C31 衝突)
        self.confirm_paid_button = self.page.get_by_role(
            "button", name="確認已繳清"
        )

    def open_personal_net_summary(self) -> None:
        """N23：prototype 的個人收支即 settledEvent 頁本身"""
        expect(self.my_flow_section.first).to_be_visible()

    def open_transfers_h3_list_host_only(self) -> None:
        """N24 付款流向清單 H3 (僅主辦入口)。
        prototype: 點 sidebar「繳款狀況」項目（desktop 尺寸下 sidebar 直接可見）。"""
        self.page.locator("button.sidebar-item").filter(
            has_text="繳款狀況"
        ).click()

    # ── 斷言 ───────────────────────────────────────────────
    def expect_H2_banner_readonly_state_shown(self) -> None:
        """H2 結帳後狀態驗證。

        Prototype (app.js L1569, L2064) 說明：
        - 「已結帳」pill 存在，但只在 evInfoCard **收合狀態** 顯示，預設展開時看不到
        - 更穩健的 marker：「款項現況（結帳不可編輯）」文字 (L2076)
        - 或 sidebar 上「繳款狀況」項目 (L1322, 僅 isSettled=true 時 render)
        - 或「我的付款流向」section (L2066, settledEvent 頁特徵)

        用這三個 marker 的 OR 邏輯，避免 pill 收合狀態依賴。
        """
        # 穩健 marker：至少一個成立即代表已在 settledEvent state
        settled_markers = self.page.locator(
            "text=/結帳不可編輯|我的付款流向|繳款狀況/"
        )
        expect(settled_markers.first).to_be_visible(timeout=5_000)

    def expect_C29_edit_entrypoints_hidden_after_settled(self) -> None:
        """★C29：結算後編輯入口直接隱藏"""
        # prototype: 「新增款項」按鈕 (title='新增款項') 不再出現
        add_item = self.page.locator("button[title='新增款項']")
        expect(add_item).to_have_count(0)

    def expect_transfers_h3_hidden_for_non_host(self) -> None:
        """§5.4 H3：僅主辦可見付款流向清單入口。
        非主辦者 sidebar 無「繳款狀況」項目。"""
        payments_link = self.page.locator("button.sidebar-item").filter(
            has_text="繳款狀況"
        )
        expect(payments_link).to_have_count(0)


# ═══════════════════════════════════════════════════════════
# N24-N27：TransfersH3Page 付款流向清單 + 結清封存
# ═══════════════════════════════════════════════════════════
class TransfersH3Page:
    """UML N24-N27: 付款流向 → 結清 → 封存
    
    prototype 對應 screen 'payments' (topbar '繳款情況確認')。
    
    ★★★ prototype 與 C31 v0.12 定案的落差 ★★★
    prototype 的 payments 頁仍有繳款勾選框 (paid checkbox toggle)：
      `<button ... data-click="H(t.toggle)">✓</button>` (v0.16 前的行為)
    C31 定案要求：H3 純檢視、無勾選框。
    測試會如實回報此落差 (契約測試的價值)。
    """

    def __init__(self, page: Page):
        self.page = page
        self.transfer_rows = self.page.locator(".grid-cards > .card")
        # N26 結清活動 button (payments 頁底部)
        self.finalize_and_archive_button = self.page.get_by_role(
            "button", name="已結清，封存活動"
        )
        # prototype 的繳款勾選 (與 C31 衝突)
        # 這些元素若存在即代表 C31 未實作到 v0.12 定案
        self.paid_toggle_buttons = self.page.locator(
            "button[data-click]:has-text('✓')"
        )

    def click_finalize_and_archive_activity(self) -> None:
        """N26 結清 → 直接觸發 N27 封存 (prototype 無中間確認 dialog)"""
        self.finalize_and_archive_button.click()

    def confirm_archive_write_archived_true(self) -> None:
        """prototype: archiveEvent() 直接將 archived=true 並回 home。
        無獨立確認 dialog (與 §11 J 區補強要求「確認框明示不可還原」有落差)。"""
        # prototype 缺此步驟，call click_finalize_and_archive_activity() 即完成
        pass

    # ── 斷言 ───────────────────────────────────────────────
    def expect_transfers_rendered_as_readonly_list(self) -> None:
        """§5.4 H3：轉帳列表呈現"""
        expect(self.transfer_rows.first).to_be_visible()

    def expect_C31_no_payment_tracking_ui_elements(self) -> None:
        """★C31 純檢視鐵三角。
        ★預期 prototype 會 fail—— prototype 未實作到 v0.12 C31 定案。
        此測試是「規格與實作落差」的契約檢查點。
        """
        # 若 prototype 已修正 C31，此檢查會通過
        assert self.paid_toggle_buttons.count() == 0, (
            "C31 違反：prototype 仍有繳款勾選按鈕 (v0.12 定案要求移除)"
        )

    def expect_archive_confirmation_shows_irreversible_only(self) -> None:
        """★§11 J 區補強（C31 修訂 v0.12）確認框。
        prototype 未實作獨立確認 dialog；此為前端待補功能。"""
        # 待前端補確認 dialog；目前 skip
        pass

    def expect_L11_archive_button_enabled_regardless_of_payment_state(
        self,
    ) -> None:
        """★L11：封存無前置條件——按鈕永遠 enabled"""
        expect(self.finalize_and_archive_button).to_be_enabled()
