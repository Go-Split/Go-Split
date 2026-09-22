"""
分帳吧分攤引擎 — SPEC-ENGINE v1.1 Python 移植

五個核心函式：
  F1 resolve_weight(rule, members)       → {mid: weight}
  F2 allocate(amount, weights)           → {mid: base_share, remainder}
  F3 settle_remainder(base_shares, remainder, payer)  → {mid: final_share}
  F0 split_detail(item, rules, members)  → {mid: share, meta}
  H1 compute_transfers(net, host_id)     → [(from, to, amount)]

四條不變量：
  I1  Σ shares == amount        (整體守恆)
  I2  shares[m] >= 0            (非負)
  I3  Σ transfers == Σ |net|/2  (轉帳守恆)
  I4  沒有自付自收              (無 self-loop)
"""

from typing import Any
from tests.fixtures.outdoor_template import member_matches_cond, get_member


# ── F1  resolve_weight ─────────────────────────────────────
def resolve_weight(rule: dict, members: list[dict]) -> dict[str, float]:
    """
    依規則計算每位成員的權重。
    - equal : 符合條件者權重 1，其餘 0
    - ratio : 使用 rule["weights"] 覆寫，未指定者為 1（若符合條件）
    - fixed : 使用 rule["weights"] 直接指定，未指定者為 0
    回傳 { mid: weight }，僅包含 weight > 0 的成員
    """
    result: dict[str, float] = {}
    mode = rule.get("weightMode", "equal")
    weights_override = rule.get("weights", {})
    cond_tags = rule.get("condTags", [])

    for m in members:
        matches = member_matches_cond(m, cond_tags)

        if mode == "equal":
            w = 1.0 if matches else 0.0

        elif mode == "ratio":
            if not matches:
                w = 0.0
            else:
                w = float(weights_override.get(m["id"], 1.0))

        elif mode == "fixed":
            w = float(weights_override.get(m["id"], 0.0))

        else:
            raise ValueError(f"unknown weightMode: {mode}")

        if w > 0:
            result[m["id"]] = w

    return result


# ── F2  allocate ───────────────────────────────────────────
def allocate(amount: int, weights: dict[str, float]) -> dict[str, Any]:
    """
    依權重分配 amount（整數台幣）給各成員。
    採整數地板分配 + 記錄餘數。
    回傳:
      {
        "base": { mid: floor_share },   # 各成員地板整數份額
        "remainder": int,               # 餘數（0 ~ n-1 之間）
      }
    """
    if amount < 0:
        raise ValueError("amount must be non-negative")
    if not weights:
        # ★ L22：不 throw，回傳空 base + 全額餘數（呼叫端決定處理）
        return {"base": {}, "remainder": amount}

    total_w = sum(weights.values())
    if total_w <= 0:
        return {"base": {}, "remainder": amount}

    base: dict[str, int] = {}
    for mid, w in weights.items():
        raw = amount * w / total_w
        base[mid] = int(raw)   # 地板

    used = sum(base.values())
    remainder = amount - used
    return {"base": base, "remainder": remainder}


# ── F3  settle_remainder ───────────────────────────────────
def settle_remainder(
    base: dict[str, int],
    remainder: int,
    payer: str | None = None,
    members_order: list[str] | None = None,
) -> dict[str, int]:
    """
    將 remainder 整數餘數「回付款人」（若付款人在 base 中）。
    - C9-a 規則：餘數優先回付款人（非均分）
    - 若付款人不在 base 中，依 members_order 由後往前輪流 +1
    - 若無序，字典鍵順序作為 fallback
    """
    result = dict(base)
    if remainder == 0:
        return result

    if payer and payer in result:
        result[payer] += remainder
        return result

    # fallback：輪流 +1
    order = members_order or list(result.keys())
    i = 0
    while remainder > 0 and order:
        mid = order[i % len(order)]
        if mid in result:
            result[mid] += 1
            remainder -= 1
        i += 1

    return result


# ── F0  split_detail ───────────────────────────────────────
def split_detail(
    item: dict,
    rules: list[dict],
    members: list[dict],
) -> dict[str, Any]:
    """
    單筆款項細項分攤。
    步驟：
      1. 找出符合此 item.itemTag 的規則（若無 → no-rule 全員均分）
      2. resolve_weight 計算符合成員的權重
      3. rest=exclude 時，未符合條件者不參與（例如 L9：開車者不分攤交通費）
      4. rest=include 時，未符合條件者按平均權重加入
      5. allocate → settle_remainder
    回傳:
      {
        "shares": { mid: amount },
        "meta": {
          "rule_id": str | None,      # 使用的規則 id
          "rest_mode": str,           # "include" / "exclude" / "no-rule"
          "excluded_rest": [mid, ...] # ★L9 護欄：被排除的成員 id
        }
      }
    """
    amount = item["amount"]
    item_tag = item.get("itemTag")
    payer = item.get("payer")

    # 找符合的規則（priority 小者優先）
    matching_rules = [r for r in rules if item_tag in r.get("itemTags", [])]
    matching_rules.sort(key=lambda r: r.get("priority", 999))

    if not matching_rules:
        # no-rule：全員均分
        weights = {m["id"]: 1.0 for m in members}
        alloc = allocate(amount, weights)
        shares = settle_remainder(alloc["base"], alloc["remainder"], payer)
        return {
            "shares": shares,
            "meta": {"rule_id": None, "rest_mode": "no-rule", "excluded_rest": []},
        }

    # 使用第一個匹配規則
    rule = matching_rules[0]
    weights = resolve_weight(rule, members)

    excluded: list[str] = []
    if rule.get("rest") == "exclude":
        # ★L9 護欄：未符合條件者不加入
        excluded = [m["id"] for m in members if m["id"] not in weights]
    else:
        # rest=include：未符合者仍分攤（權重 1）
        for m in members:
            if m["id"] not in weights:
                weights[m["id"]] = 1.0

    alloc = allocate(amount, weights)
    shares = settle_remainder(alloc["base"], alloc["remainder"], payer)

    # 補齊 excluded 成員（分攤為 0，方便下游聚合）
    for mid in excluded:
        shares.setdefault(mid, 0)

    return {
        "shares": shares,
        "meta": {
            "rule_id": rule["id"],
            "rest_mode": rule.get("rest", "include"),
            "excluded_rest": excluded,
        },
    }


# ── H1  compute_transfers ──────────────────────────────────
def compute_transfers(
    net: dict[str, int],
    host_id: str,
) -> list[dict]:
    """
    依「主辦中心 (hub) 單一策略」計算最終付款流向。
    ★L10 定案：所有 net != 0 的成員只與主辦人相互轉帳。
    - net[mid] > 0 : 該成員應收（付款人）→ 主辦人付給他
    - net[mid] < 0 : 該成員應付 → 他付給主辦人
    - net[host] 為 hub 的收付合流，最終應趨零

    回傳 [{"from": mid, "to": mid, "amount": int}, ...]
    保證：
      - 沒有 self-loop
      - 每筆 amount > 0
      - 非主辦人之間絕不產生轉帳
    """
    transfers: list[dict] = []
    # 遍歷所有非主辦成員
    for mid, val in net.items():
        if mid == host_id or val == 0:
            continue
        if val > 0:
            # 該成員應收 → 主辦付給他
            transfers.append({"from": host_id, "to": mid, "amount": val})
        else:
            # 該成員應付 → 他付給主辦
            transfers.append({"from": mid, "to": host_id, "amount": -val})

    return transfers


# ── 聚合器：多筆 item → 淨額 net ────────────────────────────
def aggregate_net(
    items: list[dict],
    rules: list[dict],
    members: list[dict],
) -> dict[str, int]:
    """
    彙總所有 items 的 split_detail 結果，計算每人淨額。
    net[mid] = 已付出金額 - 應分攤金額
    """
    paid = {m["id"]: 0 for m in members}
    shared = {m["id"]: 0 for m in members}

    for item in items:
        paid[item["payer"]] = paid.get(item["payer"], 0) + item["amount"]
        detail = split_detail(item, rules, members)
        for mid, amt in detail["shares"].items():
            shared[mid] = shared.get(mid, 0) + amt

    return {mid: paid[mid] - shared[mid] for mid in paid}
