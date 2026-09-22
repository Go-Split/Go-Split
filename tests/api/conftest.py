"""
API 契約測試共用 fixture
- healthz、公開端點可用 anon_client 直接跑（先探測網路可達）
- host_client / member_client 需注入身分（Session cookie 或 Bearer token）
- CI 若無憑證，session-scoped fixture 會 skip
"""
import os
import pytest
import requests
from tests.support.api_client import GoSplitClient, API_BASE


@pytest.fixture(scope="session")
def api_base():
    return API_BASE


@pytest.fixture(scope="session")
def _api_reachable(api_base):
    """探測 API 是否可達；不可達則 skip anon 測試。
    Cache session-scoped，只探一次。
    可用 GOSPLIT_SKIP_LIVE_API=1 強制跳過所有 live 測試（例如 CI 無網路）。

    判斷邏輯：
    - 網路 exception → 不可達
    - 收到 `x-deny-reason` header（企業 proxy / egress 擋 domain）→ 不可達
    - 其他狀況（含 healthz 本身 5xx）→ 視為可達（讓測試決定綠紅）"""
    if os.getenv("GOSPLIT_SKIP_LIVE_API"):
        return False
    try:
        r = requests.get(f"{api_base}/healthz", timeout=5)
        if "x-deny-reason" in {k.lower() for k in r.headers.keys()}:
            return False
        return True
    except requests.RequestException:
        return False


@pytest.fixture
def anon_client(api_base, _api_reachable):
    """完全匿名 client — 用於 healthz / 未授權端點 / 錯誤路徑"""
    if not _api_reachable:
        pytest.skip("無法連線到 API（設 GOSPLIT_SKIP_LIVE_API=1 明確跳過）")
    return GoSplitClient(api_base)


def _client_with_auth(base, cookie_env: str, token_env: str):
    """從環境變數建可用 client。cookie 優先（session-based auth）；
    退而以 Bearer token；兩者皆缺則回 None 讓呼叫端 skip。"""
    cookie = os.getenv(cookie_env)
    token = os.getenv(token_env)
    if not cookie and not token:
        return None
    c = GoSplitClient(base)
    if cookie:
        for kv in cookie.split(";"):
            if "=" in kv:
                k, v = kv.strip().split("=", 1)
                c.s.cookies.set(k, v)
    if token:
        c.token = token
    return c


@pytest.fixture
def host_client(api_base, _api_reachable):
    if not _api_reachable:
        pytest.skip("無法連線到 API")
    c = _client_with_auth(api_base, "GOSPLIT_HOST_COOKIE", "GOSPLIT_HOST_TOKEN")
    if c is None:
        pytest.skip("需設 GOSPLIT_HOST_COOKIE 或 GOSPLIT_HOST_TOKEN")
    return c


@pytest.fixture
def co_client(api_base, _api_reachable):
    if not _api_reachable:
        pytest.skip("無法連線到 API")
    c = _client_with_auth(api_base, "GOSPLIT_CO_COOKIE", "GOSPLIT_CO_TOKEN")
    if c is None:
        pytest.skip("需設 GOSPLIT_CO_COOKIE 或 GOSPLIT_CO_TOKEN")
    return c


@pytest.fixture
def member_client(api_base, _api_reachable):
    if not _api_reachable:
        pytest.skip("無法連線到 API")
    c = _client_with_auth(api_base, "GOSPLIT_MEMBER_COOKIE",
                          "GOSPLIT_MEMBER_TOKEN")
    if c is None:
        pytest.skip("需設 GOSPLIT_MEMBER_COOKIE 或 GOSPLIT_MEMBER_TOKEN")
    return c


@pytest.fixture
def sample_event(host_client):
    """為單一測試建活動，測試結束後 archive 收尾"""
    r = host_client.create_event("SDD-契約測試", template="outdoor")
    assert r.ok, f"建活動失敗: {r.status_code} {r.text}"
    event_id = r.json()["id"]
    yield event_id
    try:
        host_client.archive_event(event_id)
    except Exception:
        pass
