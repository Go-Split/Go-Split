"""
API 契約：members 端點
GET /events/{id}/members, POST /events/{id}/members
PATCH/DELETE /events/{id}/members/{member_id}
POST /events/{id}/members/{member_id}/bind
GET /events/{id}/members/{member_id}/role
GET /events/{id}/members/{member_id}/breakdown
GET /events/{id}/me/details
"""
import pytest
from tests.support.schemas import registry, Schemas


@pytest.mark.api
class TestMembersContract:
    def test_list_members(self, host_client, sample_event):
        r = host_client.list_members(sample_event)
        assert r.ok
        # events.membersResponse 通常是 {members: [...]}
        body = r.json()
        members = body.get("members", body if isinstance(body, list) else [])
        assert isinstance(members, list)

    def test_add_placeholder_member_role_member(
        self, host_client, sample_event
    ):
        """POST /events/{id}/members — createMemberRequest role ∈ {co,member}"""
        r = host_client.add_member(sample_event, display="小美",
                                   role="member",
                                   tags=["adult"])
        assert r.status_code in (200, 201)
        body = r.json()
        assert "id" in body and isinstance(body["id"], int)
        if registry.available():
            registry.validate(Schemas.MEMBER_DTO, body)

    def test_add_member_role_co(self, host_client, sample_event):
        r = host_client.add_member(sample_event, display="阿豪", role="co")
        assert r.status_code in (200, 201)

    def test_add_member_bad_role_400(self, host_client, sample_event):
        """role enum 僅 co / member"""
        r = host_client._req(
            "POST", f"/events/{sample_event}/members",
            json={"display": "壞", "role": "host"}  # host 不可由此建
        )
        assert r.status_code == 400

    def test_add_member_missing_display(self, host_client, sample_event):
        r = host_client._req(
            "POST", f"/events/{sample_event}/members",
            json={"role": "member"}
        )
        assert r.status_code == 400

    def test_patch_member_display(self, host_client, sample_event):
        r = host_client.add_member(sample_event, display="要改的",
                                   role="member")
        mid = r.json()["id"]
        r2 = host_client.update_member(sample_event, mid, display="改好了")
        assert r2.ok

    def test_patch_member_promote_to_co(
        self, host_client, sample_event
    ):
        """PATCH 可將 member 升為 co（updateMemberRequest role 含 host/co/member）"""
        r = host_client.add_member(sample_event, display="候選協辦",
                                   role="member")
        mid = r.json()["id"]
        r2 = host_client.update_member(sample_event, mid, role="co")
        assert r2.ok

    def test_delete_member(self, host_client, sample_event):
        r = host_client.add_member(sample_event, display="待刪",
                                   role="member")
        mid = r.json()["id"]
        r2 = host_client.delete_member(sample_event, mid)
        assert r2.ok

    def test_get_member_role(self, host_client, sample_event):
        r = host_client.add_member(sample_event, display="查角色",
                                   role="member")
        mid = r.json()["id"]
        r2 = host_client.get_member_role(sample_event, mid)
        assert r2.ok
        assert r2.json().get("role") == "member"
        if registry.available():
            registry.validate(Schemas.ROLE_RESP, r2.json())

    def test_get_member_breakdown_host_only(
        self, host_client, sample_event, member_client
    ):
        """★ breakdown 是 host 專屬"""
        r = host_client.add_member(sample_event, display="被查",
                                   role="member")
        mid = r.json()["id"]
        r_host = host_client.get_member_breakdown(sample_event, mid)
        assert r_host.ok
        # member 身分呼叫應被擋
        r_mem = member_client.get_member_breakdown(sample_event, mid)
        assert r_mem.status_code in (401, 403)

    def test_bind_member(self, host_client, sample_event):
        """POST /events/{id}/members/{mid}/bind — 把 guest 綁到占位成員
        缺 guest_id 應 400
        """
        r = host_client.add_member(sample_event, display="占位",
                                   role="member")
        mid = r.json()["id"]
        r2 = host_client._req(
            "POST", f"/events/{sample_event}/members/{mid}/bind",
            json={}
        )
        assert r2.status_code == 400


@pytest.mark.api
class TestMyDetails:
    def test_get_my_details_shape(self, host_client, sample_event):
        """GET /me/details — events.personalResponse"""
        r = host_client.get_my_details(sample_event)
        assert r.ok
        body = r.json()
        for f in ("member_id", "net", "lines"):
            assert f in body
        if registry.available():
            registry.validate(Schemas.PERSONAL_RESP, body)
