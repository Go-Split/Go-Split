"""
Playwright E2E 共用 fixture
支援三角色 storage_state：host / co / member
執行前需先跑 tests/e2e/auth_setup.py 建立三份 state 檔
"""
import os
import socket
from urllib.parse import urlparse
import pytest
from pathlib import Path


BASE_URL = os.getenv(
    "GOSPLIT_UI_BASE",
    "http://localhost:8000"   # 本機起 python -m http.server
)

STATE_DIR = Path(os.getenv("GOSPLIT_STATE_DIR", "/tmp/gosplit-states"))
STATE_DIR.mkdir(parents=True, exist_ok=True)


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


# ── UI base 可達性檢查 ─────────────────────────────────────
def _ui_base_reachable(url: str) -> bool:
    """檢查前端 base URL 的 host:port 是否可連。
    不可達 → skip 所有 E2E 測試（避免因前端未起而 error）。
    可用 GOSPLIT_SKIP_E2E=1 強制跳過所有 E2E 測試。
    """
    if os.getenv("GOSPLIT_SKIP_E2E"):
        return False
    try:
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        with socket.create_connection((host, port), timeout=2):
            return True
    except (OSError, socket.gaierror):
        return False


@pytest.fixture(scope="session", autouse=True)
def _check_ui_reachable():
    """全 E2E 目錄的守門員：若前端未起，整批 skip。
    這樣沒起前端時也不會 error，方便本機做單元/API 驗證。"""
    if not _ui_base_reachable(BASE_URL):
        pytest.skip(
            f"前端 {BASE_URL} 未啟動或不可達；"
            "請先在專案根目錄執行 `python -m http.server 8000` "
            "或 GOSPLIT_SKIP_E2E=1 明確跳過"
        )


# ── 三角色 storage_state fixture ────────────────────────
@pytest.fixture(scope="session")
def host_state_path():
    p = STATE_DIR / "host.json"
    if not p.exists():
        pytest.skip(f"缺 {p}，請先跑 auth_setup.py --role host")
    return str(p)


@pytest.fixture(scope="session")
def co_state_path():
    p = STATE_DIR / "co.json"
    if not p.exists():
        pytest.skip(f"缺 {p}，請先跑 auth_setup.py --role co")
    return str(p)


@pytest.fixture(scope="session")
def member_state_path():
    p = STATE_DIR / "member.json"
    if not p.exists():
        pytest.skip(f"缺 {p}，請先跑 auth_setup.py --role member")
    return str(p)


# ── 三角色 context / page ──────────────────────────────
@pytest.fixture
def host_context(browser, host_state_path):
    ctx = browser.new_context(storage_state=host_state_path)
    yield ctx
    ctx.close()


@pytest.fixture
def host_page(host_context, base_url):
    page = host_context.new_page()
    page.goto(base_url)
    return page


@pytest.fixture
def co_context(browser, co_state_path):
    ctx = browser.new_context(storage_state=co_state_path)
    yield ctx
    ctx.close()


@pytest.fixture
def co_page(co_context, base_url):
    page = co_context.new_page()
    page.goto(base_url)
    return page


@pytest.fixture
def member_context(browser, member_state_path):
    ctx = browser.new_context(storage_state=member_state_path)
    yield ctx
    ctx.close()


@pytest.fixture
def member_page(member_context, base_url):
    page = member_context.new_page()
    page.goto(base_url)
    return page
