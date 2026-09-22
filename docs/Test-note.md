# 分帳吧（Go-Split）— SDD × ZOMBIES-TDD 測試方案

> **對應版本**：PRD v0.16、SPEC-ENGINE v1.1、Go-Split Backend API（Swagger 2.0）
> **方法論**：Spec-Driven Development（SDD） + ZOMBIES-TDD + Gherkin BDD
> **範圍**：R1 / MVP，涵蓋分攤引擎、三角色權限、記帳、結算、付款流向、封存全流程

---

## 0. ZOMBIES-TDD 是什麼？為什麼採用？

ZOMBIES 是 James Grenning 提出的 TDD 案例順序心法。**先寫最簡單、最能立即回饋的案例，把複雜性留到最後**——與本專案「分攤引擎純函數 + 三條紀律」的架構天然契合。

| 字母 | 意義 | 對應本專案 |
|:---:|------|-----------|
| **Z** | **Zero** 空集合／零值 | 空成員、空細項、金額 0、`validity='no-participant'`（L22） |
| **O** | **One** 單一元素 | 一位成員均分、一筆細項、一條規則 |
| **M** | **Many** 多元素 | 四人烤肉、六條規則、多筆轉帳 |
| **B** | **Boundaries** 邊界 | 權重 0.1／100、金額 1、尾差 ±1、`minUnit` |
| **I** | **Interfaces** 介面 | `splitDetail` 唯一入口、API 端點、UI 三角色 |
| **E** | **Exceptions** 異常 | 除零、custom-mismatch、custom-overflow、403／409／422 |
| **S** | **Simple scenarios / Solution** 完整場景 | 烤肉模板端到端、L10 主辦中心 |

**寫測試的順序**：Z → O → M → B → I → E → S。**永遠先寫最簡單的紅色測試，再寫實作讓它變綠。**

---

## 1. 目錄結構

```
gosplit-sdd/
├─ README.md                       ← 本檔（總索引）
├─ docs/
│  ├─ TEST-SCENARIOS.md            ← 全部 Gherkin 情境（Given/When/Then）
│  ├─ MANUAL-TEST-CASES.md         ← 手動測試案例（三角色 × 全流程）
│  ├─ API-COVERAGE.md              ← doc.json 端點對應測試矩陣
│  └─ SCHEDULE.md                  ← ⭐ 時辰規劃表（人機分工）
├─ tests/
│  ├─ unit/                        ← Python + pytest（引擎純函數）
│  │  ├─ conftest.py
│  │  ├─ test_f1_resolve_weight.py
│  │  ├─ test_f2_allocate.py
│  │  ├─ test_f3_settle_remainder.py
│  │  ├─ test_f0_split_detail.py
│  │  ├─ test_h1_compute_transfers.py
│  │  └─ test_invariants.py
│  ├─ e2e/                         ← Python + Playwright（三角色 UI 流程）
│  │  ├─ conftest.py
│  │  ├─ test_host_full_flow.py
│  │  ├─ test_co_organizer_flow.py
│  │  ├─ test_participant_flow.py
│  │  └─ test_settlement_flow.py
│  ├─ fixtures/
│  │  ├─ outdoor_template.py       ← 烤肉/露營模板 fixture
│  │  └─ personas.py               ← 小凱、阿豪、小美、佳蓉
│  ├─ support/
│  │  ├─ engine.py                 ← Python 版分攤引擎（照 SPEC-ENGINE 移植）
│  │  ├─ api_client.py             ← Go-Split API client wrapper
│  │  └─ pages/                    ← Playwright Page Object Model
│  └─ manual/
│     └─ CHECKLIST.md              ← QA 手動勾選單
├─ scripts/
│  ├─ setup.sh                     ← 一鍵環境安裝
│  └─ run-all.sh                   ← 一鍵跑全套
├─ requirements.txt
└─ pytest.ini
```

## 1.5 原始素材放哪裡？測試專案怎麼引用？

本測試專案**不動**你上傳的原始素材（PRD、SPEC-ENGINE、UML、Go-Split-main、doc.json）——它們是「規格來源」，只被讀取、不被改寫。三種放法擇一：

| 放法 | 適用情境 | 引用方式 |
|---|---|---|
| **A. 放進 `docs/`（推薦）** | 想讓測試專案自包含、CI 直接跑 | `cp doc.json gosplit-sdd/docs/doc.json`，schema 驗證預設從此讀 |
| **B. 放在專案外，環境變數指向** | 素材由另一個 repo 維護（例如 Go-Split-main 是獨立 repo） | `export GOSPLIT_DOC_JSON=/absolute/path/to/doc.json` |
| **C. 完全不放，跳過 schema 驗證** | 只跑 unit / e2e，不跑 API 契約 | 什麼都不用做，`schemas.py` 找不到檔會自動 skip |

**PRD、SPEC-ENGINE、UML 三份素材**只是給你（人類）與 Claude Code（AI）在 SDD 過程中對照的參考，測試碼本身不 import 它們——所以放哪裡都可以，甚至留在原地都行。

**Go-Split-main（前端原始碼）**是 E2E 測試的被測物，用 `GOSPLIT_UI_BASE` 環境變數指向它跑起來的 URL（預設 `http://localhost:8000`），不會複製或修改前端一行程式碼。Playwright 設定寫在 `tests/e2e/conftest.py` 裡，不需要另建 `playwright.config.py`。

---

## 2. 三份核心文件的分工

| 文件 | 用途 | 讀者 |
|------|------|------|
| **TEST-SCENARIOS.md** | 所有測試情境的 **Given/When/Then 描述**（BDD 規格） | RD、QA、PM |
| **MANUAL-TEST-CASES.md** | 三角色 × 全流程的 **人肉逐步操作** 案例 | QA（含測試新手） |
| **SCHEDULE.md** | **⭐ 時辰規劃表**：人機分工、指令怎麼下、SDD 一步步怎麼跑 | 執行者（你） |

## 3. 測試分層與工具

| 層 | 工具 | 對應 SPEC | 覆蓋範圍 |
|----|------|-----------|---------|
| **單元** | Python 3.11 + pytest | SPEC-ENGINE v1.1（F1/F2/F3/F0/H1） | 分攤引擎五個純函數 + 四條不變量 |
| **API 契約** | pytest + requests | doc.json 全部端點 | 三角色 × 授權、錯誤碼、schema 驗證 |
| **E2E** | Python 3.11 + Playwright | PRD §14 七張流程圖 | 三角色 UI 全流程（快樂路徑＋擋存） |
| **手動** | 人肉勾選 CHECKLIST.md | PRD 各 AC | 視覺回饋、跨瀏覽器、可用性 |

## 4. 執行順序（快速上手）

```bash
# 一次到位（需先有 Python 3.11+）
bash scripts/setup.sh          # 建立 venv、安裝 pytest / playwright / requests、下載瀏覽器
source .venv/bin/activate

# 純跑單元（不需網路、不需憑證）— 應該 48 綠
pytest tests/unit -v

# 跑全套（無憑證時 API/E2E 自動 skip 而非 error）
bash scripts/run-all.sh

# 分層執行
pytest tests/unit -v                              # 單元（引擎）
pytest tests/api -v                               # 契約（需憑證或會 skip）
pytest tests/e2e -v --headed                      # E2E（可看畫面；需 storage_state）
pytest tests/e2e/test_host_full_flow.py -v -k HOST_E2E_05   # 單一案例
```

**預期行為對照**（剛拿到專案時）：

| 場景 | tests/unit | tests/api | tests/e2e |
|---|---|---|---|
| 純本機，無網路、無憑證 | **48 綠** | 全 skip | 全 skip |
| 本機 + `docs/doc.json` | 48 綠 | 全 skip（無憑證）| 全 skip |
| 本機 + `.env` 內填入 host cookie | 48 綠 | **~30 綠**（包含 host 相關）| 全 skip |
| 本機 + host storage_state | 48 綠 | ~30 綠 | **~6 個 host E2E 綠** |
| 三角色齊備 | 48 綠 | **~53 綠** | **~19 綠** |

`.env.example` 列出所有環境變數；複製為 `.env` 填實際值即可（`.env` 已在 `.gitignore` 內）。

## 5. 下一步

打開 [`docs/SCHEDULE.md`](docs/SCHEDULE.md) —— 那份文件把「今天先做什麼、下一步下什麼指令、SDD 每輪迴的紅→綠→重構」逐步寫死，跟著跑就對了。
