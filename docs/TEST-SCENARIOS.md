# TEST-SCENARIOS — 分帳吧 Gherkin 情境全集

> **語法**：Gherkin（Given / When / Then / And），中文可讀

---

## §0 UML.pdf 節點對應說明

本文件所有 Scenario ID 採用 `<PRD功能區代號>-<UML節點ID>-<業務語意>` 三段命名。

**對照速查**（詳見 SCHEDULE.md §0）：
- 功能區代號：A=進入 / B=活動列表 / C=邀請 / D=活動主頁 / E=群組設定 / F=分攤引擎 / G=記帳 / H=結算 / J=封存 / K=情境模板
- UML 節點 ID：N01-N28（依 UML.pdf 節點自上而下編號）
- 舊 ID（如 HOST-E2E-01）已全部改為新 ID（如 G-N15-atomic-commit）

---
> **對應**：PRD v0.16 §3–§11、SPEC-ENGINE v1.1 §2–§6、doc.json 全端點
> **順序**：依 ZOMBIES 分層——Z（零）→ O（一）→ M（多）→ B（邊界）→ I（介面）→ E（異常）→ S（完整場景）

## ⚠️ 命名層級（貫穿全文）

本文件混用兩層命名，讀時請留意 Scenario 屬於哪一層：

| 層 | 位置 | 命名風格 | 對應處 |
|---|---|---|---|
| **引擎層** | Feature 1-6（F1/F2/F3/F0/H1/不變量）| camelCase：`itemTag`, `condSets`, `condTags`, `weightMode`, `payer` | SPEC-ENGINE v1.1 |
| **API 層** | Feature 10（API 契約）| snake_case：`item_tag`, `groups`, `cond_tag`, `weight_mode`, `payer_member_id` | doc.json |

引擎與 API 之間的翻譯在 `api_client.py` 內部完成。UI 流程（Feature 7-9）不直接觸及命名，用「規則」「條件標籤」「款項」等業務語言。

**兩層命名對照速查**：

| 引擎層 | API 層 |
|---|---|
| Rule 上的 `itemTag`（string）| `item_tag` |
| Rule 上的 `condSets`（array）| `groups`（array）|
| condSet 內的 `condTags`（array）| group 內的 `cond_tag`（string；一群只對應一個標籤）|
| Item 上的 `payer`（string mid）| `payer_member_id`（integer）|
| Item 上的 `manualMemberIds`（array）| `manual_member_ids`（array of int）|
| Item 上的 `customAmounts`（dict）| `custom_amounts`（dict[str,int]，key 是 member_id 字串）|
| Transfer 上的 `from`/`to`（string mid）| `from_id`/`to_id`（integer）|

---

## 目錄

- [Feature 1：F1 權重解析 `resolveWeight`](#feature-1f1-權重解析-resolveweight)
- [Feature 2：F2 分配 `allocate`](#feature-2f2-分配-allocate)
- [Feature 3：F3 尾差 `settleRemainder`](#feature-3f3-尾差-settleremainder)
- [Feature 4：F0 對外入口 `splitDetail`](#feature-4f0-對外入口-splitdetail)
- [Feature 5：H1 主辦中心付款流向 `computeTransfers`](#feature-5h1-主辦中心付款流向-computetransfers)
- [Feature 6：不變量（四條）](#feature-6不變量四條)
- [Feature 7：主辦（Host）UI 流程](#feature-7主辦host-ui-流程)
- [Feature 8：協辦者（Co）UI 流程](#feature-8協辦者co-ui-流程)
- [Feature 9：參與者（Member）UI 流程](#feature-9參與者member-ui-流程)
- [Feature 10：API 契約（doc.json 對應）](#feature-10api-契約docjson-對應)
- [Feature 11：狀態機（Active → Settled → Archived）](#feature-11狀態機active--settled--archived)

---

## 情境 ID 命名慣例

```
<Feature ID>-<ZOMBIES 字母>-<流水>
例：F1-Z-01（F1、Zero 類、第 1 個）
    F1-E-04（F1、Exceptions 類、第 4 個）
    UI-H-S-01（Host UI、Simple scenarios 類、第 1 個）
```

---

## Feature 1：F1 權重解析 `resolveWeight`

> **對應**：SPEC-ENGINE §2、PRD §3.1 F1-c、L9

```gherkin
Feature: F1 權重解析（resolveWeight）
  身為分攤引擎，
  我要在成員條件與規則比對後，正確吐出每人在此細項的權重與追溯軌跡（trace），
  以便 F2 據以分配、F3 據以補位、並讓可驗證性有跡可循。

  Background: 烤肉/露營模板規則已載入
    Given 六條規則已載入（肉品、蔬菜、海鮮、主食、酒精飲品、交通費）
    And 交通費規則的「其他人」列為 mode='exclude'
```

### Z（Zero）— 空／零／未貼標籤

```gherkin
  Scenario: F1-Z-01 細項未貼 itemTag
    Given 細項的 itemTag 為 null
    When 對任一成員呼叫 resolveWeight(null, member)
    Then 回傳 weight 為 1
    And trace.kind 為 "no-rule"
```

```gherkin
  Scenario: F1-Z-02 該 itemTag 無對應規則
    Given 規則清單中沒有「水果」規則
    And 成員的條件標籤為 ['大人']
    When 呼叫 resolveWeight("水果", member)
    Then 回傳 weight 為 1
    And trace.kind 為 "no-rule"      # ⚠️ 不是 "rest"
```

### O（One）— 單一命中

```gherkin
  Scenario: F1-O-01 命中規則第一個條件集合（exclude）
    Given 肉品規則 condSets[0] = { condTags: ['吃素'], mode: 'exclude' }
    And 成員小美的 condTags 為 ['吃素', '大人']
    When 呼叫 resolveWeight("肉品", 小美)
    Then 回傳 weight 為 0
    And trace.kind 為 "excluded"
    And trace.condSetIndex 為 0
    And trace.hitCondTags 包含 "吃素"
```

```gherkin
  Scenario: F1-O-02 命中規則第二個條件集合（weight）
    Given 肉品規則 condSets[1] = { condTags: ['小孩'], mode: 'weight', weight: 0.5 }
    And 成員佳蓉的 condTags 為 ['小孩', '需搭主辦的車']
    When 呼叫 resolveWeight("肉品", 佳蓉)
    Then 回傳 weight 為 0.5
    And trace.kind 為 "weighted"
    And trace.condSetIndex 為 1
```

### M（Many）— 多條件、多集合

```gherkin
  Scenario: F1-M-01 由上往下、命中即停（不看第二條）
    Given 某規則 condSets = [
      { condTags: ['A'], mode: 'weight', weight: 2 },
      { condTags: ['A', 'B'], mode: 'weight', weight: 3 }
    ]
    And 成員 condTags 為 ['A', 'B']
    When 呼叫 resolveWeight
    Then 回傳 weight 為 2      # ⚠️ 命中第 0 條，不是 3
    And trace.condSetIndex 為 0
```

```gherkin
  Scenario: F1-M-02 全部未命中 → 落「其他人」列（weight）
    Given 肉品規則的 rest = { mode: 'weight', weight: 1 }
    And 成員小凱的 condTags 為 ['大人']
    When 呼叫 resolveWeight("肉品", 小凱)
    Then 回傳 weight 為 1
    And trace.kind 為 "rest"      # ⚠️ 不是 "no-rule"
```

### B（Boundaries）— 邊界

```gherkin
  Scenario: F1-B-01 權重 0.1（下限）
    Given 某集合 mode='weight'、weight=0.1
    When 命中該集合
    Then 回傳 weight 為 0.1

  Scenario: F1-B-02 權重 100（上限）
    Given 某集合 weight=100
    When 命中該集合
    Then 回傳 weight 為 100

  Scenario: F1-B-03 rest.weight 未提供 → 視為 1
    Given rest 為 {} 或 rest 缺 weight
    When 全部未命中
    Then 回傳 weight 為 1

  Scenario: F1-B-04 condSet 空 condTags → 略過該集合
    Given condSets[0] = { condTags: [], mode: 'weight', weight: 5 }
    When 比對
    Then 該集合不視為命中，繼續比對下一條
```

### I（Interfaces）— 介面約束

```gherkin
  Scenario: F1-I-01 AND 語意（至少包含）
    Given 集合 = { condTags: ['食物過敏', '不吃牛'], mode: 'weight', weight: 2.5 }
    And 成員 condTags 為 ['食物過敏', '不吃牛', '大人']
    When 比對
    Then 視為命中（額外的「大人」不影響）

  Scenario: F1-I-02 AND 語意（部分包含不算）
    Given 同上集合
    And 成員 condTags 為 ['不吃牛']
    When 比對
    Then 該集合未命中，往下找
```

### E（Exceptions）— L9 核心／規格護欄

```gherkin
  Scenario: F1-E-01 ⭐ 交通費 rest=exclude、成員全未命中 → excluded-rest
    Given 交通費規則 condSets = [
      { condTags: ['自行前往'], mode: 'exclude' },
      { condTags: ['需搭主辦的車'], mode: 'weight', weight: 1 }
    ]
    And 交通費規則的 rest = { mode: 'exclude' }
    And 成員小凱的 condTags 為 ['大人', '不喝酒/開車']    # 兩個交通條件都沒有
    When 呼叫 resolveWeight("交通費", 小凱)
    Then 回傳 weight 為 0
    And trace.kind 為 "excluded-rest"   # ⚠️ 不是 "no-rule"，也不是 "rest"
    # 這條測試就是 L9 的護欄：若被合併，開車主辦會被分攤自己付的油錢
```

```gherkin
  Scenario: F1-E-02 weight=0（等同 exclude，C25 語意）
    Given 某集合 mode='weight'、weight=0
    When 命中該集合
    Then 引擎不 throw
    And 回傳 weight 為 0（視為 exclude）
```

---

## Feature 2：F2 分配 `allocate`

> **對應**：SPEC-ENGINE §3、PRD §3.2、L22

```gherkin
Feature: F2 分配（allocate）
  身為分攤引擎，
  我要在權重解析後，把金額按總份數分配給每位成員，
  並在自訂金額、除零、名單為空時，透過 validity 回報事實而非崩潰。
```

### Z（Zero）

```gherkin
  Scenario: F2-Z-01 分攤名單為空（除零）
    Given 細項 amount=1200、itemTag="交通費"
    And 四位成員全部未命中任何交通條件
    And 交通費規則 rest = { mode: 'exclude' }
    When 呼叫 allocate
    Then validity 為 "no-participant"
    And raw 為空陣列
    And totalWeight 為 0
    And unitPrice 為 0
    # ⚠️ L22 核心：引擎不 throw，把「擋不擋存」留給應用服務層決定

  Scenario: F2-Z-02 manualMemberIds 為空陣列
    Given 細項 amount=500、itemTag=null
    And manualMemberIds=[]
    When 呼叫 allocate
    Then validity 為 "no-participant"
```

### O

```gherkin
  Scenario: F2-O-01 一位成員均分
    Given 細項 amount=100、單一成員 M1、無規則
    When 呼叫 allocate
    Then validity 為 "ok"
    And raw[0].memberId 為 M1
    And raw[0].rawAmount 為 100
```

### M

```gherkin
  Scenario: F2-M-01 權重加總分攤（PRD 黃金範例）
    Given 細項 amount=1300
    And 甲 weight=2、乙 weight=2、丙 weight=3、丁 weight=3、戊 weight=3
    When 呼叫 allocate
    Then totalWeight 為 13
    And unitPrice 為 100
    And 甲、乙 的 rawAmount 為 200
    And 丙、丁、戊 的 rawAmount 為 300

  Scenario: F2-M-02 部分自訂＋部分依權重
    Given 細項 amount=300、三人參與、無規則
    And customAmounts = { 甲: 100 }
    When 呼叫 allocate
    Then 甲 rawAmount 為 100，trace.kind 為 "custom"
    And 乙、丙 依權重分剩下 200，各得 100
```

### B（Boundaries）

```gherkin
  Scenario: F2-B-01 amount=0
    Given 細項 amount=0
    When 呼叫 allocate
    Then validity 為 "ok"
    And 每人的 rawAmount 皆為 0

  Scenario: F2-B-02 amount=1（最小可整除單位）
    Given 細項 amount=1、三人均分
    When 呼叫 allocate
    Then unitPrice 為 1/3（未取整）
    # 取整由 F3 負責
```

### E — L22 除零／L14 三鎖護欄

```gherkin
  Scenario: F2-E-01 全自訂 Σ<amount → custom-mismatch
    Given 細項 amount=300、三人全自訂 100/100/50
    When 呼叫 allocate
    Then validity 為 "custom-mismatch"
    And diff 為 50

  Scenario: F2-E-02 全自訂 Σ=amount
    Given 細項 amount=300、三人全自訂 100/100/100
    When 呼叫 allocate
    Then validity 為 "ok"

  Scenario: F2-E-03 有一人自訂超過總金額 → custom-overflow
    Given 細項 amount=300、甲自訂 350
    When 呼叫 allocate
    Then validity 為 "custom-overflow"
    And diff 為 50

  Scenario: F2-E-04 有規則細項 + customAmounts → 自訂金額被忽略（L14 鎖一）
    Given 細項貼有規則的 itemTag
    And customAmounts 非空
    When 呼叫 allocate
    Then 自訂金額被忽略
    And 全體依規則權重分攤

  Scenario: F2-E-05 有規則細項 + manualMemberIds → 名單被忽略（L14 鎖一）
    Given 細項貼有規則的 itemTag
    And manualMemberIds = [某子集]
    When 呼叫 allocate
    Then manualMemberIds 被忽略
    And pool = 全體 members
```

---

## Feature 3：F3 尾差 `settleRemainder`

> **對應**：SPEC-ENGINE §4、PRD §3.3 機制一、C9／C30

### Z / O

```gherkin
  Scenario: F3-Z-01 raw 為空（no-participant 情境）
    Given raw = []
    When 呼叫 settleRemainder
    Then 回傳 []
    And 不 throw、不無限迴圈

  Scenario: F3-O-01 一人取全額
    Given amount=100、單一人 M1、weight=1
    When 呼叫 settleRemainder
    Then M1 的 amount 為 100
    And remainderBonus 為 0
```

### M — 黃金範例

```gherkin
  Scenario: F3-M-01 ⭐ 101 元三人均分（PRD C9-a）
    Given amount=101、三人（甲、乙、丙）權重相同、splitOrder=['甲','乙','丙']
    When 呼叫 settleRemainder
    Then 甲、乙 的 amount 為 34，remainderBonus 為 1
    And 丙 的 amount 為 33，remainderBonus 為 0
    And 三人加總為 101

  Scenario: F3-M-02 1200 元五人均分（整除，全員 bonus=0）
    Given amount=1200、五人均分
    When 呼叫 settleRemainder
    Then 各得 240
    And 全員 remainderBonus 為 0

  Scenario: F3-M-03 1202 元五人均分
    Given amount=1202、五人均分
    When 呼叫 settleRemainder
    Then 前 2 位 amount 為 241
    And 後 3 位 amount 為 240

  Scenario: F3-M-04 splitOrder 改變 → 尾差落點跟著改
    Given amount=101、三人權重相同、splitOrder=['丙','乙','甲']
    When 呼叫 settleRemainder
    Then 丙、乙 為 34，甲 為 33
    # 這條就是 L25 註①「members[] 陣列順序即分攤名單順序」的護欄
```

### E — 負餘數

```gherkin
  Scenario: F3-E-01 自訂金額導致 remainder=-2
    Given raw 的 Σ 比 amount 多 2 元
    When 呼叫 settleRemainder
    Then 前 2 位各 -1
```

---

## Feature 4：F0 對外入口 `splitDetail`

> **對應**：SPEC-ENGINE §5、烤肉/露營模板 fixture

### S（Simple scenarios）— 完整場景

```gherkin
Feature: F0 對外入口（splitDetail）
  身為外部呼叫端（前端預覽 / 後端權威計算），
  我要透過唯一入口 splitDetail 拿到完整的 SplitResult，
  以確保前端顯示與後端記錄兩邊算得一模一樣。

  Background: 烤肉/露營模板
    Given 六條規則、四位成員（小凱/阿豪/小美/佳蓉）已就緒
    And 小凱 = ['大人','不喝酒/開車']（主辦、開車）
    And 阿豪 = ['大人','需搭主辦的車']
    And 小美 = ['大人','吃素','自行前往']
    And 佳蓉 = ['小孩','需搭主辦的車']
```

```gherkin
  Scenario: F0-S-01 肉品 2800 元、四人
    Given 細項 = { amount: 2800, itemTag: '肉品' }
    When 呼叫 splitDetail
    Then shares 包含 小凱、阿豪、佳蓉
    And excluded 包含 小美（吃素 → excluded）
    And 佳蓉 weight=0.5（小孩）
    And 小凱、阿豪 weight=1（rest）
    And totalWeight 為 2.5
    And Σ shares.amount 為 2800

  Scenario: F0-S-02 ⭐ 交通費 1200 元、四人（L9 護欄）
    Given 細項 = { amount: 1200, itemTag: '交通費' }
    When 呼叫 splitDetail
    Then shares 為 [阿豪, 佳蓉]，各 600
    And excluded 包含 小美（自行前往 → excluded）
    And excluded 包含 小凱（trace.kind='excluded-rest'）
    # ⚠️ 若合併 rest 與 no-rule，開車代墊油錢的小凱會被分攤自己付的油錢

  Scenario: F0-S-03 交通費 1200、四人全部沒有交通條件 → no-participant
    Given 四人的 condTags 都不含「自行前往」也不含「需搭主辦的車」
    When 呼叫 splitDetail
    Then validity 為 "no-participant"
    And shares 為 []
    And excluded 四人皆 trace.kind='excluded-rest'

  Scenario: F0-S-04 酒精飲品 1100、四人
    Given 細項 = { amount: 1100, itemTag: '酒精飲品' }
    When 呼叫 splitDetail
    Then 小凱 excluded（不喝酒/開車）
    And 佳蓉 excluded（小孩）
    And 阿豪、小美 各得 550

  Scenario: F0-S-05 免洗餐具 260、四人（無規則）
    Given 細項 = { amount: 260, itemTag: '免洗餐具' }
    And 「免洗餐具」無對應規則
    When 呼叫 splitDetail
    Then 四人皆 trace.kind='no-rule'、weight=1
    And 65 / 65 / 65 / 65
```

---

## Feature 5：H1 主辦中心付款流向 `computeTransfers`

> **對應**：SPEC-ENGINE §6、PRD §5.2、L10 定案

```gherkin
Feature: H1 主辦中心付款流向（computeTransfers）
  身為結算模組，
  我要用主辦中心（hub）策略把所有流向匯總到主辦一人，
  以確保參與者與協辦者之間永遠不產生金流，H3 頁面單一數字口徑。
```

### Z / O

```gherkin
  Scenario: H1-Z-01 全員 net=0
    Given 全員淨額皆為 0
    When 呼叫 computeTransfers
    Then 回傳 []

  Scenario: H1-O-01 主辦、單一收款人
    Given 主辦 net=-800、阿豪 net=+800
    When 呼叫 computeTransfers
    Then 產生 1 筆：主辦 → 阿豪 800
    And 不產生「主辦 → 主辦」的列
```

### M — L10 核心

```gherkin
  Scenario: H1-M-01 三人向主辦匯集
    Given 主辦 +4000、乙 -3000、丙 -1000
    When 呼叫 computeTransfers
    Then 產生 2 筆
    And 乙 → 主辦 3000
    And 丙 → 主辦 1000

  Scenario: H1-M-02 ⭐ 主辦淨額=0 但仍代收代付（L10 核心案例）
    Given 主辦 net=0、阿豪 +3000、小美 -1500、佳蓉 -1500
    When 呼叫 computeTransfers
    Then 產生 3 筆
    And 小美 → 主辦 1500
    And 佳蓉 → 主辦 1500
    And 主辦 → 阿豪 3000
    # ⚠️ 小美/佳蓉 與 阿豪 之間絕不產生任何轉帳

  Scenario: H1-M-03 轉帳筆數 = 主辦以外 net≠0 的人數
    Given 6 人、其中 4 人 net≠0（含主辦）
    When 呼叫 computeTransfers
    Then 筆數為 3
```

### E

```gherkin
  Scenario: H1-E-01 nets 中找不到 hubId
    Given nets 完全沒有 hubId 對應項
    When 呼叫 computeTransfers
    Then 回報錯誤（呼叫端錯誤，每活動恰好一位主辦）
```

---

## Feature 6：不變量（四條）

> **對應**：SPEC-ENGINE §8

```gherkin
Feature: 引擎四條不變量（property-based）
  身為系統，我要在任意合法輸入下都保持四條不變量成立。

  Scenario: INV-01 Σ shares.amount === detail.amount
    Given 任意細項（除 no-participant / custom-* 外）
    When 呼叫 splitDetail
    Then Σ shares.amount 恆等於 detail.amount

  Scenario: INV-02 excluded 每人 amount=0 且有 trace
    Given 任意細項
    When 呼叫 splitDetail
    Then excluded 陣列的每人 amount 皆為 0
    And 每人皆有 trace 供解釋

  Scenario: INV-03 ⭐ Σ nets === 0（付款流向能否配對的根本前提）
    Given 所有細項皆通過驗證
    When 走訪全部細項算出每人 net
    Then Σ nets === 0

  Scenario: INV-04 有規則的細項，manual / custom 資料無效
    Given 一個貼了有規則 itemTag 的細項
    And 該細項被塞了 manualMemberIds 或 customAmounts
    When 呼叫 splitDetail
    Then 手動資料完全不影響結果
```

---

## Feature 7：主辦（Host）UI 流程

> **對應**：PRD §14.1／§14.3／§14.5、doc.json auth/events/rules/items/settle/archive

```gherkin
Feature: 主辦人端到端流程
  身為主辦人（小凱），
  我要 Google 登入 → 建活動 → 設規則 → 記帳 → 結帳 → 檢視付款流向 → 結清封存，
  以便完成一次完整的分帳。
```

### I — 進入／登入

```gherkin
  Scenario: UI-H-I-01 Google OAuth 首次登入 → 建立主辦帳號
    Given 我尚未登入
    When 我點「以 Google 登入」並完成 OAuth 授權
    Then 系統以 Google sub 建立主辦帳號
    And 暱稱與 email 由 Google Profile 帶入
    And 我被導向活動列表首頁

  Scenario: UI-H-I-02 Google 登入回訪
    Given 我的 Google 帳號已建立過主辦帳號
    When 我再次以 Google 登入
    Then 系統不重複建帳號、直接登入
    And 我被導向活動列表首頁

  Scenario: UI-H-E-01 使用者取消 Google 授權
    Given 我點「以 Google 登入」
    When 我在 Google 授權畫面按取消
    Then 留在登入頁、不建立帳號
    And 顯示「登入未完成，請再試一次」
```

### S — 建立活動 + 套用模板

```gherkin
  Scenario: UI-H-S-01 建立活動、選「烤肉/露營」模板
    Given 我已登入為主辦人
    When 我於首頁點「建立活動」
    And 我輸入活動名「中秋公司烤肉」、日期、地點
    And 我選「情境模板 = 烤肉/露營模板」
    And 我點「建立活動」
    Then 活動被建立
    And 該活動的規則自動載入 6 條（肉品/蔬菜/海鮮/主食/酒精飲品/交通費）
    And 該活動的 itemTags 有 16 個
    And 該活動的 condTags 有 8 個
    And 我被導向該活動主頁

  Scenario: UI-H-S-02 建立後不可更換模板（C26）
    Given 我已建立某活動、選了「烤肉/露營模板」
    When 我進入該活動的群組設定
    Then 「更換模板」入口不存在
    But 規則與標籤仍可自由編輯（增／刪／改）
```

### M — 記帳 + 分攤引擎

```gherkin
  Scenario: UI-H-M-01 新增款項卡（含多細項）→ 整筆提交
    Given 我在某活動主頁
    When 我點「新增款項」
    And 我建立 3 筆細項：
      | 名稱 | 金額 | itemTag |
      | 烤肉食材 | 2800 | 肉品 |
      | 木炭與烤具 | 700 | 空 |
      | 飲料與啤酒 | 1100 | 酒精飲品 |
    And 我按「提交」
    Then 三筆細項一次寫入、整筆成功
    And 我被導回活動主頁
    And 該款項卡顯示總額 4600

  Scenario: UI-H-M-02 分攤即時預覽（有規則 → 唯讀）
    Given 我正在新增款項細項「烤肉食材 2800 元、itemTag=肉品」
    When 我在草稿層完成輸入
    Then 分攤區呈唯讀
    And 顯示「本細項套用『肉品』分攤規則，分攤由規則決定」
    And 有「前往規則頁」入口
    And 預覽顯示：小美 excluded、佳蓉 560、小凱 1120、阿豪 1120
```

### E — 擋存四類

```gherkin
  Scenario: UI-H-E-02 ⭐ 除零・情境 A（有規則但無人符合）→ L22 擋存
    Given 細項 1200 元、itemTag=交通費、四人全部沒貼交通條件
    When 我按「提交」
    Then 整筆被擋、停留原頁
    And 該細項分攤區展開、紅框
    And 顯示「無人符合此標籤的分攤規則，請改用其他標籤，或調整規則／成員條件標籤」
    And 頁面頂部顯示「有 1 筆細項需要調整」

  Scenario: UI-H-E-03 除零・情境 B（無規則、手動清空名單）→ L22 擋存
    Given 細項貼無規則標籤、主辦手動取消勾選全部成員
    When 我按「提交」
    Then 顯示「無分攤人員，請至少指定一位分攤者」

  Scenario: UI-H-E-04 全自訂 Σ≠amount → 差額文案擋存
    Given 細項 300、三人全自訂 100/100/50
    When 我按「提交」
    Then 顯示「金額合計與品項金額差 NT$ 50，請調整後再儲存」

  Scenario: UI-H-E-05 全有全無（C12）
    Given 一張卡三筆細項、其中一筆 mismatch
    When 我按「提交」
    Then 三筆全部不寫入
    And 正常兩筆的輸入內容亦完整保留在頁面上
```

### 結帳與封存

```gherkin
  Scenario: UI-H-S-03 結帳（settle）
    Given 我已完成記帳、進入「分帳產出」頁
    When 我確認四維度數字無誤，點「確認結帳」並在對話框按確認
    Then settled=true
    And 邀請碼失效
    And 款項與規則轉唯讀
    And 結帳快照被寫入
    And 我被導向 H2 結帳後活動頁

  Scenario: UI-H-S-04 付款流向清單（H3）
    Given 結帳完成、我為主辦
    When 我進入 H3 付款流向清單
    Then 顯示每筆「某人 → 某人 NT$ X」
    And 不存在勾選框、不存在繳款狀態
    And 底部有「結清活動」按鈕

  Scenario: UI-H-S-05 結清活動 → 封存（無前置條件）
    Given 我在 H3、任何繳款狀態皆不存在
    When 我點「結清活動」
    Then 顯示確認框「結清後活動將完全唯讀、不可還原」
    When 我按確認
    Then archived=true
    And 我被導向封存區
```

---

## Feature 8：協辦者（Co）UI 流程

```gherkin
Feature: 協辦者流程
  身為協辦者（阿豪、免帳號），
  我要靠 session 進活動、代墊記帳、僅能改自己新增的細項。

  Scenario: UI-CO-I-01 免帳號首次加入（邀請碼＋email＋手機）
    Given 我沒有 session
    When 我於進入頁輸入邀請碼、email、手機皆有效
    Then 我被建為免帳號成員、預設參與者
    And session 綁定我
    And 我進入 joinForm 選飲食條件 → 進活動

  Scenario: UI-CO-I-02 session 遺失找回
    Given 我曾加入某活動、活動未結帳、我的 session 已失效
    When 我輸入邀請碼、email、手機三者全對
    Then 我復原為當前角色（如已升協辦，復原為協辦）
    And 綁新 session

  Scenario: UI-CO-I-03 三者未全對
    Given session 失效
    When 我輸入的三者未全對
    Then 顯示「資料不符，無法找回身分」
    And 不透露哪一項錯

  Scenario: UI-CO-M-01 協辦者記帳（自己新增）
    Given 我已被主辦指定為協辦者、已進活動
    When 我點「新增款項」、輸入細項並提交
    Then 款項建立、payer=我
    And 該款項卡標示 author=我

  Scenario: UI-CO-M-02 協辦者僅可編輯自己新增的
    Given 活動中有款項 A（由我建立）與款項 B（由主辦建立）
    When 我開款項 A
    Then 可編輯
    When 我開款項 B
    Then 僅唯讀
    And 顯示「協辦者僅能編輯／刪除自己新增的明細」

  Scenario: UI-CO-E-01 協辦者無法進入分帳產出／H3
    Given 我為協辦
    When 我嘗試以網址進入 /events/{id}/settle
    Then 被導回活動主頁（403 或前端 guard）
```

---

## Feature 9：參與者（Member）UI 流程

```gherkin
Feature: 參與者流程
  身為參與者（小美、免帳號），
  我要能檢視所有款項金額、驗證自己的分攤結果，但不可新增／編輯任何款項。

  Scenario: UI-M-I-01 檢視活動主頁
    Given 我為參與者、已在活動中
    When 我開活動主頁
    Then 我看得到每筆款項金額（透明）
    And 我看得到頂部摘要「合計 / 應分攤 / 已代墊」（後兩者為自己）
    But 我看不到「新增款項」入口
    But 我看不到「分帳產出」入口

  Scenario: UI-M-M-01 檢視規則頁（唯讀）
    Given 我為參與者
    When 我開分攤規則頁
    Then 我看得到六條規則的內容
    And 我看得到「其他人」列的設定
    And 我看得到固定說明區「關於分攤餘數：…」（L13 承載）
    But 所有欄位皆唯讀

  Scenario: UI-M-M-02 檢視個人分攤明細（結帳後）
    Given 活動已結帳、我為參與者
    When 我開個人分攤明細
    Then 我看得到每筆細項對我的分攤金額
    And 未參與的細項顯示 0 元（非整列消失，L25 註④）
    And 加總 = 我的淨額
```

---

## Feature 10：API 契約（doc.json 對應）

> **對應**：go-backend-api.../swagger/index.html，全端點的授權、schema、錯誤碼

```gherkin
Feature: API 契約 — 授權與錯誤碼
  身為 API 消費者，我要對每個端點的授權與 4xx/2xx 有明確預期。

  # ---- Auth ----
  Scenario: API-AUTH-01 POST /auth/google 成功
    Given 前端已取得 Google id_token
    When 我 POST /auth/google
    Then 回應 200 OK
    And body 符合 auth.accountResponse schema
    And Set-Cookie 包含 session

  Scenario: API-AUTH-02 POST /auth/google 401 — token 無效
    Given id_token 過期或簽章錯
    When 我 POST /auth/google
    Then 回應 401
    And body.error 非空

  Scenario: API-AUTH-03 POST /auth/join 成功
    Given 邀請碼有效、email＋手機首次
    When 我 POST /auth/join
    Then 回應 200
    And body 符合 auth.joinResponse schema

  Scenario: API-AUTH-04 POST /auth/join 410 — 邀請碼已結帳失效
    Given 對應活動 settled=true
    When 我 POST /auth/join 帶該邀請碼
    Then 回應 410 Gone

  Scenario: API-AUTH-05 POST /auth/recover — 三者未全對
    When 我 POST /auth/recover 帶未全對的三欄
    Then 回應 404
    And body.error 不透露哪一項錯

  # ---- Events ----
  Scenario: API-EV-01 POST /events 建立活動（僅帳號可）
    Given 我為 Google 帳號登入
    When 我 POST /events 帶 { name, place, template }
    Then 回應 201
    And body 含 invite_code

  Scenario: API-EV-02 POST /events 免帳號被擋
    Given 我為 guest session
    When 我 POST /events
    Then 回應 403

  Scenario: API-EV-03 GET /events/{id} 三角色可見
    Given 我為活動任一角色
    When 我 GET /events/{id}
    Then 回應 200
    And body.my_role 為對應角色

  Scenario: API-EV-04 PATCH /events/{id} 僅主辦可編輯 metadata
    Given 我為參與者
    When 我 PATCH /events/{id}
    Then 回應 403

  # ---- Rules ----
  Scenario: API-RULE-01 POST /events/{id}/rules 主辦新增規則
    Given 我為主辦
    When 我 POST 一條新規則
      # payload 對照 doc.json events.ruleBodyRequest（snake_case）：
      # { "item_tag": "肉品",
      #   "groups": [ { "cond_tag": "adult", "weight_mode": "equal", ... } ],
      #   "rest": { "mode": "include" } }
      # ⚠️ 引擎詞 condSets 在 API 層是 groups；itemTag 是 item_tag
    Then 回應 201
    And body 符合 events.ruleDTO schema

  Scenario: API-RULE-02 POST 相同 item_tag → 409 Conflict
    Given 已有 item_tag='肉品' 的規則
    When 我再 POST 一條 item_tag='肉品'
    Then 回應 409

  Scenario: API-RULE-03 DELETE 已被使用的規則 → 409（★L14 護欄）
    Given 有一筆 item 的 detail.tag 對應到某規則
    When 我 DELETE 該 rule_id
    Then 回應 409
    And body.error 說明「規則使用中」

  # ---- Tags（原子重命名 + 引用防呆）----
  Scenario: API-TAG-01 PATCH /tags/conds/{label} 原子重命名
    Given 有一條件標籤 'adult' 被兩條規則的 groups 引用
    When 我 PATCH label='adult' 新名 'grown_up'
    Then 回應 204
    And 兩條規則的 groups[].cond_tag 同步變為 'grown_up'
    And 所有 members[].tags 內的 'adult' 同步變為 'grown_up'

  Scenario: API-TAG-02 DELETE 使用中的 item_tag → 409（★L21 護欄）
    Given item_tag='食材' 被某條 rule 使用中
    When 我 DELETE /events/{id}/tags/items/食材
    Then 回應 409

  # ---- Items（C12 atomic）----
  Scenario: API-ITEM-01 POST /events/{id}/items 主辦或協辦
    Given 我為主辦或協辦
    When 我 POST 一張款項卡
      # payload 對照 doc.json events.createItemRequest：
      # { "payer_member_id": 3,      # integer id
      #   "has_receipt": false,
      #   "details": [
      #     { "name": "牛五花", "amount": 1200, "tag": "食材" },
      #     { "name": "青菜", "amount": 600, "tag": "食材",
      #       "manual_member_ids": [4, 5],           # 覆寫規則的手動指定
      #       "custom_amounts": { "4": 300, "5": 300 } }
      #   ] }
    Then 回應 201
    And body 符合 events.itemDTO schema
    And body.details[*].allocation 為 splitengine.SplitResult

  Scenario: API-ITEM-02 POST /events/{id}/items 參與者被擋
    Given 我為參與者
    When 我 POST
    Then 回應 403

  Scenario: API-ITEM-03 POST 一筆 detail 負金額 → 全退回（★C12 atomic）
    Given payload.details 有兩筆，其一 amount=-50
    When 我 POST /events/{id}/items
    Then 回應 400
    And 資料庫中兩筆 detail 都不存在（原子性）
    And 前端應停留原表單、保留輸入

  # ---- Settle ----
  Scenario: API-SET-01 POST /events/{id}/settle 422 有除零細項
    Given 活動內存在一筆 no-participant 細項
    When 我 POST /events/{id}/settle
    Then 回應 422 Unprocessable Entity
    And body 符合 events.validationResponse
    And body.details 逐筆列出異常細項

  Scenario: API-SET-02 POST /events/{id}/settle 成功
    Given 全部細項通過驗證
    When 我 POST /settle
    Then 回應 204 No Content
    And 該活動 settled=true

  # ---- Transfers ----
  Scenario: API-XFER-01 GET /events/{id}/transfers 主辦可見
    Given 我為主辦、活動已結帳
    When 我 GET
    Then 回應 200
    And body 符合 events.transfersResponse schema
    And body.strategy 為 "hub"
    And body.hub_id 為主辦的 member_id

  Scenario: API-XFER-02 GET /events/{id}/transfers 協辦被擋
    Given 我為協辦、活動已結帳未封存
    When 我 GET
    Then 回應 403（依 "host only until archived"）

  Scenario: API-XFER-03 hub-only 每筆斷言（★L10 護欄）
    Given 我為主辦、活動已結帳
    When 我 GET /events/{id}/transfers
    Then 對 body.transfers[] 每筆 T：
    And T.from_id != T.to_id                    # I4 無 self-loop
    And T.amount > 0
    And body.hub_id in (T.from_id, T.to_id)     # ★L10 每筆必涉及主辦
    And 不存在任兩位非主辦成員之間的轉帳

  # ---- Archive ----
  Scenario: API-ARCH-01 POST /events/{id}/archive 需 settled
    Given 活動尚未 settled
    When 我 POST /archive
    Then 回應 4xx（依 L16 需 guard）

  Scenario: API-ARCH-02 POST /events/{id}/archive 成功
    Given 活動已 settled、我為主辦
    When 我 POST /archive
    Then 回應 204
    And 活動 archived=true
```

---

## Feature 11：狀態機（Active → Settled → Archived）

```gherkin
Feature: 活動狀態機
  身為系統，我要保證狀態轉換單向、無反悔。

  Scenario: STATE-01 Active → Settled 只走 /settle
    Given 活動 Active
    When 主辦通過 /settle 端點
    Then 活動 Settled

  Scenario: STATE-02 Settled → Archived 只走 /archive
    Given 活動 Settled
    When 主辦通過 /archive 端點
    Then 活動 Archived

  Scenario: STATE-03 Settled 後任何寫入皆被拒
    Given 活動 Settled
    When 任何人（含主辦）嘗試 PATCH item / rule / member
    Then 回應 4xx

  Scenario: STATE-04 Archived 全唯讀但仍可 GET
    Given 活動 Archived
    When 三角色任一 GET /events/{id}
    Then 回應 200
    And 完整四維度資料仍可看
```

---

## 對應矩陣：Feature ↔ PRD / SPEC / doc.json

| Feature | PRD 章節 | SPEC-ENGINE 章節 | doc.json 端點 |
|---------|---------|-----------------|--------------|
| F1 | §3.1、L9、L21 | §2 | — |
| F2 | §3.2、L22 | §3 | — |
| F3 | §3.3 機制一、C9、C30 | §4 | — |
| F0 | §11.5 K 模板 | §5 | 內嵌於 items.allocation |
| H1 | §5.2、L10 | §6 | GET /events/{id}/transfers |
| INV | § 全域 | §8 | — |
| Host UI | §14.1／14.3／14.5 | — | auth.google + events + settle + archive |
| Co UI | §14.6、§10.3、C19 | — | auth.join + auth.recover + items |
| Member UI | §9 D | — | GET /events/{id}/rules / shares / me/details |
| API | §6.4 錯誤總表 + §5 H | — | 全部 |
| State | §14.7 | — | /settle、/archive、L15、L16 |

---

*文件結束。任一 Scenario 皆可直接映射為 pytest 或 Playwright 案例。*
