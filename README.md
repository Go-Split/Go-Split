# 分帳吧 — v13 prototype port

A faithful, client-side-only port of the "分帳吧 Prototype v13（死碼清除）" `.dc.html`
prototype to plain HTML/CSS/JS — no framework, no build step, no backend.

- `index.html` — shell that loads `data.js` then `app.js`.
- `data.js` — all seed/demo data (10 seed activities, 4 base members + 15-person
  BBQ/camping roster, item tags, person-condition tags, weight-based rules,
  expense items, invite code, demo emails/phones). Nothing about UI or logic
  lives here.
- `app.js` — state (`ST`), the ported business logic (`class Component extends
  DCLogic` from the source became plain functions — `computeCtx`/`buildVals`
  for derived state, `detailShares`/`ruleWeight` for the weight-based
  conditional split algorithm, the debt/credit greedy-matching + hub-model
  settlement math, role/guest permission gating), and all 17 screen renderers
  (`screenLogin` … `screenArchived`, dispatched by `screenFor`).
- `styles.css` — design system (tokens, components) extracted from the
  prototype's inline styles.

Everything here is fake, in-memory demo data. There is no server, no
persistence beyond the page's own `ST` object, and no real accounts —
refreshing the page resets everything to the seed state.

## Known-incomplete areas (inherited from v13, not from this port)

The source prototype itself ships several areas that were deliberately left
unfinished — documented in the project's own content-audit doc
(`分帳吧 Prototype 內容盤查.dc.html`). This port carries them over as-is
rather than inventing content the original never specified:

- **The 4 "未規劃" (unplanned) activity templates** — 聚餐模板 / 唱歌模板 /
  出國旅遊模板 / 社團活動模板. Only "自訂"（空白）and "烤肉/露營模板" have real
  rule/tag content; the other four are shown with a "未規劃" badge and, when
  picked, load the same BBQ/camping defaults as a placeholder — that's the
  source's own behavior, not a shortcut taken here.
- **Empty/error states v13 never designed**, carried over unchanged:
  - Account login never actually fails — any non-blank email/password logs in.
  - Any invite code or invite link is accepted; there's no invalid/expired/
    already-settled/already-archived feedback.
  - No "you're already in this activity" guard against re-joining.
  - No first-time-user empty state distinct from "no active activities."
  - No warning before settling a group of one (host-only) or an activity with
    zero items.
  - The "自訂" template's empty tag library has no guidance copy (the rules
    section does; the tag section doesn't).
  - No loading/offline/save-failure states anywhere — the prototype has no
    async at all.
  - After settlement, edit entry points are hidden outright rather than shown
    disabled with an explanation.

None of the above are bugs in this port — they're gaps the original prototype
documented as "尚未補齊（需要設計）" and left for a future design pass.
