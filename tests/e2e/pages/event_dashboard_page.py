"""
EventDashboardPage — 對應 UML N08 活動主頁 / PRD §9 功能區 D

【prototype 實作對應】
Event 頁 (`screen: 'event'`) 特徵：
  - topbar 左：hamburger button (title="更多操作") 開側邊 drawer
  - topbar 右：「新增款項」button (title="新增款項", 僅主辦/協辦可見)
  - section-title "款項現況" / "群組人員"

側邊 drawer 是通往其他功能區的中樞：
  - 「首頁」→ N06 Home
  - 「活動款項」→ N08 Event (自己)
  - 「分攤規則」→ N13 Rules
  - 「群組設定」→ N10 Member Settings (僅主辦)
  - 「分帳產出」→ N16 Settle H1 (僅主辦、未結帳時)
  - 「繳款狀況」→ N24 Payments/H3 (僅主辦、已結帳時)
"""
from playwright.sync_api import Page, expect


class EventDashboardPage:
    """UML N08 活動主頁 (prototype `screen: 'event'` / `settledEvent`)"""

    def __init__(self, page: Page):
        self.page = page
        # topbar
        self.hamburger_menu_button = page.locator("button.hamburger")
        self.add_item_button = page.locator("button[title='新增款項']")

        # 側邊 drawer 內的導覽項目
        self.drawer_home_link = page.locator("button.drawer-item").filter(
            has_text="首頁"
        )
        self.drawer_event_link = page.locator("button.drawer-item").filter(
            has_text="活動款項"
        )
        self.drawer_rules_link = page.locator("button.drawer-item").filter(
            has_text="分攤規則"
        )
        self.drawer_group_settings_link = page.locator(
            "button.drawer-item"
        ).filter(has_text="群組設定")
        self.drawer_settle_link = page.locator("button.drawer-item").filter(
            has_text="分帳產出"
        )
        self.drawer_payments_link = page.locator(
            "button.drawer-item"
        ).filter(has_text="繳款狀況")

        # 唯讀 banner (prototype 用 itemPermText 與 pill-archived 表達)
        self.settled_pill = page.locator(".pill-dark, .pill-neutral").filter(
            has_text="已結帳"
        )
        self.archived_pill = page.locator(".pill-archived")

    # ── 開側邊選單並導覽 ──────────────────────────────────
    def _open_side_menu(self) -> None:
        self.hamburger_menu_button.click()

    def open_member_settings_page(self) -> None:
        """N10 群組人員設定 (E 區, 僅主辦)"""
        self._open_side_menu()
        self.drawer_group_settings_link.click()

    def open_rules_settings_page(self) -> None:
        """N13 分攤規則設定 (F 區)"""
        self._open_side_menu()
        self.drawer_rules_link.click()

    def open_recording_form_draft_page(self) -> None:
        """N12 → N14 記帳 / Form Draft (G 區)。
        prototype: 點右上「新增款項」按鈕直接進 addItem screen。"""
        self.add_item_button.click()

    def click_settle_h1_produce_settlement(self) -> None:
        """N16 分帳產出 Settle H1 (H 區, 僅主辦)"""
        self._open_side_menu()
        self.drawer_settle_link.click()

    def open_payments_h3_list(self) -> None:
        """N24 繳款狀況/付款流向 H3 (僅主辦、已結帳後)"""
        self._open_side_menu()
        self.drawer_payments_link.click()

    def navigate_back_to_home(self) -> None:
        """從 event 回 N06 Home"""
        self._open_side_menu()
        self.drawer_home_link.click()

    # ── 資訊讀取 ──────────────────────────────────────────
    def read_current_invite_code(self) -> str:
        """prototype: 邀請碼在事件卡片內以「邀請碼 XXXX-XX」呈現"""
        code_locator = self.page.locator("text=/邀請碼\\s+[A-Z0-9]{4}-[A-Z0-9]+/")
        text = code_locator.first.text_content() or ""
        # 解析 "邀請碼 4KQ2-8P" → "4KQ2-8P"
        parts = text.split()
        return parts[-1] if parts else ""

    # ── N09 角色權限斷言 ─────────────────────────────────
    def expect_host_only_actions_visible(self) -> None:
        """主辦人：hamburger 選單內可見「群組設定」「分帳產出」"""
        self._open_side_menu()
        expect(self.drawer_group_settings_link).to_be_visible()
        expect(self.drawer_settle_link).to_be_visible()

    def expect_settle_button_hidden_for_participant(self) -> None:
        """§2 角色矩陣：參與者的 hamburger 選單無「分帳產出」"""
        self._open_side_menu()
        expect(self.drawer_settle_link).not_to_be_visible()

    def expect_readonly_view_for_participant(self) -> None:
        """N11 參與者：無「新增款項」入口 (canAddItem=false)"""
        expect(self.add_item_button).not_to_be_visible()

    def expect_recording_tab_visible_for_co_host(self) -> None:
        """G2：協辦可見「新增款項」入口"""
        expect(self.add_item_button).to_be_visible()

    def expect_rules_editing_hidden_for_non_host(self) -> None:
        """規則設定：三角色皆可唯讀查看，僅主辦可編輯 (由 RulesPage 驗)"""
        self._open_side_menu()
        expect(self.drawer_rules_link).to_be_visible()

    # ── 狀態機斷言 ────────────────────────────────────────
    def expect_settled_state_readonly(self) -> None:
        """H2 結帳後：可見「已結帳」pill 與唯讀提示"""
        expect(self.settled_pill.first).to_be_visible()

    def expect_archived_state_fully_readonly(self) -> None:
        """N28 J 區封存：可見「已封存」pill"""
        expect(self.archived_pill.first).to_be_visible()
