"""
API 契約：events 端點
POST /events, GET /events, POST /events/join
GET/PATCH /events/{id}, POST /events/{id}/archive
"""
import pytest
from tests.support.schemas import registry, Schemas


@pytest.mark.api
class TestEventsContract:
    def test_anon_cannot_create_event(self, anon_client):
        r = anon_client.create_event("hack", template="outdoor")
        assert r.status_code == 401

    def test_anon_cannot_list_events(self, anon_client):
        r = anon_client.list_events()
        assert r.status_code == 401

    def test_host_creates_event(self, host_client):
        """★ 建活動：驗證回應符合 events.createEventResponse"""
        r = host_client.create_event("契約測試活動",
                                     template="outdoor",
                                     place="台北")
        assert r.status_code in (200, 201)
        body = r.json()
        assert "id" in body and isinstance(body["id"], int)
        assert "invite_code" in body
        assert body.get("name") == "契約測試活動"
        assert body.get("template") == "outdoor"
        if registry.available():
            registry.validate(Schemas.CREATE_EVENT_RESP, body)
        # cleanup
        try:
            host_client.archive_event(body["id"])
        except Exception:
            pass

    def test_create_event_requires_name(self, host_client):
        """events.createEventRequest 必填 name"""
        r = host_client._req("POST", "/events",
                             json={"template": "outdoor"})
        assert r.status_code == 400

    def test_create_event_requires_template(self, host_client):
        r = host_client._req("POST", "/events",
                             json={"name": "缺 template"})
        assert r.status_code == 400

    def test_get_event_returns_eventDetailResponse(
        self, host_client, sample_event
    ):
        r = host_client.get_event(sample_event)
        assert r.ok
        body = r.json()
        # 必要欄位
        for f in ("id", "invite_code", "members", "items", "my_role"):
            assert f in body, f"缺欄位 {f}"
        if registry.available():
            registry.validate(Schemas.EVENT_DETAIL_RESP, body)

    def test_patch_metadata_name_only(self, host_client, sample_event):
        """PATCH /events/{id} — events.metadataRequest；template 不可變"""
        r = host_client.update_event_metadata(sample_event, name="改名了")
        assert r.ok
        body = host_client.get_event(sample_event).json()
        assert body["name"] == "改名了"

    def test_patch_metadata_cannot_change_template(
        self, host_client, sample_event
    ):
        """template 不可變：即便送出也應被忽略/擋下"""
        r = host_client._req("PATCH", f"/events/{sample_event}",
                             json={"template": "different"})
        # 允許被忽略或 400；重點是 template 不變
        body = host_client.get_event(sample_event).json()
        assert body["template"] == "outdoor"

    def test_archive_event(self, host_client):
        r = host_client.create_event("要 archive 的活動",
                                     template="outdoor")
        eid = r.json()["id"]
        r2 = host_client.archive_event(eid)
        assert r2.ok
        # 之後 get 應標記為 archived
        r3 = host_client.get_event(eid)
        assert r3.json().get("archived") is True

    def test_archive_then_patch_blocked(self, host_client):
        """封存後任何 metadata 修改都應被拒（4xx）"""
        r = host_client.create_event("封存測試", template="outdoor")
        eid = r.json()["id"]
        host_client.archive_event(eid)
        r2 = host_client.update_event_metadata(eid, name="改不了")
        assert r2.status_code in (403, 409, 400)

    @pytest.mark.regression
    def test_list_events_returns_role_in_each(self, host_client):
        """events.eventListItem 應含 role 欄位（用於前端判斷入口）"""
        r = host_client.list_events()
        assert r.ok
        for ev in r.json().get("events", r.json()):
            if isinstance(ev, dict):
                assert "role" in ev
                assert ev["role"] in ("host", "co", "member")


@pytest.mark.api
class TestEventsJoin:
    def test_join_missing_code(self, host_client):
        """events.joinRequest 必填 code"""
        r = host_client._req("POST", "/events/join", json={})
        assert r.status_code == 400

    def test_join_bad_code(self, host_client):
        r = host_client.join_event(code="NOSUCHCODE")
        assert 400 <= r.status_code < 500
