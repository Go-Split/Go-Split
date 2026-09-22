"""
HomePage — 對應 UML N06 活動列表 Home / PRD §7 功能區 B

【prototype 實作對應】
- Home 頁 (`screen: 'home'`) 顯示：
  - 訪客登入資訊列
  - 「新增活動」按鈕 (僅帳號登入者可見，即 UML 的主辦人)
  - 「輸入活動邀請碼 + 加入」快速加入區
  - 活動卡片列表 (含結帳/封存狀態 pill)
- 新增活動流程：Home → 「新增活動」→ create screen → 填名稱+選模板 → 右上 checkmark → Event Dashboard
"""
from playwright.sync_api import Page, expect


class HomePage:
    """UML N06: 活動列表 Home"""

    # 對應 prototype 的模板 label（見 data.js TEMPLATE_OPTS）
    TEMPLATE_CUSTOM = "自訂"
    TEMPLATE_OUTDOOR = "烤肉/露營模板"
    TEMPLATE_DINING = "聚餐模板"

    def __init__(self, page: Page):
        self.page = page
        # 主辦人專屬入口：「新增活動」按鈕
        self.create_new_event_button = page.get_by_role(
            "button", name="新增活動"
        )
        # 快速加入邀請碼 (home 頁上「輸入活動邀請碼 + 加入」button)
        self.home_invite_code_input = page.locator("[data-fk='home-code']")
        self.quick_join_button = page.get_by_role(
            "button", name="加入", exact=True
        )
        # create 頁面欄位
        self.new_event_name_input = page.locator("[data-fk='create-name']")
        self.new_event_place_input = page.locator("[data-fk='create-place']")
        # create 右上角的 checkmark 建立按鈕 (title="建立活動")
        self.confirm_create_event_button = page.locator(
            "button[title='建立活動']"
        )

    # ── N07 建立活動流程 ──────────────────────────────────
    def open_create_new_event_form(self) -> None:
        """N06 → 建立活動表單頁（screen: 'create'）"""
        self.create_new_event_button.click()

    def create_new_event_with_template(
        self,
        event_name: str,
        template_id: str = "outdoor",
        place: str = "",
    ) -> None:
        """N07: 建立活動 + 選模板。
        template_id 語意化參數：
          - "outdoor" → 選「烤肉/露營模板」
          - "custom"  → 選「自訂」
          - "dining"  → 選「聚餐模板」(prototype 未規劃)
        """
        template_label = {
            "outdoor": self.TEMPLATE_OUTDOOR,
            "custom": self.TEMPLATE_CUSTOM,
            "dining": self.TEMPLATE_DINING,
        }.get(template_id, self.TEMPLATE_CUSTOM)

        self.open_create_new_event_form()
        self.new_event_name_input.fill(event_name)
        if place:
            self.new_event_place_input.fill(place)
        # 點選模板卡片：卡片是 <button class="card card-pad"> 內含 label
        template_card = self.page.locator("button.card.card-pad").filter(
            has_text=template_label
        )
        template_card.click()
        # 右上角 checkmark 送出
        self.confirm_create_event_button.click()

    # ── N06 → N08 進入活動 ─────────────────────────────────
    def navigate_to_event_by_name(self, event_name: str) -> None:
        """點活動卡片進入 N08"""
        # 活動卡片本身沒有明確的 role，用文字匹配
        card = self.page.locator("button.card, div.card").filter(
            has_text=event_name
        ).first
        card.click()

    def quick_join_event_by_code(self, invite_code: str) -> None:
        """N06 上的快速加入邀請碼"""
        self.home_invite_code_input.fill(invite_code)
        self.quick_join_button.click()

    # ── 斷言 ───────────────────────────────────────────────
    def expect_on_home_page(self) -> None:
        """在 N06：可見活動列表或「目前沒有進行中」空狀態"""
        home_marker = self.page.locator(
            "text=/目前沒有進行中|新增活動|輸入活動邀請碼/"
        )
        expect(home_marker.first).to_be_visible(timeout=5_000)

    def expect_create_event_button_visible_for_host(self) -> None:
        """主辦人（帳號登入）可見「新增活動」按鈕"""
        expect(self.create_new_event_button).to_be_visible()

    def expect_create_event_button_hidden_for_non_host(self) -> None:
        """訪客登入（協辦/參與者）不可見「新增活動」按鈕。
        prototype 判斷條件：`ctx.isAccount` (見 app.js L1470)。
        """
        expect(self.create_new_event_button).not_to_be_visible()

    def expect_event_list_contains(self, event_name: str) -> None:
        """活動列表中包含指定活動名稱"""
        expect(self.page.locator(f"text={event_name}").first).to_be_visible()
