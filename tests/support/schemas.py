"""
從 doc.json (Swagger 2.0) 讀 definitions 做 jsonschema 驗證
真實 definitions 名稱如 events.eventDetailResponse / splitengine.Transfer 等
"""
import json
import os
from pathlib import Path
from typing import Any
from jsonschema import Draft7Validator


# doc.json 位置：預設從專案根下 docs/doc.json 讀取
# 可用環境變數 GOSPLIT_DOC_JSON 覆寫
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOC_JSON_PATH = Path(os.getenv(
    "GOSPLIT_DOC_JSON",
    str(_PROJECT_ROOT / "docs" / "doc.json")
))


def _make_validator(schema: dict, root: dict) -> Draft7Validator:
    """建立含 $ref 解析器的 validator；優先使用 jsonschema >= 4.18 的 referencing
    套件，若不可用則回退到 RefResolver（會有 deprecation warning）。"""
    try:
        from referencing import Registry, Resource
        from referencing.jsonschema import DRAFT7

        resource = Resource(contents=root, specification=DRAFT7)
        # Swagger 2.0 的 $ref 是 "#/definitions/X"，掛在同一份 root 文件
        registry = Registry().with_resource(uri="", resource=resource)
        return Draft7Validator(schema, registry=registry)
    except ImportError:
        # jsonschema < 4.18 或無 referencing
        from jsonschema import RefResolver
        resolver = RefResolver.from_schema(root, store={"": root})
        return Draft7Validator(schema, resolver=resolver)


class SchemaRegistry:
    """讀 Swagger 2.0 doc.json，將 definitions 轉為 jsonschema 可驗證形式"""

    def __init__(self, doc_path: Path = DOC_JSON_PATH):
        self.doc_path = doc_path
        self._raw: dict = {}
        self._defs: dict[str, dict] = {}
        self._loaded = False

    def _load(self):
        if self._loaded:
            return
        if not self.doc_path.exists():
            # 允許離線測試：不 raise，讓 validator 呼叫端自己 skip
            self._loaded = True
            return
        self._raw = json.loads(self.doc_path.read_text(encoding="utf-8"))
        self._defs = self._raw.get("definitions", {})
        self._loaded = True

    def available(self) -> bool:
        self._load()
        return bool(self._defs)

    def get(self, name: str) -> dict:
        self._load()
        if name not in self._defs:
            raise KeyError(f"schema {name} not found in doc.json")
        return dict(self._defs[name])

    def validate(self, name: str, data: Any):
        """驗證資料是否符合 schema；不符則 raise ValidationError"""
        self._load()
        if not self._defs:
            raise RuntimeError(
                f"doc.json 不存在於 {self.doc_path}；"
                "請放到 docs/doc.json 或設 GOSPLIT_DOC_JSON")
        schema = self.get(name)
        _make_validator(schema, self._raw).validate(data)


registry = SchemaRegistry()


# ── doc.json 真實 definition 名稱常數 ─────────────────────
class Schemas:
    # auth
    AUTH_GOOGLE_LOGIN_REQ = "auth.googleLoginRequest"
    AUTH_ACCOUNT_RESP = "auth.accountResponse"
    AUTH_JOIN_REQ = "auth.joinRequest"
    AUTH_JOIN_RESP = "auth.joinResponse"
    AUTH_RECOVER_REQ = "auth.recoverRequest"
    AUTH_RECOVER_RESP = "auth.recoverResponse"
    AUTH_INVITATION_RESP = "auth.invitationResponse"
    AUTH_ERROR_RESP = "auth.errorResponse"

    # events
    CREATE_EVENT_REQ = "events.createEventRequest"
    CREATE_EVENT_RESP = "events.createEventResponse"
    EVENT_LIST_ITEM = "events.eventListItem"
    EVENTS_RESP = "events.eventsResponse"
    EVENT_DETAIL_RESP = "events.eventDetailResponse"
    METADATA_REQ = "events.metadataRequest"
    JOIN_REQ = "events.joinRequest"
    JOIN_RESP = "events.joinResponse"

    # members
    CREATE_MEMBER_REQ = "events.createMemberRequest"
    UPDATE_MEMBER_REQ = "events.updateMemberRequest"
    MEMBER_DTO = "events.memberDTO"
    MEMBERS_RESP = "events.membersResponse"
    BIND_MEMBER_REQ = "events.bindMemberRequest"
    ROLE_RESP = "events.roleResponse"

    # items
    CREATE_ITEM_REQ = "events.createItemRequest"
    UPDATE_ITEM_REQ = "events.updateItemRequest"
    CREATE_DETAIL_REQ = "events.createDetailRequest"
    ITEM_DTO = "events.itemDTO"
    ITEMS_RESP = "events.itemsResponse"
    DETAIL_DTO = "events.detailDTO"
    DETAIL_ISSUE = "events.detailIssue"

    # rules & tags
    RULE_BODY_REQ = "events.ruleBodyRequest"
    RULE_UPDATE_REQ = "events.ruleUpdateRequest"
    RULE_DTO = "events.ruleDTO"
    RULES_RESP = "events.rulesResponse"
    ADD_LABEL_REQ = "events.addLabelRequest"
    LABELS_RESP = "events.labelsResponse"

    # shares / transfers / settlement
    SHARES_RESP = "events.sharesResponse"
    DETAIL_SHARE_DTO = "events.detailShareDTO"
    MEMBER_SHARE_DTO = "events.memberShareDTO"
    TRANSFERS_RESP = "events.transfersResponse"
    PERSONAL_RESP = "events.personalResponse"
    PERSONAL_LINE = "events.personalLine"
    SETTLEMENT_NOTE_REQ = "events.settlementNoteRequest"
    VALIDATION_RESP = "events.validationResponse"

    # split engine (核心)
    SE_SHARE = "splitengine.Share"
    SE_TRANSFER = "splitengine.Transfer"
    SE_SPLIT_RESULT = "splitengine.SplitResult"
    SE_VALIDITY = "splitengine.Validity"
    SE_TRACE = "splitengine.Trace"

    # templates
    TEMPLATE_ITEM = "events.templateItem"
    TEMPLATES_RESP = "events.templatesResponse"

    # errors
    EVENTS_ERROR = "events.errorResponse"
