"""
EventDashboardPage — 對應 UML N08 活動主頁 / PRD §9 功能區 D

【prototype 實作對應】
Event 頁 (`screen: 'event'`) 特徵：
  - Desktop 尺寸：左側 `<nav class="sidebar">` 展開顯示，含各功能區入口
  - Mobile 尺寸：`.sidebar` 被 CSS 隱藏、改用 topbar hamburger button 開 drawer
  - 兩份 markup（sidebar + drawer）都 render 在 DOM 內，只是 CSS 決定顯隱

【定位策略】
Playwright 預設視窗約 1280x720，是 desktop 尺寸 → sidebar 可見、hamburger 不可見。
故本 POM 主要用 `.sidebar-item` 定位——直接點 sidebar 上的按鈕即可，
不需先點 hamburger（那在 desktop 是隱藏的）。

側邊 sidebar 導覽項目 (app.js L1312-1322)：
  - 「首頁」→ N06 Home
  - 「活動款項」→ N08 Event (自己)
  - 「分攤規則」→ N13 Rules
  - 「群組設定」→ N10 (僅主辦)
  - 「分帳產出」→ N16 Settle H1 (僅主辦、未結帳)
  - 「繳款狀況」→ N24 Payments/H3 (僅主辦、已結帳)
"""
from playwright.sync_api import Page, expect


class EventDashboardPage:
    """UML N08 活動主頁 (prototype `screen: 'event'` / `settledEvent`)"""

    def __init__(self, page: Page):
        self.page = page
        # topbar 右上「新增款項」button (title="新增款項")
        self.add_item_button = page.locator("button[title='新增款項']")

        # 側邊 sidebar 導覽項目（desktop 尺寸使用）
        self.sidebar_home_link = page.locator("button.sidebar-item").filter(
            has_text="首頁"
        )
        self.sidebar_event_link = page.locator("button.sidebar-item").filter(
            has_text="活動款項"
        )
        self.sidebar_rules_link = page.locator("button.sidebar-item").filter(
            has_text="分攤規則"
        )
        self.sidebar_group_settings_link = page.locator(
            "button.sidebar-item"
        ).filter(has_text="群組設定")
        self.sidebar_settle_link = page.locator("button.sidebar-item").filter(
            has_text="分帳產出"
        )
        self.sidebar_payments_link = page.locator(
            "button.sidebar-item"
        ).filter(has_text="繳款狀況")

        # 唯讀 banner
        self.settled_pill = page.locator(".pill-dark, .pill-neutral").filter(
            has_text="已結帳"
        )
        self.archived_pill = page.locator(".pill-archived")

    # ── 導覽入口 ──────────────────────────────────────────
    def open_member_settings_page(self) -> None:
        """N10 群組人員設定 (E 區, 僅主辦)"""
        self.sidebar_group_settings_link.click()

    def open_rules_settings_page(self) -> None:
        """N13 分攤規則設定 (F 區)"""
        self.sidebar_rules_link.click()

    def open_recording_form_draft_page(self) -> None:
        """N12 → N14 記帳 / Form Draft (G 區)。
        prototype: 點右上「新增款項」按鈕進 addItem screen。
        該頁 render 時 draft.details 為空陣列（畫面顯示「尚無明細」），
        測試通常需要至少一張細項卡才能填欄位——由 FormDraftPage 自行負責。"""
        self.add_item_button.click()

    def click_settle_h1_produce_settlement(self) -> None:
        """N16 分帳產出 Settle H1 (H 區, 僅主辦)"""
        self.sidebar_settle_link.click()

    def open_payments_h3_list(self) -> None:
        """N24 繳款狀況/付款流向 H3 (僅主辦、已結帳後)"""
        self.sidebar_payments_link.click()

    def navigate_back_to_home(self) -> None:
        """從 event 回 N06 Home"""
        self.sidebar_home_link.click()

    # ── 資訊讀取 ──────────────────────────────────────────
    def read_current_invite_code(self) -> str:
        """prototype: 邀請碼在事件卡片內以「邀請碼 XXXX-XX」呈現"""
        code_locator = self.page.locator("text=/邀請碼\\s+[A-Z0-9]{4}-[A-Z0-9]+/")
        text = code_locator.first.text_content() or ""
        parts = text.split()
        return parts[-1] if parts else ""

    # ── N09 角色權限斷言 ─────────────────────────────────
    def expect_host_only_actions_visible(self) -> None:
        """主辦人：sidebar 內可見「群組設定」「分帳產出」"""
        expect(self.sidebar_group_settings_link).to_be_visible()
        expect(self.sidebar_settle_link).to_be_visible()

    def expect_settle_button_hidden_for_participant(self) -> None:
        """§2 角色矩陣：參與者/協辦者的 sidebar 無「分帳產出」項目"""
        # 用 count()==0 而非 not_to_be_visible()——DOM 上就不存在
        expect(self.sidebar_settle_link).to_have_count(0)

    def expect_readonly_view_for_participant(self) -> None:
        """N11 參與者：無「新增款項」入口 (canAddItem=false)"""
        expect(self.add_item_button).to_have_count(0)

    def expect_recording_tab_visible_for_co_host(self) -> None:
        """G2：協辦可見「新增款項」入口"""
        expect(self.add_item_button).to_be_visible()

    def expect_rules_editing_hidden_for_non_host(self) -> None:
        """規則設定：三角色皆可唯讀查看，僅主辦可編輯 (由 RulesPage 驗)"""
        expect(self.sidebar_rules_link).to_be_visible()

    # ── 狀態機斷言 ────────────────────────────────────────
    def expect_settled_state_readonly(self) -> None:
        """H2 結帳後：可見「已結帳」pill"""
        expect(self.settled_pill.first).to_be_visible()

    def expect_archived_state_fully_readonly(self) -> None:
        """N28 J 區封存：可見「已封存」pill"""
        expect(self.archived_pill.first).to_be_visible()
