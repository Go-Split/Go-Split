# 分帳吧（Go-Split）待實作清單

> **給 RD 的說明**：本文件由 SDD 契約測試自動化捕獲的規格與實作落差整理而成。
> 每一項都對應到具體測試（xfail 或 skip 標記），修正完成後跑該測試會自動轉綠。
> **本清單依 PRD 規格重要度排序**：資料完整性 > 權限安全 > UI polish > 開發工具。

**測試框架版本**：SDD × ZOMBIES-TDD v1.0
**Prototype 版本**：純 HTML/CSS/JS localStorage 版（`index.html` + `prototype/app.js`）
**PRD 版本**：v0.16
**SPEC-ENGINE 版本**：v1.1
**API 契約**：doc.json (Swagger 2.0)

---

## 📊 落差全景一覽

| 分類 | 前端項目 | 後端項目 | 合計 |
|---|---|---|---|
| 🔴 P0 資料完整性 | 3 | 0 | 3 |
| 🟠 P1 權限安全 | 1 | 0 | 1 |
| 🟡 P2 UX 一致性 | 3 | 0 | 3 |
| 🟢 P3 開發工具 | 0 | 2 | 2 |
| **合計** | **7** | **2** | **9** |

---

# 前端 RD 待實作項目

## 🔴 P0-1【資料完整性】C11/C12：`amount=0` 未被視為錯誤輸入

### 問題描述

**PRD 規格**：
- C11：多筆細項驗證失敗時，逐一顯示錯誤 + 頂部筆數摘要
- C12：一筆細項不合法 → **整張款項退回、停留原頁**（atomic commit）
- SPEC-ENGINE §L22：所有分攤者權重全 0 → 除零錯誤

**Prototype 實作**（`prototype/app.js` L1079-1082）：

```javascript
const amtStr = String(d.amount === 0 ? 0 : (d.amount || ''));
const amtEmpty = !amtStr.trim();      // 只擋空字串
const amtBad = /[^0-9]/.test(amtStr); // 只擋非數字
// amount === 0 → amtStr = "0" → 既非 empty 也非 bad → 合法
```

**具體行為**：金額 `0` 元的細項會被視為合法輸入、送出後成功離開 `addItem` screen 進入 `event` dashboard，違反 C12「整張退回、停留原頁」。

### 影響

- 使用者可以輸入 `0` 元的細項並成功送出
- 若後端計算「每人應攤 = 金額 / 分攤人數」，遇到 `0` 元的細項會產生無意義計算
- 若後端計算加權平均、遇到權重全 0 的情境會觸發除零錯誤

### 修正方向（前端）

在 `draftDetails` map 內（L1079-1082）調整驗證邏輯：

```javascript
// 建議修正
const amtNum = parseFloat(amtStr);
const amtInvalid = amtEmpty || amtBad || amtNum <= 0;
```

同時：
- 在 `submitItem` 時擋下：若有任一 detail `amtInvalid`、不進 event 頁、顯示錯誤紅框
- 補上「頂部筆數摘要」文字（例如 `<div class="alert">共 3 筆細項有錯</div>`）

### 對應測試（修完後轉綠）

- `tests/e2e/test_g_zone_recording_flow.py::TestG_zone_N15_N17_N20_atomic_commit_failure::test_G_zone_C12_one_bad_detail_rejects_entire_card`
- `tests/e2e/test_g_zone_recording_flow.py::TestG_zone_N15_N17_N20_atomic_commit_failure::test_G_zone_C11_multiple_bad_details_all_shown_with_count_summary`
- `tests/e2e/test_host_full_lifecycle.py::TestHostFullLifecycle::test_G_zone_N15_atomic_commit_rejects_all_on_one_bad_detail_C12`

### 驗證方式

```bash
pytest tests/e2e/test_g_zone_recording_flow.py -v -k "C11 or C12"
```

預期從 3 xfail → 3 pass；如果 `strict=True` 的 xfail 反標為 XPASS，pytest 會提示要拿掉 xfail 標記。

---

## 🔴 P0-2【資料完整性】C31：H3 付款流向仍保留繳款勾選按鈕

### 問題描述

**PRD 規格**（C31 v0.12 定案）：
- N24 H3 付款流向清單為**純檢視鐵三角**：
  - 無勾選框
  - 無通知按鈕
  - 無繳款狀態欄
- 繳款確認移到平台外（LINE、對帳、口頭）

**Prototype 實作**（`prototype/app.js` L2160-2172）：

```javascript
// H3 payments 頁仍保留繳款 toggle button
`<button ... data-click="H(t.toggle)">✓</button>`
```

**具體行為**：付款流向清單每列右側仍有勾選按鈕，違反 C31 v0.12 定案。

### 影響

- 使用者以為系統會追蹤誰繳了款
- 與規格「無勾選、無通知、無狀態欄」明顯衝突
- 若上線後才發現，需要下架該功能並教育已使用的使用者

### 修正方向（前端）

`prototype/app.js` L2160-2172 `screenPayments` 函式：

```javascript
// 現況
${ctx.transfers.map(t => `...<button data-click="H(t.toggle)">✓</button>...`).join('')}

// 建議
${ctx.transfers.map(t => `...
  <span class="fs14">${esc(t.text)}</span>
  <span class="fs16 fw700">${esc(t.amount)}</span>
`).join('')}
// 移除 toggle button、移除 statusText 對應的欄位
```

同時清理 `st.payments` 或類似的 state（如果有）——完全移除繳款追蹤概念。

### 對應測試（修完後轉綠）

- `tests/e2e/test_h_zone_settlement_flow.py::TestH_zone_N24_H3_transfers_list::test_H_zone_N24_C31_no_payment_tracking_ui_at_all`

### 驗證方式

```bash
pytest tests/e2e/test_h_zone_settlement_flow.py -v -k "C31"
```

預期從 xfail → pass。

---

## 🔴 P0-3【資料完整性】§11 J 區：封存缺少確認 dialog

### 問題描述

**PRD 規格**（§11 J 區補強 v0.9）：
- N27 封存為**不可逆動作**
- 需彈出確認 dialog、明示「結清後活動將完全唯讀、不可還原」

**Prototype 實作**（`prototype/app.js` L651）：

```javascript
archiveEvent: () => setState(x => ({ screen: 'home',
  events: x.events.map((e, i) => i === x.cur ? Object.assign({}, e, { archived: true }) : e) })),
```

**具體行為**：點「已結清，封存活動」按鈕後**直接** `setState({archived: true, screen: 'home'})` — 無任何確認步驟。

### 影響

- 使用者誤點會直接封存活動
- 封存後完全唯讀、無法還原
- 若已上線，可能發生大量客訴要求復原

### 修正方向（前端）

在 `archiveEvent` 前插入 dialog 步驟（可參考現有 `askSettle` / `confirmSettle` 的 pattern，`app.js` L644-646）：

```javascript
// 現況
archiveEvent: () => setState(x => ({ screen: 'home', ... })),

// 建議
askArchive: () => setState({ archiveAsk: true }),
cancelArchive: () => setState({ archiveAsk: false }),
confirmArchive: () => setState(x => ({ archiveAsk: false, screen: 'home',
  events: x.events.map((e, i) => i === x.cur ? Object.assign({}, e, { archived: true }) : e) })),
```

Dialog 內容：

```
標題：確定要封存活動？
說明：結清後活動將完全唯讀、不可還原。
按鈕：再檢查一下 / 確定封存
```

### 對應測試（修完後轉綠）

- `tests/e2e/test_j_zone_archive_flow.py::TestJ_zone_N26_N27_finalize_and_archive::test_J_zone_N27_archive_confirm_dialog_shows_irreversible_only`

### 驗證方式

```bash
pytest tests/e2e/test_j_zone_archive_flow.py -v -k "confirm_dialog"
```

同時需要 QA 補 `TransfersH3Page.expect_archive_confirmation_shows_irreversible_only()` 的斷言邏輯（目前是 `pass` 空實作）。

---

## 🟠 P1-1【權限安全】C17 R1：邀請碼未做有效性驗證

### 問題描述

**PRD 規格**（C17 R1）：
- 邀請碼加入時、需**真實查驗邀請碼有效性**
- 無效邀請碼 → 顯示 §6.4 錯誤（不透露哪一欄錯，防猜測）

**Prototype 實作**（`prototype/app.js` L680-690 `joinByCode`）：

```javascript
joinByCode: () => setState(x => {
  const j = x.join2 || {};
  if (!(j.mail || '').trim() || !(j.phone || '').trim() || !(x.code || '').trim())
    return { joinTouched: true };  // 只擋三欄非空
  // ↓↓↓ 完全沒驗 x.code 是否為有效邀請碼 ↓↓↓
  const mail = (j.mail || '').trim().toLowerCase();
  const known = ... /* 只看 mail/phone 是否存在於某成員 */;
  return known ? {..., screen: 'event'} : {..., screen: 'invite'};
})
```

**具體行為**：任何 `code` 字串（例如 `"INVALID"`、`"XXX-XX"`、甚至空 code 加填入其他兩欄）只要三欄非空 + mail/phone 匹配某成員，就會**成功進入活動**——不會被 reject。

### 影響

- 惡意使用者可用隨意邀請碼組合猜測活動
- 已加入過的使用者的 mail/phone 若被知道，任何人都能冒充進入（因為 code 不驗）
- 完全違反「邀請碼」作為權限鑰的設計意圖

### 修正方向

**這個問題大概率是後端接入才解決**（前端 prototype 是純 localStorage）。當後端 API 接入後：

**前端**：`joinByCode` 改為呼叫後端 API `POST /join`，把 code + mail + phone 送給後端；接收回應決定進 event 或顯示錯誤。

**後端**：`POST /join` 必須驗證 code 對應到真實存在的活動、且未過期。

### 對應測試（修完後轉綠）

- `tests/e2e/test_a_zone_entry_flow.py::TestA_zone_N04b_first_time_join_by_invite_code::test_A_zone_N04b_join_with_invalid_code_shows_error`

### 驗證方式

```bash
pytest tests/e2e/test_a_zone_entry_flow.py -v -k "invalid_code"
```

預期從 xfail → pass。

---

## 🟡 P2-1【UX 一致性】N19 結帳確認 dialog 缺「取消」動作

### 問題描述

**UML 規格**（N19 判斷菱形）：
- 使用者點「確認結帳產出」→ 出現確認 dialog
- Dialog 有兩個出口：**確認**（→ N22 H2）/ **取消**（→ 回 N08 dashboard）

**Prototype 實作**（`prototype/app.js` L1371）：

```javascript
`<button ... data-click="H(ctx.cancelSettle)">再檢查一下</button>
 <button ... data-click="H(ctx.confirmSettle)">確定結帳</button>`
```

**具體行為**：dialog 只有「**再檢查一下**」（保持在 settle 頁）+「**確定結帳**」（進 settleDone）。**沒有真正回 N08 dashboard 的入口**。

### 影響

- 使用者若想「取消結帳、回活動主頁」需先按「再檢查一下」→ 再手動點 sidebar「活動款項」
- 多一次操作、與 UML 流程圖不符

### 修正方向

**選項 A**：明確在 dialog 加第三個按鈕「回活動頁」

**選項 B**：修改「再檢查一下」的語意為「回活動頁」（更符合 UML N19 的「取消」語意）

### 對應測試（修完後轉綠）

- `tests/e2e/test_h_zone_settlement_flow.py::TestH_zone_N19_confirmation_dialog::test_H_zone_N19_cancel_returns_to_dashboard`

當前該測試被 skip（`SettleH1Page.click_cancel_return_to_dashboard` 為 `pass` 空實作）。

---

## 🟡 P2-2【UX 一致性】規則編輯 UI 缺穩定操作流程

### 問題描述

**PRD 規格**（F 區 N13 分攤規則設定）：
- 主辦人可新增規則：選擇 tag → 選擇條件 → 設定權重
- 完整流程應可測試化

**Prototype 實作**：規則編輯 UI 使用 popover + tag chip 較複雜互動，缺乏「新增規則對話框」的明確入口，導致：

- POM 難以撰寫穩定的操作序列（`RulesPage.open_add_rule_dialog` 目前為空實作）
- 使用者也難掌握「一筆規則從無到有」的最短路徑

### 修正方向

建議前端補上：
- 明確的「＋ 新增規則」按鈕，點下後進入專屬對話框
- 對話框內按步驟填欄位（tag / cond / weight），儲存後回到規則列表
- 或替代方案：現有 inline edit 加上 `data-fk` 或 `data-testid` 屬性，讓測試可穩定定位

### 對應測試（修完後轉綠）

- `tests/e2e/test_host_full_lifecycle.py::TestHostFullLifecycle::test_F_zone_N13_add_rule_for_food_expense`

---

# 後端 RD 待實作項目

## 🟢 P3-1【開發工具】`/healthz` 端點未實作

### 問題描述

**doc.json 規格**：定義了 `GET /healthz` 端點回傳 `{status: "ok"}`

**實際部署**：`GET /healthz` → **404 Not Found**

### 影響

- 監控系統無法透過 healthz 檢查服務健康
- CI/CD 無法用 healthz 判定 deploy 完成
- API 契約與實作不一致

### 修正方向

在 API server 補上 `/healthz` 端點：

```python
@app.get("/healthz")
def healthz():
    return {"status": "ok"}
```

（或依團隊使用的 framework）

### 對應測試

- `tests/api/test_auth.py::TestHealthAndPublic::test_healthz_returns_200_or_skip_if_not_implemented`
- `tests/api/test_auth.py::TestSchemaShape::test_healthz_no_schema_needed`

當前 skip；補上後端後、測試會自動變 pass。

---

## 🟢 P3-2【開發工具】`/templates` 端點需要授權

### 問題描述

**doc.json 規格**：未標註 `security` 欄位，暗示 `/templates` 應為公開端點

**實際部署**：`GET /templates` → **401 Unauthorized**（需要 cookie 或 token）

### 影響

- 未登入使用者無法先預覽有哪些活動模板
- API 契約與實作不一致
- 若前端「建活動」流程需要先拉模板列表、必須先讓使用者登入

### 修正方向

**兩個選項擇一**：

**選項 A**：讓 `/templates` 變成公開端點（與 doc.json 對齊）
- 適合「模板列表本身不敏感」的情境
- 修正後可讓未登入使用者也能瀏覽模板

**選項 B**：在 doc.json 補上 `security` 標註（讓契約反映實作）
- 適合「模板列表確實需要授權」的情境
- 修正後 API 文件與實作一致

### 對應測試

- `tests/api/test_auth.py::TestHealthAndPublic::test_templates_public_or_requires_auth`

---

# 📋 修正順序建議

按 **PRD 規格重要度**排序（不是按工作量）：

1. **P0-1** C11/C12 amount=0 護欄 — 影響資料計算正確性、必修
2. **P0-2** C31 H3 純檢視 — 影響 UX 正確性、與 v0.12 定案衝突、必修
3. **P0-3** J 區封存確認 dialog — 不可逆動作缺確認、有客訴風險、必修
4. **P1-1** C17 R1 邀請碼驗證 — 權限安全、大概率後端接入時一併解決
5. **P2-1** N19 取消結帳入口 — UX polish、非阻塞
6. **P2-2** 規則編輯完整流程 — 前端功能未完備、非阻塞
7. **P3-1/P3-2** API 契約落差 — 工具便利性、非阻塞

---

# 🔍 如何確認自己修對了

## 方法 1：跑對應測試

每項修正的「對應測試」段已列出 pytest 命令。跑起來看訊號：

| 訊號 | 意義 |
|---|---|
| `XFAIL → XPASS` | ⚠️ 修正成功、但要記得**移除 xfail 標記**（測試檔頂部的 `@pytest.mark.xfail`）|
| `SKIPPED → PASSED` | ✅ 修正成功且完全轉綠 |
| `FAILED` | ❌ 修正有問題、看堆疊訊息診斷 |
| `PASSED` | ✅ 沒改到、原本就綠 |

## 方法 2：全套跑一次

```bash
cd /d/site-project/Go-Split
source .venv/Scripts/activate
python -m http.server 8000 &  # 起前端
pytest -v 2>&1 | tail -20     # 全套跑
```

看最後統計行：
- `passed` 數字應該**上升**
- `xfailed` 數字應該**下降**
- `failed` 應該仍是 **0**

## 方法 3：看規格對照文件

- `docs/SCHEDULE.md` §0 UML×PRD 對照表
- `docs/TEST-SCENARIOS.md` 每個 xfail 的規格對照

---

**文件版本**：v1.0（隨測試框架同版本更新）
**維護者**：測試工程師 / RD 團隊
**問題回報**：如發現本清單與實際落差不符、請開 issue 標註 `test-drift`
