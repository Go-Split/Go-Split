"""
EntryPage — 對應 UML N03 進入頁面 Entry / PRD §6 功能區 A

【prototype 實作對應說明】
本 prototype (index.html + prototype/app.js) 是純 localStorage SPA，登入分兩 tab：
  1. 「帳號登入」tab   → 對應 UML N04a (相當於 Google OAuth 的位置，但實作為 mail/pass)
  2. 「邀請碼加入」tab → 對應 UML N04b (邀請碼 + email + 手機)
  3. UML N04c 三資料找回身分：prototype 未實作（純 localStorage 版本不需要）

【DOM 定位策略】
prototype 用 SPA (`st.screen` 切換頁面)，URL 不變化。定位改用：
- 輸入框：`[data-fk='xxx']`（app.js 提供的穩定 focus key）
- 按鈕：`get_by_role("button", name="中文文字")`
- 頁面判定：檢查特徵元素（tab 文字、按鈕文字）而非 URL
"""
import pytest
from playwright.sync_api import Page, expect


class EntryPage:
    """UML N03: 進入頁面 Entry (prototype `screen: 'login'`)"""

    def __init__(self, page: Page):
        self.page = page
        # 兩個 tab（用 exact=True 避免和其他含「加入」的按鈕撞名）
        self.account_login_tab = page.get_by_role(
            "button", name="帳號登入", exact=True
        )
        self.invite_code_join_tab = page.get_by_role(
            "button", name="邀請碼加入", exact=True
        )

        # 帳號登入 tab 的輸入框（data-fk 提供穩定 selector）
        self.account_email_input = page.locator("[data-fk='acc-mail']")
        self.account_password_input = page.locator("[data-fk='acc-pass']")
        self.account_login_submit_button = page.get_by_role(
            "button", name="登入", exact=True
        )

        # 邀請碼加入 tab 的三欄輸入
        self.invite_code_input = page.locator("[data-fk='join-code']")
        self.email_input = page.locator("[data-fk='join-mail']")
        self.phone_input = page.locator("[data-fk='join-phone']")
        # 邀請碼加入的送出按鈕實際文字是「進入活動」（見 app.js L1426 joinByCode handler）
        self.join_submit_button = page.get_by_role(
            "button", name="進入活動", exact=True
        )

    def navigate_to(self, base_url: str) -> "EntryPage":
        self.page.goto(base_url)
        # 等到登入頁的 tab 都渲染完
        self.account_login_tab.wait_for(state="visible", timeout=5_000)
        return self

    # ── N04a 對應：帳號登入 (prototype 版 Google OAuth) ─────
    def login_as_host_via_account(
        self, email: str = "kai@example.com", password: str = "demo1234"
    ) -> None:
        """N04a (prototype): 帳號登入 tab，填 mail/pass 按登入。
        Note: prototype 無真實 Google OAuth，此為對應功能等價位置。
        demo 帳號 kai@example.com/demo1234 見 data.js INITIAL_STATE.acc。
        """
        self.account_login_tab.click()
        self.account_email_input.fill(email)
        self.account_password_input.fill(password)
        self.account_login_submit_button.click()

    # ── N04b 首次加入：邀請碼 + email + 手機 ──────────────
    def join_as_new_guest_by_invite_code(
        self, invite_code: str, email: str, phone_number: str
    ) -> None:
        """N04b: 切到「邀請碼加入」tab，填三欄後按加入"""
        self.invite_code_join_tab.click()
        self.invite_code_input.fill(invite_code)
        self.email_input.fill(email)
        self.phone_input.fill(phone_number)
        self.join_submit_button.click()

    # ── N04c 遺失找回：prototype 未實作 ────────────────────
    def recover_lost_guest_identity(
        self, invite_code: str, email: str, phone_number: str
    ) -> None:
        """N04c: 三資料找回身分。
        prototype 未實作此路徑（純 localStorage 無 session 概念），
        後端接入後再啟用。"""
        pytest.skip("N04c 三資料找回身分：prototype 未實作")

    # ── 斷言 ───────────────────────────────────────────────
    def expect_on_login_page(self) -> None:
        """在 N03 進入頁：兩個 tab 都存在"""
        expect(self.account_login_tab).to_be_visible()
        expect(self.invite_code_join_tab).to_be_visible()

    def expect_redirected_to_home_after_login(self) -> None:
        """N04a/b 成功 → 進 N06 活動列表 Home
        判定方式：登入 tab 消失、看到 Home 特徵（活動卡片或新增活動按鈕）
        """
        # tab 應消失
        expect(self.account_login_tab).not_to_be_visible(timeout=5_000)
        # Home 特徵：可看到「新增活動」文字或活動列表 sidebar
        home_features = self.page.locator("text=/新增活動|活動列表|目前沒有進行中/")
        expect(home_features.first).to_be_visible(timeout=5_000)

    def expect_invalid_credentials_error_shown(self) -> None:
        """§6.4：欄位錯誤時，UI 顯示紅框提示 (field-err class)。
        prototype 用 `<div class='field-err'>` 顯示驗證錯誤。"""
        error_hint = self.page.locator(".field-err")
        expect(error_hint.first).to_be_visible(timeout=3_000)
