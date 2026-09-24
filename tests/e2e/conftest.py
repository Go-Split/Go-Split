"""
Playwright E2E 共用 fixture

【身分注入策略】
prototype 是純 in-memory state 的 SPA，localStorage 不存 session，
故 storage_state 對此無用。改用 prototype 內建的 roleswitch 面板
（見 tests/e2e/roleswitch_helper.py）——每個測試前自動跑「切 persona」
兩步驟操作，等同「登入」的效果。

【三個 page fixture】
- host_page:   已切為主辦人（帳號人員）並登入完成，落在 home / event 頁
- co_page:     已切為協辦者（免帳號人員、非初次加入），落在 home / event 頁
- member_page: 已切為參與者（免帳號人員、非初次加入），落在 home / event 頁

【接後端 API 版本後】
此 fixture 應改為透過真實 login API 產 token / cookie，並用 storage_state 加速。
roleswitch 是 prototype-only 的 DEV 工具。
"""
import os
import socket
from urllib.parse import urlparse
import pytest
from pathlib import Path

from tests.e2e.roleswitch_helper import RoleswitchHelper


BASE_URL = os.getenv(
    "GOSPLIT_UI_BASE",
    "http://localhost:8000"   # 本機起 python -m http.server
)


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


# ── 三角色 page fixture（透過 roleswitch）─────────────────
@pytest.fixture
def host_page(page, base_url):
    """已切為主辦人（帳號人員）+ 完成登入，落在 home 頁"""
    helper = RoleswitchHelper(page, base_url)
    helper.switch_to_host_via_account_login()
    return page


@pytest.fixture
def co_page(page, base_url):
    """已切為協辦者（免帳號人員、非初次加入），落在 home 頁"""
    helper = RoleswitchHelper(page, base_url)
    helper.switch_to_co_organizer_via_guest_not_first()
    return page


@pytest.fixture
def member_page(page, base_url):
    """已切為參與者（免帳號人員、非初次加入），落在 home 頁"""
    helper = RoleswitchHelper(page, base_url)
    helper.switch_to_participant_via_guest_not_first()
    return page


# ── 進活動 fixture：三角色從 home 前進到 event 頁 ──────────
# 適用於需要「已在活動內」的 D/E/F/G/H 區測試
def _enter_first_event_matching_role(page, role_pill_text: str):
    """從 home 頁點第一張匹配角色的活動卡片進入 event 頁。

    prototype 的 events 陣列 role 是各自寫死的（不隨 st.role 變）——
    所以協辦身分登入後，需點 role='協辦者' 的活動；主辦點 role='主辦者'；
    參與者點 role='參與者'。這樣才會看到對應角色的操作入口。

    prototype 活動卡片 render (app.js L1452-1454):
      <button ...><span class="fs14 fw500">${活動名}</span>...
        <span class="pill-neutral">${ev.role}</span>...  ← 角色 pill
      </button>
    """
    from playwright.sync_api import expect as _expect
    # 找含指定 role pill text 的第一張卡片（用 has_text 匹配 role pill）
    event_cards = page.locator("button.card, button.card-pad").filter(
        has_text=role_pill_text
    )
    event_cards.first.click()
    # 等 event 頁 render 完（section-title「款項現況」是 event 頁特徵）
    _expect(
        page.locator("text=/款項現況|群組人員|尚無款項/").first
    ).to_be_visible(timeout=5_000)


@pytest.fixture
def host_event_page(host_page):
    """主辦已進入第一個主辦身分的活動 dashboard"""
    _enter_first_event_matching_role(host_page, "主辦者")
    return host_page


@pytest.fixture
def co_event_page(co_page):
    """協辦已進入第一個協辦身分的活動 dashboard"""
    _enter_first_event_matching_role(co_page, "協辦者")
    return co_page


@pytest.fixture
def member_event_page(member_page):
    """參與者已進入第一個參與者身分的活動 dashboard"""
    _enter_first_event_matching_role(member_page, "參與者")
    return member_page


# ── 進「已結帳活動」fixture：三角色進入 settled state ──────
# 適用於 H 區 (N22-N24 結帳後狀態) + J 區 (N26-N28 封存流程)
def _enter_settled_event_by_name(page, event_name: str):
    """從 home 頁點指定名稱的活動卡片，進入 settledEvent screen。

    prototype (data.js L36-38) 預埋三個已結帳活動：
      - '系友會春酒'    role='host'    settled=true  → 主辦視角
      - '羽球團月底結算' role='member' settled=true  → 參與者視角
      - '同事送別會'    role='co'      settled=true  → 協辦視角

    這些活動的卡片 pill 顯示「已結帳」而非角色名（app.js L1453），
    但活動名稱唯一——直接用 has_text=活動名 匹配即可。

    進入後應直達 settledEvent screen（app.js L2058-2082），
    可看到「已結帳」pill、「我的付款流向」等結帳後特徵元素。
    """
    from playwright.sync_api import expect as _expect
    event_cards = page.locator("button.card, button.card-pad").filter(
        has_text=event_name
    )
    event_cards.first.click()
    # settledEvent 頁特徵：「我的付款流向」或「已結帳」pill 或「結帳不可編輯」
    _expect(
        page.locator("text=/我的付款流向|結帳不可編輯|已結帳/").first
    ).to_be_visible(timeout=5_000)


@pytest.fixture
def host_settled_event_page(host_page):
    """主辦已進入預埋的已結帳活動「系友會春酒」（settledEvent screen）。
    可驗 H2 唯讀狀態、N24 H3 付款流向清單入口、N26/N27 封存流程。"""
    _enter_settled_event_by_name(host_page, "系友會春酒")
    return host_page


@pytest.fixture
def co_settled_event_page(co_page):
    """協辦已進入預埋的已結帳活動「同事送別會」（settledEvent screen）。
    可驗協辦視角的 H2 檢視、以及 H3 對非主辦隱藏。"""
    _enter_settled_event_by_name(co_page, "同事送別會")
    return co_page


@pytest.fixture
def member_settled_event_page(member_page):
    """參與者已進入預埋的已結帳活動「羽球團月底結算」（settledEvent screen）。
    可驗 N22-N23 個人收支明細、C31 純檢視、H3 對非主辦隱藏。"""
    _enter_settled_event_by_name(member_page, "羽球團月底結算")
    return member_page
