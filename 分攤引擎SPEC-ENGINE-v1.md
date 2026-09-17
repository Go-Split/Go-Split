# SPEC-ENGINE — 分攤引擎規格 v1

> **對應 PRD**：群體活動分帳工具 PRD v0.14 §3（F 區）、§5.2（H1）
> **套件**：`packages/engine`
> **用途**：SDD 規格。先寫測試、後寫實作。本文件的每個 AC 皆可直接轉為測試案例。

---

## 0. 模組邊界與三條紀律

### 0.1 這個套件是什麼

`packages/engine` 是**零相依的純函數套件**。不 import 任何框架、不讀 DB、不讀全域狀態、不讀時間、不做 I/O。

前端 import 它做即時預覽，後端 import 它算權威值。**必須是同一份**——兩邊算出不同數字，產品當場失去 USP。

### 0.2 三條紀律

| 紀律 | 說明 | 對應 prototype 的問題 |
|------|------|---------------------|
| **純函數** | 所有輸入由參數注入，不讀全域 | `ruleWeight()` 直讀全域 `ST.rules`、`detailShares()` 直讀 `ST.members`（app.js:98, 126）→ 無法單元測試 |
| **永不 throw** | 除零、自訂金額不符等一律以 `validity` 欄位回報，**不決定 UI 行為** | 「擋不擋存」是應用服務層的事、「畫不畫紅框」是 UI 層的事。同一份引擎才能被前端（預覽不擋）與後端（落庫要擋）共用 |
| **整數收斂** | 全程以整數元計算，`minUnit` 參數化（預設 1）。任何浮點中間值必須在 `settleRemainder` 前收斂 | — |

### 0.3 檔案結構

```
packages/engine/
├─ src/
│  ├─ types.ts              # 型別定義（§1）
│  ├─ resolveWeight.ts      # SPEC-F1（§2）
│  ├─ allocate.ts           # SPEC-F2（§3）
│  ├─ settleRemainder.ts    # SPEC-F3（§4）
│  ├─ splitDetail.ts        # SPEC-F0 組裝，唯一對外入口（§5）
│  ├─ computeTransfers.ts   # SPEC-H1（§6）
│  └─ index.ts
└─ test/
   ├─ fixtures/outdoor.ts   # 烤肉模板 fixture（§7）
   ├─ f1-resolve-weight.spec.ts
   ├─ f2-allocate.spec.ts
   ├─ f3-remainder.spec.ts
   ├─ f0-split-detail.spec.ts
   ├─ h1-transfers.spec.ts
   └─ invariants.spec.ts    # 不變量（§8）
```

---

## 1. 型別定義（`types.ts`）

```ts
// ── 輸入 ──────────────────────────────────────────

export type Mode = 'weight' | 'exclude';

export interface CondSet {
  condTags: string[];        // AND 語意：成員須「至少包含」全部
  mode: Mode;
  weight?: number;           // mode='weight' 時必填，0.1 ~ 100，小數 1 位
}

export interface Rule {
  itemTag: string;           // 恰好一個，跨規則唯一
  condSets: CondSet[];       // 有序，由上往下比對，命中即停
  rest: { mode: Mode; weight?: number };  // 「其他人」列，預設 { mode:'weight', weight:1 }
}

export interface Member {
  id: string;
  condTags: string[];        // 貼在人身上的條件標籤
}

export interface Detail {
  id: string;
  amount: number;            // 整數元
  itemTag: string | null;    // 恰好 0 或 1 個
  manualMemberIds?: string[] | null;  // 僅無規則細項可用
  customAmounts?: Record<string, number> | null;  // 僅無規則細項可用
}

// ── 輸出 ──────────────────────────────────────────

export type Validity = 'ok' | 'no-participant' | 'custom-mismatch' | 'custom-overflow';

export type ShareTrace =
  | { kind: 'custom';       value: number }
  | { kind: 'excluded';     ruleItemTag: string; condSetIndex: number; hitCondTags: string[] }
  | { kind: 'excluded-rest'; ruleItemTag: string }
  | { kind: 'weighted';     ruleItemTag: string; condSetIndex: number; hitCondTags: string[];
                            weight: number; totalWeight: number; unitPrice: number;
                            remainderBonus: number }
  | { kind: 'rest';         ruleItemTag: string; weight: number; totalWeight: number;
                            unitPrice: number; remainderBonus: number }
  | { kind: 'no-rule';      weight: 1; totalWeight: number; unitPrice: number;
                            remainderBonus: number };

export interface Share {
  memberId: string;
  amount: number;            // 整數元
  trace: ShareTrace;
}

export interface SplitResult {
  shares: Share[];           // 只含「參與分攤」者；被 exclude 者不在此列
  excluded: Share[];         // 被排除者，amount 一律 0，保留 trace 供解釋
  totalWeight: number;
  unitPrice: number;         // 每份單價（未取整）
  validity: Validity;
  diff?: number;             // custom-mismatch / custom-overflow 時的差額
}
```

> **型別設計說明**
> - `shares` 與 `excluded` 分開：被排除者金額為 0，但**仍需要 trace 才能回答「為什麼我沒份」**。合在一起會讓「加總 = 細項金額」的斷言變複雜。
> - `remainderBonus` 是數字不是 boolean：`minUnit` 若未來不為 1，補位可能不只 1 元。
> - `ShareTrace` 的 `rest` 與 `no-rule` **刻意分開**——這正是 L9 的核心（「有規則但不命中」≠「無規則」）。

---

## 2. SPEC-F1 — `resolveWeight`

### 2.1 簽章

```ts
function resolveWeight(
  itemTag: string | null,
  member: Member,
  rules: Rule[]
): { weight: number; trace: ShareTrace }
```

### 2.2 演算法

```
1. itemTag 為 null              → 回 { weight: 1, trace: { kind:'no-rule' … } }
2. rules 中找不到該 itemTag     → 回 { weight: 1, trace: { kind:'no-rule' … } }
3. 由上往下逐一比對 condSets：
     命中條件 = condSet.condTags 每一個都在 member.condTags 內（AND／至少包含）
     首次命中即停：
       mode='exclude' → { weight: 0, trace:{ kind:'excluded', condSetIndex:i, hitCondTags } }
       mode='weight'  → { weight: w, trace:{ kind:'weighted',  condSetIndex:i, hitCondTags } }
4. 全部未命中                   → 取 rule.rest：
       mode='exclude' → { weight: 0, trace:{ kind:'excluded-rest' } }
       mode='weight'  → { weight: rest.weight ?? 1, trace:{ kind:'rest' } }
```

> trace 中的 `totalWeight`／`unitPrice`／`remainderBonus` 在此階段尚未知，由 F2／F3 回填。F1 只負責 `kind`／`ruleItemTag`／`condSetIndex`／`hitCondTags`／`weight`。

### 2.3 ⭐ 四種結局（工程務必窮舉）

| # | 結局 | weight | trace.kind | 不可與誰合併 |
|---|------|:---:|---|---|
| ① | 命中某條件集合（weight） | 該集合的 weight | `weighted` | — |
| ② | 命中某條件集合（exclude） | 0 | `excluded` | — |
| ③ | **有規則但全部未命中 → 落「其他人」** | rest 的設定（**可能是 0**） | `rest` / `excluded-rest` | **不可與 ④ 合併** |
| ④ | **該 itemTag 無規則**（或未貼標籤） | 1 | `no-rule` | **不可與 ③ 合併** |

**③④ 不可合併，是本規格最關鍵的一條。** ③ 可能不計入（`rest.mode='exclude'`），④ 一定計入。合併會讓烤肉模板的「交通費」規則算錯——開車代墊油錢的主辦會被分攤自己付的油錢。

### 2.4 AC（可直接轉測試）

| # | Given | When | Then |
|---|-------|------|------|
| F1-01 | 肉品規則，member.condTags=['吃素','大人'] | resolveWeight('肉品') | weight=0；kind='excluded'；condSetIndex=0；hitCondTags=['吃素'] |
| F1-02 | 肉品規則，condTags=['小孩','需搭主辦的車'] | 同上 | weight=0.5；kind='weighted'；condSetIndex=1 |
| F1-03 | 肉品規則，condTags=['大人'] | 同上 | weight=1；kind='rest'（肉品規則無自訂 rest → 預設 weight 1） |
| F1-04 | **交通費規則**（rest=exclude），condTags=['大人','不喝酒/開車'] | resolveWeight('交通費') | **weight=0；kind='excluded-rest'** ← L9 核心案例 |
| F1-05 | 交通費規則，condTags=['大人','自行前往'] | 同上 | weight=0；kind='excluded'；condSetIndex=0 |
| F1-06 | 交通費規則，condTags=['小孩','需搭主辦的車'] | 同上 | weight=1；kind='weighted'；condSetIndex=1 |
| F1-07 | rules 中無「水果」規則，任意 member | resolveWeight('水果') | weight=1；**kind='no-rule'**（**不是** 'rest'） |
| F1-08 | itemTag=null | resolveWeight(null) | weight=1；kind='no-rule' |
| F1-09 | 條件集合=[{condTags:['食物過敏','不吃牛'],weight:2.5}]，member 只有['不吃牛'] | 比對 | **未命中**（AND 需全部包含）→ 落 rest |
| F1-10 | 同上，member=['食物過敏','不吃牛','大人'] | 比對 | 命中（至少包含即可，多餘標籤不影響）→ weight=2.5 |
| F1-11 | 酒精飲品規則，condTags=['小孩','需搭主辦的車'] | resolveWeight('酒精飲品') | weight=0；condSetIndex=**1**（'不喝酒/開車' 在第 0 條，未命中；'小孩' 在第 1 條命中） |
| F1-12 | 某規則 condSets=[{['A'],w:2},{['A','B'],w:3}]，member=['A','B'] | 比對 | **命中第 0 條**（由上往下、命中即停），weight=2，**不是** 3 |

### 2.5 輸入校驗（不在引擎內，但測試要涵蓋）

權重校驗（0.1 ≤ w ≤ 100、小數 1 位、輸入 0 自動轉 exclude）屬**輸入層**責任，不在 `resolveWeight` 內執行。引擎假設輸入已合法。但測試應涵蓋：

| # | 輸入 | 期望 |
|---|------|------|
| F1-13 | condSet.mode='weight' 但 weight=0 | 引擎**不 throw**，視為 weight 0（等同 exclude，C25 語意一致） |
| F1-14 | rest.weight 未提供 | 視為 1 |

---

## 3. SPEC-F2 — `allocate`

### 3.1 簽章

```ts
function allocate(
  detail: Detail,
  members: Member[],
  rules: Rule[]
): {
  raw: { memberId: string; weight: number; rawAmount: number; trace: ShareTrace }[];
  excluded: { memberId: string; trace: ShareTrace }[];
  totalWeight: number;
  unitPrice: number;
  validity: Validity;
  diff?: number;
}
```

### 3.2 演算法

```
1. 決定候選名單 pool：
     若 detail 可手動編輯（該 itemTag 無規則）且 manualMemberIds 非 null
        → pool = manualMemberIds 對應的成員
     否則 → pool = 全體 members
2. 對 pool 每人跑 resolveWeight → 得 weight 與 trace
3. 分流：weight === 0 者進 excluded；其餘進 participants
4. 自訂金額處理（僅無規則細項可用）：
     fixedSum = Σ customAmounts
     若 fixedSum > amount            → validity='custom-overflow', diff=fixedSum-amount
     若 participants 全為自訂 且 fixedSum ≠ amount
                                     → validity='custom-mismatch', diff=amount-fixedSum
     自訂者 rawAmount = 其自訂值，trace.kind='custom'
     剩餘金額 rest = amount - fixedSum，由非自訂者依權重分配
5. totalWeight = Σ 非自訂參與者的 weight
6. totalWeight === 0 且無自訂者    → validity='no-participant', unitPrice=0
   否則 unitPrice = rest / totalWeight
7. 非自訂者 rawAmount = weight × unitPrice（**未取整**）
```

### 3.3 除零（L22）

| 條件 | validity | 說明 |
|------|---------|------|
| participants 為空（全部 weight=0） | `no-participant` | 引擎**不 throw**，回空 raw、unitPrice=0 |
| manualMemberIds = []（手動清空名單） | `no-participant` | 同上 |

**引擎只回報事實，不決定擋不擋存。** 擋存是應用服務層依 `validity` 決定（PRD §3.3 機制四第 ④ 類）。

### 3.4 AC

| # | Given | When | Then |
|---|-------|------|------|
| F2-01 | 1000 元，甲 w=2、乙丙落 rest w=1 | allocate | totalWeight=4；unitPrice=250；甲 raw=500、乙丙各 250 |
| F2-02 | 全員落 rest 且 rest.weight=1 | allocate | 退化為均分 |
| F2-03 | 同 F2-01 但 rest.weight 改為 2 | allocate | totalWeight=6；比例隨之變 |
| F2-04 | 某規則 rest.mode='exclude'，全員皆落 rest | allocate | **validity='no-participant'**；totalWeight=0；unitPrice=0；raw=[] ← L22 核心案例 |
| F2-05 | 300 元三人全自訂 100/100/50 | allocate | validity='custom-mismatch'；diff=50 |
| F2-06 | 300 元三人全自訂 100/100/100 | allocate | validity='ok' |
| F2-07 | 300 元，甲自訂 350 | allocate | validity='custom-overflow'；diff=50 |
| F2-08 | 300 元，甲自訂 100，乙丙依權重分 200 | allocate | 甲 trace.kind='custom'；乙丙依 weight 分 200 |
| F2-09 | 貼有規則的標籤 + customAmounts 非空 | allocate | 自訂金額**被忽略**（L14：有規則時不可用），一律走規則 |
| F2-10 | 貼有規則的標籤 + manualMemberIds 非空 | allocate | manualMemberIds **被忽略**（L14），pool = 全體 |

> F2-09／F2-10 是 L14 在引擎層的保險。即使上層漏擋，引擎也不會讓手動資料生效——確保「有規則的細項上永遠不存在手動分攤資料」這個不變量在引擎層也成立。

---

## 4. SPEC-F3 — `settleRemainder`

### 4.1 簽章

```ts
function settleRemainder(
  raw: { memberId: string; weight: number; rawAmount: number; trace: ShareTrace }[],
  amount: number,
  splitOrder: string[],        // 分攤名單順序，決定補位次序（C9）
  minUnit: number = 1
): Share[]
```

### 4.2 演算法

```
1. 每人先取整：floor(rawAmount / minUnit) × minUnit
2. remainder = amount - Σ 取整後金額
3. 依 splitOrder 順序，由上往下每人 +minUnit，直到 remainder 用盡
4. remainder 為負（自訂金額導致）→ 依同一順序由上往下每人 -minUnit
5. 被補位者 trace.remainderBonus = ±minUnit，未被補位者 = 0
```

> `splitOrder` 必須由呼叫端傳入且**與結帳快照一致**。成員被刪除或順序變動會改變尾差落點，這是 PRD §5 要求凍結 `splitOrder` 的原因。

### 4.3 AC

| # | Given | When | Then |
|---|-------|------|------|
| F3-01 | 101 元三人均分，order=[甲,乙,丙] | settleRemainder | 甲 34、乙 34、丙 33；甲乙 remainderBonus=1、丙=0 ← PRD C9-a 黃金範例 |
| F3-02 | 1200 元五人均分 | settleRemainder | 各 240；**全員 remainderBonus=0**（整除） |
| F3-03 | 1202 元五人均分 | settleRemainder | 前 2 位 241、其餘 240 |
| F3-04 | 同 F3-01 但 order=[丙,乙,甲] | settleRemainder | **丙 34、乙 34、甲 33** — 順序改變尾差落點 |
| F3-05 | 自訂金額導致 remainder = -2 | settleRemainder | 前 2 位各 -1 |
| F3-06 | raw 為空（no-participant） | settleRemainder | 回 []；**不 throw**、不無限迴圈 |
| F3-07 | 任意情境 | settleRemainder | **Σ shares.amount === amount**（恆等式，見 §8） |

---

## 5. SPEC-F0 — `splitDetail`（唯一對外入口）

### 5.1 簽章

```ts
function splitDetail(
  detail: Detail,
  members: Member[],
  rules: Rule[],
  splitOrder?: string[],       // 未提供則採 members 原順序
  minUnit: number = 1
): SplitResult
```

### 5.2 組裝

```
allocate() → settleRemainder() → 回填 trace 的 totalWeight / unitPrice / remainderBonus
           → 組裝 SplitResult（shares / excluded / validity / diff）
```

### 5.3 AC

| # | 情境 | 期望 |
|---|------|------|
| F0-01 | 烤肉食材 2800「肉品」，四人（小凱/阿豪/小美/佳蓉） | 小美 excluded（吃素）；佳蓉 w=0.5；小凱阿豪 w=1（rest）；totalWeight=2.5；Σ=2800 |
| F0-02 | 交通費 1200「交通費」，同四人 | 阿豪 w=1、佳蓉 w=1（需搭主辦的車）；小美 excluded（自行前往）；**小凱 excluded-rest**；totalWeight=2；各 600 |
| F0-03 | 交通費 1200，四人**全部沒有交通條件標籤** | **validity='no-participant'**；shares=[]；excluded 四人皆 kind='excluded-rest' |
| F0-04 | 飲料 1100「酒精飲品」，同四人 | 小凱 excluded（不喝酒/開車）；佳蓉 excluded（小孩）；阿豪小美 w=1；各 550 |
| F0-05 | 免洗餐具 260「免洗餐具」（**無規則**），同四人 | 四人皆 kind='no-rule' w=1；65/65/65/65 |
| F0-06 | 木炭 700「烤肉工具」（**無規則**），手動只勾小凱阿豪 | 兩人各 350；trace.kind='no-rule' |

---

## 6. SPEC-H1 — `computeTransfers`

### 6.1 簽章

```ts
type Strategy = 'hub' | 'greedy';

function computeTransfers(
  nets: { memberId: string; net: number }[],   // net = 已代墊 - 應分攤
  opts: { strategy: Strategy; hubId?: string }
): { from: string; to: string; amount: number }[]
```

### 6.2 為什麼是單一出口

prototype 目前**同時算了兩套**且畫面各用各的：`transfers`（貪婪極小化，app.js:391）給 payments 頁；`flowRows`（主辦為中心的 hub 星狀，app.js:404）給 settle／settledEvent／archived 三頁。**同一活動兩個畫面會顯示不同的轉帳對象**（PRD L10）。

策略選擇尚未定案（業務情境傾向 hub），但**收斂為單一出口不可延後**：四個畫面必須投影自同一份輸出，策略以參數決定，並隨結帳快照凍結。

### 6.3 兩種策略

| 策略 | 演算法 |
|------|--------|
| `greedy` | 債務極小化：net<0 者與 net>0 者配對，每次取 `min(|debt|, credit)`，直到全部歸零 |
| `hub` | 全部經由 hubId：net<0 者 → hub；hub → net>0 者。筆數 = net≠0 的人數 |

### 6.4 AC

| # | Given | When | Then |
|---|-------|------|------|
| H1-01 | nets 甲+300 乙-100 丙-200 | greedy | 乙→甲 100、丙→甲 200（2 筆） |
| H1-02 | 同上 | hub（hubId=甲） | 乙→甲 100、丙→甲 200（同結果，因甲本就是唯一債權人） |
| H1-03 | nets 甲+100 乙+200 丙-300 | hub（hubId=甲） | 丙→甲 300、甲→乙 200（甲過手） |
| H1-04 | 同上 | greedy | 丙→乙 200、丙→甲 100 |
| H1-05 | 全員 net=0 | 任一策略 | 回 [] |
| H1-06 | 任意 nets | 任一策略 | **Σnet 必須為 0**，否則回報錯誤（見 §8 不變量三） |

---

## 7. Fixture — 烤肉／露營模板（`test/fixtures/outdoor.ts`）

> 來源：PRD §11.5 K 區「須原封不動存為後端模板預設值」。同時作為**回歸測試基準**。

### 7.1 六條規則

```ts
export const outdoorRules: Rule[] = [
  { itemTag: '肉品', condSets: [
      { condTags: ['吃素'], mode: 'exclude' },
      { condTags: ['小孩'], mode: 'weight', weight: 0.5 },
      { condTags: ['晚到'], mode: 'weight', weight: 0.5 } ],
    rest: { mode: 'weight', weight: 1 } },

  { itemTag: '蔬菜', condSets: [
      { condTags: ['吃素'], mode: 'weight', weight: 1.5 },
      { condTags: ['小孩'], mode: 'weight', weight: 0.5 } ],
    rest: { mode: 'weight', weight: 1 } },

  { itemTag: '海鮮', condSets: [
      { condTags: ['海鮮過敏'], mode: 'exclude' },
      { condTags: ['小孩'], mode: 'weight', weight: 0.5 } ],
    rest: { mode: 'weight', weight: 1 } },

  { itemTag: '主食', condSets: [
      { condTags: ['小孩'], mode: 'weight', weight: 0.5 } ],
    rest: { mode: 'weight', weight: 1 } },

  { itemTag: '酒精飲品', condSets: [
      { condTags: ['不喝酒/開車'], mode: 'exclude' },
      { condTags: ['小孩'], mode: 'exclude' } ],
    rest: { mode: 'weight', weight: 1 } },

  // ⭐ 唯一使用 rest.exclude 的規則 —— L9 的存在理由
  { itemTag: '交通費', condSets: [
      { condTags: ['自行前往'], mode: 'exclude' },
      { condTags: ['需搭主辦的車'], mode: 'weight', weight: 1 } ],
    rest: { mode: 'exclude' } },
];
```

### 7.2 四位成員

```ts
export const outdoorMembers: Member[] = [
  { id: 'm1', condTags: ['大人', '不喝酒/開車'] },      // 小凱（主辦、開車）
  { id: 'm2', condTags: ['大人', '需搭主辦的車'] },      // 阿豪
  { id: 'm3', condTags: ['大人', '吃素', '自行前往'] },  // 小美
  { id: 'm4', condTags: ['小孩', '需搭主辦的車'] },      // 佳蓉
];
```

### 7.3 條件標籤庫（8）與項目標籤庫（16）

```ts
export const outdoorCondTags = ['吃素','大人','小孩','晚到','海鮮過敏','不喝酒/開車','自行前往','需搭主辦的車'];

export const outdoorItemTags = ['肉品','蔬菜','海鮮','主食','水果','甜點','酒精飲品','無酒精飲品',
  '調味料','烤肉工具','露營工具','免洗餐具','清潔用品','場地費','設備租借費','交通費'];
```

### 7.4 ⭐ 交通費回歸測試（L9 的護欄）

這組測試存在的目的，是防止有人把 `rest` 當成冗餘設計刪掉。

```ts
// 交通費 1200，四人
// 期望：阿豪 600、佳蓉 600、小美 0（自行前往）、小凱 0（落 rest → exclude）
//
// ⚠️ 若 rest 被改為「預設權重 1」：
//    小凱會落 rest → w=1 → 分攤 400
//    但小凱正是開車、代墊油錢的人 → 他被分攤自己付的油錢
//    此測試必須失敗，作為規格退版的護欄
```

---

## 8. 不變量（`test/invariants.spec.ts`）

以下四條在**任何輸入下**都必須成立，建議以 property-based testing 隨機生成輸入驗證。

| # | 不變量 | 說明 |
|---|--------|------|
| **一** | `Σ shares.amount === detail.amount` | 除 `validity='no-participant'`（此時 shares=[]，由上層擋存）與 `custom-*`（由上層擋存）外恆成立 |
| **二** | `excluded` 中每人 `amount === 0` 且皆有 trace | 被排除者必須能解釋「為什麼沒份」 |
| **三** | `Σ nets === 0` | 所有細項都通過驗證的前提下，Σ代墊 必等於 Σ分攤。**這條若破，付款流向永遠無法配對、款項永遠無法結清**（L22 的根本理由） |
| **四** | 有規則的細項，`manualMemberIds` 與 `customAmounts` 無效 | L14／L21 三鎖在引擎層的最後防線 |

```ts
// 不變量三的測試寫法
const allShares = details.flatMap(d => splitDetail(d, members, rules).shares);
const owed = groupSum(allShares, s => s.memberId, s => s.amount);
const paid = groupSum(details, d => d.payerId, d => d.amount);
const nets = members.map(m => (paid[m.id] ?? 0) - (owed[m.id] ?? 0));
expect(sum(nets)).toBe(0);
```

---

## 9. 實作順序建議

| 階段 | 內容 | 完成的意義 |
|:---:|------|-----------|
| 1 | `types.ts` + `resolveWeight` + F1 全部 AC | 四種結局窮舉完成，L9 護欄就位 |
| 2 | `allocate` + F2 全部 AC | 除零與自訂金額的 validity 回報完成（L22） |
| 3 | `settleRemainder` + F3 全部 AC | 尾差與恆等式完成（C9／C30） |
| 4 | `splitDetail` + F0 AC + fixture | **可用烤肉模板跑出完整分攤結果，全程在 CLI，零 UI** |
| 5 | `computeTransfers` + H1 AC | L10 收斂完成 |
| 6 | `invariants.spec.ts` | 四條不變量驗證 |

> **階段 4 結束時，整個引擎已可驗收**——餵入烤肉模板的 6 條規則與 4 位成員，跑出 7 筆細項的完整分攤與 trace，一行 UI 都不用寫。

---

## 10. 尚未定案、會回頭影響本 spec 的項目

| 項目 | 影響範圍 | 現況 |
|------|---------|------|
| **L10 轉帳策略**（hub / greedy） | `computeTransfers` 的預設值 | 擱置中。本 spec 已以參數化處理，選定後改預設值即可，不影響其他模組 |
| **L13 推導輸入凍結** | 不影響引擎本身 | 引擎已回傳 trace（決策一，本 spec 採用）。快照是否凍結 `inputs` 屬應用層，待工程評估 |
| **L4 tags[] 收斂** | `Detail.itemTag` 型別 | 本 spec 已按定案採 `string \| null`（純量）。prototype 的 `tags[]` 陣列需在接軌時轉換 |
