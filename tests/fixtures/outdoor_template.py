"""
烤肉/露營情境 fixture — 對應 SPEC-ENGINE v1.1 附錄 A / PRD §14 測試資料集
四位成員、6 條規則、8 個條件標籤、16 個項目標籤
"""
from dataclasses import dataclass


# ─── 具語意的 persona 常數（供 E2E 測試 import 使用）────────
@dataclass(frozen=True)
class OutdoorPersona:
    """對應 UML 三角色 + 一位小孩參與者的測試 persona"""
    member_id: str
    display_name: str
    role: str           # host / co / member
    email: str
    phone: str
    is_driver: bool
    is_child: bool


HOST_MEMBER = OutdoorPersona(
    member_id="m_kai",
    display_name="小凱",
    role="host",
    email="kai@example.com",
    phone="0911111111",
    is_driver=True,
    is_child=False,
)

CO_ORGANIZER_MEMBER = OutdoorPersona(
    member_id="m_hao",
    display_name="阿豪",
    role="co",
    email="hao@example.com",
    phone="0922222222",
    is_driver=False,
    is_child=False,
)

PARTICIPANT_MEMBER = OutdoorPersona(
    member_id="m_mei",
    display_name="小美",
    role="member",
    email="mei@example.com",
    phone="0933333333",
    is_driver=False,
    is_child=False,
)

PARTICIPANT_CHILD_MEMBER = OutdoorPersona(
    member_id="m_jia",
    display_name="佳蓉",
    role="member",
    email="jia@example.com",
    phone="0944444444",
    is_driver=False,
    is_child=True,
)

ALL_OUTDOOR_PERSONAS = [
    HOST_MEMBER,
    CO_ORGANIZER_MEMBER,
    PARTICIPANT_MEMBER,
    PARTICIPANT_CHILD_MEMBER,
]


# ── 四位測試 persona（原格式，供引擎測試相容用）─────────────
OUTDOOR_MEMBERS = [
    {"id": "m_kai",    "name": "小凱",  "role": "host",   "isDriver": True,  "eats": True,  "drinks": True,  "isChild": False},
    {"id": "m_hao",    "name": "阿豪",  "role": "co",     "isDriver": False, "eats": True,  "drinks": True,  "isChild": False},
    {"id": "m_mei",    "name": "小美",  "role": "member", "isDriver": False, "eats": True,  "drinks": False, "isChild": False},
    {"id": "m_jia",    "name": "佳蓉",  "role": "member", "isDriver": False, "eats": True,  "drinks": False, "isChild": True},
]

# ── 8 個條件標籤 (condTag) ─────────────────────────────────
OUTDOOR_COND_TAGS = [
    "driver",       # 開車者
    "non_driver",   # 非開車者
    "adult",        # 成人
    "child",        # 小孩
    "eater",        # 有吃
    "drinker",      # 有喝
    "vegetarian",   # 素食
    "all",          # 全體
]

# ── 16 個項目標籤 (itemTag) ────────────────────────────────
OUTDOOR_ITEM_TAGS = [
    "food_meat", "food_veggie", "food_snack", "food_dessert",
    "drink_alcohol", "drink_soft", "drink_water",
    "transport_gas", "transport_toll", "transport_parking",
    "gear_charcoal", "gear_tent", "gear_disposable",
    "site_fee", "misc_ice", "misc_other",
]

# ── 6 條規則 (SPEC-ENGINE §附錄 A) ──────────────────────────
# 規則權重： weightMode ∈ {equal, ratio, fixed}
# rest 策略： rest ∈ {include, exclude}
OUTDOOR_RULES = [
    {
        "id": "R1",
        "name": "食物（成人有吃）",
        "itemTags": ["food_meat", "food_veggie", "food_snack", "food_dessert"],
        "condTags": ["eater", "adult"],
        "weightMode": "equal",
        "weights": {},         # equal 時忽略
        "rest": "include",     # rest 一併分攤
        "priority": 1,
    },
    {
        "id": "R2",
        "name": "食物（小孩半權）",
        "itemTags": ["food_meat", "food_veggie", "food_snack", "food_dessert"],
        "condTags": ["eater", "child"],
        "weightMode": "ratio",
        "weights": {"m_jia": 0.5},   # 小孩 0.5 權重
        "rest": "include",
        "priority": 2,
    },
    {
        "id": "R3",
        "name": "酒類（只算有喝）",
        "itemTags": ["drink_alcohol"],
        "condTags": ["drinker", "adult"],
        "weightMode": "equal",
        "weights": {},
        "rest": "exclude",   # 沒喝的不分攤
        "priority": 3,
    },
    {
        "id": "R4",
        "name": "交通費（開車者除外）",
        "itemTags": ["transport_gas", "transport_toll", "transport_parking"],
        "condTags": ["non_driver"],
        "weightMode": "equal",
        "weights": {},
        "rest": "exclude",     # ★L9 護欄：開車者落 rest 必為 excluded-rest
        "priority": 4,
    },
    {
        "id": "R5",
        "name": "場地與裝備（全體均分）",
        "itemTags": ["gear_charcoal", "gear_tent", "gear_disposable", "site_fee"],
        "condTags": ["all"],
        "weightMode": "equal",
        "weights": {},
        "rest": "include",
        "priority": 5,
    },
    {
        "id": "R6",
        "name": "軟性飲料與雜項（全體均分）",
        "itemTags": ["drink_soft", "drink_water", "misc_ice", "misc_other"],
        "condTags": ["all"],
        "weightMode": "equal",
        "weights": {},
        "rest": "include",
        "priority": 6,
    },
]


# ── 7 筆測試款項細項 (Σ=7760) ───────────────────────────────
OUTDOOR_ITEMS = [
    {"id": "i1", "name": "牛五花", "amount": 1200, "itemTag": "food_meat",     "payer": "m_kai"},
    {"id": "i2", "name": "青菜盤", "amount":  600, "itemTag": "food_veggie",   "payer": "m_hao"},
    {"id": "i3", "name": "啤酒",   "amount":  900, "itemTag": "drink_alcohol", "payer": "m_kai"},
    {"id": "i4", "name": "油錢",   "amount": 1500, "itemTag": "transport_gas", "payer": "m_kai"},
    {"id": "i5", "name": "營地費", "amount": 2000, "itemTag": "site_fee",      "payer": "m_hao"},
    {"id": "i6", "name": "冰塊",   "amount":  160, "itemTag": "misc_ice",      "payer": "m_mei"},
    {"id": "i7", "name": "木炭",   "amount":  400, "itemTag": "gear_charcoal", "payer": "m_kai"},
]
# Σ 驗算： 1200+600+900+1500+2000+160+400 = 6760
# 為到 7760，加一筆
OUTDOOR_ITEMS.append(
    {"id": "i8", "name": "拋棄式餐具", "amount": 1000, "itemTag": "gear_disposable", "payer": "m_hao"}
)

# 總支付
OUTDOOR_TOTAL = sum(it["amount"] for it in OUTDOOR_ITEMS)  # 7760


# ── C9-a 黃金範例（餘 1 元回付款人）─────────────────────────
CASE_C9A = {
    "amount": 101,
    "members": ["m_kai", "m_hao", "m_mei"],
    "payer": "m_kai",
    "expected": {
        "m_kai": 35,   # 33 + 2 餘（+1 回付款人）
        "m_hao": 33,
        "m_mei": 33,
    },
}


def get_member(mid: str) -> dict:
    """取得 member dict"""
    return next((m for m in OUTDOOR_MEMBERS if m["id"] == mid), None)


def member_matches_cond(member: dict, cond_tags: list[str]) -> bool:
    """判斷成員是否符合條件標籤集合（AND 邏輯）"""
    if "all" in cond_tags:
        return True
    for tag in cond_tags:
        if tag == "driver"       and not member["isDriver"]:  return False
        if tag == "non_driver"   and     member["isDriver"]:  return False
        if tag == "adult"        and     member["isChild"]:   return False
        if tag == "child"        and not member["isChild"]:   return False
        if tag == "eater"        and not member["eats"]:      return False
        if tag == "drinker"      and not member["drinks"]:    return False
    return True
