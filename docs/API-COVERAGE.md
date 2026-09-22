# API-COVERAGE — Swagger 端點 × 測試覆蓋矩陣

> **對應**：`https://go-backend-api-605450358080.asia-east1.run.app/swagger/index.html`（Schema）＋ `doc.json` ＋ UML.pdf 節點 N01-N28
> **用途**：確保 42 個端點皆有對應測試；三角色 × 授權 × 錯誤碼皆有覆蓋

---

## §0 API 端點 × PRD 功能區 × UML 節點對照

| API 群組 | PRD 功能區 | UML 節點 | 主要端點 |
|---|---|---|---|
| auth | A | N04a/b/c | POST /auth/google, /auth/join, /auth/recover |
| events (list/create) | B, K | N06, N07 | GET/POST /events |
| events (get/patch/archive) | D, J | N08, N27 | GET/PATCH /events/{id}, POST /events/{id}/archive |
| members | E | N10 | CRUD /events/{id}/members |
| rules | F | N13 | CRUD /events/{id}/rules |
| tags | F | N13 | CRUD /events/{id}/tags |
| items | G | N14/N15 | CRUD /events/{id}/items |
| settle | H | N16/N19 | POST /events/{id}/settle |
| shares | H | N16 | GET /events/{id}/shares |
| transfers | H | N18/N24 | GET /events/{id}/transfers |
| my-details | D | N08 | GET /events/{id}/my-details |

---

## 覆蓋級別定義

| 標記 | 意義 |
|:---:|------|
| ✅ | 有 pytest 測試 |
| 🖥 | 有 Playwright E2E 走過 |
| 📋 | 有手動測試案例 |
| 🧪 | 有屬性測試（property-based）覆蓋 |
| — | 尚未覆蓋（優先待補） |

## 授權角色定義

| 標記 | 對應 |
|:---:|------|
| **A** | Account（Google 登入的主辦） |
| **G** | Guest session（免帳號成員） |
| **H** | Host（主辦） |
| **C** | Co-organizer（協辦） |
| **M** | Member（參與者） |
| **-** | 匿名 |

---

## 表 1：Auth 端點（6）

| 方法 | 路徑 | 授權需求 | 主要成功回應 | 主要錯誤回應 | 對應 Scenario | 覆蓋 |
|------|------|---------|-------------|-------------|--------------|------|
| POST | `/auth/google` | - | 200 accountResponse | 400/401/503 | API-AUTH-01/02、UI-H-I-01 | ✅ 🖥 |
| POST | `/auth/join` | - | 200 joinResponse | 400/404/410 | API-AUTH-03/04、UI-CO-I-01 | ✅ 🖥 |
| POST | `/auth/recover` | - | 200 recoverResponse | 400/404/410 | API-AUTH-05、UI-CO-I-02 | ✅ |
| POST | `/auth/logout` | A or G | 204 | 401 | STATE-04 週邊 | ✅ |
| DELETE | `/auth/` | A | 204 | 401 | 帳號刪除（Out of Scope UI）| ✅ |
| GET | `/auth/invite/{code}` | - | 200 | 404/410 | 邀請碼預覽 | ✅ |

---

## 表 2：Events 端點（5）

| 方法 | 路徑 | 授權需求 | 主要成功 | 主要錯誤 | Scenario | 覆蓋 |
|------|------|---------|---------|---------|---------|------|
| GET | `/events` | A or G | 200 eventsResponse | 401 | UI-H-S-01 開頭 | ✅ 🖥 |
| POST | `/events` | **A only** | 201 createEventResponse | 400/401/**403 for guest** | API-EV-01/02、UI-H-S-01 | ✅ 🖥 📋 |
| GET | `/events/{id}` | H/C/M | 200 eventDetailResponse | 401/403/404 | API-EV-03、STATE-04 | ✅ 🖥 |
| PATCH | `/events/{id}` | **H only** | 204 | 400/401/403 | API-EV-04 | ✅ |
| POST | `/events/join` | A or G | 200 | 400/404/410 | UI-CO-I-01 分支 | ✅ |

---

## 表 3：Members 端點（6）

| 方法 | 路徑 | 授權 | 成功 | 錯誤 | Scenario | 覆蓋 |
|------|------|------|------|------|---------|------|
| GET | `/events/{id}/members` | H/C/M | 200 | 401/403 | 群組人員列表 | ✅ |
| POST | `/events/{id}/members` | **H only** | 201 | 403 | A-6（虛擬成員） | ✅ 🖥 |
| PATCH | `/events/{id}/members/{mid}` | **H only** | 204 | 403 | B-5、B-11、B-12 | ✅ 🖥 |
| DELETE | `/events/{id}/members/{mid}` | **H only** | 204 | 403/**409 有代墊** | E 區成員擋刪 | ✅ 📋 |
| POST | `/events/{id}/members/{mid}/bind` | H | 204 | 403 | C22 綁定 | ✅ |
| GET | `/events/{id}/members/{mid}/role` | H/C/M | 200 | 403 | B-5 即時生效 | ✅ |
| GET | `/events/{id}/members/{mid}/breakdown` | **H only** | 200 | 403 | 個人明細（主辦視角）| ✅ |

---

## 表 4：Settings 端點（規則與標籤，8）

| 方法 | 路徑 | 授權 | 成功 | 錯誤 | Scenario | 覆蓋 |
|------|------|------|------|------|---------|------|
| GET | `/events/{id}/rules` | H/C/M（三角色唯讀）| 200 rulesResponse | 401 | UI-M-M-01、C-4 | ✅ 🖥 |
| POST | `/events/{id}/rules` | **H only** | 201 ruleDTO | 400/403/**409** | API-RULE-01/02、A-14/15 | ✅ 🖥 |
| PATCH | `/events/{id}/rules/{rid}` | **H only** | 204 | 403 | A-17 | ✅ 🖥 |
| DELETE | `/events/{id}/rules/{rid}` | **H only** | 204 | 403/**409 L21-b** | A-16 | ✅ 🖥 📋 |
| GET | `/events/{id}/tags/conds` | H/C/M | 200 | 401 | joinForm 預覽 | ✅ |
| POST | `/events/{id}/tags/conds` | **H only** | 201 | 403/409 | 條件標籤新增 | ✅ |
| PATCH | `/events/{id}/tags/conds/{label}` | **H only** | 204 | 403 | 標籤改名（連動更新）| ✅ |
| DELETE | `/events/{id}/tags/conds/{label}` | **H only** | 204 | **409 使用中** | F1-a 刪除防呆 | ✅ |
| GET | `/events/{id}/tags/items` | H/C/M | 200 | 401 | 建細項時的下拉 | ✅ |
| POST | `/events/{id}/tags/items` | **H only** | 201 | 403 | itemTag 新增 | ✅ |
| PATCH | `/events/{id}/tags/items/{label}` | **H only** | 204 | 403 | itemTag 改名（原子）| ✅ |
| DELETE | `/events/{id}/tags/items/{label}` | **H only** | 204 | **409 使用中** | F1-b 刪除防呆 | ✅ |

---

## 表 5：Items 端點（4）

| 方法 | 路徑 | 授權 | 成功 | 錯誤 | Scenario | 覆蓋 |
|------|------|------|------|------|---------|------|
| GET | `/events/{id}/items` | H/C/M | 200 itemsResponse | 401/403 | UI-M-I-01 | ✅ 🖥 |
| POST | `/events/{id}/items` | **H or C only** | 201 itemDTO | 400/403 | API-ITEM-01/02、A-7/8 | ✅ 🖥 |
| GET | `/events/{id}/items/{iid}` | H/C/M | 200（含 allocation）| 401 | C-3 | ✅ 🖥 |
| PATCH | `/events/{id}/items/{iid}` | H；C 限 own | 204 | 403 | B-7 | ✅ 🖥 |
| DELETE | `/events/{id}/items/{iid}` | H；C 限 own | 204 | 403 | L23 款項卡刪除 | ✅ 🖥 📋 |

---

## 表 6：Shares 端點（3）

| 方法 | 路徑 | 授權 | 成功 | 錯誤 | Scenario | 覆蓋 |
|------|------|------|------|------|---------|------|
| GET | `/events/{id}/shares` | 個人（H 全員）| 200 sharesResponse | 401/403 | UI-M-M-02、C-8 | ✅ 🖥 |
| GET | `/events/{id}/me/details` | 任一角色 | 200 personalResponse | 401 | C-7（未參與細項顯示 0）| ✅ 🖥 |
| GET | `/events/{id}/transfers` | H only（封存後三角色可）| 200 transfersResponse | 403 | API-XFER-01/02、UI-H-S-04 | ✅ 🖥 |

---

## 表 7：Settlement 端點（3）

| 方法 | 路徑 | 授權 | 成功 | 錯誤 | Scenario | 覆蓋 |
|------|------|------|------|------|---------|------|
| POST | `/events/{id}/settle` | **H only** | 204 | **422 validationResponse**、403 | API-SET-01/02、A-20 | ✅ 🖥 📋 |
| PATCH | `/events/{id}/settlement-note` | H | 204 | 403 | 結算前備註 | ✅ |
| POST | `/events/{id}/archive` | **H only** | 204 | 403/**4xx 需 settled** | API-ARCH-01/02、A-22 | ✅ 🖥 |

---

## 表 8：Templates + Health（2）

| 方法 | 路徑 | 授權 | Scenario | 覆蓋 |
|------|------|------|---------|------|
| GET | `/templates` | - | UI-H-S-01 開頭 | ✅ |
| GET | `/healthz` | - | 冒煙測試 | ✅ |

---

## 授權矩陣（快查）

| 端點類別 | 匿名 | Guest | Account | Host | Co | Member |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| /auth/google, /auth/join, /auth/recover | ✅ | ✅ | ✅ | — | — | — |
| GET /events, GET /events/{id} | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **POST /events** | — | **❌ 403** | ✅ | — | — | — |
| PATCH /events/{id} | — | — | — | ✅ | ❌ | ❌ |
| POST /events/{id}/items | — | — | — | ✅ | ✅ | ❌ |
| PATCH /events/{id}/items/{iid} (non-own) | — | — | — | ✅ | ❌ | ❌ |
| POST /events/{id}/rules | — | — | — | ✅ | ❌ | ❌ |
| GET /events/{id}/rules | — | — | — | ✅ | ✅ | ✅ |
| **POST /events/{id}/settle** | — | — | — | **✅** | ❌ | ❌ |
| GET /events/{id}/transfers | — | — | — | ✅ | ❌* | ❌* |
| POST /events/{id}/archive | — | — | — | ✅ | ❌ | ❌ |

*封存後三角色可看。

---

## Schema 驗證清單（Python jsonschema）

以下 definition 應在測試中做 schema 驗證。真實命名以雙段點號分隔（例如 `events.eventDetailResponse`）：

**auth**：`auth.accountResponse`, `auth.joinResponse`, `auth.recoverResponse`, `auth.invitationResponse`, `auth.errorResponse`

**events**：`events.eventsResponse`, `events.eventListItem`, `events.eventDetailResponse`, `events.createEventResponse`, `events.metadataRequest`

**rules & tags**：`events.ruleDTO`, `events.rulesResponse`, `events.ruleBodyRequest`, `events.ruleUpdateRequest`, `events.addLabelRequest`, `events.labelsResponse`

**items & details**：`events.itemDTO`, `events.itemsResponse`, `events.detailDTO`, `events.createItemRequest`, `events.createDetailRequest`, `events.updateItemRequest`, `events.detailIssue`

**members**：`events.memberDTO`, `events.membersResponse`, `events.createMemberRequest`, `events.updateMemberRequest`, `events.bindMemberRequest`, `events.roleResponse`

**shares / transfers / settlement**：`events.sharesResponse`, `events.detailShareDTO`, `events.memberShareDTO`, `events.transfersResponse`（含 `strategy="hub"`, `hub_id`）, `events.personalResponse`, `events.personalLine`, `events.settlementNoteRequest`, `events.validationResponse`（422 錯誤結構）

**split engine（引擎回傳）**：`splitengine.Share`, `splitengine.Transfer`, `splitengine.SplitResult`（深藏於 `detailDTO.allocation`）, `splitengine.Validity`（enum: `ok` / `no-participant` / `custom-mismatch` / `custom-overflow`）, `splitengine.Trace`

**templates**：`events.templateItem`, `events.templatesResponse`

> ℹ️ 舊版曾提及 `events.condSetDTO` — **真實 doc.json 沒有這個 definition**。條件分組結構在 API 層是 `events.ruleBodyRequest.groups[]`（`type: object`，未詳列子欄位）。引擎層的 `condSets` 是內部詞彙，不對應 API schema。

---

## 端點總覽（42 operations across 30 paths）

| 類別 | Operations | 覆蓋數 | 完成率 |
|------|:---:|:---:|:---:|
| Auth | 6 | 6 | 100% |
| Events（含 join、archive） | 6 | 6 | 100% |
| Members | 7 | 7 | 100% |
| Settings（rules 4 + tags 8） | 12 | 12 | 100% |
| Items | 5 | 5 | 100% |
| Shares（含 me/details、transfers） | 3 | 3 | 100% |
| Settlement（settle、settlement-note） | 2 | 2 | 100% |
| Templates + Health | 2 | 2 | 100% |
| **合計** | **43** | **43** | **100%** |

> 註：doc.json 共 30 個 path，跨 42 個 operation（method + path 為單位）。上表分類將 archive/join 歸到 Events、transfers/me-details 歸到 Shares，故各類加總 43，含 `.../breakdown` 這個 host-only 端點。

---

## 尚未覆蓋 / 待補注意項

1. **多語系錯誤文案**：doc.json 未指定文案語言；測試僅斷言 `error` 欄非空與狀態碼。
2. **rate limit**：doc.json 未定義；若後端有，補上 429 測試。
3. **Optimistic locking / 版本欄位**：若後端用 `updated_at` 做 concurrency control，補 409。
4. **CORS**：E2E 已間接覆蓋，若切換 domain 需另補。
5. **splitengine 內部 fields**：Trace 內部欄位 doc.json 未展開；測試只斷言存在，不驗證細節。

*文件結束。*
