"""
Roleswitch Helper — 利用 prototype 內建的「原型檢視身份」快速切換測試 persona

【背景】
prototype (app.js L1427-1429) 在 login screen 下方提供 roleswitch 面板，
內含四行角色（主辦人/協辦者/參與者/初次加入），每行有 2 個 .pill-toggle 按鈕。
點下按鈕觸發 viewRoleRows.pick() → setState({role, persona, guest, ...})。
若 (guest && !firstJoin) || blank，會直接跳到 screen: 'home'。

【用途】
E2E 測試需要「當前身分為某角色」的前置條件——不走真實登入，改用 roleswitch
瞬間切好。等同免 storage_state 的替代方案（因為 prototype 是純 in-memory state，
localStorage 存不到有意義的東西）。

【對應規格】
- roleswitch 是 prototype 的 DEV 工具，非產品功能
- 接後端 API 版本後，此檔案改為 storage_state 或 API 產 token 流程
- 三角色定義見 data.js viewRoleRows：'host'/'co'/'member'
"""
from playwright.sync_api import Page, expect


class RoleswitchHelper:
    """封裝 prototype roleswitch 面板的操作"""

    # 對應 app.js viewRoleRows 的四個 row label
    ROLE_HOST = "主辦人"
    ROLE_CO = "協辦者"
    ROLE_MEMBER = "參與者"
    ROLE_FIRST_JOIN = "初次加入"

    # 對應 pill-toggle 上的選項 label
    OPT_ACCOUNT = "帳號人員"
    OPT_GUEST_NOT_FIRST = "免帳號人員（非初次加入）"
    OPT_GUEST_FIRST = "免帳號人員"
    OPT_BLANK_HOST = "空白狀態"

    def __init__(self, page: Page, base_url: str):
        self.page = page
        self.base_url = base_url

    def _navigate_to_login_and_locate_roleswitch(self):
        """導向 login 頁，等 roleswitch 面板 render 完"""
        self.page.goto(self.base_url)
        # roleswitch 面板的 title 是 rendered 完成的訊號
        expect(
            self.page.locator(".roleswitch-title")
        ).to_be_visible(timeout=5_000)

    def _click_role_option(self, role_label: str, option_label: str):
        """點指定角色 row 內的指定 option button"""
        # roleswitch-row 內含 label + opts，用 filter 找對的 row
        role_row = self.page.locator(".roleswitch-row").filter(
            has=self.page.locator(".roleswitch-label", has_text=role_label)
        )
        # 該 row 內找 pill-toggle button，用 exact 匹配 option 文字
        option_button = role_row.locator(".pill-toggle", has_text=option_label)
        option_button.click()

    def _wait_for_home_or_event_screen(self):
        """點選 persona 後應離開 login screen；等 Home 或 Event 特徵出現。

        marker 策略：
        - 「輸入活動邀請碼」— home 頁的邀請碼輸入框 placeholder（所有登入態都有）
        - 「款項現況」— event 頁的 section title（若切完直接進 event）
        - 「訪客登入」— 免帳號人員的 home 上方顯示（co / member 特徵）
        """
        home_or_event_marker = self.page.locator(
            "text=/輸入活動邀請碼|款項現況|訪客登入|新增活動/"
        )
        expect(home_or_event_marker.first).to_be_visible(timeout=5_000)

    # ── 主辦人（Host）帳號登入 ──────────────────────────────
    def switch_to_host_via_account_login(self):
        """切主辦（帳號人員）→ 停在 login 頁的帳號態、需再按登入
        （app.js: guest=false, firstJoin=false, blank=false → 不會直接跳 home）"""
        self._navigate_to_login_and_locate_roleswitch()
        self._click_role_option(self.ROLE_HOST, self.OPT_ACCOUNT)
        # 帳號模式下停在 login 頁，需按登入
        # 用「登入」button (btn btn-primary)——非 tab、非 pill-toggle
        login_button = self.page.get_by_role(
            "button", name="登入", exact=True
        )
        login_button.click()
        self._wait_for_home_or_event_screen()

    def switch_to_host_blank_state(self):
        """切主辦（空白狀態）→ 直接進 home 且無預埋活動
        （app.js: blank=true → screen: 'home'）"""
        self._navigate_to_login_and_locate_roleswitch()
        self._click_role_option(self.ROLE_HOST, self.OPT_BLANK_HOST)
        self._wait_for_home_or_event_screen()

    # ── 協辦者（Co-host）─────────────────────────────────
    def switch_to_co_organizer_via_guest_not_first(self):
        """切協辦（免帳號人員、非初次加入）→ 直接進 home 或 event
        （app.js: guest=true, first=false → home）"""
        self._navigate_to_login_and_locate_roleswitch()
        self._click_role_option(self.ROLE_CO, self.OPT_GUEST_NOT_FIRST)
        self._wait_for_home_or_event_screen()

    # ── 參與者（Participant / member）──────────────────
    def switch_to_participant_via_guest_not_first(self):
        """切參與者（免帳號人員、非初次加入）→ 直接進 home 或 event"""
        self._navigate_to_login_and_locate_roleswitch()
        self._click_role_option(self.ROLE_MEMBER, self.OPT_GUEST_NOT_FIRST)
        self._wait_for_home_or_event_screen()

    def switch_to_first_time_joiner(self):
        """切初次加入（免帳號人員）→ 進 invite screen 而非 home
        （app.js: firstJoin=true → 不直接跳 home）"""
        self._navigate_to_login_and_locate_roleswitch()
        self._click_role_option(
            self.ROLE_FIRST_JOIN, self.OPT_GUEST_FIRST
        )
        # 這種情況不會直接進 home——保留邏輯彈性
