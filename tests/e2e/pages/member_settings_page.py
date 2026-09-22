"""
MemberSettingsPage — 對應 UML N10 群組人員設定 / PRD §10 功能區 E

【prototype 實作對應】
group screen (`screen: 'group'`) 內容：
  - section-title 「群組人員」
  - 「新增人員」button (title 屬性)
  - member cards 顯示每位成員
  - toast 提示：「已新增成功」、「已有代墊款項或分攤金額，不可刪除」

【prototype 侷限】
- 升降 role 的具體 UI selector 尚不穩定（用 dot-sel 群組 radio）
- C20 主辦權不轉移：prototype 內 mk() 定義的 opts 僅有 host（僅一位）+ co + member
- C22 主辦手動新增虛擬成員：本頁「新增人員」button 對應
"""
from playwright.sync_api import Page, expect


class MemberSettingsPage:
    """UML N10 群組人員設定"""

    def __init__(self, page: Page):
        self.page = page
        self.add_new_member_button = self.page.locator(
            "button[title='新增人員']"
        )
        # toast 訊息
        self.member_toast = self.page.locator(".toast")

    def add_virtual_member_by_display_name(
        self, display_name: str, role: str = "member"
    ) -> None:
        """C22: 新增虛擬成員。
        prototype 流程：點「新增人員」→ 出現新成員 card → 編輯 display name → doneEdit
        由於 prototype 用 in-place edit 且無穩定 fk，此方法僅點按鈕觸發流程，
        後續 fill 邏輯待前端補穩定 selector。
        """
        self.add_new_member_button.click()
        # TODO: prototype 補穩定 selector 後填入 display_name

    def promote_member_to_co_host(self, member_display_name: str) -> None:
        """升 member 為 co-host。
        prototype 於 member card 的 role radio 群組切換 (dot-sel/dot-unsel)。
        具體 selector 待前端穩定。
        """
        pass

    def demote_co_host_to_member(self, co_host_display_name: str) -> None:
        """C19: 協辦降參與。同上，待前端穩定。"""
        pass

    # ── 斷言 ───────────────────────────────────────────────
    def expect_member_in_list(
        self, display_name: str, role: str = ""
    ) -> None:
        """member card 顯示 name (與 role 標籤)"""
        expect(
            self.page.locator(f"text={display_name}").first
        ).to_be_visible()

    def expect_C20_host_promote_button_hidden(self) -> None:
        """★C20：主辦權不轉移。
        prototype: opts 定義僅有「主辦者」(單一)/協辦者/參與者，
        沒有「升為主辦」的 UI 選項，此斷言默認通過。"""
        # 反向斷言：沒有任何 role radio 標為「升為主辦」
        promote_to_host_text = self.page.locator(
            "text=/升為主辦|轉移主辦/"
        )
        expect(promote_to_host_text).to_have_count(0)

    def expect_page_hidden_for_non_host(self) -> None:
        """僅主辦可進此頁。
        prototype: `if (s === 'group' && st.role !== 'host') setTimeout(() => go('event'), 0)`
        非主辦者被強制跳回 event 頁。"""
        expect(self.add_new_member_button).not_to_be_visible()

    def expect_L14_delete_blocked_because_member_has_items(self) -> None:
        """★L14 (member 方向)：已有代墊款項或分攤金額的成員不可刪。
        prototype 顯示 toast: `dsp(m) + ' 已有代墊款項或分攤金額，不可刪除'`"""
        block_toast = self.page.locator(
            "text=/已有代墊款項或分攤金額，不可刪除/"
        )
        expect(block_toast).to_be_visible(timeout=3_000)
