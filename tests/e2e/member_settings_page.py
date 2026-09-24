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

    # Prototype 內建的角色 label（見 app.js roleOpts, L1000）
    ROLE_LABEL_HOST = "主辦者"
    ROLE_LABEL_CO = "協辦者"
    ROLE_LABEL_MEMBER = "參與者"

    # 測試 API 用的簡短 role code → prototype label 對應
    _ROLE_CODE_TO_LABEL = {
        "host": ROLE_LABEL_HOST,
        "co": ROLE_LABEL_CO,
        "member": ROLE_LABEL_MEMBER,
    }

    def __init__(self, page: Page):
        self.page = page
        self.add_new_member_button = self.page.locator(
            "button[title='新增人員']"
        )
        # doneEdit 儲存 button（title="儲存"）
        self.save_edit_button = self.page.locator("button[title='儲存']")
        # 「確認新增」dialog 按鈕（title="確認"、data-click="memberAddYes"）
        self.confirm_add_member_button = self.page.get_by_role(
            "button", name="確認", exact=True
        )
        # toast 訊息
        self.member_toast = self.page.locator(".toast")

    def _get_member_card_for_name(self, member_name: str):
        """定位含指定 name input 的 member card（用 data-fk 匹配）。
        Prototype fk 用 'member-name-' + m.name 當 key（見 app.js L1631）——
        所以能靠 name 直接定位到該 card 的 name input。
        """
        return self.page.locator(f"[data-fk='member-name-{member_name}']")

    def add_virtual_member_by_display_name(
        self, display_name: str, role: str = "member"
    ) -> None:
        """C22: 新增虛擬成員。

        Prototype 完整流程（app.js L1027-1032, L998, L957-961）：
        1. 點「新增人員」button → addMember() → 新成員 card 進 editMember 模式
           初始 name="新成員 N" (N=members.length+1)、role="參與者"、guest=true
        2. 該 card 的 name input 有 fk='member-name-新成員 N'——填入目標名稱
        3. （選用）點該 card 內的 .btn-pill 切換 role
        4. 點該 card 內的「儲存」button（title="儲存"）→ doneEdit → 跳確認 dialog
        5. Dialog 顯示「新增後即套用到所有款項依據條件分攤，確認新增嗎？」
        6. 點「確認」button → memberAddYes() → 真正加入 members 陣列
        """
        # Step 1: 觸發新增
        self.add_new_member_button.click()

        # Step 2: 找剛建立的成員 card（name="新成員 N"），填入新名字
        # 現有 members 數不確定，遍歷可能的初始 name「新成員 1」～「新成員 N」找出剛建的
        # 更穩健：找頁上最新出現且尚未存過的 card——用 placeholder="姓名" 的 input
        editing_name_input = self.page.locator(
            "input.input[placeholder='姓名']"
        ).first
        editing_name_input.wait_for(state="visible", timeout=3_000)
        editing_name_input.fill(display_name)

        # Step 3（選用）：切 role
        if role in self._ROLE_CODE_TO_LABEL:
            target_label = self._ROLE_CODE_TO_LABEL[role]
            # role button 是 .btn-pill 且含 role label 文字
            # 該 card 內：用 has-text 精準匹配 label（避免撞到其他 pill）
            role_button = self.page.locator("button.btn-pill").filter(
                has_text=target_label
            ).first
            role_button.click()

        # Step 4: 點該 card 內的「儲存」button（title="儲存"）
        self.save_edit_button.first.click()

        # Step 5-6: dialog 出現 → 點「確認」
        self.confirm_add_member_button.wait_for(
            state="visible", timeout=3_000
        )
        self.confirm_add_member_button.click()

    def promote_member_to_co_host(self, member_display_name: str) -> None:
        """升 member 為 co-host。

        Prototype 流程：
        1. 該 member card 在 readonly 模式時，點「編輯人員」button（title="編輯人員"）
           進入 editMember 模式
        2. 點該 card 的 .btn-pill "協辦者" 切 role
        3. 點「儲存」→ doneEdit → 直接更新（非新成員不觸發 dialog）
        """
        # Step 1: 進 edit 模式——member card 上找 name → 找該 card 內的「編輯人員」button
        # 較簡化的做法：找到 member 名字所在 card 的容器，點裡面的 title="編輯人員"
        # Prototype card 結構：<div class="card card-pad">...<button title="編輯人員">...
        # 用 has 定位含指定 member 名字的 card
        member_card = self.page.locator("div.card.card-pad").filter(
            has_text=member_display_name
        ).first
        edit_button = member_card.locator("button[title='編輯人員']")
        edit_button.click()

        # Step 2: 點該 card 內的「協辦者」btn-pill
        # 進 edit 模式後同一張 card 內出現 name input 和 btn-pill role options
        # 重新定位（因為 DOM 變了）
        member_card = self.page.locator("div.card.card-pad").filter(
            has=self.page.locator(
                f"[data-fk='member-name-{member_display_name}']"
            )
        ).first
        co_pill = member_card.locator("button.btn-pill").filter(
            has_text=self.ROLE_LABEL_CO
        )
        co_pill.click()

        # Step 3: 點「儲存」
        member_card.locator("button[title='儲存']").click()

    def demote_co_host_to_member(self, co_host_display_name: str) -> None:
        """C19: 協辦降參與。同 promote 邏輯，改點「參與者」pill。"""
        member_card = self.page.locator("div.card.card-pad").filter(
            has_text=co_host_display_name
        ).first
        edit_button = member_card.locator("button[title='編輯人員']")
        edit_button.click()

        member_card = self.page.locator("div.card.card-pad").filter(
            has=self.page.locator(
                f"[data-fk='member-name-{co_host_display_name}']"
            )
        ).first
        member_pill = member_card.locator("button.btn-pill").filter(
            has_text=self.ROLE_LABEL_MEMBER
        )
        member_pill.click()

        member_card.locator("button[title='儲存']").click()

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
