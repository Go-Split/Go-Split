"""
Go-Split Backend API client — 對應真實 doc.json（Swagger 2.0）
Base: https://go-backend-api-605450358080.asia-east1.run.app
无 /api/v1 前缀；更新用 PATCH；ID 為 integer；session 以 cookie 為主
"""
import os
import requests


API_BASE = os.getenv(
    "GOSPLIT_API_BASE",
    "https://go-backend-api-605450358080.asia-east1.run.app",
)
DEFAULT_TIMEOUT = 15


class GoSplitClient:
    """
    對應 doc.json 全部 42 端點。
    - session 使用 requests.Session 自動保留 cookie（服務端以 cookie 維持身分）
    - 若後端另回 Bearer token，可額外用 self.token 帶入
    - 三種身分 (account host / guest co / guest member) 都用同一個 client 類別
    """

    def __init__(self, base_url: str = API_BASE):
        self.base = base_url.rstrip("/")
        self.s = requests.Session()
        self.token: str | None = None

    def _url(self, path: str) -> str:
        return f"{self.base}{path}"

    def _headers(self) -> dict:
        h = {"Accept": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _req(self, method: str, path: str, **kw):
        kw.setdefault("timeout", DEFAULT_TIMEOUT)
        headers = kw.pop("headers", {})
        merged = self._headers()
        merged.update(headers)
        return self.s.request(method, self._url(path), headers=merged, **kw)

    # ─────────── auth (6) ──────────────────────────────────
    def auth_google_login(self, id_token: str):
        """POST /auth/google — auth.googleLoginRequest"""
        return self._req("POST", "/auth/google",
                         json={"id_token": id_token})

    def auth_get_invitation(self, code: str):
        """GET /auth/invite/{code} — 拿邀請碼對應的活動名稱與可用條件標籤"""
        return self._req("GET", f"/auth/invite/{code}")

    def auth_join(self, code: str, name: str, email: str, phone: str,
                  cond_tags: list[str] | None = None, note: str | None = None):
        """POST /auth/join — 首次以邀請碼加入 (auth.joinRequest)"""
        payload = {"code": code, "name": name, "email": email, "phone": phone}
        if cond_tags is not None:
            payload["cond_tags"] = cond_tags
        if note is not None:
            payload["note"] = note
        return self._req("POST", "/auth/join", json=payload)

    def auth_recover(self, code: str, email: str, phone: str):
        """POST /auth/recover — 三資料找回 guest session (auth.recoverRequest)"""
        return self._req("POST", "/auth/recover",
                         json={"code": code, "email": email, "phone": phone})

    def auth_logout(self):
        """POST /auth/logout"""
        r = self._req("POST", "/auth/logout")
        self.token = None
        return r

    def auth_delete_account(self):
        """DELETE /auth/ — 刪除目前帳號"""
        return self._req("DELETE", "/auth/")

    # ─────────── events (5) ────────────────────────────────
    def list_events(self):
        """GET /events — events.eventsResponse"""
        return self._req("GET", "/events")

    def create_event(self, name: str, template: str, place: str | None = None):
        """POST /events — events.createEventRequest"""
        payload = {"name": name, "template": template}
        if place is not None:
            payload["place"] = place
        return self._req("POST", "/events", json=payload)

    def join_event(self, code: str, name: str | None = None,
                   cond_tags: list[str] | None = None, note: str | None = None):
        """POST /events/join — 已登入者以邀請碼加活動 (events.joinRequest)"""
        payload = {"code": code}
        if name is not None:
            payload["name"] = name
        if cond_tags is not None:
            payload["cond_tags"] = cond_tags
        if note is not None:
            payload["note"] = note
        return self._req("POST", "/events/join", json=payload)

    def get_event(self, event_id: int):
        """GET /events/{id} — events.eventDetailResponse"""
        return self._req("GET", f"/events/{event_id}")

    def update_event_metadata(self, event_id: int, name: str | None = None,
                              place: str | None = None):
        """PATCH /events/{id} — events.metadataRequest（template 不可變）"""
        payload: dict = {}
        if name is not None:
            payload["name"] = name
        if place is not None:
            payload["place"] = place
        return self._req("PATCH", f"/events/{event_id}", json=payload)

    def archive_event(self, event_id: int):
        """POST /events/{id}/archive"""
        return self._req("POST", f"/events/{event_id}/archive")

    # ─────────── members (7) ───────────────────────────────
    def list_members(self, event_id: int):
        """GET /events/{id}/members — events.membersResponse"""
        return self._req("GET", f"/events/{event_id}/members")

    def add_member(self, event_id: int, display: str,
                   role: str, tags: list[str] | None = None):
        """POST /events/{id}/members — events.createMemberRequest
        role ∈ {"co","member"}
        """
        assert role in ("co", "member"), "role 只能是 co 或 member"
        payload = {"display": display, "role": role}
        if tags is not None:
            payload["tags"] = tags
        return self._req("POST", f"/events/{event_id}/members", json=payload)

    def update_member(self, event_id: int, member_id: int,
                      display: str | None = None,
                      role: str | None = None,
                      tags: list[str] | None = None):
        """PATCH /events/{id}/members/{member_id} — events.updateMemberRequest
        role ∈ {"host","co","member"}
        """
        payload: dict = {}
        if display is not None:
            payload["display"] = display
        if role is not None:
            assert role in ("host", "co", "member")
            payload["role"] = role
        if tags is not None:
            payload["tags"] = tags
        return self._req("PATCH",
                         f"/events/{event_id}/members/{member_id}",
                         json=payload)

    def delete_member(self, event_id: int, member_id: int):
        """DELETE /events/{id}/members/{member_id}"""
        return self._req("DELETE",
                         f"/events/{event_id}/members/{member_id}")

    def bind_member(self, event_id: int, member_id: int, guest_id: int):
        """POST /events/{id}/members/{member_id}/bind
        — events.bindMemberRequest：把已 join 的 guest 綁到 host 建的占位成員
        """
        return self._req("POST",
                         f"/events/{event_id}/members/{member_id}/bind",
                         json={"guest_id": guest_id})

    def get_member_role(self, event_id: int, member_id: int):
        """GET /events/{id}/members/{member_id}/role"""
        return self._req("GET",
                         f"/events/{event_id}/members/{member_id}/role")

    def get_member_breakdown(self, event_id: int, member_id: int):
        """GET /events/{id}/members/{member_id}/breakdown — host only"""
        return self._req("GET",
                         f"/events/{event_id}/members/{member_id}/breakdown")

    # ─────────── me / personal (1) ─────────────────────────
    def get_my_details(self, event_id: int):
        """GET /events/{id}/me/details — events.personalResponse"""
        return self._req("GET", f"/events/{event_id}/me/details")

    # ─────────── items (5) ─────────────────────────────────
    def list_items(self, event_id: int):
        """GET /events/{id}/items — events.itemsResponse"""
        return self._req("GET", f"/events/{event_id}/items")

    def create_item(self, event_id: int, payer_member_id: int,
                    details: list[dict], has_receipt: bool = False):
        """
        POST /events/{id}/items — events.createItemRequest

        details 是一張消費卡上的多筆細項（C12 atomic 的實現）：
          [{"amount": int, "tag": str, "name": str,
            "manual_member_ids": [int] | None,
            "custom_amounts": {mid: int} | None,
            "note": str | None}, ...]
        整包送出：後端統一驗證，一筆錯全退回。
        """
        payload = {
            "payer_member_id": payer_member_id,
            "details": details,
            "has_receipt": has_receipt,
        }
        return self._req("POST",
                         f"/events/{event_id}/items", json=payload)

    def get_item(self, event_id: int, item_id: int):
        """GET /events/{id}/items/{item_id}"""
        return self._req("GET",
                         f"/events/{event_id}/items/{item_id}")

    def update_item(self, event_id: int, item_id: int,
                    payer_member_id: int | None = None,
                    details: list[dict] | None = None,
                    has_receipt: bool | None = None):
        """PATCH /events/{id}/items/{item_id} — events.updateItemRequest"""
        payload: dict = {}
        if payer_member_id is not None:
            payload["payer_member_id"] = payer_member_id
        if details is not None:
            payload["details"] = details
        if has_receipt is not None:
            payload["has_receipt"] = has_receipt
        return self._req("PATCH",
                         f"/events/{event_id}/items/{item_id}",
                         json=payload)

    def delete_item(self, event_id: int, item_id: int):
        """DELETE /events/{id}/items/{item_id}"""
        return self._req("DELETE",
                         f"/events/{event_id}/items/{item_id}")

    # ─────────── rules (4) ─────────────────────────────────
    def list_rules(self, event_id: int):
        """GET /events/{id}/rules"""
        return self._req("GET", f"/events/{event_id}/rules")

    def add_rule(self, event_id: int, item_tag: str,
                 groups: list[dict] | None = None,
                 rest: dict | None = None):
        """POST /events/{id}/rules — events.ruleBodyRequest
        - item_tag: 對應項目標籤（每個 tag 一條規則）
        - groups: 條件分組 [{cond_tag, weight_mode, weights, ...}]
        - rest: 未落入 groups 的殘餘桶 {"mode": "include"|"exclude", ...}
        """
        payload = {"item_tag": item_tag}
        if groups is not None:
            payload["groups"] = groups
        if rest is not None:
            payload["rest"] = rest
        return self._req("POST", f"/events/{event_id}/rules", json=payload)

    def update_rule(self, event_id: int, rule_id: int,
                    groups: list[dict] | None = None,
                    rest: dict | None = None):
        """PATCH /events/{id}/rules/{rule_id} — events.ruleUpdateRequest"""
        payload: dict = {}
        if groups is not None:
            payload["groups"] = groups
        if rest is not None:
            payload["rest"] = rest
        return self._req("PATCH",
                         f"/events/{event_id}/rules/{rule_id}",
                         json=payload)

    def delete_rule(self, event_id: int, rule_id: int):
        """DELETE /events/{id}/rules/{rule_id}"""
        return self._req("DELETE",
                         f"/events/{event_id}/rules/{rule_id}")

    # ─────────── tags: conds (4) ──────────────────────────
    def list_cond_tags(self, event_id: int):
        return self._req("GET", f"/events/{event_id}/tags/conds")

    def add_cond_tag(self, event_id: int, label: str):
        """events.addLabelRequest"""
        return self._req("POST",
                         f"/events/{event_id}/tags/conds",
                         json={"label": label})

    def rename_cond_tag(self, event_id: int, label: str, new_label: str):
        """PATCH /events/{id}/tags/conds/{label} — 原子重命名（含成員/規則引用）"""
        return self._req("PATCH",
                         f"/events/{event_id}/tags/conds/{label}",
                         json={"label": new_label})

    def delete_cond_tag(self, event_id: int, label: str):
        return self._req("DELETE",
                         f"/events/{event_id}/tags/conds/{label}")

    # ─────────── tags: items (4) ──────────────────────────
    def list_item_tags(self, event_id: int):
        return self._req("GET", f"/events/{event_id}/tags/items")

    def add_item_tag(self, event_id: int, label: str):
        return self._req("POST",
                         f"/events/{event_id}/tags/items",
                         json={"label": label})

    def rename_item_tag(self, event_id: int, label: str, new_label: str):
        return self._req("PATCH",
                         f"/events/{event_id}/tags/items/{label}",
                         json={"label": new_label})

    def delete_item_tag(self, event_id: int, label: str):
        return self._req("DELETE",
                         f"/events/{event_id}/tags/items/{label}")

    # ─────────── shares / settlement / transfers (4) ──────
    def get_shares(self, event_id: int):
        """GET /events/{id}/shares — events.sharesResponse
        個人視角預設；host 或已封存事件可看全體
        """
        return self._req("GET", f"/events/{event_id}/shares")

    def get_transfers(self, event_id: int):
        """GET /events/{id}/transfers — events.transfersResponse
        主辦中心轉帳；host 專屬（封存後所有人可看）
        回傳含 hub_id / strategy / transfers[]，即 L10 驗證來源
        """
        return self._req("GET", f"/events/{event_id}/transfers")

    def settle_event(self, event_id: int):
        """POST /events/{id}/settle — 驗證並永久凍結；events.validationResponse"""
        return self._req("POST", f"/events/{event_id}/settle")

    def update_settlement_note(self, event_id: int, note: str):
        """PATCH /events/{id}/settlement-note — events.settlementNoteRequest
        存結算輸出訊息（結算前）
        """
        return self._req("PATCH",
                         f"/events/{event_id}/settlement-note",
                         json={"note": note})

    # ─────────── templates / healthz ──────────────────────
    def list_templates(self):
        """GET /templates — events.templatesResponse"""
        return self._req("GET", "/templates")

    def healthz(self):
        """GET /healthz"""
        return self._req("GET", "/healthz")
