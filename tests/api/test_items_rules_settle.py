"""
API 契約：items / rules / tags / shares / transfers / settle
POST /events/{id}/items — createItemRequest（含 details[] → C12 atomic）
POST /events/{id}/rules — ruleBodyRequest（groups + rest → L14/L21/L22 護欄）
GET  /events/{id}/shares — sharesResponse（分攤預覽）
GET  /events/{id}/transfers — transfersResponse（含 hub_id → L10 驗證）
POST /events/{id}/settle — 永久凍結
"""
import pytest
from tests.support.schemas import registry, Schemas


# ── items: C12 atomic ────────────────────────────────────
@pytest.mark.api
class TestItemsContract:
    def _payer_id(self, host_client, event_id):
        """取得主辦成員 id 作為 payer"""
        r = host_client.get_event(event_id)
        for m in r.json().get("members", []):
            if m.get("role") == "host":
                return m["id"]
        # fallback：任何 you=true 的成員
        for m in r.json().get("members", []):
            if m.get("you"):
                return m["id"]
        pytest.skip("找不到主辦成員 id")

    def test_create_item_single_detail(self, host_client, sample_event):
        payer = self._payer_id(host_client, sample_event)
        r = host_client.create_item(
            sample_event,
            payer_member_id=payer,
            details=[{
                "name": "牛五花", "amount": 1200,
                "tag": "food_meat", "note": ""
            }],
            has_receipt=False,
        )
        assert r.status_code in (200, 201)
        body = r.json()
        assert "id" in body
        assert body.get("total") == 1200
        if registry.available():
            registry.validate(Schemas.ITEM_DTO, body)

    def test_C12_atomic_reject_all_on_one_bad(
        self, host_client, sample_event
    ):
        """★C12：一張 item card 中一筆 detail 錯 → 整張 400"""
        payer = self._payer_id(host_client, sample_event)
        r = host_client.create_item(
            sample_event,
            payer_member_id=payer,
            details=[
                {"name": "好", "amount": 100, "tag": "food_meat"},
                {"name": "壞", "amount": -50, "tag": "food_meat"},
            ],
        )
        assert r.status_code == 400
        # 進 store 檢查：好那筆也不能存在
        items = host_client.list_items(sample_event).json()
        rows = items.get("items", items if isinstance(items, list) else [])
        for it in rows:
            for d in it.get("details", []):
                assert d.get("name") not in ("好", "壞")

    def test_missing_payer_member_id_400(self, host_client, sample_event):
        r = host_client._req(
            "POST", f"/events/{sample_event}/items",
            json={"details": [{"amount": 100, "tag": "food_meat"}]}
        )
        assert r.status_code == 400

    def test_get_item_returns_allocations(
        self, host_client, sample_event
    ):
        """★ itemDTO.details[].allocation 應含 splitengine.SplitResult"""
        payer = self._payer_id(host_client, sample_event)
        r = host_client.create_item(
            sample_event, payer_member_id=payer,
            details=[{"name": "青菜", "amount": 600, "tag": "food_veggie"}],
        )
        item_id = r.json()["id"]
        r2 = host_client.get_item(sample_event, item_id)
        assert r2.ok
        body = r2.json()
        details = body.get("details", [])
        assert len(details) == 1
        alloc = details[0].get("allocation")
        assert alloc is not None
        # SplitResult 必要欄位
        for f in ("shares", "excluded", "validity"):
            assert f in alloc, f"allocation 缺 {f}"

    def test_update_item(self, host_client, sample_event):
        payer = self._payer_id(host_client, sample_event)
        r = host_client.create_item(
            sample_event, payer_member_id=payer,
            details=[{"name": "原始", "amount": 300, "tag": "food_veggie"}]
        )
        iid = r.json()["id"]
        r2 = host_client.update_item(
            sample_event, iid,
            details=[{"name": "改後", "amount": 500, "tag": "food_veggie"}]
        )
        assert r2.ok

    def test_delete_item(self, host_client, sample_event):
        payer = self._payer_id(host_client, sample_event)
        r = host_client.create_item(
            sample_event, payer_member_id=payer,
            details=[{"name": "待刪", "amount": 100, "tag": "food_veggie"}]
        )
        iid = r.json()["id"]
        r2 = host_client.delete_item(sample_event, iid)
        assert r2.ok


# ── rules: L14 / L21 / L22 護欄 ────────────────────────
@pytest.mark.api
class TestRulesContract:
    def test_list_rules_after_template(self, host_client, sample_event):
        r = host_client.list_rules(sample_event)
        assert r.ok

    def test_add_rule_requires_item_tag(self, host_client, sample_event):
        """ruleBodyRequest 必填 item_tag"""
        r = host_client._req(
            "POST", f"/events/{sample_event}/rules",
            json={"groups": [], "rest": {"mode": "include"}}
        )
        assert r.status_code == 400

    def test_add_rule_minimal(self, host_client, sample_event):
        # 先建 item_tag
        host_client.add_item_tag(sample_event, "custom_food")
        r = host_client.add_rule(
            sample_event,
            item_tag="custom_food",
            groups=[{"cond_tag": "adult", "weight_mode": "equal"}],
            rest={"mode": "include"},
        )
        assert r.status_code in (200, 201)


# ── tags: cond & item ─────────────────────────────────
@pytest.mark.api
class TestTagsContract:
    def test_add_and_delete_cond_tag(self, host_client, sample_event):
        r = host_client.add_cond_tag(sample_event, "test_cond")
        assert r.status_code in (200, 201)
        r2 = host_client.delete_cond_tag(sample_event, "test_cond")
        assert r2.ok

    def test_add_and_delete_item_tag(self, host_client, sample_event):
        r = host_client.add_item_tag(sample_event, "test_item")
        assert r.status_code in (200, 201)
        r2 = host_client.delete_item_tag(sample_event, "test_item")
        assert r2.ok

    def test_rename_cond_tag_atomic(self, host_client, sample_event):
        """PATCH tags/conds/{label} — 應原子同步成員與規則引用"""
        host_client.add_cond_tag(sample_event, "old_tag")
        r = host_client.rename_cond_tag(sample_event, "old_tag", "new_tag")
        assert r.ok
        # old 應不在，new 應在
        labels = host_client.list_cond_tags(sample_event).json()
        rows = labels.get("labels", labels if isinstance(labels, list) else [])
        names = [x if isinstance(x, str) else x.get("label") for x in rows]
        assert "new_tag" in names
        assert "old_tag" not in names


# ── shares / transfers / settle: L10 hub-only ────────
@pytest.mark.api
class TestSettlementContract:
    def _add_sample_items(self, host_client, event_id):
        r = host_client.get_event(event_id)
        payer = next((m["id"] for m in r.json().get("members", [])
                      if m.get("role") == "host"), None)
        assert payer, "找不到 host member"
        # 加兩筆項目
        host_client.create_item(
            event_id, payer_member_id=payer,
            details=[{"name": "牛五花", "amount": 1200,
                      "tag": "food_meat"}]
        )
        host_client.create_item(
            event_id, payer_member_id=payer,
            details=[{"name": "營地費", "amount": 2000,
                      "tag": "site_fee"}]
        )

    def test_get_shares(self, host_client, sample_event):
        self._add_sample_items(host_client, sample_event)
        r = host_client.get_shares(sample_event)
        assert r.ok
        body = r.json()
        for f in ("grand_total", "per_member", "per_detail"):
            assert f in body, f"sharesResponse 缺 {f}"
        if registry.available():
            registry.validate(Schemas.SHARES_RESP, body)

    def test_get_transfers_hub_only(self, host_client, sample_event):
        """★L10：transfersResponse 應含 hub_id，所有 transfer 至少一端是 hub"""
        self._add_sample_items(host_client, sample_event)
        r = host_client.get_transfers(sample_event)
        assert r.ok
        body = r.json()
        hub_id = body.get("hub_id")
        assert hub_id is not None, "transfersResponse 缺 hub_id"
        for t in body.get("transfers", []):
            assert t["from_id"] != t["to_id"], "I4：不可自付自收"
            assert t["amount"] > 0
            assert hub_id in (t["from_id"], t["to_id"]), \
                f"L10 違反：hub {hub_id} 不在 transfer {t}"
        if registry.available():
            registry.validate(Schemas.TRANSFERS_RESP, body)

    def test_transfers_hidden_from_non_host_until_archived(
        self, host_client, sample_event, member_client
    ):
        """★ transfers 是 host only（未封存前）"""
        self._add_sample_items(host_client, sample_event)
        r = member_client._req(
            "GET", f"/events/{sample_event}/transfers"
        )
        assert r.status_code in (401, 403)

    def test_settle_freezes_event(self, host_client, sample_event):
        """POST /settle → 之後任何 detail 修改都被拒"""
        self._add_sample_items(host_client, sample_event)
        r = host_client.settle_event(sample_event)
        assert r.ok
        # 之後 create item 應失敗
        r2 = host_client.create_item(
            sample_event, payer_member_id=1,
            details=[{"name": "settle 後", "amount": 100,
                      "tag": "food_meat"}]
        )
        assert r2.status_code in (403, 409, 400)

    def test_settlement_note_before_settle(
        self, host_client, sample_event
    ):
        r = host_client.update_settlement_note(sample_event, "請於一週內付清")
        assert r.ok
