# 分帳吧（Go-Split）測試操作手冊

> **本手冊分兩部分**：
> - **【基礎】給一般 RD**：起環境、跑測試、看結果、解讀 xfail
> - **【進階】給 QA / 測試工程師**：POM 風格、新增測試、fixture 設計、除錯技巧

**測試框架版本**：SDD × ZOMBIES-TDD v1.0
**專案位置**：`D:\site-project\Go-Split\`（Windows 11 + Python 3.14 + Git Bash）

---

# 目錄

- [基礎篇](#基礎篇)
  - [1. 一次性環境設定](#1-一次性環境設定)
  - [2. 起前端 + 跑測試](#2-起前端--跑測試)
  - [3. 解讀測試結果](#3-解讀測試結果)
  - [4. 常見錯誤與解法](#4-常見錯誤與解法)
- [進階篇](#進階篇)
  - [5. 測試框架架構](#5-測試框架架構)
  - [6. POM 撰寫風格](#6-pom-撰寫風格)
  - [7. 新增測試方法](#7-新增測試方法)
  - [8. Fixture 設計](#8-fixture-設計)
  - [9. 除錯技巧](#9-除錯技巧)
  - [10. 命名體系](#10-命名體系)

---

# 基礎篇

適合：**只要能跑測試、看懂結果的 RD**

## 1. 一次性環境設定

### 1.1 需要什麼

- **Python 3.14+**（本專案用 3.14.5 驗證過）
- **Git Bash**（Windows 上跑指令的 shell）
- **Chrome 或 Chromium**（Playwright 自動安裝，不需事先裝）

### 1.2 首次設定步驟

在 Git Bash 執行：

```bash
# 1. 進專案目錄
cd /d/site-project/Go-Split

# 2. 建虛擬環境
python -m venv .venv

# 3. 啟動虛擬環境（Windows Git Bash 用 Scripts 而非 bin）
source .venv/Scripts/activate

# 4. 安裝相依套件
pip install -r requirements.txt

# 5. 安裝 Playwright 瀏覽器
playwright install chromium
```

### 1.3 中文亂碼修正（Windows Git Bash 必做）

執行完設定後，加這段到 `~/.bashrc` 讓中文正常顯示：

```bash
cat >> ~/.bashrc << 'EOF'

# UTF-8 for Python & pytest output
export PYTHONIOENCODING=utf-8
export LANG=zh_TW.UTF-8
export LC_ALL=zh_TW.UTF-8

# Windows console 用 UTF-8 codepage
if command -v chcp.com &> /dev/null; then
    chcp.com 65001 > /dev/null 2>&1
fi
EOF

source ~/.bashrc
```

未來每次開新 Git Bash 都會自動生效。

### 1.4 驗證環境

```bash
# 應該顯示 Python 3.14.x
python --version

# 應該顯示 pytest 9.x 且看到 playwright plugin
pytest --version

# 跑單元測試驗證環境
pytest tests/unit -q
```

**預期**：`48 passed in ...`

## 2. 起前端 + 跑測試

### 2.1 每次開發流程

**每次開始工作**都要做這兩件事：

```bash
# 視窗 A：起前端 HTTP server（保持開著！關了就沒服務）
cd /d/site-project/Go-Split
python -m http.server 8000

# 視窗 B：啟動 venv 跑測試（新開一個視窗）
cd /d/site-project/Go-Split
source .venv/Scripts/activate
```

### 2.2 跑不同層次的測試

在**視窗 B**執行：

```bash
# 只跑單元測試（引擎邏輯，最快）
pytest tests/unit -v

# 只跑 API 契約測試（需要 httpx 打後端）
pytest tests/api -v

# 只跑 E2E 測試（需要前端起、Playwright 開 Chromium）
pytest tests/e2e -v

# 跑全部
pytest -v
```

### 2.3 跑特定測試檔

```bash
# 只跑主辦全生命週期
pytest tests/e2e/test_host_full_lifecycle.py -v

# 只跑協辦者流程
pytest tests/e2e/test_co_organizer_journey.py -v
```

### 2.4 跑特定測試方法

```bash
# 跑特定測試（用 `::` 分層）
pytest tests/e2e/test_a_zone_entry_flow.py::TestA_zone_all_paths_converge_to_home::test_A_zone_host_after_login_lands_on_home -v
```

### 2.5 遇到 fail 就停

跑一整批測試時，若不想等後面全部跑完：

```bash
# -x = fail-fast，遇第一個 fail 就停
pytest tests/e2e -v -x
```

### 2.6 看 HTML 報告

跑完測試會在 `reports/` 產生 HTML 報告：

```bash
# 開報告（Windows）
start reports/e2e.html
```

或直接用瀏覽器開啟 `D:\site-project\Go-Split\reports\e2e.html`。

## 3. 解讀測試結果

### 3.1 五種可能的訊號

| 訊號 | 顏色 | 意義 | 你要做什麼 |
|---|---|---|---|
| **PASSED** | 綠 | 測試通過 | 什麼都不用做 ✅ |
| **FAILED** | 紅 | 測試失敗 | 看 traceback、看是不是你的改動造成 |
| **ERROR** | 紅 | 環境錯誤 | 看是不是沒起前端、fixture 掛掉 |
| **SKIPPED** | 黃 | 主動跳過 | 看 reason，理解為何 skip |
| **XFAIL** | 黃 | 預期失敗 | 看 reason，這是**規格與實作有落差**的訊號 |
| **XPASS** | 紅（strict）| 預期失敗但通過了 | ⚠️ 表示規格已補齊，去移除 `@pytest.mark.xfail` 標記 |

### 3.2 xfail 三種意義（重要）

看 xfail 的 reason 分辨屬於哪類：

**類型 A：規格與實作落差**（給 RD 改）
```
★規格與實作落差：C17 R1 要求「邀請碼真實查驗有效性」，
但 prototype (app.js joinByCode L680-690) 不做邀請碼驗證...
```
→ 到 `TODO-FOR-RD.md` 查對應項目。

**類型 B：POM 待實作**（給 QA 補測試碼）
```
★POM 待實作：MemberSettingsPage.promote_member_to_co_host 目前為 pass 空實作
```
→ 補 POM 方法後測試自動轉綠。

**類型 C：前端 selector 未就緒**（給前端加 test-id）
```
POM 待實作：進封存活動後點選 sidebar「分帳產出」查看四維度
```
→ 前端補 data-testid 或 data-fk 後可 POM 化。

### 3.3 一個具體例子

```
tests/e2e/test_g_zone_recording_flow.py::TestG_zone_N15_N17_N20_atomic_commit_failure::test_G_zone_C12_one_bad_detail_rejects_entire_card XFAIL

XFAIL - ★規格與實作落差：C12 要求「一筆錯 → 整張退回」，
但 prototype (app.js L1079-1082) 對 amount 只擋空字串與非數字字元，
接受 0 為合法值。後端接入引擎規則後（L22 除零檢查）可轉為 pass。
```

**判讀**：
1. **類型**：規格與實作落差（給前端 / 後端 RD）
2. **證據**：`app.js L1079-1082`（可以直接去看程式碼）
3. **修法**：`TODO-FOR-RD.md` P0-1 有詳細建議

## 4. 常見錯誤與解法

### 4.1 「前端 http://localhost:8000 未啟動或不可達」

**原因**：忘記起前端 HTTP server。

**解法**：
```bash
# 在另一個視窗
cd /d/site-project/Go-Split
python -m http.server 8000
```

### 4.2 「AttributeError: 'FormDraftPage' object has no attribute 'add_detail_row_and_fill_it'」

**原因**：POM 檔案沒同步更新。

**解法**：
```bash
# 檢查該 method 存不存在
grep -c "add_detail_row_and_fill_it" tests/e2e/pages/form_draft_page.py
# 應該回傳 >= 1
```
不存在 → 重新從最新的變更下載該 POM 檔案覆蓋。

### 4.3 「strict mode violation: get_by_role('button', name='X') resolved to 2 elements」

**原因**：兩個元素有相同名字。

**解法**：POM 內加 `exact=True` 或改用 `.locator("button.specific-class").filter(has_text='X')`。

### 4.4 「element is not visible」

**原因**：元素在 DOM 內但被 CSS 隱藏（例如 mobile hamburger 在 desktop 視窗下）。

**解法**：檢查是不是用了「桌面/手機兩份 markup」的 selector（例如 `.hamburger` vs `.sidebar-item`），改用 desktop 對應的。

### 4.5 「TimeoutError: Locator.click: Timeout 30000ms exceeded」

**原因**：selector 找不到、或元素還沒 render 完。

**解法**：
1. 用 `--headed` 開真瀏覽器看實際發生什麼
2. 檢查 selector 是否對應到 prototype 的實際 DOM

### 4.6 中文顯示成 `▒`

**原因**：Git Bash codepage 不是 UTF-8。

**解法**：見 [1.3 中文亂碼修正](#13-中文亂碼修正windows-git-bash-必做)

---

# 進階篇

適合：**要維護測試框架、新增測試、寫 POM 的 QA / 測試工程師**

## 5. 測試框架架構

### 5.1 三層測試金字塔

```
       E2E (Playwright)
      ─────────────
       53 tests、35 綠
       跑最慢、覆蓋最全
     
      API 契約 (httpx)
     ─────────────────
       53 tests、10 綠
       中速、驗規格對齊實作
       
       單元 (pytest)
      ──────────────
       48 tests、48 綠
       跑最快、驗引擎邏輯
```

### 5.2 目錄結構

```
tests/
├── unit/                    # 單元測試（引擎邏輯）
│   ├── test_engine_f0.py
│   ├── test_engine_h1.py
│   ├── test_invariants.py   # Hypothesis 屬性測試
│   └── ...
├── api/                     # API 契約測試
│   ├── test_auth.py
│   ├── test_events.py
│   ├── test_items_rules_settle.py
│   └── conftest.py          # httpx client fixture
├── e2e/                     # E2E Playwright 測試
│   ├── conftest.py          # 三角色 fixture
│   ├── roleswitch_helper.py # persona 切換
│   ├── pages/               # POM（Page Object Model）
│   │   ├── entry_page.py
│   │   ├── home_page.py
│   │   ├── event_dashboard_page.py
│   │   ├── form_draft_page.py
│   │   ├── rules_page.py
│   │   ├── member_settings_page.py
│   │   └── settlement_page.py
│   ├── test_a_zone_entry_flow.py
│   ├── test_co_organizer_journey.py
│   └── ...
├── support/                 # 引擎 helper
│   ├── engine.py
│   ├── api_client.py
│   └── schemas.py
└── fixtures/                # 測試資料
    └── outdoor_template.py
```

### 5.3 `pytest_collection_modifyitems`

`conftest.py`（專案根）根據目錄自動打 marker：

- `tests/unit/*` → `@pytest.mark.unit`
- `tests/api/*` → `@pytest.mark.api`
- `tests/e2e/*` → `@pytest.mark.e2e`

跑 `pytest -m e2e` 只跑 e2e 測試。

## 6. POM 撰寫風格

### 6.1 三層 Locator 策略

依穩定性從高到低：

```python
# 優先 1：data-fk（prototype 內建的 focus key，最穩）
self.name_input = page.locator("[data-fk='draft-name-1']")

# 優先 2：get_by_role + exact（accessibility 導向）
self.login_button = page.get_by_role("button", name="登入", exact=True)

# 優先 3：CSS class + text filter（兜底）
self.sidebar_settle = page.locator("button.sidebar-item").filter(has_text="分帳產出")
```

**避免用**：
- 純 CSS class 沒 filter：容易撞到不相關的 button
- `nth-child(N)`：DOM 順序改就爆
- 文字位置依賴：多語系或改文案就爆

### 6.2 Card-scoped 相對定位（重要）

當一個 element 可能在多張 card 出現時，**必須先定位 card 再往內找**：

```python
# ❌ 不好：全頁範圍找「儲存」button，可能撞到「活動編輯」的儲存
self.page.locator("button[title='儲存']").click()

# ✅ 好：先定位 member card，再找該 card 內的儲存
member_card = self.page.locator("div.card.card-pad").filter(
    has=self.page.locator(f"[data-fk='member-name-{name}']")
).first
member_card.locator("button[title='儲存']").click()
```

### 6.3 隱藏 prototype 特殊行為

POM 應該對測試碼**隱藏 prototype 怪癖**。例如：

**Prototype LIFO 陷阱**：新增細項是 unshift 到最前面

```python
# ❌ 測試碼要處理 LIFO 順序（易錯）
form.click_add_another_detail_row()
form.fill_detail_row_at_index(0, "A", 100)  # A 現在 no=1
form.click_add_another_detail_row()
form.fill_detail_row_at_index(1, "B", 200)  # B 在 no=1、A 變 no=2
form.fill_detail_row_at_index(1, "A_update", 150)  # 要記得 A 變 no=2 才對

# ✅ POM 隱藏 LIFO
form.add_detail_row_and_fill_it("A", 100)  # POM 內部處理 no=1
form.add_detail_row_and_fill_it("B", 200)  # POM 內部處理新 no=1
```

### 6.4 斷言方法用 `expect_*` 前綴

```python
class HomePage:
    def expect_on_home_page(self) -> None:
        expect(self.home_marker).to_be_visible()
    
    def expect_create_event_button_hidden_for_non_host(self) -> None:
        expect(self.create_event_button).not_to_be_visible()
```

## 7. 新增測試方法

### 7.1 命名格式

**強制格式**：`test_<PRD功能區>_<UML節點>_<業務語意>`

```python
# ✅ 好的名字
def test_G_zone_N15_atomic_commit_rejects_all_on_one_bad_detail_C12(self, host_event_page):
    """★C12 核心測試：一筆錯 → 整張退回 → 停留原頁 → 內容保留"""

# ❌ 不好的名字
def test_add_item(self, page):  # 沒說是哪個角色、什麼場景、驗什麼
```

### 7.2 docstring 該寫什麼

```python
def test_H_zone_N19_confirm_dialog_shows_irreversible_warning(self, host_event_page):
    """★§11 J 區補強：確認框明示「不可還原」
    
    對應 UML N19 判斷菱形的確認分支。
    """
```

### 7.3 完整測試模板

```python
import pytest
from tests.e2e.pages.event_dashboard_page import EventDashboardPage
from tests.e2e.pages.settlement_page import SettleH1Page


class TestH_zone_N19_confirmation_dialog:
    """N19 確認結帳判斷菱形"""

    def test_H_zone_N19_confirm_dialog_shows_irreversible_warning(
        self, host_event_page  # ← 用對應 fixture
    ):
        """★§11 J 區補強：確認框明示「不可還原」"""
        # Arrange
        dashboard = EventDashboardPage(host_event_page)
        dashboard.click_settle_h1_produce_settlement()
        
        settle = SettleH1Page(host_event_page)
        
        # Act
        settle.click_confirm_settlement_open_dialog()
        
        # Assert
        settle.expect_irreversible_warning_shown_in_dialog()
```

### 7.4 xfail 三種標法

**類型 A：規格與實作落差**

```python
@pytest.mark.xfail(
    reason=(
        "★規格與實作落差：C11 要求「多筆錯誤逐一顯示 + 頂部筆數摘要」，"
        "同 C12 的根源——prototype 不擋 amount=0..."
    ),
    strict=True,
)
def test_G_zone_C11_multiple_bad_details_all_shown_with_count_summary(self, host_event_page):
    ...
```

**類型 B：POM 待實作（用 skip，不用 xfail！）**

當 POM 為 `pass` 空實作、測試會「意外通過」，用 `xfail(strict=True)` 會變 XPASS 反標為 fail。改用 skip：

```python
@pytest.mark.skip(
    reason=(
        "POM 待實作：TransfersH3Page.expect_archive_confirmation_shows_"
        "irreversible_only 目前為 pass 空實作..."
    )
)
def test_J_zone_N27_archive_confirm_dialog_shows_irreversible_only(self, host_settled_event_page):
    ...
```

**類型 C：規格明確要求但實作沒對齊（會真 fail 的斷言）**

```python
@pytest.mark.xfail(
    reason="★POM 待實作：RulesPage.open_add_rule_dialog 目前為 pass 空實作...",
    strict=True,
)
def test_F_zone_N13_add_rule_for_food_expense(self, host_event_page):
    ...
    rules.open_add_rule_dialog()  # pass
    rules.expect_rule_in_list(item_tag="食材")  # ← 這裡會真 fail (rule 沒真建)
```

## 8. Fixture 設計

### 8.1 三角色 × 三場景 = 9 個 fixture

```python
# 只到 home 頁
host_page       # 主辦（帳號登入）
co_page         # 協辦（免帳號、非初次）
member_page     # 參與者（免帳號、非初次）

# 進活動 dashboard（未結帳）
host_event_page       # 進「公司烤肉聚會」
co_event_page         # 進「沖繩四天三夜」
member_event_page     # 進「週末露營裝備分攤」

# 進活動 dashboard（已結帳）
host_settled_event_page       # 進「系友會春酒」
co_settled_event_page         # 進「同事送別會」
member_settled_event_page     # 進「羽球團月底結算」
```

### 8.2 fixture 的 helper 函數

```python
def _enter_first_event_matching_role(page, role_pill_text: str):
    """依角色 pill 找對應第一張活動"""
    event_cards = page.locator("button.card, button.card-pad").filter(
        has_text=role_pill_text
    )
    event_cards.first.click()
    expect(
        page.locator("text=/款項現況|群組人員|尚無款項/").first
    ).to_be_visible(timeout=5_000)
```

**設計原則**：
- Fixture 應該幫測試「先走到需要的起始狀態」
- 起始狀態的 marker（例如「款項現況」）用來確認 fixture 完成
- 如果 marker 沒等到、fixture 自己 fail（測試才不會誤以為斷言失敗）

### 8.3 為什麼不用 storage_state

Prototype 是純 in-memory state 的 SPA、localStorage 不存 session。每次 reload 頁面就回到 `screen: 'login'`。

因此**傳統的「登入一次、存 storage_state、之後跳過登入」策略對這個 prototype 無效**。改用：

**roleswitch 策略**：利用 prototype 內建的「原型檢視身份」DEV 面板，兩點鐘完成 persona 切換。

## 9. 除錯技巧

### 9.1 Headed 模式眼見為憑

```bash
pytest tests/e2e/test_g_zone_recording_flow.py::TestG_zone_N14_form_draft::test_G_zone_N14_add_multiple_detail_rows --headed --slowmo=500 -s
```

**參數說明**：
- `--headed`：開真瀏覽器
- `--slowmo=500`：每動作放慢 500ms
- `-s`：不吃 print，看得到 debug log

### 9.2 只看錯誤行、濾掉 aria snapshot

```bash
pytest tests/e2e/test_XXX.py --tb=short 2>&1 | grep -E "^E |^tests|Error:|Timeout"
```

當 aria snapshot 塞滿螢幕看不到真訊息時、用這條指令。

### 9.3 印當前 DOM

在 POM 或測試碼加：

```python
print(self.page.content())  # 印整個 HTML
print(self.page.locator("div.card").all_text_contents())  # 印所有 card 內容
```

### 9.4 Playwright 自帶的 debug

```bash
PWDEBUG=1 pytest tests/e2e/test_XXX.py::test_YYY
```

會開 Playwright Inspector，可以逐步 step 看每個 locator。

### 9.5 檢查 selector 命中數

```python
count = self.page.locator("button[title='儲存']").count()
print(f"Found {count} save buttons")  # 若 > 1、要限縮 selector
```

## 10. 命名體系

### 10.1 三段命名格式

**`test_<PRDzone>_<UMLnode>_<業務語意>`**

範例：`test_G_zone_N15_atomic_commit_rejects_all_on_one_bad_detail_C12`

- `G_zone` → PRD §4 記帳功能區
- `N15` → UML 節點 N15 整筆提交 Atomic Commit
- `atomic_commit_rejects_all_on_one_bad_detail` → 業務語意
- `C12` → PRD 條款 C12（可選）

### 10.2 PRD 功能區代號對照

| 代號 | PRD 章節 | UML 節點 | 內容 |
|---|---|---|---|
| A | §6 | N01-N04 | 進入頁面 |
| B | §7 | N06 | 活動列表 Home |
| C | §8 | N05 | 邀請/加入流程 |
| D | §9 | N08-N09 | 活動主頁 + 角色權限 |
| E | §10 | N10 | 群組人員設定 |
| F | §3 | N13 | 分攤規則 |
| G | §4 | N12-N15 | 記帳/新增款項 |
| H | §5 | N16-N24 | 結算全流程 |
| J | §11 | N26-N28 | 封存流程 |
| K | §11.5 | N07 | 情境模板 |

### 10.3 UML 節點對照

| 節點 | 名稱 | 對應 prototype screen |
|---|---|---|
| N01 | 開啟系統 | — |
| N02 | Session 檢查 | — |
| N03 | 進入頁 | `login` |
| N04a | Google OAuth（帳號登入 tab）| `login` |
| N04b | 邀請碼加入 | `login`（另 tab）|
| N04c | 三資料找回 | 未實作 |
| N06 | 活動列表 Home | `home` |
| N07 | 建立活動 | `create` |
| N08 | Event Dashboard | `event` |
| N09 | 角色判斷（非 screen）| — |
| N10 | 群組人員設定 | `group` |
| N11 | 參與者唯讀 | `event`（member 視角）|
| N12 | 點記帳 | — |
| N13 | 規則設定 | `rules` / `rulesEdit` |
| N14 | Form Draft | `addItem` |
| N15 | Atomic Commit | `addItem` submit 動作 |
| N16 | Settle H1 | `settle` |
| N18 | Hub L10 | `settle`（計算）|
| N19 | 確認結帳 dialog | `settle`（dialog）|
| N22 | 結帳後 H2 | `settledEvent` |
| N23 | 個人收支 | `settledEvent`（section）|
| N24 | 付款流向 H3 | `payments` |
| N25 | 平台外繳款 | 無 UI（C31）|
| N26 | 結清活動 | `payments`（button）|
| N27 | 封存 | `home`（archived flag）|
| N28 | 完全唯讀 | `archived` |

### 10.4 為什麼用這種命名

**優點**：
- 一眼看出**該測試對應哪個 PRD 條款、UML 節點、業務動作**
- 團隊三方（PM / 前端 / 測試）都能對到同一參考點
- 「規格→測試→實作」形成明確的 traceable trace

**缺點**：
- 名字長（可讀性降低）
- 新人需要先看命名手冊

---

# 附錄

## A. 一頁備忘 Cheat Sheet

```bash
# ── 每天開工 ──────────────────────────────
cd /d/site-project/Go-Split
source .venv/Scripts/activate
python -m http.server 8000 &   # 起前端

# ── 跑測試 ────────────────────────────────
pytest -v                          # 全套
pytest tests/unit -v               # 只單元
pytest tests/e2e -v -x             # E2E fail-fast
pytest tests/e2e/test_XXX.py::TestClass::test_method -v --headed  # 單一測試 headed

# ── 常用診斷 ──────────────────────────────
pytest --tb=short 2>&1 | tail -20                    # 短堆疊
PWDEBUG=1 pytest tests/e2e/test_XXX.py::test_YYY    # Playwright Inspector

# ── 收工 ─────────────────────────────────
kill %1                            # 關 http.server
deactivate                         # 退出 venv
```

## B. 相關文件

- `TODO-FOR-RD.md` — 給 RD 的待實作清單
- `docs/SCHEDULE.md` — UML × PRD 對照 + 實作進度
- `docs/TEST-SCENARIOS.md` — 每個測試對應的規格
- `docs/API-COVERAGE.md` — API 契約覆蓋率
- `README.md` — 專案總覽

## C. 版本資訊

**測試框架版本**：v1.0
**適用 PRD 版本**：v0.16
**適用 SPEC-ENGINE 版本**：v1.1
**適用 doc.json 版本**：Swagger 2.0

**維護者**：QA / 測試工程師
**問題回報**：如發現本手冊與實際狀況不符、請開 issue 標註 `doc-drift`
