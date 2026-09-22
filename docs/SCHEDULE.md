# ⭐ SCHEDULE — 時辰規劃表（人機分工 × SDD 一步步指令）

> **對象**：軟體架構師 / SDET / QA lead / 想跟著跑一遍完整 SDD＋TDD 的執行者
> **語言**：Claude Code / 一般終端機皆可
> **總時程**：**建議 3 個工作天**（實際可在 1.5 天內完成核心，剩餘做端到端整合）

---

## §0 UML × PRD × 測試命名對照表（重要！）

**本專案採用「PRD 功能區代號 + UML 節點 ID + 業務語意」三段命名法**，讓第三者可從測試名稱直接反推規格出處。

### PRD 功能區編號系統

| 代號 | 功能區 | PRD 章節 | UML 節點範圍 |
|---|---|---|---|
| **F** | 條件式分攤引擎 | §3 | 引擎純函數（不在 UML 上）|
| **G** | 記帳（新增/編輯款項） | §4 | N12 / N14 / N15 |
| **H** | 結算（分帳→結帳→付款→結清）| §5 | N16 / N18 / N19 / N22 / N24 |
| **A** | 進入 / 帳號 | §6 | N01 / N02 / N03 / N04a/b/c |
| **B** | 活動列表 (home) | §7 | N06 |
| **C** | 邀請 / 加入 | §8 | N04b |
| **D** | 活動主頁 (event) | §9 | N08 / N09 |
| **E** | 群組設定 + 成員管理 | §10 | N10 |
| **J** | 封存 | §11 | N27 / N28 |
| **K** | 情境模板 | §11.5 | N07 |

### UML.pdf 節點 → PRD 章節 → POM class 對照

| UML 節點 ID | UML 節點名 | PRD | POM class | POM 檔案 |
|---|---|---|---|---|
| N03 | 進入頁面 Entry | §6 A | `EntryPage` | `entry_page.py` |
| N04a | Google 登入 OAuth | §6.1 A | `EntryPage.login_as_host_via_google_oauth()` | 同上 |
| N04b | 邀請碼 + Email + 手機 | §6.2 A | `EntryPage.join_as_new_guest_by_invite_code()` | 同上 |
| N04c | 三資料找回身分 | §6.3 A | `EntryPage.recover_lost_guest_identity()` | 同上 |
| N06 | 活動列表 Home | §7 B | `HomePage` | `home_page.py` |
| N07 | 建立活動 + 選模板 | §7 + §11.5 K | `HomePage.create_new_event_with_template()` | 同上 |
| N08 | 活動主頁 Event Dashboard | §9 D | `EventDashboardPage` | `event_dashboard_page.py` |
| N09 | 角色與權限判斷 | §9 D | `EventDashboardPage.expect_*` 系列 | 同上 |
| N10 | 群組人員設定 | §10 E | `MemberSettingsPage` | `member_settings_page.py` |
| N11 | 唯讀檢視：款項與個人摘要 | §9 D | `EventDashboardPage.expect_readonly_view_for_participant()` | 同上 |
| N12 | 記帳：新增 / 編輯款項 | §4 G | `FormDraftPage` | `form_draft_page.py` |
| N13 | 分攤規則設定 Rules | §3 F | `RulesPage` | `rules_page.py` |
| N14 | 前端草稿層 Form Draft | §4 G + L20 | `FormDraftPage` | 同 N12 |
| N15 | 整筆提交 Atomic Commit | §4 G + C12 | `FormDraftPage.submit_all_details_as_atomic_commit()` | 同上 |
| N16 | 分帳產出 Settle H1 | §5.1 H | `SettleH1Page` | `settlement_page.py` |
| N17 | 全掃驗證 | §3.3 F | `FormDraftPage.expect_C11_*` | 同 N12 |
| N18 | 主辦中心轉帳計算 Hub L10 | §5.1 H + L10 | `SettleH1Page.expect_L10_*` | 同 N16 |
| N19 | 確認結帳（判斷菱形）| §5.2 H | `SettleH1Page.click_confirm_settlement_open_dialog()` | 同上 |
| N20 | 顯示紅框與筆數摘要 | §4 G + C11 | `FormDraftPage.expect_error_shown_*` | 同 N12 |
| N21 | 更新全域 Store | §4 G | `FormDraftPage.expect_successful_commit_*` | 同上 |
| N22 | 結帳後活動頁 H2 | §5.3 H | `SettledDashboardH2Page` | 同 N16 |
| N23 | 檢視個人收支明細 | §5.3 H | `SettledDashboardH2Page.open_personal_net_summary()` | 同上 |
| N24 | 付款流向清單 H3 | §5.4 H + C31 | `TransfersH3Page` | 同上 |
| N25 | 平台外私下確認款項 | §5.4 H + C31 | （無 UI 元素，設計性節點）| N/A |
| N26 | 結清活動 | §11 J | `TransfersH3Page.click_finalize_and_archive_activity()` | 同 N24 |
| N27 | 封存 Archived J 區 | §11 J + L11 | `TransfersH3Page.confirm_archive_write_archived_true()` | 同上 |
| N28 | 全區完全唯讀 | §11 J | `EventDashboardPage.expect_archived_state_fully_readonly()` | 同 N08 |

### 測試命名格式

**格式**：`test_<PRD功能區代號>_<UML節點ID>_<業務語意>`

| 範例 | 涵蓋 |
|---|---|
| `test_A_zone_N04a_host_login_via_google_redirects_to_home` | A 區 + N04a 節點 + 業務語意 |
| `test_D_zone_N08_N09_role_gate_all_host_actions_visible` | D 區 + 兩節點 + 權限判斷語意 |
| `test_G_zone_N15_atomic_commit_rejects_all_on_one_bad_detail_C12` | G 區 + N15 + C12 決議代號 |
| `test_H_zone_N18_L10_all_transfers_route_through_host` | H 區 + N18 + L10 護欄 |
| `test_J_zone_N27_L11_archive_confirmation_shows_irreversible_only` | J 區 + N27 + L11 定案 |

### 引擎詞 vs API 命名 vs UML 命名 對照

| 語義 | 引擎 (F0-F3/H1) | API (doc.json snake_case) | UML 圖上文字 |
|---|---|---|---|
| 條件式權重解析 | F1 resolveWeight | rule.groups[].weight_mode | N13 分攤規則設定 |
| 金額分配 | F2 allocate | share.amount | N16 分帳產出 |
| 餘數處理 | F3 settleRemainder | (內含在 F2) | （不在 UML）|
| 產出款項細項分帳 | F0 splitDetail | POST /items details[] | N15 整筆提交 |
| 中心化轉帳最小化 | H1 computeTransfers | GET /transfers hub_only=true | N18 Hub L10 |

**重要提醒**：
- UML 上的 **H1** 指 UI 節點「分帳產出」（測試前綴 `test_UI_H1_*` 或 `test_H_zone_N16_*`）
- 引擎的 **H1** 指純函數 `computeTransfers`（測試前綴 `test_H1_*` 於 `tests/unit/test_h1_compute_transfers.py`）
- 兩者同名但作用層不同，測試命名保持分層清晰

---

> **核心方法**：Spec-Driven Development ＋ ZOMBIES-TDD ＋ 人機分工

---

## 0. 方法論鳥瞰

### SDD × TDD × BDD 的三層閉環

```
┌─────────────────────────────────────────────┐
│ Layer 3：BDD 場景描述 (docs/TEST-SCENARIOS.md) │  ← 人：讀規格、想場景
├─────────────────────────────────────────────┤
│ Layer 2：TDD 循環（Red → Green → Refactor）    │  ← 機：寫測試/寫實作/重構
├─────────────────────────────────────────────┤
│ Layer 1：ZOMBIES 案例順序                       │  ← 兩者共同遵守
│  Zero → One → Many → Boundaries →              │
│  Interfaces → Exceptions → Simple scenarios    │
└─────────────────────────────────────────────┘
```

### 人 vs 機 的責任邊界（誰做什麼？）

| 職責 | 人（你） | 機（Claude / AI）|
|------|---------|-----------------|
| 讀 PRD / SPEC / API doc | ✅ | 輔助 |
| 決策：某條規格模糊時的解釋 | ✅ | 只提選項 |
| 決策：測試框架、優先序 | ✅ | 只提建議 |
| 寫測試（每輪紅） | 提示情境 | ✅ 產出 pytest 碼 |
| 寫實作（每輪綠） | 提示簽章 | ✅ 產出 Python/引擎 |
| 重構 | 指定目標 | ✅ 產出重構 |
| 跑測試、看紅綠、回報 | 執行指令 | ✅ 分析錯誤 |
| 手動 QA（跨瀏覽器、可用性） | ✅ 人肉走 | 幫寫 CHECKLIST |
| Commit / PR | ✅ | 幫寫訊息 |
| 部署、觀察 metric | ✅ | — |

---

## 1. 環境準備（Day 0，30 分鐘）

### 1.1 目錄骨架

在你的工作機上執行：

```bash
# 建立專案根目錄
mkdir -p ~/projects/gosplit-sdd && cd ~/projects/gosplit-sdd

# 建立子目錄
mkdir -p docs tests/{unit,e2e,fixtures,support,manual} scripts
mkdir -p tests/support/pages

# 初始化 Python 環境
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate

# 記得建 .gitignore
cat > .gitignore << 'EOF'
.venv/
__pycache__/
*.pyc
.pytest_cache/
playwright-report/
test-results/
.env
EOF
```

### 1.2 相依套件清單

建立 `requirements.txt`：

```txt
# ==== 核心測試 ====
pytest==8.3.2
pytest-asyncio==0.24.0
pytest-cov==5.0.0
pytest-html==4.1.1
pytest-xdist==3.6.1

# ==== 屬性測試（不變量驗證）====
hypothesis==6.112.0

# ==== API 測試 ====
requests==2.32.3
jsonschema==4.23.0

# ==== E2E 測試 ====
playwright==1.47.0
pytest-playwright==0.5.1

# ==== 資料處理 ====
pyyaml==6.0.2
python-dotenv==1.0.1
```

### 1.3 一鍵安裝腳本

建立 `scripts/setup.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3 -m venv .venv || true
source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt

# Playwright 瀏覽器
playwright install chromium
# 若要跨瀏覽器：playwright install firefox webkit

echo "✅ 環境準備完成。用 'source .venv/bin/activate' 進入 venv。"
```

### 1.4 pytest 設定

`pytest.ini`：

```ini
[pytest]
minversion = 8.0
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    unit: 單元測試（引擎純函數）
    api: API 契約測試
    e2e: 端到端 UI 測試
    zombies_z: Zero 類
    zombies_o: One 類
    zombies_m: Many 類
    zombies_b: Boundaries
    zombies_i: Interfaces
    zombies_e: Exceptions
    zombies_s: Simple scenarios
    slow: 執行較久的案例
addopts =
    -ra
    --strict-markers
    --tb=short
    --html=test-report.html
    --self-contained-html
```

### 1.5 環境變數

`.env`（複製自 `.env.example`）：

```dotenv
GOSPLIT_API_BASE=https://go-backend-api-605450358080.asia-east1.run.app
GOSPLIT_UI_BASE=http://localhost:3000
# 主辦 Google 帳號測試用（若後端支援 fake OAuth）
TEST_HOST_EMAIL=kai-test@example.com
TEST_HOST_TOKEN_URL=https://backend/testing/mint-token
```

### 1.6 執行環境驗證

```bash
bash scripts/setup.sh
python -c "import pytest, playwright, hypothesis, requests, jsonschema; print('OK')"
```

**Checkpoint ✅**：看到 `OK` 才進入 Day 1。

---

## 2. Day 1：分攤引擎的 TDD（ZOMBIES 走一輪）

**目標**：把 SPEC-ENGINE 五個純函數 + 四條不變量在 Python 端實現並測試通過。所有測試都以 ZOMBIES 順序寫。

### 2.1 上午：F1 `resolveWeight`（3 小時）

#### Step 1（10 min）— 建 fixture

**人做**：把 SPEC §7 烤肉/露營 fixture 抄成 Python。

**指令**：

> ⚠️ **命名層次說明**：本 fixture 用「引擎層規格詞」（`itemTag`、`condSets`、`weightMode`）——與 SPEC-ENGINE v1.1 一致，方便對照 SPEC 讀。**API 層命名不同**：真實 doc.json 的 `events.ruleBodyRequest` 用 snake_case + 結構名 `groups`（不是 `condSets`）、`rest`（結構相同）、`item_tag`（不是 `itemTag`）。轉換發生在 `api_client.add_rule()` 內部——測試碼用引擎詞，client 送出時翻譯成 API 命名。**這是刻意分層**，避免引擎測試碰到 API 命名變更。

```bash
cat > tests/fixtures/outdoor_template.py << 'PY'
"""烤肉/露營模板 — 對應 SPEC-ENGINE v1.1 §7.1-7.3（引擎層命名）"""

OUTDOOR_RULES = [
    {"itemTag": "肉品", "condSets": [
        {"condTags": ["吃素"], "mode": "exclude"},
        {"condTags": ["小孩"], "mode": "weight", "weight": 0.5},
        {"condTags": ["晚到"], "mode": "weight", "weight": 0.5}],
     "rest": {"mode": "weight", "weight": 1}},
    {"itemTag": "蔬菜", "condSets": [
        {"condTags": ["吃素"], "mode": "weight", "weight": 1.5},
        {"condTags": ["小孩"], "mode": "weight", "weight": 0.5}],
     "rest": {"mode": "weight", "weight": 1}},
    {"itemTag": "海鮮", "condSets": [
        {"condTags": ["海鮮過敏"], "mode": "exclude"},
        {"condTags": ["小孩"], "mode": "weight", "weight": 0.5}],
     "rest": {"mode": "weight", "weight": 1}},
    {"itemTag": "主食", "condSets": [
        {"condTags": ["小孩"], "mode": "weight", "weight": 0.5}],
     "rest": {"mode": "weight", "weight": 1}},
    {"itemTag": "酒精飲品", "condSets": [
        {"condTags": ["不喝酒/開車"], "mode": "exclude"},
        {"condTags": ["小孩"], "mode": "exclude"}],
     "rest": {"mode": "weight", "weight": 1}},
    # ⭐ 唯一使用 rest.exclude 的規則 — L9 的存在理由
    {"itemTag": "交通費", "condSets": [
        {"condTags": ["自行前往"], "mode": "exclude"},
        {"condTags": ["需搭主辦的車"], "mode": "weight", "weight": 1}],
     "rest": {"mode": "exclude"}},
]

OUTDOOR_MEMBERS = [
    {"id": "m1", "condTags": ["大人", "不喝酒/開車"]},      # 小凱（主辦、開車）
    {"id": "m2", "condTags": ["大人", "需搭主辦的車"]},      # 阿豪
    {"id": "m3", "condTags": ["大人", "吃素", "自行前往"]},  # 小美
    {"id": "m4", "condTags": ["小孩", "需搭主辦的車"]},      # 佳蓉
]

OUTDOOR_COND_TAGS = ["吃素","大人","小孩","晚到","海鮮過敏","不喝酒/開車","自行前往","需搭主辦的車"]
OUTDOOR_ITEM_TAGS = ["肉品","蔬菜","海鮮","主食","水果","甜點","酒精飲品","無酒精飲品",
                    "調味料","烤肉工具","露營工具","免洗餐具","清潔用品","場地費","設備租借費","交通費"]
PY
```

**引擎詞 ↔ API 命名對照表**（api_client.py 內部翻譯）：

| 引擎層（本 fixture、TEST-SCENARIOS）| API 層（doc.json、events.ruleBodyRequest）|
|---|---|
| `itemTag`（rule 上）| `item_tag` |
| `condSets`（陣列）| `groups`（陣列） |
| `condTags`（陣列，within condSet）| `cond_tags`（陣列，within group） |
| `mode`（`"exclude"`\|`"weight"`）| 同 `mode`，欄位位置一致 |
| `weight`（number）| 同 `weight` |
| `rest`（object，同結構）| 同 `rest` |
| item 的 `payer`（string mid）| `payer_member_id`（integer）|
| item 的 `manualMemberIds`（可選）| `manual_member_ids`（陣列 int）|
| item 的 `customAmounts`（可選）| `custom_amounts`（dict[int,int]） |

`api_client.add_rule(event_id, item_tag, groups, rest)` 收 API 層命名的 dict；把 fixture 傳進去前，測試 helper 會做這個轉換。

#### Step 2（20 min）— TDD Z：寫紅色測試 F1-Z-01 / F1-Z-02

**人給指令**（給 Claude / AI 或你自己）：

> 「幫我寫 `tests/unit/test_f1_resolve_weight.py`，包含兩個測試：
> 1. `test_f1_z_01_null_item_tag`：itemTag=None → weight=1，trace.kind='no-rule'
> 2. `test_f1_z_02_item_tag_without_rule`：itemTag='水果'（無規則）→ weight=1，trace.kind='no-rule'
> 使用 pytest；import `tests.support.engine.resolve_weight`（此函式尚未存在，測試會紅）。」

**產出**：

```python
# tests/unit/test_f1_resolve_weight.py
"""F1 resolveWeight — ZOMBIES: Z, O, M, B, I, E"""
import pytest
from tests.support.engine import resolve_weight
from tests.fixtures.outdoor_template import OUTDOOR_RULES

pytestmark = [pytest.mark.unit]

# ---------- Z（Zero）----------
@pytest.mark.zombies_z
def test_f1_z_01_null_item_tag():
    """F1-Z-01 itemTag=None → weight=1, kind='no-rule'"""
    member = {"id": "m1", "condTags": ["吃素"]}
    result = resolve_weight(None, member, OUTDOOR_RULES)
    assert result["weight"] == 1
    assert result["trace"]["kind"] == "no-rule"

@pytest.mark.zombies_z
def test_f1_z_02_item_tag_without_rule():
    """F1-Z-02 itemTag 無對應規則 → kind='no-rule'（不是 'rest'）"""
    member = {"id": "m1", "condTags": ["大人"]}
    result = resolve_weight("水果", member, OUTDOOR_RULES)  # 水果沒有規則
    assert result["weight"] == 1
    assert result["trace"]["kind"] == "no-rule"
```

**執行**：

```bash
pytest tests/unit/test_f1_resolve_weight.py -v
```

**預期**：ImportError（`engine` 不存在）→ **紅色**。

#### Step 3（15 min）— TDD Green：實作最小可過的 `resolve_weight`

**人給指令**：

> 「新增 `tests/support/engine.py`，實作 `resolve_weight(item_tag, member, rules)`，僅處理 Z 兩個案例：
> - `item_tag is None` → return `{"weight": 1, "trace": {"kind": "no-rule"}}`
> - `item_tag not in [r['itemTag'] for r in rules]` → 同上
> 不要多做其他東西（YAGNI）。」

**產出**：

```python
# tests/support/engine.py
"""SPEC-ENGINE v1.1 — Python 移植（純函數、零依賴）"""

def resolve_weight(item_tag, member, rules):
    """SPEC-ENGINE §2 — F1"""
    if item_tag is None:
        return {"weight": 1, "trace": {"kind": "no-rule"}}
    rule = next((r for r in rules if r["itemTag"] == item_tag), None)
    if rule is None:
        return {"weight": 1, "trace": {"kind": "no-rule"}}
    # TODO: cond_sets 比對留到 O 階段
    return {"weight": 1, "trace": {"kind": "no-rule"}}  # 佔位
```

**執行**：

```bash
pytest tests/unit/test_f1_resolve_weight.py -v
```

**預期**：**兩個綠色** ✅。

#### Step 4（30 min）— TDD One：F1-O-01 / F1-O-02

**人給指令**：

> 「加兩個測試：
> - F1-O-01：肉品規則，member.condTags=['吃素','大人'] → weight=0、kind='excluded'、condSetIndex=0、hitCondTags=['吃素']
> - F1-O-02：肉品規則，condTags=['小孩','需搭主辦的車'] → weight=0.5、kind='weighted'、condSetIndex=1、hitCondTags=['小孩']
> 再擴充 resolve_weight，讓它逐一比對 condSets。」

**產出（測試）**：

```python
# 加入 test_f1_resolve_weight.py

@pytest.mark.zombies_o
def test_f1_o_01_hit_first_condset_exclude():
    """F1-O-01 命中肉品第 0 條（吃素→exclude）"""
    member = {"id": "m3", "condTags": ["吃素", "大人"]}
    r = resolve_weight("肉品", member, OUTDOOR_RULES)
    assert r["weight"] == 0
    assert r["trace"]["kind"] == "excluded"
    assert r["trace"]["condSetIndex"] == 0
    assert "吃素" in r["trace"]["hitCondTags"]

@pytest.mark.zombies_o
def test_f1_o_02_hit_second_condset_weight():
    """F1-O-02 命中肉品第 1 條（小孩→0.5）"""
    member = {"id": "m4", "condTags": ["小孩", "需搭主辦的車"]}
    r = resolve_weight("肉品", member, OUTDOOR_RULES)
    assert r["weight"] == 0.5
    assert r["trace"]["kind"] == "weighted"
    assert r["trace"]["condSetIndex"] == 1
```

**跑 → 紅 → 實作（把 resolve_weight 補上 condSets 走訪與 AND 判斷）→ 跑 → 綠**。

#### Step 5（1.5 hour）— 一次補齊 F1-M / B / I / E

**人給指令**：

> 「依 docs/TEST-SCENARIOS.md 的 F1-M-01/M-02、F1-B-01~04、F1-I-01/02、F1-E-01/E-02，
> 幫我把 test_f1_resolve_weight.py 補齊 12 個測試（對應 SPEC §2.4 的 F1-01~14）。
> 然後把 engine.resolve_weight 補完整，讓所有測試通過。」

**驗收**：

```bash
pytest tests/unit/test_f1_resolve_weight.py -v --tb=short
# 預期：12 passed
```

**Checkpoint ✅**：F1 全部綠。

---

### 2.2 下午：F2 `allocate` + F3 `settleRemainder`（3.5 小時）

#### F2（1.5 hour）

**指令模板**（給 Claude / 任 AI 或你自己）：

> 「依 docs/TEST-SCENARIOS.md 的 Feature 2（F2-Z-01/02、F2-O-01、F2-M-01/02、F2-B-01/02、F2-E-01~05），
> 建 `tests/unit/test_f2_allocate.py`，10 個測試以 ZOMBIES 順序。
> 然後在 engine.py 新增 `allocate(detail, members, rules)`，簽章對照 SPEC §3.1；
> 演算法照 SPEC §3.2；重點：
> - 全員 weight=0 → validity='no-participant'（引擎不 throw）
> - 全自訂 Σ<amount → 'custom-mismatch'
> - Σ>amount → 'custom-overflow'
> - 有規則細項的 customAmounts/manualMemberIds 一律被忽略（L14）」

**執行**：

```bash
pytest tests/unit/test_f2_allocate.py -v
# 預期：10 passed
```

#### F3（1.5 hour）

**指令模板**：

> 「依 F3-Z-01/O-01/M-01~M-04/E-01 建 `test_f3_settle_remainder.py` 共 7 個測試（對照 SPEC §4.3）。
> 實作 `settle_remainder(raw, amount, split_order, min_unit=1)`，依 splitOrder 逐位補 minUnit 直到 remainder=0；
> ⭐ **黃金範例**：101 元三人均分、order=[甲,乙,丙] → 甲34、乙34、丙33；甲乙 bonus=1、丙=0」

**執行**：

```bash
pytest tests/unit/test_f3_settle_remainder.py -v
```

**Checkpoint ✅**：F1+F2+F3 = 28 個綠。

#### F0（30 min）— 唯一對外入口

**指令**：

> 「新增 `test_f0_split_detail.py` 對照 SPEC §5.3 的 F0-01~06；
> 實作 `split_detail(detail, members, rules, split_order=None, min_unit=1)`，
> 組裝 F2 → F3 → 回填 trace 的 totalWeight/unitPrice/remainderBonus。
> 特別驗證 F0-02 與 F0-03（L9 護欄——交通費）。」

---

### 2.3 傍晚：H1 + 不變量（2 小時）

#### H1（1 hour）

**指令**：

> 「建 `test_h1_compute_transfers.py`，依 SPEC §6.5 的 H1-01~08 全部寫進去。
> 實作 `compute_transfers(nets, hub_id)`。
> 特別驗證 **H1-02**（主辦淨額=0 但仍代收代付 → 小美/佳蓉→主辦、主辦→阿豪，且 **絕不** 出現小美/佳蓉→阿豪）」

#### 不變量（1 hour）

**指令**：

> 「用 `hypothesis` 建 `test_invariants.py`，四條不變量：
> - INV-01 Σ shares.amount == detail.amount（除 no-participant/custom-*）
> - INV-02 excluded 每人 amount=0 且有 trace
> - INV-03 Σ nets == 0（走訪全部細項）
> - INV-04 有規則細項的 manual/custom 資料無效
> 隨機生成 4~8 位成員、2~10 條細項、金額 1~10000；每條不變量跑 200 個 example。」

**執行**：

```bash
pytest tests/unit -v --tb=short
pytest tests/unit --cov=tests.support.engine --cov-report=term-missing
```

**預期**：**60+ 個測試全綠、engine.py 覆蓋率 ≥ 95%**。

**Day 1 收工 ✅**：分攤引擎完成 SDD。

---

## 3. Day 2：API 契約測試（4 小時） + E2E 骨架（4 小時）

### 3.1 上午：API 契約測試

#### Step 1（30 min）— 建 API client

**指令**：

> 「新增 `tests/support/api_client.py`，包裝 `requests.Session`，方法名嚴格對齊 **真實 doc.json 端點**（無 `/api/v1` 前綴、更新用 PATCH、id 為 integer）：
> 
> **auth**（6）：
> - `auth_google_login(id_token)` → POST /auth/google
> - `auth_join(code, name, email, phone, cond_tags=None, note=None)` → POST /auth/join
> - `auth_get_invitation(code)` → GET /auth/invite/{code}
> - `auth_recover(code, email, phone)` → POST /auth/recover
> - `auth_logout()` → POST /auth/logout
> - `auth_delete_account()` → DELETE /auth/
> 
> **events**（5+1）：
> - `list_events()` → GET /events
> - `create_event(name, template, place=None)` → POST /events
> - `join_event(code, name=None, cond_tags=None, note=None)` → POST /events/join
> - `get_event(event_id)` → GET /events/{id}
> - `update_event_metadata(event_id, name=None, place=None)` → PATCH /events/{id}（template 不可變）
> - `archive_event(event_id)` → POST /events/{id}/archive
> 
> **members**（7）：
> - `list_members(event_id)` → GET /events/{id}/members
> - `add_member(event_id, display, role, tags=None)` → POST /events/{id}/members（role ∈ {"co","member"}）
> - `update_member(event_id, member_id, display=None, role=None, tags=None)` → PATCH（role ∈ {"host","co","member"}，用於升 co）
> - `delete_member(event_id, member_id)` → DELETE
> - `bind_member(event_id, member_id, guest_id)` → POST /events/{id}/members/{member_id}/bind
> - `get_member_role(event_id, member_id)` → GET /events/{id}/members/{member_id}/role
> - `get_member_breakdown(event_id, member_id)` → GET .../breakdown（host only）
> - `get_my_details(event_id)` → GET /events/{id}/me/details
> 
> **items**（5）：⭐ C12 atomic 就是靠 `details[]` 陣列一次送
> - `list_items(event_id)` → GET /events/{id}/items
> - `create_item(event_id, payer_member_id, details, has_receipt=False)` → POST /events/{id}/items
>   - `details`: `[{"name","amount","tag","manual_member_ids"?,"custom_amounts"?,"note"?}, ...]`
> - `get_item(event_id, item_id)` → GET（回傳含 `details[].allocation` = splitengine.SplitResult）
> - `update_item(event_id, item_id, payer_member_id=None, details=None, has_receipt=None)` → PATCH
> - `delete_item(event_id, item_id)` → DELETE
> 
> **rules**（4）：對齊 events.ruleBodyRequest
> - `list_rules(event_id)` → GET
> - `add_rule(event_id, item_tag, groups=None, rest=None)` → POST（**注意 snake_case**：`item_tag` 不是 `itemTag`；`groups` 不是 `condSets`）
> - `update_rule(event_id, rule_id, groups=None, rest=None)` → PATCH
> - `delete_rule(event_id, rule_id)` → DELETE
> 
> **tags**（8）：conds + items 各 4
> - `list_cond_tags/list_item_tags(event_id)` → GET /events/{id}/tags/conds|items
> - `add_cond_tag/add_item_tag(event_id, label)` → POST（events.addLabelRequest）
> - `rename_cond_tag/rename_item_tag(event_id, label, new_label)` → PATCH（原子重命名 + 連動更新引用）
> - `delete_cond_tag/delete_item_tag(event_id, label)` → DELETE（若引用中 → 409）
> 
> **shares / settlement / transfers**（4）：
> - `get_shares(event_id)` → GET /events/{id}/shares（events.sharesResponse）
> - `get_transfers(event_id)` → GET /events/{id}/transfers（含 `hub_id`、`strategy`、`transfers[]`；★L10 驗證來源）
> - `settle_event(event_id)` → POST /events/{id}/settle（驗證並永久凍結；events.validationResponse）
> - `update_settlement_note(event_id, note)` → PATCH /events/{id}/settlement-note（結算前備註）
> 
> **templates + healthz**：
> - `list_templates()` → GET /templates
> - `healthz()` → GET /healthz
> 
> 三角色身分靠 session cookie 或 Bearer token 注入（`GOSPLIT_HOST_COOKIE` / `GOSPLIT_HOST_TOKEN` 等環境變數）；每個方法回傳 `requests.Response`（用 `.ok` / `.status_code` / `.json()` 判斷）。」

#### Step 2（30 min）— Schema 驗證工具

**指令**：

> 「新增 `tests/support/schemas.py`，從 `docs/doc.json`（可用 `GOSPLIT_DOC_JSON` 環境變數覆寫）讀入 definitions，提供 `registry.validate(name, data)` 用 jsonschema Draft7 + RefResolver 驗證。
> 常用 schema 常數放在 `class Schemas`：
> - Auth: `AUTH_GOOGLE_LOGIN_REQ`, `AUTH_JOIN_RESP`, `AUTH_INVITATION_RESP`, `AUTH_ERROR_RESP`
> - Events: `CREATE_EVENT_RESP`, `EVENT_DETAIL_RESP`, `EVENT_LIST_ITEM`, `METADATA_REQ`
> - Members: `CREATE_MEMBER_REQ`, `MEMBER_DTO`, `MEMBERS_RESP`, `ROLE_RESP`, `BIND_MEMBER_REQ`
> - Items: `CREATE_ITEM_REQ`, `ITEM_DTO`, `DETAIL_DTO`, `CREATE_DETAIL_REQ`
> - Rules: `RULE_BODY_REQ`, `RULE_DTO`, `RULES_RESP`, `ADD_LABEL_REQ`
> - Shares/Settle: `SHARES_RESP`, `TRANSFERS_RESP`, `PERSONAL_RESP`, `VALIDATION_RESP`, `SETTLEMENT_NOTE_REQ`
> - SplitEngine: `SE_SHARE`, `SE_TRANSFER`, `SE_SPLIT_RESULT`, `SE_VALIDITY`, `SE_TRACE`
> 找不到 doc.json 時 `available()` 回 False，讓契約測試自己決定 skip 或必要斷言。」

#### Step 3（3 hour）— 分角色打契約測試

**指令**：

> 「依 docs/API-COVERAGE.md 的 7 張表，建 4 個檔案（合併相近端點群）：
> - `test_auth.py`（auth 6 + healthz + templates）
> - `test_events.py`（events 5 + join）
> - `test_members.py`（members 7 + me/details）
> - `test_items_rules_settle.py`（items 5 + rules 4 + tags 8 + shares/settle/transfers 4；含 C12 / L10 / L14 護欄）
> 
> 每個測試包含三個維度：
> 1. **正常回應**：狀態碼 + schema 驗證（`if registry.available(): registry.validate(...)`）
> 2. **未授權**：拿錯角色打 → 401/403
> 3. **邊界／護欄**：例如 items 一筆負金額 → 整張 400（C12）；transfers 每筆含 hub（L10）；已用規則 → 409（L14）
> 
> 打真實環境（`GOSPLIT_API_BASE` 預設為 https://go-backend-api-605450358080.asia-east1.run.app）；用 `sample_event` fixture 建活動並於 teardown 呼叫 `archive_event`。」

**執行**：

```bash
pytest tests/api -v -m api
```

**Checkpoint ✅**：全部 API 端點都被打過至少一次。

---

### 3.2 下午：E2E 骨架 + 主辦人快樂路徑

#### Step 1（30 min）— Playwright 設定 + storage_state

E2E 用 `pytest-playwright` 提供的 `browser` fixture；三角色身分靠 **Playwright storage_state**（不是每次跑 Google OAuth）：先跑一次 `auth_setup.py` 手動登入把 cookie 存下來，之後每次 `context.storage_state=host.json` 直接注入。

`tests/e2e/auth_setup.py`：一次性建立 host/co/member 三份 state 檔

```bash
# 先手動登入主辦（一次即可）
python -m tests.e2e.auth_setup --role host

# 用邀請碼建立協辦與參與者
python -m tests.e2e.auth_setup --role co --invite-code <邀請碼>
python -m tests.e2e.auth_setup --role member --invite-code <邀請碼>
```

`tests/e2e/conftest.py`：讀取三份 state 生成 `host_page` / `co_page` / `member_page` fixture

```python
import os, pytest
from pathlib import Path

BASE_URL = os.getenv("GOSPLIT_UI_BASE", "http://localhost:8000")
STATE_DIR = Path(os.getenv("GOSPLIT_STATE_DIR", "/tmp/gosplit-states"))

@pytest.fixture(scope="session")
def base_url(): return BASE_URL

@pytest.fixture(scope="session")
def host_state_path():
    p = STATE_DIR / "host.json"
    if not p.exists():
        pytest.skip(f"缺 {p}，請先跑 auth_setup.py --role host")
    return str(p)

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

# co_page / member_page 同構
```

#### Step 2（30 min）— Page Object Model

**指令**：

> 「新增 `tests/e2e/pages/` 目錄（**注意路徑**：與 `tests/support/` 分開，因為 POM 是 E2E 專屬），含四個檔案：
> - `login_page.py`：LoginPage（`login_as_host_via_google()`、`join_by_code(code, email, phone)`、`recover_identity(code, email, phone)`）
> - `event_page.py`：EventDashboardPage（`create_event(name, template)`、`open_rules()`、`open_items()`、`click_settle()`、`click_archive()`、`expect_settle_btn_visible/hidden`、`expect_readonly`）+ RulesPage（`add_rule`、`expect_L14_delete_blocked(rule_name)`）
> - `item_and_settle_page.py`：AddItemPage（`add_row(idx, name, amount, item_tag, payer)`、`click_add_more_row()`、`submit_atomic()`、`expect_C12_error_stays_in_form()`、`expect_row_error(idx)`、`expect_L22_zero_weight_warn()`）+ SettlePage（`compute()`、`confirm()`、`expect_transfers_hub_only(host_name)`、`expect_settled_readonly()`）
> 
> 全部用 `page.get_by_test_id(...)`，**不用文字選擇器**——前端要相應加 `data-testid` 屬性。」

**⚠️ 重要提醒**：目前 `Go-Split-main` 前端是純 localStorage 模擬版，還沒接真實 API 也沒加 `data-testid`。跑 E2E 前需請前端補上：
- `data-testid="btn-google-login"`, `btn-create-event`, `btn-add-row`, `btn-submit-atomic`, `btn-settle`, `btn-archive`
- `data-testid="input-event-name"`, `input-invite-code`, `input-email`, `input-phone`, `select-template`, `select-item-tag`, `select-payer`
- `data-testid="tab-rules"`, `tab-items`, `event-list-item`, `item-row-{n}`, `rule-row-{name}`, `my-summary`, `table-transfers`, `banner-readonly`, `banner-settled`, `error-summary`

#### Step 3（3 hour）— 主辦人快樂路徑

`test_host_full_flow.py`（對應 D-1）：

**指令**：

> 「照 docs/MANUAL-TEST-CASES.md D-1 的十步驟，寫 `TestHostFullFlow`（多個小測試比一個超大測試好維護）：
> 1. `test_HOST_E2E_01_create_outdoor_event`：`EventDashboardPage.create_event('SDD-烤肉夜', template='outdoor')` → 驗 settle 按鈕可見
> 2. `test_HOST_E2E_02_add_rules_and_items`：加項目（`AddItemPage.add_row` 三筆 → `submit_atomic`）
> 3. `test_HOST_E2E_03_C12_atomic_reject`：★C12 — 一筆負金額 → `expect_C12_error_stays_in_form()` + `expect_row_error(1)`
> 4. `test_HOST_E2E_04_L14_delete_used_rule`：★L14 — 加項用了規則後嘗試刪規則 → `RulesPage.expect_L14_delete_blocked()`
> 5. `test_HOST_E2E_05_settle_hub_flow`：★L10 — 結算後 `SettlePage.expect_transfers_hub_only(host_name='小凱')`
> 6. `test_HOST_E2E_06_archive_full_readonly`：封存後 `EventDashboardPage.expect_readonly()`
> 
> 每個測試獨立建活動、獨立 archive（fixture teardown）。」

**執行**：

```bash
pytest tests/e2e/test_host_full_flow.py -v --headed --slowmo=200
```

**Checkpoint ✅**：主辦人完整流程通過。

---

## 4. Day 3：協辦、參與者、狀態機、邊界（8 小時）

### 4.1 上午：協辦與參與者流程

**指令**：

> 「依 MANUAL-TEST-CASES.md：
> - Section B（協辦者）→ `test_co_organizer_flow.py`（12 個測試）
> - Section C（參與者）→ `test_participant_flow.py`（10 個測試）
> 用兩個 browser context 模擬：主辦一個 context，協辦另一個 context。
> 用 API client 完成 join（比 UI 快），只用 UI 驗證權限與畫面。」

### 4.2 下午前段：跨角色整合場景

**指令**：

> 「依 MANUAL-TEST-CASES.md Section D（跨角色）建 5 個 E2E 測試：
> - D-1 完整生命週期
> - D-2 L9 護欄回歸
> - D-3 L10 護欄
> - D-4 身分變更款項歸屬
> - D-5 session 找回 + 結帳限制」

### 4.3 下午後段：邊界／異常

**指令**：

> 「依 Section E 建 12 個測試 `test_edge_cases.py`。
> 大部分可用 API 層測（權重輸入、除零、金額異常），少數用 UI 驗證擋存視覺回饋。」

**Checkpoint ✅**：全部 ~65 E2E 測試綠。

---

## 5. 整合：一鍵跑全套（30 min）

### 5.1 執行腳本

`scripts/run-all.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate

echo "▶ 1/4 單元（引擎）"
pytest tests/unit -m unit -v

echo "▶ 2/4 API 契約"
pytest tests/api -m api -v

echo "▶ 3/4 E2E（headless）"
pytest tests/e2e -m e2e -v

echo "▶ 4/4 產覆蓋率"
pytest tests/unit --cov=tests.support.engine --cov-report=html

echo "✅ 全套通過。開 test-report.html 與 htmlcov/index.html 查看。"
```

```bash
chmod +x scripts/setup.sh scripts/run-all.sh
```

### 5.2 CI（可選）

`.github/workflows/tests.yml`（GitHub Actions 例）：

```yaml
name: SDD Tests
on: [push, pull_request]
jobs:
  unit-and-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: pytest tests/unit tests/api -v --tb=short
  e2e:
    runs-on: ubuntu-latest
    needs: unit-and-api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: playwright install --with-deps chromium
      - run: pytest tests/e2e -v
```

---

## 6. 每輪 SDD × TDD 的通用指令範本

**給執行者（Claude Code 用）**——每個 feature 都可套此範本：

### 範本 A：新增一個測試 + 讓它綠

```
[人下指令]
1. 讀 docs/TEST-SCENARIOS.md 的 <Feature X, Scenario X-Y-Z>
2. 在 tests/unit/test_<feature>.py 新增測試 test_<feature>_<yz>_<name>
   - 只斷言 Scenario 的 Then 子句
   - import 尚未存在的函式 → 保證紅
3. 跑 pytest tests/unit/test_<feature>.py::test_<feature>_<yz>_<name> -v
4. 若紅 → 在 tests/support/engine.py 補最小可過的實作
5. 再跑一次
6. 若綠 → 若可能，重構（DRY、命名），再跑一次

[給 AI 的 Prompt 範本]
「請幫我完成 SDD 一輪：
- 情境：<貼 Scenario Given/When/Then>
- 檔案：<檔名>
- 現況：<engine.py 目前有的函式簽章>
- 要做：紅 → 綠 → （重構）」
```

### 範本 B：跑完一批、產報告

```
pytest tests/unit -v --html=reports/unit.html --self-contained-html
pytest tests/api -v --html=reports/api.html --self-contained-html
pytest tests/e2e -v --html=reports/e2e.html --self-contained-html
```

### 範本 C：找出未覆蓋的規格

```
# 用 pytest -k 篩選對應 marker
pytest -m "zombies_e" -v          # 只看異常類
pytest -m "not zombies_s" --collect-only  # 看未包含 Simple 的
pytest --collect-only -q | wc -l  # 案例總數
```

---

## 7. 三日檢查表（人肉勾一勾）

### Day 1（引擎）— 交付：60+ 單元測試綠

- [ ] `tests/fixtures/outdoor_template.py` 建立
- [ ] `tests/support/engine.py` 五函式完成
- [ ] F1 12 案例綠
- [ ] F2 10 案例綠
- [ ] F3 7 案例綠
- [ ] F0 6 案例綠
- [ ] H1 8 案例綠
- [ ] 不變量 4 條綠（hypothesis 各 200 example）
- [ ] `pytest tests/unit --cov` ≥ 95%
- [ ] git commit `feat: engine implementation with ZOMBIES-TDD (60 tests)`

### Day 2（API）— 交付：30+ 契約測試綠 + E2E 骨架

- [ ] `tests/support/api_client.py` 完成（對齊 doc.json 全部 42 端點）
- [ ] `tests/support/schemas.py` 完成（讀 docs/doc.json）
- [ ] `tests/api/test_auth.py` 綠（auth 6 + healthz + templates）
- [ ] `tests/api/test_events.py` 綠（events 5 + join）
- [ ] `tests/api/test_members.py` 綠（members 7 + me/details）
- [ ] `tests/api/test_items_rules_settle.py` 綠（items 5 + rules 4 + tags 8 + shares/settle/transfers 4）
- [ ] `test_C12_atomic_reject_all_on_one_bad` 綠（★ C12 護欄）
- [ ] `test_get_transfers_hub_only` 綠（★ L10 護欄，含 `hub_id` 斷言）
- [ ] `tests/e2e/auth_setup.py` 完成 → 三份 storage_state 檔就位
- [ ] Playwright POM 三份就位（`login_page.py`, `event_page.py`, `item_and_settle_page.py`）
- [ ] 主辦人快樂路徑 6 個 E2E 綠
- [ ] git commit `feat: api contract aligned to doc.json + host e2e happy path`

### Day 3（E2E 完整）— 交付：65+ E2E 綠

- [ ] 協辦者 12 案例綠
- [ ] 參與者 10 案例綠
- [ ] 跨角色 5 大場景綠
- [ ] 邊界／異常 12 案例綠
- [ ] `scripts/run-all.sh` 全綠
- [ ] `docs/MANUAL-TEST-CASES.md` 15 項回歸勾選單人肉走一遍
- [ ] 產出 HTML 報告
- [ ] git commit `feat: full e2e coverage + manual checklist`

---

## 8. 常見問題（FAQ）

### Q1：測試綠了但真實環境還是壞

- 引擎綠：試 `pytest tests/unit`。若綠 → **引擎正確、UI 或 API 有 bug**。
- API 綠：試 `pytest tests/api`。若紅 → 後端不合規。
- E2E 紅、其他綠：**前端 UI 有 bug**（例如沒接分攤引擎的 validity）。

### Q2：某條規格與程式碼行為不同（正如 §13.2 的 L4 / L8 / L10）

- 這就是 SDD 的價值：**測試會逼你先討論規格**。
- 先確認 PRD 定案為準，開 issue 記錄 delta，暫時 mark 該測試為 `xfail(reason='L10 待收斂')`。

### Q3：Google OAuth 難以自動化

- 兩條路：
  1. 後端提供 `POST /testing/mint-token`（僅測試環境）→ 直接發 Google-like id_token。
  2. 用 Playwright 的 storage state：預先手動登入一次、存下 cookie / localStorage、之後 `context.storage_state=...` 直接注入。

### Q4：資料庫怎麼隔離？

- 每個活動 seed 於 fixture 的 `setup`、teardown 呼叫 `DELETE /events/{id}`。
- 或後端提供 `/testing/reset` 端點。

### Q5：測試跑很慢怎麼辦

- 單元測試永遠 < 1 秒
- API 測試用 `pytest -n auto`（xdist 平行）
- E2E 分快樂路徑（每次跑）與完整場景（Nightly）

---

## 9. ⭐ 一鍵起手式（給你複製貼上）

```bash
# 1. clone / cd 到工作目錄
mkdir -p ~/projects/gosplit-sdd && cd ~/projects/gosplit-sdd

# 2. 把本專案裡的 docs/、scripts/、pytest.ini、requirements.txt 複製過來
#    （或用 git clone）

# 3. 環境
bash scripts/setup.sh
source .venv/bin/activate

# 4. Day 1 起手：寫第一個紅測試
mkdir -p tests/fixtures tests/support tests/unit
# 貼 outdoor_template.py（見 §2.1 Step 1）
# 寫 test_f1_resolve_weight.py 的 Z 兩個測試
pytest tests/unit -v         # 應該紅

# 5. Day 1 綠：實作 engine.resolve_weight
# 貼最小可過實作
pytest tests/unit -v         # 應該綠

# 6. 接著跟著本檔 §2 一路走完
```

---

## 10. 交付清單（結束時你會有）

```
gosplit-sdd/
├─ README.md
├─ docs/
│  ├─ TEST-SCENARIOS.md       (~ 500 個 Given/When/Then)
│  ├─ MANUAL-TEST-CASES.md    (~ 61 手動案例 + 15 項回歸)
│  ├─ API-COVERAGE.md         (43 端點覆蓋矩陣)
│  └─ SCHEDULE.md             (本檔)
├─ tests/
│  ├─ unit/                   (60+ pytest 單元測試 → 引擎)
│  ├─ api/                    (40+ pytest 契約測試 → 端點)
│  ├─ e2e/                    (65+ Playwright E2E → 三角色流程)
│  ├─ fixtures/               (烤肉模板、personas)
│  └─ support/                (engine.py + api_client.py + POM)
├─ scripts/                   (setup / run-all)
├─ requirements.txt
├─ pytest.ini
└─ .github/workflows/         (CI，可選)
```

**產出量**：約 165+ 個自動測試 + 61 個手動案例 + 15 項回歸勾選單。

---

*本規劃表結束。祝順利。*
