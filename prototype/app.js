/* ==========================================================================
   分帳吧 — vanilla JS port of v13 prototype (no React, no build step).
   Faithful translation of the source .dc.html's `class Component extends
   DCLogic` business logic + JSX markup. See README.md for scope notes.
   ========================================================================== */

/* ---------------- handler registry (replaces JSX onClick={fn}) ---------------- */
let HANDLERS = {};
let HID = 0;
function H(fn) { if (typeof fn !== 'function') return ''; const id = 'h' + (HID++); HANDLERS[id] = fn; return id; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------------- state ---------------- */
let ST = clone(INITIAL_STATE);
let INIT_SNAPSHOT = clone(INITIAL_STATE);
let _memberUsed = null;
let _memberOrder = null;

function setState(updater, cb) {
  const patch = typeof updater === 'function' ? updater(ST) : updater;
  if (patch) Object.assign(ST, patch);
  render();
  if (cb) cb();
}

/* ---------------- data tools (ported 1:1 from Component) ---------------- */
function curItems(st) { st = st || ST; return (st.itemsBy && st.itemsBy[st.cur]) || []; }
function curPaid(st) { st = st || ST; return (st.paidBy2 && st.paidBy2[st.cur]) || {}; }
function evSettings(x) { return { rules: x.rules, members: x.members, itemTags: x.itemTags, condTags: x.condTags }; }
function defaultEvSettings() {
  const d = INIT_SNAPSHOT || ST;
  return clone({ rules: d.rules || [], members: d.members || [], itemTags: d.itemTags || [], condTags: d.condTags || [] });
}
function isOutdoorEvent(name) { return /烤肉|露營/.test(name || ''); }
function isOutdoorTemplate(t) { return t === '烤肉/露營模板'; }
function outdoorEvSettings(x) {
  const base = defaultEvSettings();
  return outdoorEvSettingsData(base.members);
}
function evMemberCount(x, i) {
  if (i === x.cur) return (x.members || []).length;
  const saved = (x.settingsBy || {})[i];
  if (saved && saved.members) return saved.members.length;
  const ev = (x.events || [])[i];
  const outdoor = isOutdoorEvent(ev && ev.name) || isOutdoorTemplate(ev && ev.template);
  const s = outdoor ? outdoorEvSettings(x) : defaultEvSettings();
  return (s.members || []).length;
}
function blankEvSettings() {
  const base = defaultEvSettings();
  return { rules: [], itemTags: [], condTags: [], members: (base.members || []).map(m => Object.assign({}, m, { tags: [] })) };
}
function switchEvent(x, next) {
  const store = Object.assign({}, x.settingsBy || {}, { [x.cur]: evSettings(x) });
  const ev = (x.events || [])[next];
  const fresh = !store[next];
  const outdoor = fresh && (isOutdoorEvent(ev && ev.name) || isOutdoorTemplate(ev && ev.template));
  const load = store[next] ? clone(store[next]) : (outdoor ? outdoorEvSettings(x) : defaultEvSettings());
  return Object.assign({ settingsBy: store, cur: next, editMember: null, newMember: null,
    ruleEdit: null, ruleNew: false, rulePick: null, tagEdit: null, tagMenu: null },
    outdoor ? { itemsBy: Object.assign({}, x.itemsBy, { [next]: outdoorSeedItems(next) }) } : {}, load);
}
function mapAllItems(x, fn) {
  const src = x.itemsBy || {}; const out = {};
  Object.keys(src).forEach(k => { out[k] = (src[k] || []).map(it => Object.assign({}, it, { details: it.details.map(fn) })); });
  return out;
}
function setItems(fn) {
  setState(x => { const next = fn(curItems(x), x); return { itemsBy: Object.assign({}, x.itemsBy, { [x.cur]: next }) }; });
}
function setPaid(fn) {
  setState(x => { const next = fn(curPaid(x), x); return { paidBy2: Object.assign({}, x.paidBy2, { [x.cur]: next }) }; });
}
function fmtD(s) { if (!s) return ''; const p = String(s).split('-'); return p.length === 3 ? p[0] + '/' + p[1] + '/' + p[2] : s; }
function fmtDT(s) { if (!s) return ''; const parts = String(s).split('T'); const d = fmtD(parts[0]); const t = (parts[1] || '').slice(0, 5); return t ? d + ' ' + t : d; }
function fmtEvDT(ev) {
  const j = (d, t) => { const dd = fmtD(d); return dd ? (t ? dd + ' ' + t : dd) : ''; };
  const a = j(ev.d1, ev.t1), b = j(ev.d2, ev.t2);
  if (!a) return b || '';
  return b ? a + '～' + b : a;
}
function money(n) { return 'NT$ ' + Math.round(n).toLocaleString('en-US'); }
function num(v) { return parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0; }
function roleName(r) { return r === 'host' ? '主辦者' : r === 'co' ? '協辦者' : '參與者'; }
function roleAt(st, e, i) {
  if (st.firstJoin) return 'member';
  return (i === 0 && !st.guest) ? (st.persona || st.role) : e.role;
}
const go = (s) => setState({ screen: s, expand: {} });
const setField = (g, k) => (e) => { const v = e.target.value; setState(st => ({ [g]: Object.assign({}, st[g], { [k]: v }) })); };
const toggleField = (g, k, val) => () => setState(st => {
  const cur = st[g][k];
  const next = cur.indexOf(val) >= 0 ? cur.filter(x => x !== val) : cur.concat([val]);
  return { [g]: Object.assign({}, st[g], { [k]: next }) };
});

function ruleWeight(tags, person) {
  const rs = ST.rules || [];
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    if (!r.tag || (tags || []).indexOf(r.tag) < 0) continue;
    const gs = r.groups || [];
    for (let j = 0; j < gs.length; j++) {
      const g = gs[j], cs = g.conds || [];
      if (!cs.length) continue;
      if (!cs.every(c => (person.tags || []).indexOf(c) >= 0)) continue;
      if ((g.mode || 'exclude') === 'exclude') return 0;
      const v = Number(g.wt === '' || g.wt === undefined || g.wt === null ? 1 : g.wt);
      return isNaN(v) ? 1 : Math.max(0, Math.min(100, v));
    }
    const rest = r.rest || {};
    if ((rest.mode || 'weight') === 'exclude') return 0;
    const rv = Number(rest.wt === '' || rest.wt === undefined || rest.wt === null ? 1 : rest.wt);
    return isNaN(rv) ? 1 : Math.max(0, Math.min(100, rv));
  }
  return 1;
}
function ruleTagUsed(tag, st) { if (!tag) return false; return (curItems(st) || []).some(it => (it.details || []).some(d => (d.tags || []).indexOf(tag) >= 0)); }
function restLabel(r) {
  const rest = (r && r.rest) || {};
  if ((rest.mode || 'weight') === 'exclude') return '不計入';
  const v = rest.wt === '' || rest.wt === undefined || rest.wt === null ? 1 : Number(rest.wt);
  return '權重 ×' + (isNaN(v) ? 1 : v);
}
function detailShares(d) {
  const ms = ST.members;
  const wOf = {};
  ms.forEach(m => { wOf[m.id] = d.ids ? 1 : ruleWeight(d.tags, m); });
  const inc = d.ids ? ms.filter(m => d.ids.indexOf(m.id) >= 0) : ms.filter(m => wOf[m.id] > 0);
  const amount = typeof d.amount === 'number' ? d.amount : num(d.amount);
  const custom = d.custom || {};
  const fixedIds = [];
  let fixedSum = 0;
  inc.forEach(m => {
    const v = custom[m.id];
    if (v !== undefined && String(v).trim() !== '' && !/[^0-9.]/.test(String(v))) { fixedIds.push(m.id); fixedSum += Number(v); }
  });
  const restIds = inc.filter(m => fixedIds.indexOf(m.id) < 0).map(m => m.id);
  const rest = Math.max(0, amount - fixedSum);
  const restW = restIds.reduce((a, id) => a + (wOf[id] || 0), 0);
  const per = restIds.length ? rest / restIds.length : 0;
  const map = {};
  inc.forEach(m => {
    map[m.id] = fixedIds.indexOf(m.id) >= 0 ? Number(custom[m.id])
      : (restW ? rest * (wOf[m.id] || 0) / restW : 0);
  });
  const unit = restW ? rest / restW : 0;
  let mismatch = false;
  if (inc.length) {
    let acc = 0;
    fixedIds.forEach(id => { const v = Math.round(map[id]); map[id] = v; acc += v; });
    restIds.forEach(id => { const v = Math.floor(map[id] + 1e-6); map[id] = v; acc += v; });
    let remainder = Math.round(amount) - acc;
    if (restIds.length) {
      let k = 0;
      while (remainder > 0) { const id = restIds[k % restIds.length]; map[id] += 1; remainder -= 1; k += 1; }
      while (remainder < 0) { const id = restIds[k % restIds.length]; if (map[id] > 0) { map[id] -= 1; remainder += 1; } k += 1; if (k > restIds.length * 4) break; }
    } else if (remainder !== 0) {
      mismatch = true;
    }
  }
  const diff = Math.round(amount) - inc.reduce((a, m) => a + (map[m.id] || 0), 0);
  return { inc, per, unit, restW, amount, map, fixedIds, fixedSum, mismatch, diff, overflow: fixedSum - amount > 0.5 };
}
function itemTotal(it) { return it.details.reduce((a, d) => a + (typeof d.amount === 'number' ? d.amount : num(d.amount)), 0); }

function patchDetail(where, di, patch) {
  setState(st => {
    const clr = { shareAlert: null };
    if (where === 'draft') {
      return Object.assign(clr, { draft: Object.assign({}, st.draft, {
        details: st.draft.details.map((d, i) => i === di ? Object.assign({}, d, patch) : d) }) });
    }
    const list = curItems(st);
    const next = list.map((it, i) => i === st.sel ? Object.assign({}, it, {
      details: it.details.map((d, j) => j === di ? Object.assign({}, d, patch) : d) }) : it);
    return Object.assign(clr, { itemsBy: Object.assign({}, st.itemsBy, { [st.cur]: next }) });
  });
}

function openMenu() { clearTimeout(window._menuT); setState({ menuOpen: true, menuIn: true }); }
function closeMenu() { clearTimeout(window._menuT); setState({ menuIn: false }); window._menuT = setTimeout(() => setState({ menuOpen: false }), 320); }
function askDelete(fn) { setState({ delAsk: fn }); }

let ruleAlertT = null;
function flashRule(i) { clearTimeout(ruleAlertT); setState({ ruleAlert: i }); ruleAlertT = setTimeout(() => setState({ ruleAlert: null }), 1800); }
let shareAlertT = null;
function flashShareAlert(key) { clearTimeout(shareAlertT); setState({ shareAlert: key }); }

function tagUsedWhere(kind, t, st) {
  const x = st || ST;
  if (!t) return null;
  const q = (n) => ({ text: '「' + t + '」已被使用在' + n + '，不可刪除。' });
  if (kind === 'item') {
    if ((x.rules || []).some(r => r.tag === t)) return q('分攤規則');
    const by = x.itemsBy || {};
    const inItems = Object.keys(by).some(k => (by[k] || []).some(it => (it.details || []).some(d => (d.tags || []).indexOf(t) >= 0)));
    return inItems ? q('款項上') : null;
  }
  if ((x.members || []).some(m => (m.tags || []).indexOf(t) >= 0)) return q('人員上');
  if (((x.join && x.join.conds) || []).indexOf(t) >= 0) return q('加入訊息');
  const inRule = (x.rules || []).some(r => (r.groups || []).some(g => (g.conds || []).indexOf(t) >= 0));
  return inRule ? q('條件式分攤規則') : null;
}

function commitTag() {
  const te = ST.tagEdit; if (!te) return;
  const v = (te.value || '').trim();
  if (!v) { cancelTag(); return; }
  const list = te.kind === 'item' ? ST.itemTags : ST.condTags;
  if (list.some((t, j) => j !== te.i && t === v)) {
    setState(x => ({ tagEdit: Object.assign({}, x.tagEdit, { dup: true }) }));
    return;
  }
  renameTag();
}
function cancelTag() {
  setState(x => {
    const te = x.tagEdit; if (!te) return { tagEdit: null };
    if (te.isNew) return te.kind === 'item'
      ? { tagEdit: null, itemTags: x.itemTags.filter((_, j) => j !== te.i) }
      : { tagEdit: null, condTags: x.condTags.filter((_, j) => j !== te.i) };
    return { tagEdit: null };
  });
}
function renameTag() {
  setState(x => {
    const te = x.tagEdit; if (!te) return {};
    const next = (te.value || '').trim(); const old = te.kind === 'item' ? x.itemTags[te.i] : x.condTags[te.i];
    if (!next && te.isNew) {
      return te.kind === 'item'
        ? { tagEdit: null, itemTags: x.itemTags.filter((_, j) => j !== te.i) }
        : { tagEdit: null, condTags: x.condTags.filter((_, j) => j !== te.i) };
    }
    if (!next || next === old) return { tagEdit: null };
    if (te.kind === 'item') {
      return { tagEdit: null,
        itemTags: x.itemTags.map((t, j) => j === te.i ? next : t),
        rules: x.rules.map(r => Object.assign({}, r, { tag: r.tag === old ? next : r.tag })),
        itemsBy: mapAllItems(x, d => Object.assign({}, d, { tags: d.tags.map(t => t === old ? next : t) })) };
    }
    return { tagEdit: null,
      condTags: x.condTags.map((t, j) => j === te.i ? next : t),
      rules: x.rules.map(r => Object.assign({}, r, { conds: (r.conds || []).map(t => t === old ? next : t) })),
      members: x.members.map(m => Object.assign({}, m, { tags: m.tags.map(t => t === old ? next : t) })),
      join: Object.assign({}, x.join, { conds: x.join.conds.map(t => t === old ? next : t) }) };
  });
}
function removeTag() {
  setState(x => {
    const te = x.tagEdit; if (!te) return {};
    if (te.kind === 'item') {
      const old0 = x.itemTags[te.i];
      const usedItem = old0 && curItems(x).some(it => it.details.some(d => (d.tags || []).indexOf(old0) >= 0));
      if (usedItem) return { tagMenu: null, tagEdit: null, tagUsedAsk: { text: '「' + old0 + '」已被使用在款項上，不可刪除。' } };
    } else {
      const old0 = x.condTags[te.i];
      const usedCond = old0 && x.members.some(m => (m.tags || []).indexOf(old0) >= 0);
      if (usedCond) return { tagMenu: null, tagEdit: null, tagUsedAsk: { text: '「' + old0 + '」已被使用在人員上，不可刪除。' } };
      const inRule = old0 && (x.rules || []).some(r => (r.groups || []).some(g => (g.conds || []).indexOf(old0) >= 0));
      if (inRule) return { tagMenu: null, tagEdit: null, tagUsedAsk: { text: '「' + old0 + '」已被使用在條件式分攤規則，不可刪除。' } };
    }
    if (te.kind === 'item') {
      const old = x.itemTags[te.i];
      return { tagEdit: null, tagToast: null, tagMenu: null, ruleEdit: null, rulePick: null,
        itemTags: x.itemTags.filter((_, j) => j !== te.i),
        rules: x.rules.filter(r => r.tag !== old),
        itemsBy: mapAllItems(x, d => Object.assign({}, d, { tags: d.tags.filter(t => t !== old) })) };
    }
    const old = x.condTags[te.i];
    return { tagEdit: null, tagToast: null, tagMenu: null, ruleEdit: null, rulePick: null,
      condTags: x.condTags.filter((_, j) => j !== te.i),
      rules: x.rules.map(r => Object.assign({}, r, {
        groups: (r.groups || []).map(g => Object.assign({}, g, { conds: (g.conds || []).filter(t => t !== old) }))
          .filter(g => (g.conds || []).length) })),
      members: x.members.map(m => Object.assign({}, m, { tags: m.tags.filter(t => t !== old) })),
      join: Object.assign({}, x.join, { conds: x.join.conds.filter(t => t !== old) }) };
  });
}
function tagRows(kind, st) {
  const list = kind === 'item' ? st.itemTags : st.condTags;
  const te = st.tagEdit;
  return list.map((t, i) => ({ t, i }))
    .filter(r => !!r.t || !!(te && te.kind === kind && te.i === r.i))
    .map(({ t, i }) => {
      const editing = !!(te && te.kind === kind && te.i === i);
      const menu = !!(st.tagMenu && st.tagMenu.kind === kind && st.tagMenu.i === i);
      const doDel = () => setState({ tagMenu: null, tagEdit: { kind: kind, i: i, value: t } }, () => removeTag());
      return { label: t, editing: editing && !te.dup, dupEditing: editing && !!te.dup, menu: menu, idle: !editing && !menu,
        inputVal: editing ? (te.value || '') : '',
        setVal: (e) => { const v = e.target.value; setState(x => ({ tagEdit: Object.assign({}, x.tagEdit, { value: v, dup: false }) })); },
        commit: () => commitTag(),
        onKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); commitTag(); } else if (e.key === 'Escape') cancelTag(); },
        openMenu: () => setState({ tagMenu: { kind: kind, i: i } }),
        closeMenu: () => setState({ tagMenu: null }),
        startEdit: () => setState({ tagMenu: null, tagEdit: { kind: kind, i: i, value: t } }),
        del: () => { const u = tagUsedWhere(kind, t, st); if (u) setState({ tagMenu: null, tagUsedAsk: u }); else setState({ tagMenu: null, delAsk: doDel }); } };
    });
}
function effLabel(g) {
  if (!g) return '';
  if ((g.mode || 'exclude') === 'weight') {
    const v = g.wt === '' || g.wt === undefined || g.wt === null ? 1 : Number(g.wt);
    return '權重 ×' + (isNaN(v) ? 1 : v);
  }
  return '不計入';
}
function matchCount(g) {
  const conds = (g && g.conds) || [];
  if (!conds.length) return 0;
  return ST.members.filter(m => conds.every(c => (m.tags || []).indexOf(c) >= 0)).length;
}
function toggleSecOpen(k) {
  setState(x => {
    const cur = x.secShut || {};
    const next = Object.assign({}, cur, { [k]: !cur[k] });
    const extra = { secShut: next, tagMenu: null, tagEdit: null, rulePick: null };
    if (next[k]) { extra.secEdit = Object.assign({}, x.secEdit || {}, { [k]: false }); if (k === 'rule') { extra.ruleEdit = null; extra.ruleNew = false; } }
    return extra;
  });
}
function toggleSec(k) {
  setState(x => {
    const cur = x.secEdit || {};
    const on = !cur[k];
    const next = Object.assign({}, cur, { [k]: on });
    const extra = { secEdit: next, ruleSec: k, tagMenu: null, tagEdit: null, rulePick: null };
    if (k === 'rule' && !on) { extra.ruleEdit = null; extra.ruleNew = false; }
    return extra;
  });
}
function scrollToSec(k) {
  const el = document.getElementById('sec-' + k);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function patchGroup(gi, patch) {
  setState(x => ({ rules: x.rules.map((r, j) => j === x.ruleEdit
    ? Object.assign({}, r, { groups: (r.groups || []).map((g, k) => k === gi ? Object.assign({}, g, patch) : g) })
    : r) }));
}
function patchRule(patch) {
  setState(x => ({ rules: x.rules.map((r, j) => j === x.ruleEdit ? Object.assign({}, r, patch) : r) }));
}
function setMember(i, patch) { setState(x => ({ members: x.members.map((m, j) => j === i ? Object.assign({}, m, patch) : m) })); }

/* ---------------- render context (ported from Component.renderCtx) ---------------- */
function computeCtx() {
  const st0 = ST;
  const st = Object.assign({}, st0, { items: curItems(st0), paid: curPaid(st0) });
  const s = st.screen;
  if (s === 'group' && st.role !== 'host') setTimeout(() => go('event'), 0);
  if (s === 'addItem' && st.role === 'member') setTimeout(() => go('event'), 0);
  if (s === 'create' && st.guest) setTimeout(() => go('home'), 0);
  if (s === 'settle' && st.role !== 'host') setTimeout(() => go('event'), 0);
  if (s === 'payments' && st.role !== 'host') setTimeout(() => go('settledEvent'), 0);
  const menuAllowed = ['event', 'group', 'rules', 'rulesEdit', 'addItem', 'itemDetail', 'settle', 'settledEvent', 'payments', 'pairDetail', 'archived'].indexOf(s) >= 0;
  const menuActive = !!st.menuOpen && menuAllowed;
  const menuShown = !!st.menuIn && menuAllowed;

  const curEv = st.events[st.cur] || st.events[0];
  const personaName = { host: '小凱', co: '阿豪', member: '小美' }[st.persona || st.role];
  const me = (st.firstJoin && st.members.filter(m => m.you)[0])
    || st.members.filter(m => m.name === personaName)[0]
    || (st.role === 'member' && st.members.filter(m => m.you)[0])
    || st.members.filter(m => m.role === roleName(st.role))[0] || st.members[0];

  const totals = {}; const paidBy = {};
  st.members.forEach(m => { totals[m.id] = 0; paidBy[m.id] = 0; });
  const items = st.items.map((it, i) => {
    const tot = itemTotal(it);
    const payer = st.members.filter(m => m.name === it.by)[0];
    if (payer) paidBy[payer.id] += tot;
    let mine = 0; const tagSet = [];
    it.details.forEach(d => {
      const { inc, map } = detailShares(d);
      inc.forEach(p => { totals[p.id] += map[p.id]; if (p.id === me.id) mine += map[p.id]; });
      d.tags.forEach(t => { if (tagSet.indexOf(t) < 0) tagSet.push(t); });
    });
    return { title: (it.details.length ? it.details[0].name : (it.receipt ? '收據（尚無明細）' : '未命名款項'))
        + (it.details.length > 1 ? ' 等 ' + it.details.length + ' 項' : ''),
      amountText: money(tot), by: it.by, detailCount: it.details.length,
      mineText: money(mine), tags: tagSet.length ? tagSet : [],
      open: () => setState({ sel: i, screen: 'itemDetail', expand: {} }),
      openArchived: () => setState({ sel: i, screen: 'itemDetail', backFrom: 'archived', editDetail: null, expand: {} }) };
  });
  const total = st.items.reduce((a, it) => a + itemTotal(it), 0);

  const net = st.members.map(m => ({ m, v: paidBy[m.id] - totals[m.id] }));
  const debt = net.filter(x => x.v < -0.5).map(x => ({ m: x.m, v: -x.v })).sort((a, b) => b.v - a.v);
  const cred = net.filter(x => x.v > 0.5).map(x => ({ m: x.m, v: x.v })).sort((a, b) => b.v - a.v);
  const transfers = [];
  let di = 0, ci = 0;
  while (di < debt.length && ci < cred.length) {
    const amt = Math.min(debt[di].v, cred[ci].v);
    const key = debt[di].m.id + '>' + cred[ci].m.id;
    transfers.push({ key, from: debt[di].m, to: cred[ci].m, amount: amt });
    debt[di].v -= amt; cred[ci].v -= amt;
    if (debt[di].v < 0.5) di++;
    if (cred[ci].v < 0.5) ci++;
  }

  const cur = st.items[st.sel] || st.items[0] || { by: '—', receipt: false, details: [] };
  if (s === 'itemDetail' && !st.items.length) setTimeout(() => go(st.settled ? 'settledEvent' : 'event'), 0);
  const hub = st.members.filter(m => m.role === '主辦者')[0] || st.members[0];
  const netOf = (m) => (paidBy[m.id] || 0) - (totals[m.id] || 0);
  const dspF = (m) => m.name + (m.id === me.id ? '（你）' : '');
  const flowRows = st.members.map(m => {
    const v = netOf(m);
    if (m.id === hub.id) {
      const lines = st.members.filter(x => x.id !== hub.id && Math.abs(netOf(x)) >= 0.5)
        .map(x => netOf(x) < 0
          ? { text: '你 ← ' + dspF(x), amount: money(-netOf(x)) }
          : { text: '→ ' + dspF(x), amount: money(netOf(x)) });
      return { name: dspF(m), role: m.role,
        lines: lines.length ? lines : [{ text: '無需轉帳', amount: '—' }],
        summaryLabel: v >= 0 ? '總結應得' : '總結應付',
        summary: money(Math.abs(v)),
        positive: v >= 0, negative: v < 0 };
    }
    const lines = Math.abs(v) < 0.5
      ? [{ text: '無需轉帳', amount: '—' }]
      : (v < 0
        ? [{ text: '→ ' + dspF(hub), amount: money(-v) }]
        : [{ text: '你 ← ' + dspF(hub), amount: money(v) }]);
    return { name: dspF(m), role: m.role, lines,
      summaryLabel: v >= 0 ? '總結應得' : '總結應付',
      summary: money(Math.abs(v)),
      positive: v >= 0, negative: v < 0 };
  });
  const openPair = (id) => () => setState({ selPair: id, screen: 'pairDetail', expand: {} });
  const myNet = netOf(me);
  const myFlow = (() => {
    const base = { name: dspF(me), role: me.role,
      summaryLabel: myNet >= 0 ? '總結應得' : '總結應付',
      summary: money(Math.abs(myNet)),
      positive: myNet >= 0, negative: myNet < 0 };
    if (me.id === hub.id) {
      const ls = st.members.filter(x => x.id !== hub.id && Math.abs(netOf(x)) >= 0.5)
        .map(x => netOf(x) < 0
          ? { text: '你 ← ' + x.name, amount: money(-netOf(x)), open: openPair(x.id) }
          : { text: '→ ' + x.name, amount: money(netOf(x)), open: openPair(x.id) });
      return Object.assign(base, { lines: ls, hasLines: ls.length > 0, noLines: ls.length === 0 });
    }
    if (Math.abs(myNet) < 0.5) return Object.assign(base, { lines: [], hasLines: false, noLines: true });
    const line = myNet < 0
      ? { text: '→ ' + hub.name, amount: money(-myNet), open: openPair(hub.id) }
      : { text: '你 ← ' + hub.name, amount: money(myNet), open: openPair(hub.id) };
    return Object.assign(base, { lines: [line], hasLines: true, noLines: false });
  })();
  const canEditDetail = !curEv.archived && (st.role === 'host' || (st.role === 'co' && cur.by === me.name));
  const edD = (st.editDetail !== null && st.editDetail !== undefined) ? cur.details[st.editDetail] : null;
  const edAmt = edD ? String(edD.amount === 0 ? 0 : (edD.amount || '')) : '';
  const editingInvalid = !!edD && (!(edD.name || '').trim() || !edAmt.trim() || /[^0-9]/.test(edAmt));
  const editRule = (st.ruleEdit !== null && st.ruleEdit !== undefined) ? st.rules[st.ruleEdit] : null;
  const dsp = (m) => m.name + (m.id === me.id ? '（你）' : '');
  const LIMIT = 2;
  const shareView = (key, rows0) => {
    const open = !!st.expand[key];
    const isMine = (r) => typeof r.name === 'string' && r.name.indexOf('（你）') >= 0;
    const hasAmt = (r) => parseFloat(String(r.amount).replace(/[^\d.]/g, '')) > 0;
    const mine = rows0.filter(isMine);
    const rows = (mine.length && hasAmt(mine[0]))
      ? mine.concat(rows0.filter(r => !isMine(r)))
      : rows0;
    return {
      shareCount: rows.length,
      visibleShares: open ? rows : rows.slice(0, LIMIT),
      caret: rows.length > LIMIT ? (open ? '▼' : '▶') : '▶',
      shareTitle: '共計 ' + rows.length + ' 人分攤',
      showMore: !open && rows.length > LIMIT,
      expandLabel: '＋ 其他 ' + Math.max(0, rows.length - LIMIT) + ' 人',
      expandable: rows.length > LIMIT,
      toggleExpand: rows.length > LIMIT ? () => setState(x => ({ expand: Object.assign({}, x.expand, { [key]: !x.expand[key] }) })) : undefined,
    };
  };
  const shareEditView = (key, where, di2, d, allow, forced) => {
    const editing = forced !== undefined ? !!forced : (allow !== false && st.shareEdit === key);
    const sh = detailShares(d);
    const ids = sh.inc.map(p => p.id);
    const bad = sh.mismatch || sh.overflow;
    const alerting = st.shareAlert === key;
    return {
      sharesEditing: editing, sharesReadOnly: !editing,
      shareBad: bad,
      shareErrOpen: alerting,
      shareErrText: sh.mismatch
        ? '各人金額合計與品項金額差 ' + money(Math.abs(sh.diff)) + '，請調整後再儲存'
        : '自訂金額已超出本品項金額 ' + money(sh.fixedSum - sh.amount),
      toggleShareEdit: allow === false ? undefined : () => {
        if (st.shareEdit === key && bad) { flashShareAlert(key); return; }
        setState(x => ({ shareAlert: null, shareEdit: x.shareEdit === key ? null : key }));
      },
      remainText: sh.overflow
        ? '自訂金額已超出本品項金額 ' + money(sh.fixedSum - sh.amount)
        : '未鎖定者依權重分攤，共 ' + (Math.round(sh.restW * 100) / 100) + ' 份，每份 ' + money(sh.unit),
      editRows: editing ? st.members.map(m => {
        const on = ids.indexOf(m.id) >= 0;
        const cus = (d.custom || {})[m.id];
        const isCustom = cus !== undefined && String(cus).trim() !== '';
        return { id: m.id, name: dsp(m), on: on, off: !on,
          hasCond: m.tags.length > 0,
          condText: m.tags.map(t => '#' + t).join('、'),
          amountVal: isCustom ? String(cus) : (on ? String(Math.round(sh.map[m.id] || 0)) : ''),
          amountPh: on ? String(Math.round(sh.map[m.id] || sh.unit)) : '—',
          locked: !isCustom, unlocked: isCustom,
          toggleLock: () => patchDetail(where, di2, {
            ids: on ? ids : ids.concat([m.id]),
            custom: Object.assign({}, d.custom || {}, { [m.id]: isCustom ? '' : String(Math.round(sh.map[m.id] || sh.per || 0)) }) }),
          setAmount: (e) => patchDetail(where, di2, {
            ids: on ? ids : ids.concat([m.id]),
            custom: Object.assign({}, d.custom || {}, { [m.id]: e.target.value }) }),
          toggle: () => patchDetail(where, di2, { ids: on ? ids.filter(x => x !== m.id) : ids.concat([m.id]) }) };
      }) : [],
    };
  };
  const tagPickView = (key, where, di2, d, allow) => {
    const q = (st.tagQuery || {})[key] || '';
    const open = allow !== false && st.tagPick === key;
    const pool = st.itemTags.filter(t => !q.trim() || t.indexOf(q.trim()) >= 0);
    return {
      tagPickOpen: open, tagQueryVal: q,
      tagHasSel: d.tags.length > 0, tagNoSel: d.tags.length === 0,
      tagSelLabel: d.tags[0] || '',
      clearTag: () => { patchDetail(where, di2, { tags: [] }); setState(x => ({ tagQuery: Object.assign({}, x.tagQuery, { [key]: '' }) })); },
      setTagQuery: (e) => setState(x => ({ tagPick: key, tagQuery: Object.assign({}, x.tagQuery, { [key]: e.target.value }) })),
      openTagPick: () => setState({ tagPick: key }),
      closeTagPick: () => setState({ tagPick: null }),
      tagChips: d.tags.map(t => ({ label: t, remove: () => patchDetail(where, di2, { tags: d.tags.filter(x => x !== t) }) })),
      tagPickRows: open ? pool.map(t => ({ label: t, sel: d.tags.indexOf(t) >= 0, unsel: d.tags.indexOf(t) < 0,
        toggle: () => { patchDetail(where, di2, { tags: d.tags.indexOf(t) >= 0 ? [] : [t] }); setState(x => ({ tagPick: null, tagQuery: Object.assign({}, x.tagQuery, { [key]: '' }) })); } })) : [],
      tagPickEmpty: open && pool.length === 0,
    };
  };

  const pairMap = {};
  st.members.forEach(m => { if (m.id !== me.id) pairMap[m.id] = { m: m, lines: [], net: 0 }; });
  st.items.forEach(it => {
    const payer = st.members.filter(m => m.name === it.by)[0];
    if (!payer) return;
    it.details.forEach(d => {
      const sh = detailShares(d);
      const label = d.name || '未命名品項';
      if (payer.id === me.id) {
        sh.inc.forEach(p => {
          if (p.id === me.id || !pairMap[p.id]) return;
          pairMap[p.id].lines.push({ label: label, amount: money(sh.map[p.id]), sign: 1 });
          pairMap[p.id].net += sh.map[p.id];
        });
      } else if (pairMap[payer.id] && sh.inc.some(p => p.id === me.id)) {
        pairMap[payer.id].lines.push({ label: label, amount: money(sh.map[me.id]), sign: -1 });
        pairMap[payer.id].net -= sh.map[me.id];
      }
    });
  });
  const pairs = Object.keys(pairMap).map(k => pairMap[k]).filter(x => x.lines.length);
  const myTransfers = pairs.filter(x => Math.abs(x.net) > 0.5).map(x => ({
    text: x.net > 0 ? x.m.name + ' 需轉給你' : '你需轉給 ' + x.m.name,
    amount: money(Math.abs(x.net)),
    open: () => setState({ selPair: x.m.id, screen: 'pairDetail' }) }));
  const pair = pairMap[st.selPair] || pairs[0] || { m: { name: '—' }, lines: [], net: 0 };
  const pairHubNet = (pair.m && pair.m.id)
    ? (me.id === hub.id ? netOf(pair.m) : -netOf(me))
    : 0;
  const pairTarget = (me.id === hub.id) ? pair.m : me;
  const pairSrcLines = [];
  if (pairTarget && pairTarget.id) {
    st.items.forEach(it => {
      const payer = st.members.filter(m => m.name === it.by)[0];
      it.details.forEach(d => {
        const sh = detailShares(d);
        if (sh.inc.some(p => p.id === pairTarget.id) && sh.map[pairTarget.id] > 0.5) {
          pairSrcLines.push({ label: d.name || '未命名品項', amount: money(sh.map[pairTarget.id]),
            dirText: '應分攤' + (payer ? '（' + payer.name + ' 代墊）' : ''), plus: true, minus: false });
        }
      });
      if (payer && payer.id === pairTarget.id) {
        const tot = itemTotal(it);
        if (tot > 0.5) pairSrcLines.push({
          label: (it.details.length ? it.details[0].name : '收據（尚無明細）') + (it.details.length > 1 ? ' 等 ' + it.details.length + ' 項' : ''),
          amount: '－ ' + money(tot), dirText: '本人代墊，可扣抵', plus: false, minus: true });
      }
    });
  }
  const myKeys = transfers.filter(t => t.from.id === me.id).map(t => t.key);
  const myPaid = myKeys.length > 0 && myKeys.every(k => st.paid[k]);

  return { st0, st, s, menuAllowed, menuActive, menuShown, curEv, personaName, me, totals, items, total, net, debt, cred, transfers, di, cur, hub, netOf, dspF, flowRows, openPair, myNet, myFlow, canEditDetail, edD, edAmt, editingInvalid, editRule, dsp, LIMIT, shareView, shareEditView, tagPickView, pairMap, pairs, myTransfers, pair, pairHubNet, pairTarget, pairSrcLines, myKeys, myPaid, paidBy };
}

/* ---------------- vals (ported from vals1..vals5) ---------------- */
function buildVals(c) {
  const { st0, st, s, menuAllowed, menuActive, menuShown, curEv, personaName, me, totals, items, total, net, debt, cred, transfers, di, cur, hub, netOf, dspF, flowRows, openPair, myNet, myFlow, canEditDetail, edD, edAmt, editingInvalid, editRule, dsp, LIMIT, shareView, shareEditView, tagPickView, pairMap, pairs, myTransfers, pair, pairHubNet, pairTarget, pairSrcLines, myKeys, myPaid, paidBy } = c;
  const v = {};
  Object.assign(v, {
    s_login: s === 'login', s_register: s === 'register', s_home: s === 'home',
    s_create: s === 'create', s_invite: s === 'invite', s_joinForm: s === 'joinForm', s_event: s === 'event',
    s_group: s === 'group',
    s_rulesPage: s === 'rules' || s === 'rulesEdit',
    s_addItem: s === 'addItem', s_itemDetail: s === 'itemDetail', s_settle: s === 'settle',
    s_settleDone: s === 'settleDone', s_settledEvent: s === 'settledEvent', s_payments: s === 'payments',
    s_archived: s === 'archived', s_pairDetail: s === 'pairDetail',
    pair: {
      title: pairHubNet < 0 ? pair.m.name + ' 需轉給你' : '你需轉給 ' + pair.m.name,
      amount: money(Math.abs(pairHubNet)),
      lines: pairSrcLines,
    },
    myFlow: myFlow,

    reset: () => setState(INIT_SNAPSHOT ? clone(INIT_SNAPSHOT) : { screen: 'login' }),
    toLogin: () => go('login'),
    logout: () => setState(Object.assign(INIT_SNAPSHOT ? clone(INIT_SNAPSHOT) : {}, { screen: 'login', guest: false })),
    toRegister: () => setState({ guest: false, screen: 'register' }),
    toHome: () => setState({ screen: 'home', expand: {}, evNameTouched: false }),
    toCreate: () => setState({ screen: 'create', expand: {}, evNameTouched: false,
      ev: { name: '', date: '', place: '', template: '自訂', d1: '', t1: '', d2: '', t2: '' } }),
    toInvite: () => go('invite'),
    toJoinForm: () => go('joinForm'), toGroup: () => go('group'), toRules: () => go('rules'),
    toAddItem: () => go('addItem'), toSettle: () => go('settle'),
    toSettledEvent: () => go('settledEvent'), toPayments: () => go('payments'),
    backToEvent: () => setState(x => ({ screen: x.backFrom || (x.settled ? 'settledEvent' : 'event'), backFrom: null, expand: {} })),
    submitJoin: () => setState(x => {
      const youM = { id: '010020', name: x.join.name.trim() || '新參與者', role: '參與者',
        tags: x.join.conds.slice(), login: x.guest ? '訪客登入 001001' : '帳號（10999）', guest: x.guest, you: true };
      const has = x.members.some(m => m.you);
      return { role: 'member', screen: 'event',
        members: has ? x.members.map(m => m.you ? Object.assign({}, m, youM) : m) : x.members.concat([youM]) };
    }),
    createEvent: () => setState(x => {
      if (!x.ev.name.trim()) return { evNameTouched: true };
      const switched = switchEvent(x, x.events.length);
      const override = (isOutdoorTemplate(x.ev.template) || (x.ev.template !== '自訂' && isOutdoorEvent(x.ev.name)))
        ? outdoorEvSettings(x)
        : (x.ev.template === '自訂' ? blankEvSettings() : {});
      return Object.assign({}, switched, override, {
        evNameTouched: false,
        role: 'host', screen: 'event', settled: false,
        itemsBy: Object.assign({}, x.itemsBy, { [x.events.length]: [] }),
        paidBy2: Object.assign({}, x.paidBy2, { [x.events.length]: {} }),
        events: x.events.concat([{ name: x.ev.name.trim(), date: fmtEvDT(x.ev) || '時間未定', place: (x.ev.place || '').trim() || '地點未定', role: 'host', archived: false, template: x.ev.template }]),
        ev: { name: '', date: '', place: '', template: '自訂', d1: '', t1: '', d2: '', t2: '' },
      });
    }),
    settleAskOpen: !!st.settleAsk,
    askSettle: () => setState({ settleAsk: true }),
    cancelSettle: () => setState({ settleAsk: false }),
    confirmSettle: () => setState({ settleAsk: false, settled: true, screen: 'settleDone' }),
    askPaid: () => setState({ paidAsk: true }),
    paidAskOpen: !!st.paidAsk,
    cancelPaid: () => setState({ paidAsk: false }),
    confirmPaid: () => { setState({ paidAsk: false }); setPaid((p) => { const n = Object.assign({}, p); myKeys.forEach(k => { n[k] = true; }); return n; }); },
    archiveEvent: () => setState(x => ({ screen: 'home', events: x.events.map((e, i) => i === x.cur ? Object.assign({}, e, { archived: true }) : e) })),
    isGuest: st.guest, isAccount: !st.guest, guestId: '001001',
    isHost: st.role === 'host', isCo: st.role === 'co',
    menuHostOps: st.role === 'host' && !curEv.archived,
    canAddItem: st.role !== 'member', isMemberOnly: st.role === 'member',
    settleOnSplit: (st.settleTab || 'split') === 'split',
    settleOnEvent: st.settleTab === 'event',
    toSettleSplit: () => setState({ settleTab: 'split' }),
    toSettleEventTab: () => setState({ settleTab: 'event' }),
    roleLabel: roleName(st.role),

    loginOnAcc: (st.loginTab || 'acc') === 'acc',
    loginOnCode: st.loginTab === 'code',
    toLoginAcc: () => setState({ loginTab: 'acc' }),
    toLoginCode: () => setState({ loginTab: 'code' }),
    accMailErr: !!st.loginTouched && !(st.acc.mail || '').trim(),
    accPassErr: !!st.loginTouched && !(st.acc.pass || '').trim(),
    accMailBd: (!!st.loginTouched && !(st.acc.mail || '').trim()) ? '#FF6B6B' : '#DCE4E3',
    accPassBd: (!!st.loginTouched && !(st.acc.pass || '').trim()) ? '#FF6B6B' : '#DCE4E3',
    loginAsAccount: () => setState(x => (!(x.acc.mail || '').trim() || !(x.acc.pass || '').trim())
      ? { loginTouched: true }
      : { loginTouched: false, guest: false, firstJoin: false, screen: 'home' }),
    joinMail: (st.join2 || {}).mail || '',
    joinPhone: (st.join2 || {}).phone || '',
    setJoinMail: (e) => { const v2 = e.target.value; setState(x => ({ join2: Object.assign({}, x.join2, { mail: v2 }) })); },
    setJoinPhone: (e) => { const v2 = e.target.value; setState(x => ({ join2: Object.assign({}, x.join2, { phone: v2 }) })); },
    joinMailErr: !!st.joinTouched && !((st.join2 || {}).mail || '').trim(),
    joinPhoneErr: !!st.joinTouched && !((st.join2 || {}).phone || '').trim(),
    joinCodeErr: !!st.joinTouched && !(st.code || '').trim(),
    joinByCode: () => setState(x => {
      const j = x.join2 || {};
      if (!(j.mail || '').trim() || !(j.phone || '').trim() || !(x.code || '').trim()) return { joinTouched: true };
      const mail = (j.mail || '').trim().toLowerCase();
      const phone = (j.phone || '').trim().replace(/[^0-9]/g, '');
      const known = !x.firstJoin && x.members.some(m => (mail && (m.mail || '').toLowerCase() === mail)
        || (phone && (m.phone || '').replace(/[^0-9]/g, '') === phone));
      return known
        ? { joinTouched: false, guest: true, role: x.role === 'host' ? 'member' : x.role, firstJoin: false, screen: 'event' }
        : { joinTouched: false, guest: true, role: 'member', firstJoin: true, screen: 'invite' };
    }),
    viewRoleRows: (() => {
      const idOf = (role, first) => first ? { n: '小明', m: 'ming' }
        : ({ host: { n: '小凱', m: 'kai' }, co: { n: '阿豪', m: 'hao' }, member: { n: '小美', m: 'mei' } }[role] || { n: '小明', m: 'ming' });
      const set = (role, guest, first, blank) => () => setState(x => Object.assign({ role: role, persona: role, guest: guest, firstJoin: !!first, blank: !!blank,
        acc: Object.assign({}, x.acc, { name: idOf(role, first).n, mail: idOf(role, first).m + '@example.com' }),
        join2: Object.assign({}, x.join2, { mail: idOf(role, first).m + '@example.com' }),
        shareEdit: null, shareAlert: null, tagPick: null, editDetail: null, detailTouched: false, alertDetail: null },
        ((guest && !first) || blank) ? { screen: 'home', expand: {} } : {}));
      const mk = (label, role, guest, first, blank) => {
        const sel = (st.persona || st.role) === role && !!st.guest === guest && !!st.firstJoin === !!first && !!st.blank === !!blank;
        return { label: label, sel: sel, unsel: !sel, pick: set(role, guest, first, blank) };
      };
      return [
        { role: '主辦人', opts: [mk('帳號人員', 'host', false, false, false), mk('空白狀態', 'host', false, false, true)] },
        { role: '協辦者', opts: [mk('帳號人員', 'co', false, false), mk('免帳號人員（非初次加入）', 'co', true, false)] },
        { role: '參與者', opts: [mk('帳號人員', 'member', false, false), mk('免帳號人員（非初次加入）', 'member', true, false)] },
        { role: '初次加入', opts: [mk('免帳號人員', 'member', true, true)] },
      ];
    })(),
    hasPast: !st.blank && !st.firstJoin && st.events.some(e => e.archived && !(st.guest && e.role === 'host')),
    userName: st.acc.name.trim() || (st.firstJoin ? '訪客' : me.name),
    accName: st.acc.name, accMail: st.acc.mail, accPass: st.acc.pass,
    setAccName: setField('acc', 'name'), setAccMail: setField('acc', 'mail'), setAccPass: setField('acc', 'pass'),
    code: st.code, setCode: (e) => setState({ code: e.target.value }),
    evName: curEv.name, evDate: curEv.date,
    evNameVal: st.ev.name,
    evNameErr: !!st.evNameTouched && !st.ev.name.trim(),
    evNameOk: !(!!st.evNameTouched && !st.ev.name.trim()),
    evPlaceVal: st.ev.place || '',
    dtD1: st.ev.d1 || '', dtT1: st.ev.t1 || '', dtD2: st.ev.d2 || '', dtT2: st.ev.t2 || '',
    dtHasT1: !!st.ev.t1, dtNoT1: !st.ev.t1, dtHasT2: !!st.ev.t2, dtNoT2: !st.ev.t2,
    dtStart: st.ev.d1 ? st.ev.d1 + 'T' + (st.ev.t1 || '00:00') : '',
    dtEnd: st.ev.d2 ? st.ev.d2 + 'T' + (st.ev.t2 || '00:00') : '',
    setDtD1: (e) => { const val = e.target.value; setState(x => ({ ev: Object.assign({}, x.ev, { d1: val }) })); },
    setDtStart: (e) => { const p = String(e.target.value).split('T'); setState(x => ({ ev: Object.assign({}, x.ev, { d1: p[0] || '', t1: (p[1] || '').slice(0, 5) }) })); },
    setDtEnd: (e) => { const p = String(e.target.value).split('T'); setState(x => ({ ev: Object.assign({}, x.ev, { d2: p[0] || '', t2: (p[1] || '').slice(0, 5) }) })); },
    setDtD2: (e) => { const val = e.target.value; setState(x => ({ ev: Object.assign({}, x.ev, { d2: val }) })); },
    addT1: () => setState(x => ({ ev: Object.assign({}, x.ev, { t1: '19:00' }) })),
    addT2: () => setState(x => ({ ev: Object.assign({}, x.ev, { t2: '21:00' }) })),
    clearT1: () => setState(x => ({ ev: Object.assign({}, x.ev, { t1: '' }) })),
    clearT2: () => setState(x => ({ ev: Object.assign({}, x.ev, { t2: '' }) })),
    clearStart: () => setState(x => ({ ev: Object.assign({}, x.ev, { d1: '', t1: '' }) })),
    clearEnd: () => setState(x => ({ ev: Object.assign({}, x.ev, { d2: '', t2: '' }) })),
    setEvName: setField('ev', 'name'),
    setEvPlaceNew: setField('ev', 'place'),
    templateOpts: TEMPLATE_OPTS.map(o => ({ label: o.label, hint: o.hint, soon: !!o.soon, sel: st.ev.template === o.label, unsel: st.ev.template !== o.label,
      pick: () => setState(x => ({ ev: Object.assign({}, x.ev, { template: o.label }) })) })),

    noActive: !!st.blank || st.events.every((e, i) => e.archived || (st.guest && roleAt(st, e, i) === 'host') || (st.firstJoin && i !== 0)),
    activeEvents: (st.blank ? [] : st.events.map((e, i) => ({ name: e.name, date: e.date, place: e.place || '地點未定',
      archived: e.archived || (st.guest && roleAt(st, e, i) === 'host') || (st.firstJoin && i !== 0),
      role: roleName(roleAt(st, e, i)),
      status: ((i === st.cur && st.settled) || (i !== st.cur && e.settled)) ? '已結帳，待繳款' : evMemberCount(st0, i) + ' 人參與',
      open: () => setState(x => Object.assign(switchEvent(x, i),
        { role: roleAt(st, e, i),
          settled: i === st.cur ? st.settled : !!e.settled, expand: {},
          screen: ((i === st.cur && st.settled) || (i !== st.cur && e.settled)) ? 'settledEvent' : 'event' })) }))
      .filter(e => !e.archived)),
    pastEvents: (st.blank || st.firstJoin ? [] : st.events.map((e, i) => ({ e: e, i: i }))
      .filter(o => o.e.archived && !(st.guest && o.e.role === 'host'))).map(o => ({
      name: o.e.name, date: o.e.date, place: o.e.place || '地點未定',
      total: money((st0.itemsBy[o.i] || []).reduce((a, it) => a + itemTotal(it), 0)),
      open: () => setState(x => Object.assign(switchEvent(x, o.i),
        { role: st.firstJoin ? 'member' : o.e.role, screen: 'archived' })) })),
    archivedName: curEv.name, archivedDate: curEv.date, archivedPlace: curEv.place || '地點未定',

    joinName: st.join.name, joinNote: st.join.note,
    setJoinName: setField('join', 'name'), setJoinNote: setField('join', 'note'),
    condOpts: st.condTags.map(t => ({ label: t, sel: st.join.conds.indexOf(t) >= 0, unsel: st.join.conds.indexOf(t) < 0,
      toggle: toggleField('join', 'conds', t) })),

    myTags: me.tags.length ? me.tags : ['無標籤'], noMyTags: false,
    items, noItems: items.length === 0, itemsTotal: money(total),
    sharedTotal: money(totals[me.id] || 0),
    myPaidTotal: money(paidBy[me.id] || 0),

    noRules: !st.rules.length,
    itemTagsView: st.itemTags.filter(t => !!t).map(t => ({ label: t })),
    condTagsView: st.condTags.filter(t => !!t).map(t => ({ label: t })),
    ruleCards: st.rules.map(r => ({
      tag: r.tag || '未選標籤',
      tagUsed: ruleTagUsed(r.tag, st0),
      lines: (r.groups || []).map(g => ({
        chips: ((g.conds || []).length ? g.conds : ['未選條件']).map(cc => ({ label: cc })),
        count: '符合 ' + matchCount(g) + ' 人',
        effect: effLabel(g) })),
      restLabel: restLabel(r) })),
    menuFade: menuShown ? 1 : 0,
    menuSlide: menuShown ? 'translateX(0)' : 'translateX(-100%)',
    menuVis: menuActive ? 'visible' : 'hidden',
    railShown: menuAllowed,
    railVar: menuAllowed ? 'var(--railw-lg)' : '0px',
    menuPE: menuShown ? 'auto' : 'none',
    onEvent: s === 'event' || s === 'settledEvent' || s === 'archived',
    notOnEvent: !(s === 'event' || s === 'settledEvent' || s === 'archived'),
    bgHome: s === 'home' ? '#F3F6F5' : 'none',
    bgEvent: (s === 'event' || s === 'settledEvent' || s === 'archived') ? '#F3F6F5' : 'none',
    bgRules: (s === 'rules' || s === 'rulesEdit') ? '#F3F6F5' : 'none',
    bgGroup: s === 'group' ? '#F3F6F5' : 'none',
    bgSettle: (s === 'settle' || s === 'settleDone') ? '#F3F6F5' : 'none',
    bgPayments: s === 'payments' ? '#F3F6F5' : 'none',
    isSettled: !!st.settled,
    notSettled: !st.settled,
    menuToHome: () => { closeMenu(); setState({ screen: 'home', expand: {} }); },
    menuToEvent: () => { closeMenu(); setState(x => ({ screen: x.settled ? 'settledEvent' : 'event', expand: {} })); },
    menuToPayments: () => { closeMenu(); setState(x => ({ screen: 'payments', backFrom: x.screen, expand: {} })); },
    openMenu: () => openMenu(),
    closeMenu: () => closeMenu(),
    menuToRules: () => { closeMenu(); setState(x => ({ screen: 'rules', backFrom: x.screen, expand: {},
      secEdit: null, tagMenu: null, tagEdit: null, rulePick: null, ruleEdit: null, ruleNew: false })); },
    menuToGroup: () => { closeMenu(); setState(x => ({ screen: 'group', backFrom: x.screen, expand: {}, editMember: null })); },
    menuToSettle: () => { closeMenu(); setState(x => ({ screen: 'settle', backFrom: x.screen, expand: {} })); },
    evInfoOpen: !st.evInfoCollapsed,
    evInfoClosed: !!st.evInfoCollapsed,
    evInfoCaret: st.evInfoCollapsed ? '▾' : '▴',
    evInfoTitle: st.evInfoCollapsed ? '展開活動資訊' : '收合活動資訊',
    toggleEvInfo: () => setState(x => ({ evInfoCollapsed: !x.evInfoCollapsed })),
    canAddMember: st.role === 'host' && !st.settled,
    canEditRules: st.role === 'host' && !st.settled && !curEv.archived,
    cantEditRules: !(st.role === 'host' && !st.settled && !curEv.archived),
    ruleLockText: curEv.archived ? '活動已封存，規則僅供檢視' : st.settled ? '活動已結帳，規則已鎖定' : '僅主辦人可以調整規則',
    ruleRows: st.rules.map((r, i) => {
      const tagUsed = ruleTagUsed(r.tag, st0);
      return {
      tagLabel: r.tag || '未選標籤',
      tagUsed: tagUsed, tagFree: !tagUsed,
      restLabel: restLabel(r),
      lines: (r.groups || []).map(g => ({
        chips: (g.conds || []).length ? (g.conds || []).map(cc => ({ label: cc })) : [{ label: '未選條件' }],
        effect: effLabel(g),
        count: '符合 ' + matchCount(g) + ' 人' })),
      alertOutline: st.ruleAlert === i ? '2px solid #FF6B6B' : 'none',
      editing: st.ruleEdit === i, readOnly: st.ruleEdit !== i,
      edit: () => setState({ ruleEdit: i, rulePick: null }),
      del: () => askDelete(() => setState(x => ({ rules: x.rules.filter((_, j) => j !== i) }))) };
    }),
    restEffLabel: restLabel(editRule),
    restEffOpen: st.rulePick === 'rest',
    openRestEff: () => setState({ rulePick: 'rest' }),
    restModeOpts: [['不計入', 'exclude'], ['設定權重', 'weight']].map(pr => {
      const rest = (editRule && editRule.rest) || {};
      const sel = (rest.mode || 'weight') === pr[1];
      return { label: pr[0], mark: sel ? '✓' : '',
        sel,
        pick: () => {
          const cur2 = (editRule && editRule.rest) || {};
          patchRule({ rest: Object.assign({}, cur2, { mode: pr[1], wt: pr[1] === 'weight' && (cur2.wt === undefined || cur2.wt === null || cur2.wt === '') ? '1' : cur2.wt }) });
          if (pr[1] !== 'weight') setState({ rulePick: null });
        } };
    }),
    restIsPct: ((((editRule && editRule.rest) || {}).mode) || 'weight') === 'weight',
    restPctVal: (function (rest) { return rest.wt === undefined || rest.wt === null ? '1' : String(rest.wt); })(((editRule && editRule.rest) || {})),
    setRestPct: (e) => {
      let raw = e.target.value.replace(/[^0-9.]/g, '');
      const parts = raw.split('.');
      if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
      if (raw !== '' && raw !== '.' && Number(raw) > 100) raw = '100';
      patchRule({ rest: Object.assign({}, ((editRule && editRule.rest) || {}), { mode: 'weight', wt: raw }) });
    },
    ruleTagLabel: editRule && editRule.tag ? editRule.tag : '選擇項目標籤',
    openRuleTagPick: () => setState({ rulePick: 'tag' }),
    ruleTagPickOpen: st.rulePick === 'tag',
    ruleTagPickRows: st.rulePick === 'tag' ? st.itemTags.filter(t => !!t
      && ((editRule && editRule.tag === t) || (!st.rules.some((r, j) => j !== st.ruleEdit && r.tag === t) && !ruleTagUsed(t, st0)))).map(t => {
      const on = !!(editRule && editRule.tag === t);
      return { label: t, sel: on, unsel: !on, used: false,
        toggle: () => { patchRule({ tag: t }); setState({ rulePick: null }); } };
    }) : [],
    closeRulePick: () => setState({ rulePick: null }),
    ruleGroupRows: (editRule ? (editRule.groups || []) : []).map((g, gi) => {
      const conds = g.conds || [];
      const key = 'cond' + gi;
      const q = st.rulePick === key ? (st.ruleCondQuery || '').trim() : '';
      const opts = st.condTags.filter(cc => !!cc && (!q || cc.indexOf(q) >= 0));
      return {
        no: gi + 1,
        chips: conds.map(cc => ({ label: cc, remove: () => patchGroup(gi, { conds: conds.filter(vv => vv !== cc) }) })),
        queryVal: st.rulePick === key ? (st.ruleCondQuery || '') : '',
        setQuery: (e) => { const vv = e.target.value; setState({ rulePick: key, ruleCondQuery: vv }); },
        openPick: () => setState({ rulePick: key, ruleCondQuery: '' }),
        pickOpen: st.rulePick === key,
        pickRows: st.rulePick === key ? opts.map(cc => {
          const on = conds.indexOf(cc) >= 0;
          return { label: cc, sel: on, unsel: !on, used: false,
            toggle: () => patchGroup(gi, { conds: on ? conds.filter(vv => vv !== cc) : conds.concat([cc]) }) };
        }) : [],
        pickEmpty: st.rulePick === key && opts.length === 0,
        count: conds.length ? '符合 ' + matchCount(g) + ' 人' : '',
        dup: conds.length > 0 && ((editRule && editRule.groups) || []).some((og, oi) => oi !== gi
          && (og.conds || []).length === conds.length
          && (og.conds || []).slice().sort().join('|') === conds.slice().sort().join('|')),
        rowOpacity: st.dragG === gi ? 0.45 : 1,
        dragStart: (e) => { if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(gi)); } catch (err) {} } setState({ dragG: gi, rulePick: null }); },
        dragEnd: () => setState({ dragG: null }),
        dragOver: (e) => { if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; },
        drop: () => {
          const from = ST.dragG;
          setState({ dragG: null });
          if (from === null || from === undefined || from === gi) return;
          const list = ((editRule && editRule.groups) || []).slice();
          const moved = list.splice(from, 1)[0];
          list.splice(gi, 0, moved);
          patchRule({ groups: list });
        },
        effLabel: effLabel(g),
        effOpen: st.rulePick === 'eff' + gi,
        openEff: () => setState({ rulePick: 'eff' + gi }),
        modeOpts: [['不計入', 'exclude'], ['設定權重', 'weight']].map(pr => {
          const sel = (g.mode || 'exclude') === pr[1];
          return { label: pr[0], mark: sel ? '✓' : '', sel,
            pick: () => { patchGroup(gi, { mode: pr[1] }); if (pr[1] !== 'weight') setState({ rulePick: null }); } };
        }),
        isPct: (g.mode || 'exclude') === 'weight',
        pctVal: g.wt === undefined || g.wt === null ? '' : String(g.wt),
        setPct: (e) => {
          let raw = e.target.value.replace(/[^0-9.]/g, '');
          const parts = raw.split('.');
          if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
          if (raw !== '' && raw !== '.' && Number(raw) > 100) raw = '100';
          patchGroup(gi, { wt: raw });
        },
        del: () => patchRule({ groups: (editRule.groups || []).filter((_, j) => j !== gi) }),
      };
    })});

  Object.assign(v, {
    addRuleGroup: () => patchRule({ groups: ((editRule && editRule.groups) || []).concat([{ conds: [], mode: 'exclude', wt: '' }]) }),
    closeRuleEdit: () => setState(x => Object.assign({ rulePick: null, ruleAlert: null }, x.ruleNew
      ? { ruleEdit: null, ruleNew: false, rules: x.rules.filter((_, j) => j !== x.ruleEdit) }
      : { ruleEdit: null })),
    saveRuleEdit: () => {
      const r = st.rules[st.ruleEdit];
      const keys = (r && r.groups || []).map(g => (g.conds || []).slice().sort().join('|'));
      const noDup = keys.every((k, i) => keys.indexOf(k) === i);
      const ok = r && r.tag && (r.groups || []).length && noDup
        && (r.groups || []).every(g => (g.conds || []).length
          && ((g.mode || 'exclude') !== 'weight' || (g.wt !== '' && g.wt !== undefined && Number(g.wt) > 0 && Number(g.wt) <= 100)));
      if (!ok) { flashRule(st.ruleEdit); return; }
      setState({ ruleEdit: null, ruleNew: false, rulePick: null, ruleAlert: null });
    },
    itemTagRows: tagRows('item', st),
    condTagRows: tagRows('cond', st),
    tagUsedOpen: !!st.tagUsedAsk,
    tagUsedText: (st.tagUsedAsk && st.tagUsedAsk.text) || '',
    tagUsedNo: () => setState({ tagUsedAsk: null }),
    addItemTag: () => setState(x => (x.tagEdit && x.tagEdit.isNew ? {} : { tagMenu: null, itemTags: x.itemTags.concat(['']), tagEdit: { kind: 'item', i: x.itemTags.length, value: '', isNew: true } })),
    addCondTag: () => setState(x => (x.tagEdit && x.tagEdit.isNew ? {} : { tagMenu: null, condTags: x.condTags.concat(['']), tagEdit: { kind: 'cond', i: x.condTags.length, value: '', isNew: true } })),
    itemOpen: !(st.secShut && st.secShut.item), itemShut: !!(st.secShut && st.secShut.item),
    condOpen: !(st.secShut && st.secShut.cond), condShut: !!(st.secShut && st.secShut.cond),
    ruleOpen: !(st.secShut && st.secShut.rule), ruleShut: !!(st.secShut && st.secShut.rule),
    toggleItemOpen: () => toggleSecOpen('item'), toggleCondOpen: () => toggleSecOpen('cond'), toggleRuleOpen: () => toggleSecOpen('rule'),
    itemViewOn: !(st.secShut && st.secShut.item) && !(st.secEdit && st.secEdit.item),
    itemEditOn: !(st.secShut && st.secShut.item) && !!(st.secEdit && st.secEdit.item),
    condViewOn: !(st.secShut && st.secShut.cond) && !(st.secEdit && st.secEdit.cond),
    condEditOn: !(st.secShut && st.secShut.cond) && !!(st.secEdit && st.secEdit.cond),
    ruleViewOn: !(st.secShut && st.secShut.rule) && !(st.secEdit && st.secEdit.rule),
    ruleEditOn: !(st.secShut && st.secShut.rule) && !!(st.secEdit && st.secEdit.rule),
    toggleItemEdit: () => toggleSec('item'), toggleCondEdit: () => toggleSec('cond'), toggleRuleEdit: () => toggleSec('rule'),
    addRuleRow: () => {
      const blank = st.rules.findIndex(r => !r.tag || !(r.groups || []).length || (r.groups || []).some(g => !(g.conds || []).length));
      if (blank >= 0) { setState({ ruleEdit: blank, rulePick: null }); flashRule(blank); return; }
      setState(x => ({ rules: [{ tag: '', groups: [{ conds: [], mode: 'exclude', wt: '' }] }].concat(x.rules),
        ruleEdit: 0, ruleNew: true, ruleAlert: null, rulePick: null, ruleTagQuery: '', ruleCondQuery: '' }));
    },
    memberAddAskOpen: st.memberAddAsk != null,
    memberAddNo: () => setState({ memberAddAsk: null }),
    memberAddYes: () => setState(x => {
      const i = x.memberAddAsk;
      const mm = x.members[i] || {};
      const nm = (mm.name || '').trim() || '未命名';
      return { memberAddAsk: null, editMember: null, newMember: null,
        memberToast: (mm.role || '參與者') + '　' + nm + ' 已新增成功' };
    }),
    memberCount: st.members.length,
    members: (() => {
      const usedIds = {}; const usedNames = {};
      st.items.forEach(it => {
        usedNames[it.by] = true;
        it.details.forEach(d => { detailShares(d).inc.forEach(p => { usedIds[p.id] = true; }); });
      });
      _memberUsed = { ids: usedIds, names: usedNames };
      const rank = { '主辦者': 0, '協辦者': 1, '參與者': 2 };
      const rk = (i) => rank[st.members[i].role] === undefined ? 3 : rank[st.members[i].role];
      const editing = st.editMember != null;
      let idx;
      if (editing && _memberOrder && _memberOrder.length === st.members.length) {
        idx = _memberOrder.slice();
      } else {
        idx = st.members.map((_, i) => i);
        idx.sort((a, b) => (rk(a) - rk(b)) || (a - b));
        if (st.newMember !== null && st.newMember !== undefined) idx = [st.newMember].concat(idx.filter(i => i !== st.newMember));
        _memberOrder = idx.slice();
      }
      return idx.map(i => {
        const m = st.members[i];
        const lastHost = m.role === '主辦者' && st.members.filter(x => x.role === '主辦者').length === 1;
        const isNew = st.newMember === i;
        const used = !isNew && !!m.name && !!(_memberUsed && (_memberUsed.ids[m.id] || _memberUsed.names[m.name]));
        return { name: dsp(m), role: m.role, login: m.login,
          tagText: m.tags.length ? m.tags.map(t => '#' + t).join(' ') : '',
          hasTags: m.tags.length > 0,
          removable: !lastHost && !st.settled, locked: lastHost && !st.settled,
          inUse: used, rawName: m.name,
          canEdit: st.role === 'host' && !st.settled,
          cantEdit: !(st.role === 'host' && !st.settled),
          editing: st.editMember === i, readOnly: st.editMember !== i,
          startEdit: () => setState({ editMember: i }),
          doneEdit: () => setState(x => (x.newMember === i ? { memberAddAsk: i } : { editMember: null })),
          setName: e => setMember(i, { name: e.target.value }),
          roleOpts: (m.guest ? ['協辦者', '參與者'] : ['主辦者', '協辦者', '參與者']).map(r => {
            const sel = m.role === r;
            const lockRole = lastHost;
            if (lockRole) return { label: r, sel, locked: true, pick: () => {} };
            return { label: r, sel, locked: false, pick: () => { if (!sel) setMember(i, { role: r }); } };
          }),
          condLocked: used, condFree: !used, noConds: m.tags.length === 0,
          condChips: m.tags.map(t => ({ label: t, remove: () => setMember(i, { tags: m.tags.filter(vv => vv !== t) }) })),
          condQueryVal: st.mTagPick === i ? (st.mTagQuery || '') : '',
          setCondQuery: (e) => { const vv = e.target.value; setState({ mTagPick: i, mTagQuery: vv }); },
          openCondPick: () => setState({ mTagPick: i, mTagQuery: '' }),
          closeCondPick: () => setState({ mTagPick: null }),
          condPickOpen: st.mTagPick === i,
          condPickRows: st.mTagPick === i
            ? st.condTags.filter(t => !!t && (!(st.mTagQuery || '').trim() || t.indexOf((st.mTagQuery || '').trim()) >= 0)).map(t => {
                const on = m.tags.indexOf(t) >= 0;
                return { label: t, sel: on, unsel: !on, toggle: () => setMember(i, { tags: on ? m.tags.filter(vv => vv !== t) : m.tags.concat([t]) }) };
              })
            : [],
          condPickEmpty: st.mTagPick === i
            && st.condTags.filter(t => !!t && (!(st.mTagQuery || '').trim() || t.indexOf((st.mTagQuery || '').trim()) >= 0)).length === 0,
          noteVal: m.note === undefined || m.note === null ? (st.join.note || '') : m.note,
          setNote: (e) => setMember(i, { note: e.target.value }),
          open: () => { if (st.role === 'host' && !st.settled) setState({ editMember: i }); },
          askRemove: () => { if (used) { setState({ memberToast: dsp(m) + ' 已有代墊款項或分攤金額，不可刪除' }); return; } askDelete(() => setState(x => ({ editMember: null, newMember: null, members: x.members.filter((_, j) => j !== i) }))); } };
      });
    })(),
    addMember: () => setState(x => (x.newMember != null ? {
      editMember: x.newMember, memberToast: '請先完成目前新增的人員，再新增下一位'
    } : {
      editMember: x.members.length, newMember: x.members.length, memberToast: null,
      members: x.members.concat([{ id: '0100' + (20 + x.members.length), name: '新成員 ' + (x.members.length + 1),
        role: '參與者', tags: [], login: '尚未加入', guest: true }]) })),
  });

  Object.assign(v, {
    memberAddOn: st.newMember == null, memberAddOff: st.newMember != null,
    evPlace: curEv.place || '地點未定',
    evEditOpen: !!st.evEdit, evEditIdle: !st.evEdit,
    edName: st.evEdit ? (st.evEdit.name || '') : '',
    edNameErr: !!(st.evEdit && st.evEdit.touched && !(st.evEdit.name || '').trim()),
    edPlace: st.evEdit ? (st.evEdit.place || '') : '',
    setEdName: (e) => { const vv = e.target.value; setState(x => ({ evEdit: Object.assign({}, x.evEdit, { name: vv }) })); },
    setEdPlace: (e) => { const vv = e.target.value; setState(x => ({ evEdit: Object.assign({}, x.evEdit, { place: vv }) })); },
    edD1: st.evEdit ? (st.evEdit.d1 || '') : '', edD2: st.evEdit ? (st.evEdit.d2 || '') : '',
    edHasT1: !!(st.evEdit && st.evEdit.t1), edNoT1: !(st.evEdit && st.evEdit.t1),
    edHasT2: !!(st.evEdit && st.evEdit.t2), edNoT2: !(st.evEdit && st.evEdit.t2),
    edStart: st.evEdit && st.evEdit.d1 ? st.evEdit.d1 + 'T' + (st.evEdit.t1 || '00:00') : '',
    edEnd: st.evEdit && st.evEdit.d2 ? st.evEdit.d2 + 'T' + (st.evEdit.t2 || '00:00') : '',
    setEdD1: (e) => { const vv = e.target.value; setState(x => ({ evEdit: Object.assign({}, x.evEdit, { d1: vv }) })); },
    setEdD2: (e) => { const vv = e.target.value; setState(x => ({ evEdit: Object.assign({}, x.evEdit, { d2: vv }) })); },
    setEdStart: (e) => { const p = String(e.target.value).split('T'); setState(x => ({ evEdit: Object.assign({}, x.evEdit, { d1: p[0] || '', t1: (p[1] || '').slice(0, 5) }) })); },
    setEdEnd: (e) => { const p = String(e.target.value).split('T'); setState(x => ({ evEdit: Object.assign({}, x.evEdit, { d2: p[0] || '', t2: (p[1] || '').slice(0, 5) }) })); },
    edAddT1: () => setState(x => ({ evEdit: Object.assign({}, x.evEdit, { t1: '19:00' }) })),
    edAddT2: () => setState(x => ({ evEdit: Object.assign({}, x.evEdit, { t2: '21:00' }) })),
    edClearT1: () => setState(x => ({ evEdit: Object.assign({}, x.evEdit, { t1: '' }) })),
    edClearT2: () => setState(x => ({ evEdit: Object.assign({}, x.evEdit, { t2: '' }) })),
    edClearStart: () => setState(x => ({ evEdit: Object.assign({}, x.evEdit, { d1: '', t1: '' }) })),
    edClearEnd: () => setState(x => ({ evEdit: Object.assign({}, x.evEdit, { d2: '', t2: '' }) })),
    openEvEdit: () => setState({ evEdit: { name: curEv.name, place: curEv.place || '', d1: '', t1: '', d2: '', t2: '', dateText: curEv.date } }),
    closeEvEdit: () => setState({ evEdit: null }),
    saveEvEdit: () => {
      const ed = ST.evEdit;
      if (!ed || !(ed.name || '').trim()) { setState(x => ({ evEdit: Object.assign({}, x.evEdit, { touched: true }) })); return; }
      setState(x => ({ evEdit: null,
        events: x.events.map((e, i) => i === x.cur ? Object.assign({}, e, {
          name: (x.evEdit.name || '').trim() || e.name,
          date: fmtEvDT(x.evEdit) || x.evEdit.dateText || e.date,
          place: (x.evEdit.place || '').trim() }) : e) }));
    },
    inviteLink: 'https://fenzhang.app/j/' + (curEv.name.length * 7 + 4831).toString(36).toUpperCase(),
    inviteCode: '4KQ2-8P',
    copyLabel: st.copied ? '已複製 ✓' : '複製連結',
    copyLink: () => { setState({ copied: true }); setTimeout(() => setState({ copied: false }), 1600); },
    receiptLabel: st.draft.receipt ? '收據已上傳 ✓（示意）' : '拍照上傳收據',
    uploadReceipt: () => setState(x => ({ draft: Object.assign({}, x.draft, { receipt: !x.draft.receipt }) })),
    draftDetails: st.draft.details.map((d, i) => {
      const sh = detailShares(d);
      const editingDraft = (st.draftEdit === undefined ? null : st.draftEdit);
      const amtStr = String(d.amount === 0 ? 0 : (d.amount || ''));
      const nameEmpty = !(d.name || '').trim();
      const amtEmpty = !amtStr.trim();
      const amtBad = !amtEmpty && /[^0-9]/.test(amtStr);
      const touched = editingDraft === i && !!st.draftTouched;
      return { no: i + 1, name: d.name, amount: d.amount, note: d.note,
        nameText: (d.name || '').trim() || '未命名品項',
        amountText: money(num(d.amount)),
        canEdit: editingDraft === i, readOnly: editingDraft !== i,
        startEdit: () => setState({ draftEdit: i, draftTouched: false }),
        doneEdit: () => {
          const shk = 'draft' + i;
          if (sh.mismatch || sh.overflow) { setState({ shareEdit: shk }); flashShareAlert(shk); return; }
          if (nameEmpty || amtEmpty || amtBad) setState({ draftTouched: true });
          else setState({ draftEdit: null, draftTouched: false, shareEdit: null, shareAlert: null });
        },
        nameOk: !(touched && nameEmpty), nameErr: touched && nameEmpty,
        amountEmpty: touched && amtEmpty, amountBad: amtBad,
        alertOutline: st.alertDraft === i ? '2px solid #FF6B6B' : 'none',
        askRemove: () => askDelete(() => setState(x => ({ draftEdit: null, draftTouched: false,
          draft: Object.assign({}, x.draft, { details: x.draft.details.filter((_, j) => j !== i) }) }))),
        cancelAdd: () => setState(x => ({ draftEdit: null, draftTouched: false, shareEdit: null, shareAlert: null,
          draft: Object.assign({}, x.draft, { details: x.draft.details.filter((_, j) => j !== i) }) })),
        setName: (e) => patchDetail('draft', i, { name: e.target.value }),
        setAmount: (e) => patchDetail('draft', i, { amount: e.target.value }),
        setNote: (e) => patchDetail('draft', i, { note: e.target.value }),
        ...shareView('draft' + i, sh.inc.length ? sh.inc.map(p => ({ name: dsp(p), amount: money(sh.map[p.id]), hasCond: p.tags.length > 0, condText: p.tags.map(t => '#' + t).join('、') })) : [{ name: '尚無分攤者', amount: '—', hasCond: false, condText: '' }]),
        ...tagPickView('draft' + i, 'draft', i, d),
        ...shareEditView('draft' + i, 'draft', i, d, true, editingDraft === i) };
    }),
    draftTotal: money(st.draft.details.reduce((a, d) => a + num(d.amount), 0)),
    draftEmpty: st.draft.details.length === 0,
    addDetail: () => {
      const bad = d => { const a = String(d.amount === 0 ? 0 : (d.amount || '')).trim(); return !(d.name || '').trim() || !a || /[^0-9]/.test(a); };
      const blank = st.draft.details.findIndex(bad);
      if (blank >= 0) {
        clearTimeout(window._alertT2);
        setState({ alertDraft: blank, draftEdit: blank, draftTouched: true });
        window._alertT2 = setTimeout(() => setState({ alertDraft: null }), 1800);
        return;
      }
      setState(x => ({ alertDraft: null, draftEdit: 0, draftTouched: false, draft: Object.assign({}, x.draft, {
        details: [{ name: '', amount: '', tags: [], note: '', ids: null }].concat(x.draft.details) }) }));
    },
    draftBack: () => {
      const dirty = st.draft.receipt || st.draft.details.some(d => (d.name || '').trim() || String(d.amount === 0 ? 0 : (d.amount || '')).trim() || (d.note || '').trim() || d.tags.length);
      if (dirty) setState({ draftDiscardAsk: true });
      else setState({ screen: 'event', draftTouched: false });
    },
    memberToastText: st.memberToast || '', memberToastOpen: !!st.memberToast,
    closeMemberToast: () => setState({ memberToast: null }),
    delConfirmOpen: !!st.delAsk,
    delConfirmNo: () => setState({ delAsk: null }),
    delConfirmYes: () => { const fn = ST.delAsk; setState({ delAsk: null }, () => { if (fn) fn(); }); },
    draftDiscardOpen: !!st.draftDiscardAsk,
    draftDiscardCancel: () => setState({ draftDiscardAsk: false }),
    draftDiscardConfirm: () => setState({ draftDiscardAsk: false, draftTouched: false, alertDraft: null, screen: 'event',
      draftEdit: null, draftNeedAny: false, draft: { receipt: false, details: [] } }),
    submitItem: () => {
      const bad = st.draft.details.some(d => { const a = String(d.amount === 0 ? 0 : (d.amount || '')); return !(d.name || '').trim() || !a.trim() || /[^0-9]/.test(a); });
      if (bad) { setState({ draftTouched: true }); return; }
      if (!st.draft.details.length && !st.draft.receipt) { setState({ draftNeedAny: true }); return; }
      setItems((list, x) => list.concat([{ id: 'i' + (list.length + 1), by: me.name, receipt: x.draft.receipt,
        details: x.draft.details.map(d => ({ name: d.name.trim() || '未命名品項', amount: num(d.amount),
          tags: d.tags.slice(), note: d.note.trim(), ids: d.ids })) }]));
      setState({ screen: 'event', draftTouched: false, alertDraft: null, draftNeedAny: false,
        draftEdit: null, draft: { receipt: false, details: [] } });
    },
    draftNeedAny: !!st.draftNeedAny && !st.draft.details.length && !st.draft.receipt,
    discardAskOpen: !!st.discardAsk,
    itemBack: () => { if (st.editDetail !== null && st.editDetail !== undefined) setState({ discardAsk: true }); else setState(x => ({ screen: x.backFrom || (x.settled ? 'settledEvent' : 'event'), backFrom: null, expand: {} })); },
    discardCancel: () => setState({ discardAsk: false }),
    discardConfirm: () => setState(x => ({ discardAsk: false, editDetail: null, alertDetail: null, screen: x.backFrom || (x.settled ? 'settledEvent' : 'event'), backFrom: null, expand: {} })),
  });

  Object.assign(v, {
    itemSaveAll: () => { if (editingInvalid) { setState({ detailTouched: true }); return; } setState(x => ({ discardAsk: false, editDetail: null, detailTouched: false, alertDetail: null, screen: x.backFrom || (x.settled ? 'settledEvent' : 'event'), backFrom: null, expand: {} })); },
    canEditItem: canEditDetail && !st.settled,
    askRemoveItem: () => askDelete(() => {
      setItems((list) => list.filter((_, j) => j !== st.sel));
      setState(x => ({ sel: 0, editDetail: null, detailTouched: false, newDetail: null, shareEdit: null, shareAlert: null, alertDetail: null,
        screen: x.backFrom || (x.settled ? 'settledEvent' : 'event'), backFrom: null, expand: {} }));
    }),
    addItemDetail: () => {
      const blank = cur.details.findIndex(d => { const a = String(d.amount === 0 ? 0 : (d.amount || '')).trim(); return !(d.name || '').trim() || !a || /[^0-9]/.test(a); });
      if (blank >= 0) {
        clearTimeout(window._alertT);
        setState({ editDetail: blank, alertDetail: blank, detailTouched: true });
        window._alertT = setTimeout(() => setState({ alertDetail: null }), 1800);
        return;
      }
      setItems((list, x) => list.map((it, j) => j === x.sel
        ? Object.assign({}, it, { details: [{ name: '', amount: '', tags: [], note: '', ids: null }].concat(it.details) }) : it));
      setState({ editDetail: 0, alertDetail: null, detailTouched: false, newDetail: 0 });
    },
    item: { by: cur.by, amountText: money(itemTotal(cur)),
      receiptText: cur.receipt ? '收據照片 placeholder' : '此筆未上傳收據',
      details: cur.details.map((d, i) => {
        const sh = detailShares(d);
        const editable = canEditDetail && !st.settled;
        const editingNow = editable && st.editDetail === i;
        const amtStr = String(d.amount === 0 ? 0 : (d.amount || ''));
        const nameEmpty = !(d.name || '').trim();
        const amtEmpty = !amtStr.trim();
        const amtBad = !amtEmpty && /[^0-9]/.test(amtStr);
        const touched = editingNow && !!st.detailTouched;
        return { no: i + 1, name: d.name || '未命名品項', amountText: money(sh.amount), note: d.note || '—',
          tags: d.tags,
          nameVal: d.name, amountVal: String(d.amount), noteVal: d.note,
          setName: (e) => patchDetail('item', i, { name: e.target.value }),
          amountBad: amtBad, amountEmpty: touched && amtEmpty,
          nameOk: !(touched && nameEmpty), nameErr: touched && nameEmpty,
          setAmount: (e) => patchDetail('item', i, { amount: e.target.value }),
          setNote: (e) => patchDetail('item', i, { note: e.target.value }),
          ...shareView('item' + st.sel + '_' + i, sh.inc.map(p => ({ name: dsp(p), amount: money(sh.map[p.id]), hasCond: p.tags.length > 0, condText: p.tags.map(t => '#' + t).join('、') }))),
          ...tagPickView('item' + st.sel + '_' + i, 'item', i, d, editable),
          ...shareEditView('item' + st.sel + '_' + i, 'item', i, d, editable, editingNow),
          canEdit: editingNow, readOnly: !editingNow,
          hasNote: !editingNow && !!(d.note || '').trim(),
          alertOutline: st.alertDetail === i ? '2px solid #FF6B6B' : 'none',
          newRow: st.newDetail === i, savedRow: st.newDetail !== i,
          cancelAdd: () => { setItems((list, x) => list.map((it, j) => j === x.sel
            ? Object.assign({}, it, { details: it.details.filter((_, k) => k !== i) }) : it).filter(it => it.details.length));
            setState({ editDetail: null, detailTouched: false, newDetail: null, shareEdit: null, shareAlert: null }); },
          canStartEdit: editable && !editingNow,
          startEdit: () => setState({ editDetail: i, detailTouched: false }),
          doneEdit: () => {
            const shk = 'item' + st.sel + '_' + i;
            if (sh.mismatch || sh.overflow) { setState({ shareEdit: shk }); flashShareAlert(shk); return; }
            if (nameEmpty || amtEmpty || amtBad) setState({ detailTouched: true });
            else setState({ editDetail: null, detailTouched: false, newDetail: null, shareEdit: null, shareAlert: null });
          },
          askRemove: () => askDelete(() => {
            const wasLast = cur.details.length <= 1 && !cur.receipt;
            setItems((list, x) => list.map((it, j) => j === x.sel
              ? Object.assign({}, it, { details: it.details.filter((_, k) => k !== i) }) : it)
              .filter(it => it.details.length || it.receipt));
            setState(x => Object.assign({ editDetail: null, detailTouched: false, newDetail: null,
              shareEdit: null, shareAlert: null, alertDetail: null },
              wasLast ? { sel: 0, expand: {}, backFrom: null, screen: x.backFrom || (x.settled ? 'settledEvent' : 'event') } : {})); }) };
      }) },
    viewOnlyItem: !canEditDetail || st.settled,
    itemPermText: curEv.archived ? '活動已封存，僅供檢視'
      : st.settled ? '活動已結帳，明細不可編輯'
      : (st.role === 'member' ? '參與者僅能檢視明細' : '協辦者僅能編輯／刪除自己新增的明細'),
    personSplits: st.members.map(m => ({
      name: dsp(m), role: m.role,
      tagText: m.tags.length ? m.tags.map(t => '#' + t).join(' ') : '',
      hasTags: m.tags.length > 0,
      share: money(totals[m.id] || 0), advance: money(paidBy[m.id] || 0) })),
    flowRows: flowRows,
    transferNote: st.transferNote,
    setTransferNote: (e) => setState({ transferNote: e.target.value }),
    copyReportLabel: st.copiedReport ? '已複製 ✓' : '複製',
    copyReport: () => { setState({ copiedReport: true }); setTimeout(() => setState({ copiedReport: false }), 1600); },
    transfers: transfers.map(t => ({ text: dsp(t.from) + ' → ' + dsp(t.to), amount: money(t.amount),
      paid: !!st.paid[t.key], unpaid: !st.paid[t.key],
      statusText: st.paid[t.key] ? '已繳款' : '未繳款',
      toggle: () => setPaid((p) => Object.assign({}, p, { [t.key]: !p[t.key] })) })),
    myTransfers, noTransfers: myTransfers.length === 0,
    myPaid: myKeys.length > 0 && myPaid,
    myUnpaid: myKeys.length > 0 && !myPaid,
    myReceiving: myKeys.length === 0 && myTransfers.length > 0,
    waitingText: '你為代墊方，等待其他人繳款',
  });

  return v;
}

function buildCtx() {
  const c = computeCtx();
  return Object.assign({}, c, buildVals(c));
}

/* ---------------- boot (ported from componentDidMount) ---------------- */
function bootSeed() {
  const ev0 = ST.events[ST.cur];
  if (ev0 && isOutdoorEvent(ev0.name)) {
    Object.assign(ST, outdoorEvSettingsData(bbqRoster()));
    ST.members = bbqRoster();
    ST.itemsBy = Object.assign({}, ST.itemsBy, { [ST.cur]: bbqItems() });
  }
}

/* ---------------- small shared UI fragments ---------------- */
function backIcon() { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:21px"><path d="M15 5l-7 7 7 7" stroke="#4D8F8F" stroke-linecap="butt" stroke-width="4"/></svg>'; }
function checkIcon(w) { w = w || 15; return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4.5 4.5L19 7"/></svg>`; }
function xIcon(w) { w = w || 14; return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`; }
function editIcon(w) { w = w || 16; return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l4 4"/></svg>`; }
function trashIcon(w) { w = w || 15; return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.8h6V7M6.5 7l.9 12.2h9.2L17.5 7M10 11v6M14 11v6"/></svg>`; }
function plusIcon(w) { w = w || 17; return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`; }
function chevDownIcon() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'; }
function chevRightIcon() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'; }
function lockIcon(w) { w = w || 15; return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`; }
function unlockIcon(w) { w = w || 15; return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 7.4-2"/></svg>`; }
function trashOutlineIcon() { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 12h10l1-12"/><path d="M10 11v5M14 11v5"/></svg>'; }
function starIcon() { return '<svg viewBox="0 0 24 24" width="17" height="17" fill="#4D8F8F" style="flex:none;margin-top:12px"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="#F1D380"/></svg>'; }

function fk(key) { return ` data-fk="${esc(key)}"`; }
function inputHTML(o) {
  // o: {value, onChange, placeholder, err, type, fkKey, extra, mode}
  const cls = 'input' + (o.err ? ' input--err' : '') + (o.small ? ' input--sm' : '');
  const type = o.type || 'text';
  return `<input type="${type}" class="${cls}" value="${esc(o.value)}" placeholder="${esc(o.placeholder || '')}"${o.mode ? ` inputmode="${o.mode}"` : ''}${fk(o.fkKey || o.placeholder || '')} data-change="${H(o.onChange)}"${o.extra || ''}>`;
}
function chip(label, kind, selected, opts) {
  opts = opts || {};
  const cls = `chip ${kind === 'item' ? 'chip-item' : 'chip-cond'}${opts.md ? ' chip-md' : ''}${selected ? ' is-sel' : ''}${opts.btn ? ' chip-btn' : ''}`;
  const prefix = kind === 'cond' && opts.hash ? '＃' : '';
  if (opts.onClick) return `<button type="button" class="${cls}" data-click="${H(opts.onClick)}">${prefix}${esc(label)}${opts.suffix || ''}</button>`;
  return `<span class="${cls}">${prefix}${esc(label)}${opts.suffix || ''}</span>`;
}
function dot(selected) { return selected ? `<span class="dot-sel">✓</span>` : `<span class="dot-unsel"></span>`; }

/* ---------------- topbar / drawer / sidebar / dialogs ---------------- */
function topbarBack(title, backFn, action) {
  return `<div class="topbar"><div class="topbar-row">
    <button class="icon-btn" title="返回" data-click="${H(backFn)}">${backIcon()}</button>
    <span class="topbar-title">${esc(title)}</span>
    ${action || '<span class="icon-btn" style="visibility:hidden"></span>'}
  </div></div>`;
}
function topbarHamburger(ctx, title, rightAction) {
  return `<div class="topbar"><div class="topbar-row topbar-row--start">
    <button class="icon-btn hamburger" title="更多操作" data-click="${H(ctx.openMenu)}"><span></span><span></span><span></span></button>
    <span class="topbar-title">${esc(title)}</span>
    ${rightAction || ''}
  </div></div>`;
}
function sidebarNav(ctx) {
  if (!ctx.railShown) return '';
  return `<nav class="sidebar">
    <div class="sidebar-brand"><span class="sidebar-logo">分</span><span class="sidebar-name">分帳吧</span></div>
    <button class="sidebar-item" style="background:${ctx.bgHome}" data-click="${H(ctx.menuToHome)}"><span>首頁</span></button>
    <div class="sidebar-divider"></div>
    <div class="sidebar-label">活動</div>
    ${ctx.onEvent ? `<div class="sidebar-static">活動款項</div>`
      : `<button class="sidebar-item" style="background:${ctx.bgEvent}" data-click="${H(ctx.menuToEvent)}"><span>活動款項</span></button>`}
    <button class="sidebar-item" style="background:${ctx.bgRules}" data-click="${H(ctx.menuToRules)}"><span>分攤規則</span></button>
    ${ctx.menuHostOps ? `<div class="sidebar-section">
      <div class="sidebar-label">主辦者操作</div>
      <button class="sidebar-item" style="background:${ctx.bgGroup}" data-click="${H(ctx.menuToGroup)}"><span>群組設定</span></button>
      ${ctx.notSettled ? `<button class="sidebar-item" style="background:${ctx.bgSettle}" data-click="${H(ctx.menuToSettle)}"><span>分帳產出</span></button>` : ''}
      ${ctx.isSettled ? `<button class="sidebar-item" style="background:${ctx.bgPayments}" data-click="${H(ctx.menuToPayments)}"><span>繳款狀況</span></button>` : ''}
    </div>` : ''}
  </nav>`;
}
function drawerMenu(ctx) {
  if (!ctx.menuAllowed) return '';
  return `<div class="drawer-root" style="visibility:${ctx.menuVis};pointer-events:${ctx.menuPE}">
    <div class="drawer-backdrop" style="opacity:${ctx.menuFade}" data-click="${H(ctx.closeMenu)}"></div>
    <div class="drawer-panel" style="transform:${ctx.menuSlide}">
      <div class="drawer-head"><span>選單</span><button data-click="${H(ctx.closeMenu)}" style="border:none;background:none;color:#95A0A5;font-size:16px;cursor:pointer">✕</button></div>
      <div class="drawer-body">
        <div class="drawer-list">
          <button class="drawer-item" style="background:${ctx.bgHome}" data-click="${H(ctx.menuToHome)}"><span class="drawer-item-label" style="flex:1">首頁</span><span class="drawer-item-caret">›</span></button>
          <div class="sidebar-divider" style="margin:6px 12px"></div>
          ${ctx.onEvent ? `<div class="drawer-static"><span class="drawer-item-label">活動總覽</span></div>`
            : `<button class="drawer-item" style="background:${ctx.bgEvent}" data-click="${H(ctx.menuToEvent)}"><span class="drawer-item-label" style="flex:1">活動總覽</span><span class="drawer-item-caret">›</span></button>`}
          <button class="drawer-item" style="background:${ctx.bgRules}" data-click="${H(ctx.menuToRules)}"><span class="drawer-item-label" style="flex:1">分攤規則</span><span class="drawer-item-caret">›</span></button>
        </div>
        ${ctx.menuHostOps ? `<div class="sidebar-section">
          <div class="sidebar-label">主辦者操作</div>
          <button class="drawer-item" style="background:${ctx.bgGroup}" data-click="${H(ctx.menuToGroup)}"><span class="drawer-item-label" style="flex:1">群組設定</span><span class="drawer-item-caret">›</span></button>
          ${ctx.notSettled ? `<button class="drawer-item" style="background:${ctx.bgSettle}" data-click="${H(ctx.menuToSettle)}"><span class="drawer-item-label" style="flex:1">分帳產出</span><span class="drawer-item-caret">›</span></button>` : ''}
          ${ctx.isSettled ? `<button class="drawer-item" style="background:${ctx.bgPayments}" data-click="${H(ctx.menuToPayments)}"><span class="drawer-item-label" style="flex:1">繳款狀況<span class="drawer-item-hint">確認各成員繳款進度</span></span><span class="drawer-item-caret">›</span></button>` : ''}
        </div>` : ''}
      </div>
    </div>
  </div>`;
}
function dialog(title, body, actions, closeFn, opts) {
  opts = opts || {};
  return `<div class="dialog-overlay"><div class="dialog">
    ${closeFn ? `<button class="dialog-close" data-click="${H(closeFn)}">✕</button>` : ''}
    <div class="dialog-title${opts.danger ? ' dialog-title--danger' : ''}">${esc(title)}</div>
    <div class="dialog-body">${esc(body)}</div>
    <div class="dialog-actions">${actions}</div>
  </div></div>`;
}
function renderDialogs(ctx) {
  let out = '';
  if (ctx.delConfirmOpen) out += dialog('刪除', '確認要刪除這筆資料?',
    `<button class="btn dialog-btn-cancel" data-click="${H(ctx.delConfirmNo)}">取消</button><button class="btn dialog-btn-danger" data-click="${H(ctx.delConfirmYes)}">刪除</button>`,
    ctx.delConfirmNo);
  if (ctx.draftDiscardOpen) out += dialog('離開', '確定要放棄編輯？',
    `<button class="btn dialog-btn-cancel" data-click="${H(ctx.draftDiscardCancel)}">取消</button><button class="btn dialog-btn-primary" data-click="${H(ctx.draftDiscardConfirm)}">確定</button>`,
    ctx.draftDiscardCancel);
  if (ctx.discardAskOpen) out += dialog('離開', '確定要放棄編輯？',
    `<button class="btn dialog-btn-cancel" data-click="${H(ctx.discardCancel)}">取消</button><button class="btn dialog-btn-primary" data-click="${H(ctx.discardConfirm)}">確定</button>`,
    ctx.discardCancel);
  if (ctx.settleAskOpen) out += dialog('確定要結帳產出？', '結帳後產生正式分帳結果，無法編輯、還原。',
    `<button class="btn dialog-btn-cancel" data-click="${H(ctx.cancelSettle)}">再檢查一下</button><button class="btn dialog-btn-primary" data-click="${H(ctx.confirmSettle)}">確定結帳</button>`,
    ctx.cancelSettle, { danger: true });
  if (ctx.paidAskOpen) out += dialog('確認繳清', '將告知主辦人已繳清款項',
    `<button class="btn dialog-btn-cancel" data-click="${H(ctx.cancelPaid)}">尚未繳清</button><button class="btn dialog-btn-primary" data-click="${H(ctx.confirmPaid)}">通知繳清</button>`,
    ctx.cancelPaid);
  if (ctx.memberAddAskOpen) out += dialog('提醒', '新增後即套用到所有款項依據條件分攤，確認新增嗎？',
    `<button class="btn dialog-btn-cancel" data-click="${H(ctx.memberAddNo)}">取消</button><button class="btn dialog-btn-primary" data-click="${H(ctx.memberAddYes)}">確認</button>`,
    ctx.memberAddNo);
  if (ctx.tagUsedOpen) out += `<div class="dialog-overlay" style="align-items:flex-start;padding-top:80px"><div class="error-banner" style="max-width:420px"><span>${esc(ctx.tagUsedText)}</span><button data-click="${H(ctx.tagUsedNo)}">✕</button></div></div>`;
  return out;
}

/* ---------------- screen: login ---------------- */
function screenLogin(ctx) {
  const roleRows = ctx.viewRoleRows.map(row => `
    <div class="roleswitch-row">
      <span class="roleswitch-label">${esc(row.role)}</span>
      <span class="roleswitch-opts">${row.opts.map(o => `<button class="pill-toggle${o.sel ? ' is-sel' : ''}" data-click="${H(o.pick)}">${esc(o.label)}</button>`).join('')}</span>
    </div>`).join('');
  return `<div class="page-shell page-shell--narrow" style="display:flex;flex-direction:column;align-items:center;padding-top:76px">
    <div style="width:70px;height:70px;border-radius:20px;background:var(--teal);display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:700">分</div>
    <div style="margin-top:16px;font-size:32px;font-weight:700;letter-spacing:.04em;color:var(--text)">分帳吧</div>
    <div class="segmented" style="margin-top:28px;width:100%">
      <button class="segmented-tab${ctx.loginOnAcc ? ' is-active' : ''}" data-click="${H(ctx.toLoginAcc)}">帳號登入</button>
      <button class="segmented-tab${ctx.loginOnCode ? ' is-active' : ''}" data-click="${H(ctx.toLoginCode)}">邀請碼加入</button>
    </div>
    ${ctx.loginOnAcc ? `
    <div class="flex-col gap-16 mt-20" style="width:100%">
      <div class="field"><div class="field-label">Email</div>
        <input class="input${ctx.accMailErr ? ' input--err' : ''}" value="${esc(ctx.accMail)}" placeholder="you@example.com"${fk('acc-mail')} data-change="${H(ctx.setAccMail)}">
        ${ctx.accMailErr ? '<div class="field-err">請填寫 Email</div>' : ''}
      </div>
      <div class="field"><div class="field-label">密碼</div>
        <input class="input${ctx.accPassErr ? ' input--err' : ''}" value="${esc(ctx.accPass)}" placeholder="輸入密碼"${fk('acc-pass')} data-change="${H(ctx.setAccPass)}">
        ${ctx.accPassErr ? '<div class="field-err">請填寫密碼</div>' : ''}
      </div>
    </div>
    <button class="btn btn-primary mt-20" data-click="${H(ctx.loginAsAccount)}">登入</button>
    <div class="flex-col gap-12 mt-12" style="width:100%">
      <button class="btn btn-secondary" data-click="${H(ctx.toRegister)}">我要註冊</button>
    </div>` : `
    <div class="flex-col gap-16 mt-20" style="width:100%">
      <div class="field"><div class="field-label">Email</div>
        <input class="input${ctx.joinMailErr ? ' input--err' : ''}" value="${esc(ctx.joinMail)}" placeholder="you@example.com"${fk('join-mail')} data-change="${H(ctx.setJoinMail)}">
        ${ctx.joinMailErr ? '<div class="field-err">請填寫 Email</div>' : ''}
      </div>
      <div class="field"><div class="field-label">手機</div>
        <input class="input${ctx.joinPhoneErr ? ' input--err' : ''}" value="${esc(ctx.joinPhone)}" inputmode="tel" placeholder="09xx-xxx-xxx"${fk('join-phone')} data-change="${H(ctx.setJoinPhone)}">
        ${ctx.joinPhoneErr ? '<div class="field-err">請填寫手機號碼</div>' : ''}
      </div>
      <div class="field"><div class="field-label">活動邀請碼</div>
        <input class="input${ctx.joinCodeErr ? ' input--err' : ''}" style="font:600 20px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-align:center" value="${esc(ctx.code)}" placeholder="例：4KQ2-8P"${fk('join-code')} data-change="${H(ctx.setCode)}">
        ${ctx.joinCodeErr ? '<div class="field-err">請填寫活動邀請碼</div>' : ''}
      </div>
    </div>
    <button class="btn btn-primary mt-20" data-click="${H(ctx.joinByCode)}">進入活動</button>`}
    <div class="roleswitch">
      <div class="roleswitch-head"><span class="roleswitch-title">原型檢視身份</span><button class="pill-dashed" data-click="${H(ctx.reset)}">重新開始</button></div>
      <div class="roleswitch-rows">${roleRows}</div>
    </div>
    <div class="hint mt-10" style="width:100%">免帳號加入。已被加入過的信箱／手機會直接進入活動頁；初次加入則顯示活動邀請。<br>已加入範例：mei@example.com 或 0912345678</div>
  </div>`;
}

/* ---------------- screen: register ---------------- */
function screenRegister(ctx) {
  return `<div class="page-shell page-shell--narrow">
    ${topbarBack('建立帳號', ctx.toLogin)}
    <div class="flex-col gap-16 mt-24">
      <div class="field"><div class="field-label">暱稱</div><input class="input" value="${esc(ctx.accName)}" placeholder="你的顯示名稱"${fk('reg-name')} data-change="${H(ctx.setAccName)}"></div>
      <div class="field"><div class="field-label">Email</div><input class="input" value="${esc(ctx.accMail)}" placeholder="you@example.com"${fk('reg-mail')} data-change="${H(ctx.setAccMail)}"></div>
      <div class="field"><div class="field-label">密碼</div><input class="input" value="${esc(ctx.accPass)}" placeholder="至少 8 個字元"${fk('reg-pass')} data-change="${H(ctx.setAccPass)}"></div>
    </div>
    <button class="btn btn-primary mt-24" style="margin-top:28px" data-click="${H(ctx.toHome)}">註冊並開始</button>
  </div>`;
}

/* ---------------- screen: home ---------------- */
function screenHome(ctx) {
  const evCard = (ev, archived) => `<button class="card card-pad" style="width:100%;text-align:left;cursor:pointer;${archived ? 'background:var(--bg-neutral);border-color:var(--ln-control)' : ''}" data-click="${H(ev.open)}">
      <div class="flex between items-start gap-10">
        <span class="fs16 fw500" style="color:${archived ? 'var(--text2)' : 'var(--text)'}">${esc(ev.name)}</span>
        <span class="${archived ? 'pill-archived' : 'pill-neutral'}">${archived ? '已封存' : esc(ev.role)}</span>
      </div>
      <div class="mt-6 fs12 text3">${esc(ev.date)} · ${esc(ev.place)} · ${archived ? esc(ev.total) : esc(ev.status)}</div>
    </button>`;
  return `<div class="page-shell">
    <div class="topbar"><div class="topbar-row between" style="justify-content:space-between">
      <span class="flex items-center gap-10"><span style="flex:none;width:36px;height:36px;border-radius:10px;background:var(--teal);color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center">分</span>
        <span class="fs18" style="font-size:24px;font-weight:700;color:var(--text)">嗨，${esc(ctx.userName)}</span></span>
      <span class="flex items-center gap-8">
        <button class="btn-pill" style="border:1px dashed var(--ln-control);font-size:14px;padding:4px 10px" data-click="${H(ctx.toLogin)}">回首頁／測試用</button>
        ${ctx.isAccount ? `<button class="btn-pill" style="font-size:14px;padding:4px 10px;border:1px solid var(--ln-control)" data-click="${H(ctx.logout)}">登出</button>` : ''}
      </span>
    </div></div>
    ${ctx.isGuest ? `<div class="mt-16" style="padding:16px 20px;border-radius:8px;background:rgba(111,183,183,.12);display:flex;justify-content:space-between;align-items:center;gap:12px">
      <span class="fs14">訪客登入 ${esc(ctx.guestId)}<br>綁定帳號後可保留活動紀錄</span>
      <button class="btn-pill" style="background:var(--teal);color:#fff;border:none;font-size:14px" data-click="${H(ctx.toRegister)}">綁定帳號</button>
    </div>` : ''}
    ${ctx.isAccount ? `<button class="btn-primary mt-16" style="width:100%;text-align:left;padding:20px;border:none;border-radius:8px;color:#fff;display:flex;align-items:center;gap:16px;cursor:pointer" data-click="${H(ctx.toCreate)}">
      <span style="width:36px;height:36px;flex:none;border-radius:99px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:24px">+</span>
      <span class="fs18 fw700">新增活動</span></button>` : ''}
    <div class="flex gap-10 items-center mt-12">
      <input class="input" style="flex:1;padding:12px 14px;font-size:14px" value="${esc(ctx.code)}" placeholder="輸入活動邀請碼"${fk('home-code')} data-change="${H(ctx.setCode)}">
      <button class="btn-pill" data-click="${H(ctx.toInvite)}">加入</button>
    </div>
    <div class="section-title mt-24">進行中的活動</div>
    <div class="grid-cards mt-10">${ctx.activeEvents.map(ev => evCard(ev, false)).join('')}</div>
    ${ctx.noActive ? `<div class="empty-box">目前沒有進行中的活動<br>新增活動或輸入邀請碼加入</div>` : ''}
    ${ctx.hasPast ? `<div class="section-title mt-24">過去活動</div>
    <div class="grid-cards mt-10">${ctx.pastEvents.map(ev => evCard(ev, true)).join('')}</div>` : ''}
  </div>`;
}

/* ---------------- screen: create ---------------- */
function screenCreate(ctx) {
  const dateBlock = (hasT, noT, dVal, tVal, setD, setT, addT, clearT, clearStart, dtCombined, setCombined) => `
    <div style="flex:1 1 280px;min-width:0" class="flex-col gap-6">
      ${hasT ? `<input type="datetime-local" class="input" style="padding:12px" value="${esc(dtCombined)}" data-change="${H(setCombined)}">`
        : `<input type="date" class="input input--sm" value="${esc(dVal)}" data-change="${H(setD)}">`}
      <div class="flex gap-12" style="padding-left:2px">
        ${hasT ? `<button class="btn-link btn-link--muted" data-click="${H(clearT)}">清除時間</button>` : `<button class="btn-link" data-click="${H(addT)}">＋ 加時間</button>`}
        <button class="btn-link btn-link--muted" data-click="${H(clearStart)}">清除日期</button>
      </div>
    </div>`;
  return `<div class="page-shell">
    ${topbarBack('新增活動', ctx.toHome, `<button class="icon-btn" title="建立活動" style="color:var(--teal-hover)" data-click="${H(ctx.createEvent)}">${checkIcon(18)}</button>`)}
    <div class="flex-col gap-20 mt-10">
      <div><div class="field-label">活動名稱 <span style="color:var(--danger)">＊</span></div>
        <input class="input${ctx.evNameErr ? ' input--err' : ''} input--sm" value="${esc(ctx.evNameVal)}" placeholder="例：部門季末聚餐"${fk('create-name')} data-change="${H(ctx.setEvName)}">
        ${ctx.evNameErr ? '<div class="field-err">請輸入活動名稱</div>' : ''}
      </div>
      <div><div class="field-label">活動時間</div>
        <div class="flex wrap items-center gap-10">
          ${dateBlock(ctx.dtHasT1, ctx.dtNoT1, ctx.dtD1, ctx.dtT1, ctx.setDtD1, null, ctx.addT1, ctx.clearT1, ctx.clearStart, ctx.dtStart, ctx.setDtStart)}
          <span class="text3 fs14">～</span>
          ${dateBlock(ctx.dtHasT2, ctx.dtNoT2, ctx.dtD2, ctx.dtT2, ctx.setDtD2, null, ctx.addT2, ctx.clearT2, ctx.clearEnd, ctx.dtEnd, ctx.setDtEnd)}
        </div>
      </div>
      <div><div class="field-label">活動地點</div><input class="input input--sm" value="${esc(ctx.evPlaceVal)}" placeholder="例：大安區 好客燒肉"${fk('create-place')} data-change="${H(ctx.setEvPlaceNew)}"></div>
      <div><div class="field-label" style="margin-bottom:9px">分攤方式（情境模板）</div>
        <div class="grid-cards">
          ${ctx.templateOpts.map(t => `<button class="card card-pad" style="width:100%;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;${t.sel ? 'border-color:var(--teal);border-width:2px;background:rgba(111,183,183,.10)' : ''}" data-click="${H(t.pick)}">
            <span class="flex-col gap-4"><span class="flex items-center gap-6 wrap"><span class="fs14 fw500">${esc(t.label)}</span>${t.soon ? `<span class="pill-soon">未規劃</span>` : ''}</span><span class="fs12 text3">${esc(t.hint)}</span></span>
            ${t.sel ? `<span class="dot-sel">✓</span>` : `<span class="dot-unsel"></span>`}
          </button>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------------- screen: invite ---------------- */
function screenInvite(ctx) {
  return `<div class="page-shell page-shell--narrow" style="min-height:100%;display:flex;flex-direction:column">
    <div class="topbar"><div class="topbar-row"><span class="topbar-title" style="position:static;transform:none">活動邀請</span></div></div>
    <div class="card mt-20" style="padding:20px">
      <div style="font-size:24px;font-weight:700;color:var(--text);line-height:1.35">${esc(ctx.evName)}</div>
      <div class="mt-8 fs14 text2">${esc(ctx.evDate)} · ${esc(ctx.evPlace)}</div>
      <div class="mt-16 flex-col gap-12" style="padding-top:18px;border-top:1px solid var(--ln-control)">
        <div class="flex between fs14"><span>主辦人</span><span class="fw500">小凱</span></div>
        <div class="flex between fs14"><span>你的身份</span><span class="fw500">參與者</span></div>
      </div>
    </div>
    <div style="flex:1"></div>
    <div class="fs16 fw500" style="text-align:center;margin-top:20px">確認是否加入活動？</div>
    <div class="flex-col gap-12 mt-16">
      <button class="btn btn-primary" data-click="${H(ctx.toJoinForm)}">加入活動</button>
      <button class="btn btn-secondary" data-click="${H(ctx.toLogin)}">暫不加入</button>
    </div>
  </div>`;
}

/* ---------------- screen: joinForm ---------------- */
function screenJoinForm(ctx) {
  return `<div class="page-shell page-shell--narrow">
    ${topbarBack('填寫加入訊息', ctx.toInvite)}
    <div class="flex-col gap-20 mt-20">
      <div class="field"><div class="field-label">參與者姓名</div><input class="input" value="${esc(ctx.joinName)}" placeholder="你的名字"${fk('joinform-name')} data-change="${H(ctx.setJoinName)}"></div>
      <div><div class="fs14" style="margin-bottom:9px">人員條件</div>
        <div class="flex wrap gap-8">${ctx.condOpts.map(c => chip(c.label, 'cond', c.sel, { md: true, hash: true, onClick: c.toggle })).join('')}</div>
      </div>
      <div class="field"><div class="field-label">其他備註</div><textarea class="input" rows="3" placeholder="例：會晚 20 分鐘到"${fk('joinform-note')} data-change="${H(ctx.setJoinNote)}">${esc(ctx.joinNote)}</textarea></div>
    </div>
    <button class="btn btn-primary" style="margin-top:24px" data-click="${H(ctx.submitJoin)}">加入</button>
  </div>`;
}

/* ---------------- shared: event info card (event/settledEvent/archived) ---------------- */
function evInfoCard(ctx, statusPill) {
  return `<div class="card mt-16" style="padding:16px 20px" class="flex-col gap-12">
    <div class="flex items-start gap-12">
      <div class="grow flex items-center gap-12 wrap" style="align-items:baseline">
        <span style="flex:none;font-size:16px;color:var(--text);min-width:72px;font-weight:500">時間地點</span>
        <span class="fs14">${esc(ctx.evDate)} · ${esc(ctx.evPlace)}</span>
      </div>
      <button class="icon-btn" title="${esc(ctx.evInfoTitle)}" style="width:32px;height:32px;font-size:30px;margin:-4px -6px 0 0" data-click="${H(ctx.toggleEvInfo)}">${ctx.evInfoCaret}</button>
    </div>
    ${ctx.evInfoClosed ? `<div class="flex items-center gap-6 wrap mt-12">
        ${statusPill || ''}
        <span class="pill-neutral">${esc(ctx.roleLabel)}</span>
        ${ctx.myTags.filter(t => t !== '無標籤').map(t => chip(t, 'cond', false, { hash: true })).join('')}
      </div>` : `
      <div class="flex items-center gap-12 wrap mt-12">
        <span style="flex:none;font-size:16px;color:var(--text);min-width:72px;font-weight:500">身份</span>
        <span class="pill-neutral">${esc(ctx.roleLabel)}</span>
      </div>
      <div class="flex items-center gap-12 wrap mt-12">
        <span style="flex:none;font-size:16px;color:var(--text);min-width:72px;font-weight:500">人員條件</span>
        <span class="flex items-center gap-6 wrap">
          ${ctx.noMyTags ? `<span class="fs12 text3">無特殊條件</span>` : ctx.myTags.map(t => t === '無標籤' ? `<span class="fs12 text3">無特殊條件</span>` : chip(t, 'cond', false, { hash: true })).join('')}
        </span>
      </div>`}
  </div>`;
}
function itemCard(it, opts) {
  opts = opts || {};
  return `<button class="card card-pad" style="width:100%;text-align:left;cursor:pointer" data-click="${H(opts.onOpen || it.open)}">
    <div class="flex between items-start gap-10">
      <span class="grow fs16 fw500">${esc(it.title)}</span>
      <span style="flex:0 1 auto;max-width:55%;text-align:right" class="fs16 fw500">${esc(it.amountText)}</span>
    </div>
    <div class="mt-6 fs12 text2">${esc(it.by)} 代墊 · 明細 ${it.detailCount} 筆 · 你分攤 ${esc(it.mineText)}${opts.mine === false ? '' : ''}</div>
    <div class="mt-10 flex wrap gap-8 items-center" style="min-height:23px">${(it.tags || []).map(t => chip(t, 'item', false)).join('')}</div>
  </button>`;
}

/* ---------------- screen: event (activity detail) ---------------- */
function screenEvent(ctx) {
  return `<div class="page-shell">
    ${topbarHamburger(ctx, ctx.evName, ctx.canAddItem ? `<button class="icon-btn icon-btn--primary" style="margin-left:auto" title="新增款項" data-click="${H(ctx.toAddItem)}">${plusIcon(18)}</button>` : '')}
    ${evInfoCard(ctx)}
    <div class="mt-20 flex items-baseline between wrap gap-6">
      <span class="section-title">款項現況</span>
      <span class="flex gap-8 wrap" style="justify-content:flex-end">
        <span class="fs14">合計 ${esc(ctx.itemsTotal)}</span><span class="fs14">｜</span>
        <span class="fs14">應分攤 ${esc(ctx.sharedTotal)}</span><span class="fs14">｜</span>
        <span class="fs14">已代墊 ${esc(ctx.myPaidTotal)}</span>
      </span>
    </div>
    <div class="grid-cards mt-10">${ctx.items.map(it => itemCard(it)).join('')}</div>
    ${ctx.noItems ? `<div class="empty-box">尚無款項</div>` : ''}
  </div>`;
}

/* ---------------- screen: group (members / settings) ---------------- */
function screenGroup(ctx) {
  const memberCard = (m) => `<div class="card card-pad">
    ${m.readOnly ? `<div class="flex between items-start gap-10">
      <button style="flex:1;text-align:left;border:none;background:none;padding:0;cursor:pointer" data-click="${H(m.open)}">
        <div class="fs16 fw500">${esc(m.name)}</div>
      </button>
      ${m.canEdit ? `<span class="flex items-center gap-8" style="flex:none">
          <span class="fs12 text2" style="white-space:nowrap">${esc(m.role)}</span>
          ${m.removable ? `<button class="icon-btn-sm" title="刪除人員" data-click="${H(m.askRemove)}">${trashIcon()}</button>` : ''}
          <button class="icon-btn-sm icon-btn-sm--fill" title="編輯人員" data-click="${H(m.startEdit)}">${editIcon()}</button>
        </span>` : `<span class="fs12 text2" style="white-space:nowrap;flex:none">${esc(m.role)}</span>`}
      </div><div class="mt-4 fs12" style="color:var(--tag-cond-fg)">${esc(m.tagText)}</div>` : `
      <div class="flex-col gap-12">
        <div class="flex items-center gap-8">
          <input class="input" style="flex:1;padding:10px 12px;font-weight:500" value="${esc(m.rawName)}" placeholder="姓名"${fk('member-name-' + m.name)} data-change="${H(m.setName)}">
          <button class="icon-btn-sm icon-btn-sm--fill" title="儲存" data-click="${H(m.doneEdit)}">${checkIcon(16)}</button>
        </div>
        <div><div class="field-label" style="font-size:16px;margin-bottom:6px">身分</div>
          <div class="flex wrap gap-8">${m.roleOpts.map(r => `<button class="btn-pill" style="font-size:12px;padding:6px 12px;cursor:${r.locked ? 'not-allowed' : 'pointer'};${r.sel ? 'border-color:var(--teal-hover);background:rgba(111,183,183,.16);color:var(--teal-deep)' : ''}${r.locked ? ';opacity:.5' : ''}" data-click="${H(r.pick)}">${esc(r.label)}</button>`).join('')}</div>
        </div>
        <div><div class="field-label" style="font-size:16px;margin-bottom:6px">人員條件</div>
          ${m.condLocked ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--ln-control);border-radius:8px;background:var(--bg-neutral)">
              ${m.condChips.map(c => chip(c.label, 'cond', false)).join('')}${m.noConds ? '<span class="fs12 text3">無條件</span>' : ''}
            </div><div class="mt-6 fs12 text3">已有代墊款項或分攤金額，人員條件不可修改</div>` : `
            <div class="combo">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;border:1px solid var(--ln-control);border-radius:8px;background:#fff">
                ${m.condChips.map(c => chip(c.label, 'cond', true, { onClick: c.remove, suffix: ' ×' })).join('')}
                <input style="flex:1;min-width:120px;border:none;background:none;outline:none;font-size:14px" value="${esc(m.condQueryVal)}" placeholder="搜尋或選擇條件（可多選）"${fk('member-cond-q-' + m.name)} data-change="${H(m.setCondQuery)}" data-focus="${H(m.openCondPick)}">
              </div>
              ${m.condPickOpen ? `<div class="picker-backdrop" data-click="${H(m.closeCondPick)}"></div>
                <div class="picker-panel">${m.condPickRows.map(o => `<button class="picker-row${o.sel ? ' is-sel' : ''}" data-click="${H(o.toggle)}">${esc(o.label)}<span>${o.sel ? '✓' : ''}</span></button>`).join('')}
                ${m.condPickEmpty ? '<div class="picker-empty">沒有符合的條件</div>' : ''}</div>` : ''}
            </div>`}
        </div>
        <div><div class="field-label" style="font-size:16px;margin-bottom:6px">備註</div><input class="input" style="padding:10px 12px;font-size:14px" value="${esc(m.noteVal)}" placeholder="其他備註"${fk('member-note-' + m.name)} data-change="${H(m.setNote)}"></div>
        <div class="flex items-center gap-8 wrap"><span class="fs14">${esc(m.login)}</span></div>
      </div>`}
    </div>`;
  return `<div class="page-shell">
    ${topbarHamburger(ctx, '群組設定')}
    <div class="card mt-16" style="padding:16px 20px">
      ${ctx.evEditIdle ? `<div class="flex items-start gap-12">
        <div class="grow">
          <div style="font-size:18px;font-weight:700;color:var(--text)">${esc(ctx.evName)}</div>
          <div class="mt-4 fs14 text2">${esc(ctx.evDate)}</div>
          <div class="fs14 text2" style="margin-top:2px">${esc(ctx.evPlace)}</div>
        </div>
        <button class="icon-btn-sm" title="編輯" data-click="${H(ctx.openEvEdit)}">${editIcon()}</button>
      </div>` : `<div class="flex-col gap-16">
        <div class="flex between items-center gap-10"><span class="fs18 fw700">編輯活動資訊</span>
          <span class="flex gap-8">
            <button class="icon-btn-sm" title="取消" data-click="${H(ctx.closeEvEdit)}">${xIcon()}</button>
            <button class="icon-btn-sm icon-btn-sm--fill" title="儲存" data-click="${H(ctx.saveEvEdit)}">${checkIcon()}</button>
          </span>
        </div>
        <div><div class="field-label">活動名稱 <span style="color:var(--danger)">＊</span></div>
          <input class="input${ctx.edNameErr ? ' input--err' : ''}" value="${esc(ctx.edName)}" placeholder="例：部門季末聚餐"${fk('ed-name')} data-change="${H(ctx.setEdName)}">
          ${ctx.edNameErr ? '<div class="field-err">請輸入活動名稱</div>' : ''}
        </div>
        <div><div class="field-label">活動時間</div>
          <div class="flex wrap items-center gap-10">
            <div style="flex:1 1 280px;min-width:0" class="flex-col gap-6">
              ${ctx.edHasT1 ? `<input type="datetime-local" class="input" value="${esc(ctx.edStart)}" data-change="${H(ctx.setEdStart)}">` : `<input type="date" class="input" value="${esc(ctx.edD1)}" data-change="${H(ctx.setEdD1)}">`}
              <div class="flex gap-12" style="padding-left:2px">${ctx.edHasT1 ? `<button class="btn-link btn-link--muted" data-click="${H(ctx.edClearT1)}">清除時間</button>` : `<button class="btn-link btn-link--muted" data-click="${H(ctx.edAddT1)}">＋ 加時間</button>`}<button class="btn-link btn-link--muted" data-click="${H(ctx.edClearStart)}">清除日期</button></div>
            </div>
            <span class="text3 fs14">～</span>
            <div style="flex:1 1 280px;min-width:0" class="flex-col gap-6">
              ${ctx.edHasT2 ? `<input type="datetime-local" class="input" value="${esc(ctx.edEnd)}" data-change="${H(ctx.setEdEnd)}">` : `<input type="date" class="input" value="${esc(ctx.edD2)}" data-change="${H(ctx.setEdD2)}">`}
              <div class="flex gap-12" style="padding-left:2px">${ctx.edHasT2 ? `<button class="btn-link btn-link--muted" data-click="${H(ctx.edClearT2)}">清除時間</button>` : `<button class="btn-link btn-link--muted" data-click="${H(ctx.edAddT2)}">＋ 加時間</button>`}<button class="btn-link btn-link--muted" data-click="${H(ctx.edClearEnd)}">清除日期</button></div>
            </div>
          </div>
          <div class="mt-6 fs12 text2">未調整則保留原時間：${esc(ctx.evDate)}</div>
        </div>
        <div><div class="field-label">活動地點</div><input class="input" value="${esc(ctx.edPlace)}" placeholder="例：大安區 好客燒肉"${fk('ed-place')} data-change="${H(ctx.setEdPlace)}"></div>
      </div>`}
    </div>
    <div class="mt-16 flex wrap items-start gap-20">
      ${ctx.canAddMember ? `<div style="flex:1 1 300px;min-width:0" class="flex-col gap-10">
        <div class="section-title">專屬邀請連結</div>
        <div class="card" style="padding:20px;display:flex;flex-direction:column;align-items:center">
          <div class="qr-placeholder"><span style="font:11px/1.6 ui-monospace,Menlo,monospace;color:var(--text3)">QR CODE<br>placeholder</span></div>
          <div class="mt-14" style="width:100%;padding:12px;border-radius:8px;background:var(--bg-neutral);font:11.5px/1.5 ui-monospace,Menlo,monospace;color:var(--text2);word-break:break-all">${esc(ctx.inviteLink)}</div>
          <div class="mt-8" style="font:600 16px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em">邀請碼 ${esc(ctx.inviteCode)}</div>
          <button class="btn btn-secondary mt-12" data-click="${H(ctx.copyLink)}">${esc(ctx.copyLabel)}</button>
        </div>
      </div>` : ''}
      <div style="flex:2 1 380px;min-width:0">
        <div class="flex items-center between gap-10">
          <span class="section-title">群組人員</span>
          <div class="flex items-center gap-8">
            ${ctx.canAddMember ? `<span class="fs12 text2">${ctx.memberCount} 人</span>${ctx.memberAddOn ? `<button class="icon-btn-sm" title="新增人員" data-click="${H(ctx.addMember)}">${plusIcon(15)}</button>` : `<button class="icon-btn-sm icon-btn-sm--disabled" title="請先完成目前新增的人員">${plusIcon(15)}</button>`}` : ''}
          </div>
        </div>
        ${ctx.memberToastOpen ? `<div class="toast"><span>${esc(ctx.memberToastText)}</span><button data-click="${H(ctx.closeMemberToast)}">✕</button></div>` : ''}
        <div class="grid-cards mt-10">${ctx.members.map(memberCard).join('')}</div>
      </div>
    </div>
  </div>`;
}

/* ---------------- screen: rules (view + edit) ---------------- */
function tagManageRow(t) {
  if (t.idle) return `<span style="display:flex;align-items:center;gap:1px;border:1px solid #E4C374;background:var(--tag-item-bg);border-radius:99px;padding:0 4px 0 0">
    <span style="font-size:14px;padding:6px 4px 6px 12px;color:var(--tag-item-fg)">${esc(t.label)}</span>
    <button style="width:22px;height:22px;border:none;border-radius:99px;background:none;color:var(--tag-item-fg);font-size:14px;cursor:pointer" data-click="${H(t.openMenu)}">⋮</button></span>`;
  if (t.menu) return `<span class="dropdown-menu" style="position:relative;display:flex;align-items:center;gap:1px;border:2px solid var(--tag-item-bg-sel);background:var(--tag-item-fg-sel);border-radius:99px;padding:0 4px 0 0;box-shadow:none">
    <span style="font-size:14px;font-weight:500;padding:6px 4px 6px 12px;color:var(--tag-item-fg)">${esc(t.label)}</span>
    <button style="width:22px;height:22px;border:none;border-radius:99px;background:none;color:var(--tag-item-fg);font-size:14px;cursor:pointer" data-click="${H(t.closeMenu)}">⋮</button>
    <span class="dropdown-menu" style="left:0;top:calc(100% + 6px)"><button data-click="${H(t.del)}">${trashIcon(14)}刪除</button><button data-click="${H(t.startEdit)}">${editIcon(14)}編輯</button></span>
    </span>`;
  if (t.editing) return `<input class="input" style="width:118px;padding:6px 12px;border-radius:99px;font-size:14px" value="${esc(t.inputVal)}"${fk('tag-edit')} data-change="${H(t.setVal)}" data-blur="${H(t.commit)}" data-keydown="${H(t.onKey)}" autofocus>`;
  return `<span class="flex items-center gap-8"><input class="input input--err" style="width:118px;padding:6px 12px;border-radius:99px;font-size:14px" value="${esc(t.inputVal)}"${fk('tag-edit')} data-change="${H(t.setVal)}" data-keydown="${H(t.onKey)}" autofocus><span class="fs12" style="color:var(--danger)">標籤重複</span></span>`;
}
function condManageRow(t) {
  if (t.idle) return `<span style="display:flex;align-items:center;gap:1px;border:1px solid #E0AEB8;background:var(--tag-cond-bg);border-radius:99px;padding:0 4px 0 0">
    <span style="font-size:14px;padding:6px 4px 6px 12px;color:var(--tag-cond-fg)">${esc(t.label)}</span>
    <button style="width:22px;height:22px;border:none;border-radius:99px;background:none;color:var(--teal-deep);font-size:14px;cursor:pointer" data-click="${H(t.openMenu)}">⋮</button></span>`;
  if (t.menu) return `<span style="position:relative;display:flex;align-items:center;gap:1px;border:2px solid var(--tag-cond-fg);background:var(--tag-cond-bg-sel);border-radius:99px;padding:0 4px 0 0">
    <span style="font-size:14px;font-weight:500;padding:6px 4px 6px 12px;color:#9C4B5B">${esc(t.label)}</span>
    <button style="width:22px;height:22px;border:none;border-radius:99px;background:none;color:var(--tag-item-fg);font-size:14px;cursor:pointer" data-click="${H(t.closeMenu)}">⋮</button>
    <span class="dropdown-menu" style="left:0;top:calc(100% + 6px)"><button data-click="${H(t.del)}">${trashIcon(14)}刪除</button><button data-click="${H(t.startEdit)}">${editIcon(14)}編輯</button></span>
    </span>`;
  if (t.editing) return `<input class="input" style="width:118px;padding:6px 12px;border-radius:99px;font-size:14px" value="${esc(t.inputVal)}"${fk('cond-edit')} data-change="${H(t.setVal)}" data-blur="${H(t.commit)}" data-keydown="${H(t.onKey)}" autofocus>`;
  return `<span class="flex items-center gap-8"><input class="input input--err" style="width:118px;padding:6px 12px;border-radius:99px;font-size:14px" value="${esc(t.inputVal)}"${fk('cond-edit')} data-change="${H(t.setVal)}" data-keydown="${H(t.onKey)}" autofocus><span class="fs12" style="color:var(--danger)">標籤重複</span></span>`;
}
function screenRules(ctx) {
  const ruleCardView = ctx.ruleCards.map(r => `<div class="card" style="padding:14px 16px;margin-left:40px;margin-right:40px">
      <div class="flex items-center between gap-10"><span class="grow fs16 fw500">${esc(r.tag)}</span>${r.tagUsed ? '<span class="pill-neutral">已被使用</span>' : ''}</div>
      <div class="flex-col gap-8 mt-10">${r.lines.map(l => `<div class="flex items-center gap-10">
          <span class="grow flex wrap items-center gap-6">${l.chips.map(c => chip(c.label, 'cond', false)).join('')}<span class="fs12 text3">${esc(l.count)}</span></span>
          <span class="fs14 fw500" style="flex:none">${esc(l.effect)}</span></div>`).join('')}</div>
      <div class="flex items-center between gap-10 mt-12" style="padding-top:10px;border-top:1px solid var(--ln-control)"><span class="grow fs12 text3">其他人員</span><span class="fs14 fw500">${esc(r.restLabel)}</span></div>
    </div>`).join('');
  const ruleEditView = ctx.ruleRows.map((r, i) => `<div class="card" style="padding:16px 20px;margin-left:40px;margin-right:40px;outline:${r.alertOutline};outline-offset:2px">
      <div class="flex items-center between gap-12">
        <span class="grow fs16 fw700" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.tagLabel)}</span>
        ${r.tagUsed ? '<span class="pill-neutral">已被使用</span>' : ''}
        ${r.readOnly && r.tagFree ? `<span class="flex gap-8"><button class="icon-btn-sm" title="刪除" data-click="${H(r.del)}">${trashIcon()}</button><button class="icon-btn-sm icon-btn-sm--fill" title="編輯" data-click="${H(r.edit)}">${editIcon()}</button></span>` : ''}
        ${r.editing ? `<span class="flex gap-8"><button class="icon-btn-sm" title="取消" data-click="${H(ctx.closeRuleEdit)}">${xIcon()}</button><button class="icon-btn-sm icon-btn-sm--fill" title="儲存" data-click="${H(ctx.saveRuleEdit)}">${checkIcon()}</button></span>` : ''}
      </div>
      ${r.editing ? `<div class="combo mt-10">
        <button class="combo-trigger" style="color:${ctx.ruleTagLabel !== '選擇項目標籤' ? 'var(--text)' : 'var(--text3)'}" data-click="${H(ctx.openRuleTagPick)}">${esc(ctx.ruleTagLabel)}<span class="text3 fs12">▾</span></button>
        ${ctx.ruleTagPickOpen ? `<div class="picker-backdrop" data-click="${H(ctx.closeRulePick)}"></div>
          <div class="picker-panel">${ctx.ruleTagPickRows.map(o => `<button class="picker-row${o.sel ? ' is-sel' : ''}" data-click="${H(o.toggle)}">${esc(o.label)}<span>${o.sel ? '✓' : ''}</span></button>`).join('')}</div>` : ''}
      </div>` : ''}
      <div class="mt-14" style="padding-top:12px;border-top:1px solid var(--ln-control)"><div class="fs14 fw500">分攤規則</div></div>
      ${r.readOnly ? `<div class="flex-col gap-10 mt-10">${r.lines.map(l => `<div class="flex items-center gap-10">
          <span class="grow flex wrap items-center gap-6">${l.chips.map(c => chip(c.label, 'cond', false)).join('')}<span class="fs12 text3">${esc(l.count)}</span></span>
          <span class="fs14 fw500" style="flex:none">${esc(l.effect)}</span></div>`).join('')}</div>` : ''}
      ${r.editing ? `<div class="flex-col gap-10 mt-10">
        ${ctx.ruleGroupRows.map(g => `<div data-dragover="${H(g.dragOver)}" data-drop="${H(g.drop)}" style="display:flex;flex-direction:column;gap:4px;opacity:${g.rowOpacity}">
          <div class="flex items-start gap-8 wrap">
            <span draggable="true" title="拖曳調整順序" style="flex:none;margin-top:10px;font-size:14px;color:#B9C6C3;cursor:grab" data-dragstart="${H(g.dragStart)}" data-dragend="${H(g.dragEnd)}">☰</span>
            <div class="combo" style="flex:1 1 180px;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;border:1px solid var(--ln-control);border-radius:99px;background:#fff">
                ${g.chips.map(c => chip(c.label, 'cond', true, { onClick: c.remove, suffix: ' ×' })).join('')}
                <span class="fs12 text3">${esc(g.count)}</span>${g.dup ? `<span class="fs12" style="color:var(--danger)">條件組合重複</span>` : ''}
                <input style="flex:1;min-width:70px;border:none;background:none;outline:none;font-size:14px" value="${esc(g.queryVal)}" placeholder="選擇條件"${fk('rule-group-q-' + g.no)} data-change="${H(g.setQuery)}" data-focus="${H(g.openPick)}">
              </div>
              ${g.pickOpen ? `<div class="picker-backdrop" data-click="${H(ctx.closeRulePick)}"></div>
                <div class="picker-panel">${g.pickRows.map(o => `<button class="picker-row${o.sel ? ' is-sel' : ''}" data-click="${H(o.toggle)}">${esc(o.label)}<span>${o.sel ? '✓' : ''}</span></button>`).join('')}${g.pickEmpty ? '<div class="picker-empty">沒有符合的條件</div>' : ''}</div>` : ''}
            </div>
            <div class="combo" style="flex:none">
              <button class="combo-trigger-pill" data-click="${H(g.openEff)}">${esc(g.effLabel)}<span class="text3 fs12">▾</span></button>
              ${g.effOpen ? `<div class="picker-backdrop" data-click="${H(ctx.closeRulePick)}"></div>
                <div class="picker-panel picker-panel--right">
                  ${g.modeOpts.map(o => `<button class="picker-row" style="background:${o.sel ? 'rgba(111,183,183,.16)' : 'none'};color:${o.sel ? 'var(--teal-hover)' : 'var(--text2)'}" data-click="${H(o.pick)}">${esc(o.label)}<span>${o.mark}</span></button>`).join('')}
                  ${g.isPct ? `<div class="flex items-center gap-8" style="padding:8px 12px 4px"><span class="fs12 text2" style="flex:none">權重 ×</span><input class="input" style="padding:6px 10px;text-align:right" inputmode="decimal" value="${esc(g.pctVal)}" placeholder="1"${fk('rule-group-pct-' + g.no)} data-change="${H(g.setPct)}"><span class="fs12 text2" style="flex:none">／人</span></div>` : ''}
                </div>` : ''}
            </div>
            <button class="icon-btn-sm" title="刪除此規則" style="margin-top:6px" data-click="${H(g.del)}">${xIcon()}</button>
          </div>
        </div>`).join('')}
        <button class="pill-dashed" style="align-self:flex-start;border-style:dashed" data-click="${H(ctx.addRuleGroup)}">＋ 新增分攤規則</button>
      </div>` : ''}
      <div class="flex items-center between gap-10 mt-14" style="padding-top:12px;border-top:1px solid var(--ln-control)">
        <span class="grow fs12 text2">其他人員</span>
        ${r.readOnly ? `<span class="fs14 fw500">${esc(r.restLabel)}</span>` : `<div class="combo" style="flex:none">
          <button class="combo-trigger-pill" data-click="${H(ctx.openRestEff)}">${esc(ctx.restEffLabel)}<span class="text3 fs12">▾</span></button>
          ${ctx.restEffOpen ? `<div class="picker-backdrop" data-click="${H(ctx.closeRulePick)}"></div>
            <div class="picker-panel picker-panel--right">
              ${ctx.restModeOpts.map(o => `<button class="picker-row" style="background:${o.sel ? 'rgba(111,183,183,.16)' : 'none'};color:${o.sel ? 'var(--teal-hover)' : 'var(--text2)'}" data-click="${H(o.pick)}">${esc(o.label)}<span>${o.mark}</span></button>`).join('')}
              ${ctx.restIsPct ? `<div class="flex items-center gap-8" style="padding:8px 12px 4px"><span class="fs12 text2" style="flex:none">權重 ×</span><input class="input" style="padding:6px 10px;text-align:right" inputmode="decimal" value="${esc(ctx.restPctVal)}" placeholder="1"${fk('rest-pct')} data-change="${H(ctx.setRestPct)}"><span class="fs12 text2" style="flex:none">／人</span></div>` : ''}
            </div>` : ''}
          </div>`}
      </div>
    </div>`).join('');
  return `<div class="page-shell">
    ${topbarHamburger(ctx, '分攤規則')}
    ${ctx.cantEditRules ? `<div class="mt-16" style="padding:12px 14px;border-radius:8px;background:var(--bg-neutral);font-size:14px;color:var(--text2);line-height:1.7">${esc(ctx.ruleLockText)}</div>` : ''}
    ${ctx.tagUsedOpen ? `<div class="error-banner mt-16"><span>${esc(ctx.tagUsedText)}</span><button data-click="${H(ctx.tagUsedNo)}">✕</button></div>` : ''}

    <div id="sec-item" class="mt-20 flex items-center between gap-10">
      <button class="icon-btn-sm" style="border:none" title="收合／展開" data-click="${H(ctx.toggleItemOpen)}">${ctx.itemOpen ? chevDownIcon() : chevRightIcon()}</button>
      <span class="grow section-title">項目標籤（記帳項目用）</span>
      ${ctx.canEditRules ? (ctx.itemViewOn ? `<button class="icon-btn-sm" title="編輯" data-click="${H(ctx.toggleItemEdit)}">${editIcon()}</button>` : `<button class="icon-btn-sm icon-btn-sm--fill" title="完成" data-click="${H(ctx.toggleItemEdit)}">${checkIcon()}</button>`) : ''}
    </div>
    ${ctx.itemViewOn ? `<div class="mt-10 flex wrap gap-8" style="margin-left:40px">${ctx.itemTagsView.map(t => chip(t.label, 'item', false, { md: true })).join('')}</div>` : ''}
    ${ctx.itemEditOn ? `<div class="mt-10 flex wrap items-center gap-8" style="margin-left:40px">${ctx.itemTagRows.map(tagManageRow).join('')}<button class="pill-dashed" style="border-style:dashed;border-color:var(--tag-item-bg)" data-click="${H(ctx.addItemTag)}">＋ 新增項目標籤</button></div>` : ''}

    <div id="sec-cond" class="mt-24 flex items-center between gap-10">
      <button class="icon-btn-sm" style="border:none" title="收合／展開" data-click="${H(ctx.toggleCondOpen)}">${ctx.condOpen ? chevDownIcon() : chevRightIcon()}</button>
      <span class="grow section-title">人員條件（人員定義用）</span>
      ${ctx.canEditRules ? (ctx.condViewOn ? `<button class="icon-btn-sm" title="編輯" data-click="${H(ctx.toggleCondEdit)}">${editIcon()}</button>` : `<button class="icon-btn-sm icon-btn-sm--fill" title="完成" data-click="${H(ctx.toggleCondEdit)}">${checkIcon()}</button>`) : ''}
    </div>
    ${ctx.condViewOn ? `<div class="mt-10 flex wrap gap-8" style="margin-left:40px">${ctx.condTagsView.map(t => chip(t.label, 'cond', false, { md: true, hash: true })).join('')}</div>` : ''}
    ${ctx.condEditOn ? `<div class="mt-10 flex wrap items-center gap-8" style="margin-left:40px">${ctx.condTagRows.map(condManageRow).join('')}<button class="pill-dashed" style="border-style:dashed;border-color:var(--tag-cond-bg)" data-click="${H(ctx.addCondTag)}">＋ 新增人員條件</button></div>` : ''}

    <div id="sec-rule" class="mt-24 flex items-center between gap-10">
      <button class="icon-btn-sm" style="border:none" title="收合／展開" data-click="${H(ctx.toggleRuleOpen)}">${ctx.ruleOpen ? chevDownIcon() : chevRightIcon()}</button>
      <span class="grow section-title">條件式分攤規則</span>
      <span class="flex items-center gap-8">
        ${ctx.ruleEditOn ? `<button class="icon-btn-sm" style="border:1px solid #B9C6C3" title="新增規則" data-click="${H(ctx.addRuleRow)}">${plusIcon(19)}</button>` : ''}
        ${ctx.canEditRules ? (ctx.ruleViewOn ? `<button class="icon-btn-sm" title="編輯" data-click="${H(ctx.toggleRuleEdit)}">${editIcon()}</button>` : `<button class="icon-btn-sm icon-btn-sm--fill" title="完成" data-click="${H(ctx.toggleRuleEdit)}">${checkIcon()}</button>`) : ''}
      </span>
    </div>
    ${ctx.ruleOpen ? `<div class="fs12 text3 mt-6" style="line-height:1.7;margin-left:40px">依據項目標籤與人員條件；未被設定到的人員與未設定規則的項目，皆採均分。</div>` : ''}
    ${ctx.ruleViewOn ? `<div class="flex-col gap-16 mt-12">${ruleCardView}${ctx.noRules ? `<div class="fs14 text3" style="margin-left:40px">尚未設定標籤規則，所有款項皆採均分。</div>` : ''}</div>` : ''}
    ${ctx.ruleEditOn ? `<div class="flex-col gap-12 mt-12">${ruleEditView}</div>` : ''}
  </div>`;
}

/* ---------------- shared: tag picker + share block (addItem / itemDetail) ---------------- */
function renderTagPicker(d, keySuffix) {
  return `<div style="position:relative;display:flex;align-items:flex-start;gap:8px">
    ${starIcon()}
    <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--ln-control);border-radius:99px;background:#fff">
      <button style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;border:none;background:none;padding:0;text-align:left;cursor:pointer" data-click="${H(d.openTagPick)}">
        ${d.tagHasSel ? chip(d.tagSelLabel, 'item', false) : `<span class="fs14 text3">選擇標籤</span>`}
      </button>
      ${d.tagHasSel ? `<button style="flex:none;width:22px;height:22px;border:none;border-radius:99px;background:var(--bg-neutral);color:var(--text2);font-size:12px;cursor:pointer" title="清除標籤" data-click="${H(d.clearTag)}">×</button>` : ''}
      <button style="flex:none;width:22px;height:22px;border:none;background:none;color:var(--text2);cursor:pointer" title="展開選單" data-click="${H(d.openTagPick)}">${chevDownIcon()}</button>
    </div>
    ${d.tagPickOpen ? `<div class="picker-backdrop" data-click="${H(d.closeTagPick)}"></div>
      <div class="picker-panel" style="left:26px">
        <input class="input" style="padding:8px 10px;font-size:14px" value="${esc(d.tagQueryVal)}" placeholder="搜尋標籤"${fk('tagq-' + keySuffix)} data-change="${H(d.setTagQuery)}">
        ${d.tagPickRows.map(g => `<button class="picker-row${g.sel ? ' is-sel' : ''}" data-click="${H(g.toggle)}">${esc(g.label)}<span>${g.sel ? '✓' : ''}</span></button>`).join('')}
        ${d.tagPickEmpty ? '<div class="picker-empty">沒有符合的標籤</div>' : ''}
      </div>` : ''}
  </div>`;
}
function renderShareBlock(d, keySuffix) {
  return `<div class="card mt-14" style="padding:14px 16px">
    <div class="flex between items-center gap-10">
      <button style="border:none;background:none;padding:0;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);letter-spacing:.06em;cursor:pointer" data-click="${H(d.toggleExpand)}"><span class="text3 fs12">${d.caret}</span>${esc(d.shareTitle)}</button>
    </div>
    ${d.sharesReadOnly ? `<div class="grid-cards mt-10">${d.visibleShares.map(sh => `<div class="flex between items-start gap-8"><div style="flex:none;min-width:0" class="flex-col gap-4"><span class="fs14">${esc(sh.name)}</span>${sh.hasCond ? `<span class="fs12" style="color:var(--tag-cond-fg)">${esc(sh.condText)}</span>` : ''}</div><span class="grow fs14 text2" style="text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sh.amount)}</span></div>`).join('')}</div>
      ${d.showMore ? `<button class="btn-link mt-12" data-click="${H(d.toggleExpand)}">${esc(d.expandLabel)}</button>` : ''}` : ''}
    ${d.sharesEditing ? `<div class="flex-col gap-10 mt-12">
        ${d.shareErrOpen ? `<div class="fs12" style="color:var(--danger)">${esc(d.shareErrText)}</div>` : ''}
        ${d.editRows.map(r => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--ln-card);border-radius:8px;background:#fff">
          <button style="flex:1;min-width:0;border:none;background:none;padding:0;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer" data-click="${H(r.toggle)}">
            ${dot(r.on)}
            <span style="min-width:0" class="flex-col gap-4"><span class="fs14">${esc(r.name)}</span>${r.hasCond ? `<span class="fs12" style="color:var(--tag-cond-fg)">${esc(r.condText)}</span>` : ''}</span>
          </button>
          ${r.on ? `<span class="flex items-center gap-6">
              <span class="fs12 text2">NT$</span>
              <input style="width:74px;padding:8px 10px;border:1px solid var(--ln-control);border-radius:6px;font-size:14px;font-weight:500;text-align:right;background:${r.locked ? 'var(--bg-neutral)' : '#fff'};color:${r.locked ? 'var(--text3)' : 'var(--text)'}" ${r.locked ? 'readonly' : ''} inputmode="numeric" value="${esc(r.amountVal)}" placeholder="${esc(r.amountPh)}"${fk('shareamt-' + keySuffix + '-' + r.id)} data-change="${H(r.setAmount)}">
              <button style="flex:none;width:32px;height:32px;border:none;background:none;color:${r.locked ? 'var(--text3)' : 'var(--teal-hover)'};cursor:pointer" title="${r.locked ? '解鎖以自訂金額' : '鎖定，改回平均分攤'}" data-click="${H(r.toggleLock)}">${r.locked ? lockIcon() : unlockIcon()}</button>
            </span>` : `<span class="fs14 text3" style="flex:none">—</span>`}
        </div>`).join('')}
      </div>` : ''}
  </div>`;
}
function renderDraftDetailCard(d) {
  return `<div class="card card-pad" style="outline:${d.alertOutline};outline-offset:2px">
    ${d.readOnly ? `<div class="flex between items-center gap-10">
        <span class="grow fs16 fw700" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.nameText)}</span>
        <span class="flex items-center gap-10" style="flex:1 1 auto;min-width:0;justify-content:flex-end">
          <span class="fs16 fw700" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.amountText)}</span>
          <button class="icon-btn-sm" title="刪除" data-click="${H(d.askRemove)}">${trashIcon(14)}</button>
          <button class="icon-btn-sm icon-btn-sm--fill" title="編輯" data-click="${H(d.startEdit)}">${editIcon(14)}</button>
        </span>
      </div>` : `
      <div class="flex between items-center gap-10">
        <input class="input${d.nameErr ? ' input--err' : ''}" style="flex:1;min-width:0;padding:12px;font-size:14px" value="${esc(d.name)}" placeholder="品項名稱"${fk('draft-name-' + d.no)} data-change="${H(d.setName)}">
        <span class="flex items-center gap-8" style="flex:none">
          <button class="icon-btn-sm icon-btn-sm--fill" title="完成" data-click="${H(d.doneEdit)}">${checkIcon()}</button>
          <button class="icon-btn-sm" title="取消新增" data-click="${H(d.cancelAdd)}">${xIcon()}</button>
        </span>
      </div>
      ${d.nameErr ? '<div class="field-err">請輸入品項名稱</div>' : ''}
      <div class="flex-col gap-12 mt-12">
        <input class="input${d.amountBad || d.amountEmpty ? ' input--err' : ''}" style="padding:12px;font-size:14px" inputmode="numeric" value="${esc(d.amount)}" placeholder="品項金額"${fk('draft-amount-' + d.no)} data-change="${H(d.setAmount)}">
        ${d.amountEmpty ? '<div class="field-err">請輸入品項金額</div>' : (d.amountBad ? '<div class="field-err">金額只能輸入數字</div>' : '')}
        ${renderTagPicker(d, 'draft' + d.no)}
        <input class="input" style="padding:12px;font-size:14px" value="${esc(d.note)}" placeholder="其他備註"${fk('draft-note-' + d.no)} data-change="${H(d.setNote)}">
      </div>`}
    ${renderShareBlock(d, 'draft' + d.no)}
  </div>`;
}
function renderItemDetailCard(d) {
  return `<div class="card card-pad" style="outline:${d.alertOutline};outline-offset:2px">
    ${d.readOnly ? `<div class="flex between items-start gap-10">
        <span class="grow fs16 fw500" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.name)}</span>
        <span class="fs16 fw500">${esc(d.amountText)}</span>
        <span class="flex items-center gap-10" style="flex:none">
          ${d.canStartEdit ? `<button class="icon-btn-sm" title="刪除" data-click="${H(d.askRemove)}">${trashIcon(14)}</button><button class="icon-btn-sm icon-btn-sm--fill" title="編輯" data-click="${H(d.startEdit)}">${editIcon(14)}</button>` : ''}
        </span>
      </div>
      <div class="mt-12 flex wrap gap-8">${d.tags.map(t => chip(t, 'item', false)).join('')}</div>
      ${d.hasNote ? `<div class="mt-12 fs12 text2">備註：${esc(d.note)}</div>` : ''}` : `
      <div class="flex between items-center gap-10">
        <input class="input${d.nameErr ? ' input--err' : ''}" style="flex:1;min-width:0;padding:12px;font-size:14px" value="${esc(d.nameVal)}" placeholder="品項名稱"${fk('item-name-' + d.no)} data-change="${H(d.setName)}">
        <span class="flex items-center gap-8" style="flex:none">
          ${d.savedRow ? `<button class="icon-btn-sm" title="刪除項目" data-click="${H(d.askRemove)}">${trashIcon()}</button>` : `<button class="icon-btn-sm" title="取消新增" data-click="${H(d.cancelAdd)}">${xIcon()}</button>`}
          <button class="icon-btn-sm icon-btn-sm--fill" title="完成" data-click="${H(d.doneEdit)}">${checkIcon()}</button>
        </span>
      </div>
      ${d.nameErr ? '<div class="field-err">請輸入品項名稱</div>' : ''}
      <div class="flex-col gap-12 mt-12">
        <input class="input${d.amountBad || d.amountEmpty ? ' input--err' : ''}" style="padding:12px;font-size:14px" inputmode="numeric" value="${esc(d.amountVal)}" placeholder="品項金額"${fk('item-amount-' + d.no)} data-change="${H(d.setAmount)}">
        ${d.amountEmpty ? '<div class="field-err">請輸入品項金額</div>' : (d.amountBad ? '<div class="field-err">金額只能輸入數字</div>' : '')}
        ${renderTagPicker(d, 'item' + d.no)}
        <input class="input" style="padding:12px;font-size:14px" value="${esc(d.noteVal)}" placeholder="其他備註"${fk('item-note-' + d.no)} data-change="${H(d.setNote)}">
      </div>`}
    ${renderShareBlock(d, 'item' + d.no)}
  </div>`;
}

/* ---------------- screen: addItem ---------------- */
function screenAddItem(ctx) {
  return `<div class="page-shell">
    ${topbarBack('新增款項', ctx.draftBack, `<button class="icon-btn icon-btn--soft" title="儲存款項" data-click="${H(ctx.submitItem)}">${checkIcon(18)}</button>`)}
    <div class="mt-20" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px;align-items:start">
      <div>
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 20px">
          <span class="fs18 fw500" style="flex:none">本筆款項合計</span>
          <span class="grow fs18 fw700" style="text-align:right">${esc(ctx.draftTotal)}</span>
        </div>
        <button class="receipt-drop" data-click="${H(ctx.uploadReceipt)}">${esc(ctx.receiptLabel)}</button>
      </div>
      <div>
        <div class="flex items-center between gap-10">
          <span class="section-title">明細</span>
          <button class="icon-btn-sm" title="新增明細" data-click="${H(ctx.addDetail)}">${plusIcon()}</button>
        </div>
        <div class="flex-col gap-16 mt-10">
          ${ctx.draftDetails.map(renderDraftDetailCard).join('')}
          ${ctx.draftEmpty ? `<div class="empty-box" style="border-style:dashed">尚無明細<br>可只上傳收據，或按右上＋新增明細</div><div class="fs14" style="color:var(--danger)">請至少上傳收據或新增一筆明細</div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------------- screen: itemDetail ---------------- */
function screenItemDetail(ctx) {
  return `<div class="page-shell">
    ${topbarBack('款項細項', ctx.itemBack, ctx.canEditItem ? `<button class="icon-btn icon-btn--danger" title="刪除這筆款項" data-click="${H(ctx.askRemoveItem)}">${trashOutlineIcon()}</button>` : '')}
    <div class="mt-20" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px;align-items:start">
      <div>
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px">
          <span class="fs18 fw700">${esc(ctx.item.by)} 代墊</span>
          <span class="fs18 fw700">${esc(ctx.item.amountText)}</span>
        </div>
        <div class="receipt-drop" style="cursor:default"><span style="font:11.5px/1.6 ui-monospace,Menlo,monospace;color:var(--text2)">${esc(ctx.item.receiptText)}</span></div>
      </div>
      <div>
        <div class="flex items-center between gap-10">
          <span class="section-title">明細</span>
          ${ctx.canEditItem ? `<button class="icon-btn-sm" title="新增明細" data-click="${H(ctx.addItemDetail)}">${plusIcon()}</button>` : ''}
        </div>
        <div class="flex-col gap-16 mt-10">${ctx.item.details.map(renderItemDetailCard).join('')}</div>
      </div>
    </div>
  </div>`;
}

/* ---------------- shared: split/flow cards ---------------- */
function personSplitCard(row) {
  return `<div class="card" style="padding:16px 20px">
    <div class="flex between items-center gap-10"><span class="fs16 fw500">${esc(row.name)}</span><span class="pill-neutral">${esc(row.role)}</span></div>
    ${row.hasTags ? `<div class="mt-8 fs12" style="color:var(--tag-cond-fg)">${esc(row.tagText)}</div>` : ''}
    <div class="flex-col gap-12 mt-12" style="padding-top:12px;border-top:1px solid var(--ln-control)">
      <div><div class="fs12 text2">分攤金額</div><div class="mt-4" style="font-size:18px;font-weight:700;word-break:break-all">${esc(row.share)}</div></div>
      <div><div class="fs12 text2">代墊金額</div><div class="mt-4" style="font-size:18px;font-weight:700;word-break:break-all">${esc(row.advance)}</div></div>
    </div>
  </div>`;
}
function flowRowCard(row) {
  return `<div class="card" style="padding:16px 20px">
    <div class="flex between items-center gap-10"><span class="fs16 fw500">${esc(row.name)}</span><span class="pill-neutral">${esc(row.role)}</span></div>
    <div class="flex-col gap-8 mt-12">${row.lines.map(l => `<div class="flex between" style="align-items:baseline;gap:10px"><span class="fs14 text2" style="white-space:nowrap;flex:none">${esc(l.text)}</span><span class="grow fs14" style="text-align:right">${esc(l.amount)}</span></div>`).join('')}</div>
    <div class="flex between" style="align-items:baseline;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--ln-control)"><span class="fs12 text3" style="white-space:nowrap;flex:none">${esc(row.summaryLabel)}</span><span class="grow" style="text-align:right;font-size:18px;font-weight:700;color:${row.positive ? 'var(--receive)' : 'var(--owe)'}">${esc(row.summary)}</span></div>
  </div>`;
}
function flowRowCardSmall(row) {
  return `<div class="card" style="padding:14px 16px">
    <div class="flex between items-center gap-10"><span class="fs16 fw500">${esc(row.name)}</span><span class="pill-neutral">${esc(row.role)}</span></div>
    <div class="flex-col gap-8 mt-10">${row.lines.map(l => `<div class="flex between" style="align-items:baseline;gap:10px"><span class="fs14 text2">${esc(l.text)}</span><span class="fs14 fw500" style="flex:none">${esc(l.amount)}</span></div>`).join('')}</div>
    <div class="flex between" style="align-items:baseline;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--ln-control)"><span class="fs12 text2">${esc(row.summaryLabel)}</span><span style="font-size:16px;font-weight:700;color:${row.positive ? 'var(--receive)' : 'var(--owe)'}">${esc(row.summary)}</span></div>
  </div>`;
}

/* ---------------- screen: settle ---------------- */
function screenSettle(ctx) {
  return `<div class="page-shell">
    ${topbarHamburger(ctx, '分帳產出')}
    <div class="segmented mt-14">
      <button class="segmented-tab${ctx.settleOnSplit ? ' is-active' : ''}" data-click="${H(ctx.toSettleSplit)}">分帳</button>
      <button class="segmented-tab${ctx.settleOnEvent ? ' is-active' : ''}" data-click="${H(ctx.toSettleEventTab)}">活動</button>
    </div>
    ${ctx.settleOnEvent ? `
    <div class="section-title mt-20">全部款項</div>
    <div class="card mt-10" style="padding:20px">
      <div class="section-title">款項現況</div>
      <div class="mt-12" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:16px">
        ${ctx.items.map(it => `<div class="flex between items-center"><span class="fs14">${esc(it.title)}</span><span class="fs14 fw500">${esc(it.amountText)}</span></div>`).join('')}
      </div>
      <div class="flex" style="justify-content:flex-end;align-items:baseline;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid var(--ln-control)"><span class="fs14 text3">合計</span><span style="font-size:24px;font-weight:700">${esc(ctx.itemsTotal)}</span></div>
    </div>
    <div class="section-title mt-24">人員分攤結果</div>
    <div class="grid-cards grid-cards--sm mt-10">${ctx.personSplits.map(personSplitCard).join('')}</div>` : ''}
    ${ctx.settleOnSplit ? `
    <div class="section-title mt-20">人員付款流向</div>
    <div class="grid-cards grid-cards--sm mt-10">${ctx.flowRows.map(flowRowCard).join('')}</div>
    <div class="section-title mt-24">留言</div>
    <div class="mt-10"><textarea class="input" rows="3" style="line-height:1.6"${fk('transfer-note')} data-change="${H(ctx.setTransferNote)}">${esc(ctx.transferNote)}</textarea></div>` : ''}
    <div class="bottom-cta"><button class="btn btn-primary btn-cta-lg" data-click="${H(ctx.askSettle)}">確認結帳產出</button></div>
  </div>`;
}

/* ---------------- screen: settleDone ---------------- */
function screenSettleDone(ctx) {
  return `<div class="page-shell">
    <div class="flex-col items-center">
      <div style="width:56px;height:56px;border-radius:99px;background:var(--teal);color:#fff;font-size:32px;display:flex;align-items:center;justify-content:center;font-weight:700">✓</div>
      <div class="mt-16" style="font-size:24px;font-weight:700">分帳已產出</div>
      <div class="mt-6 fs14">${esc(ctx.evName)} · 合計 ${esc(ctx.itemsTotal)}</div>
    </div>
    <div class="mt-20" style="padding:16px 20px;border-radius:8px;background:rgba(111,183,183,.10);font-size:14px;line-height:1.7">${esc(ctx.transferNote)}</div>
    <div class="card mt-16" style="padding:16px 20px">
      <div class="flex between items-center"><span class="section-title">人員付款流向</span><button class="btn-pill" style="font-size:12px;padding:6px 12px" data-click="${H(ctx.copyReport)}">${esc(ctx.copyReportLabel)}</button></div>
      <div class="mt-12" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,235px),1fr));gap:16px">${ctx.flowRows.map(flowRowCardSmall).join('')}</div>
    </div>
    <button class="btn btn-primary mt-12" data-click="${H(ctx.toSettledEvent)}">返回活動頁</button>
  </div>`;
}

/* ---------------- screen: settledEvent ---------------- */
function screenSettledEvent(ctx) {
  return `<div class="page-shell">
    <div class="topbar"><div class="topbar-row topbar-row--start">
      <button class="icon-btn hamburger" title="更多操作" data-click="${H(ctx.openMenu)}"><span></span><span></span><span></span></button>
      <span class="topbar-title">${esc(ctx.evName)}</span>
    </div></div>
    ${evInfoCard(ctx, `<span class="pill-dark">已結帳</span>`)}
    <div class="card mt-20" style="padding:20px">
      <div class="section-title">我的付款流向</div>
      <div class="flex-col gap-8 mt-14">
        ${ctx.myFlow.hasLines ? ctx.myFlow.lines.map(l => `<button class="card" style="width:100%;text-align:left;padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px" data-click="${H(l.open)}"><span class="fs14">${esc(l.text)}</span><span class="flex items-center gap-8"><span class="fs16 fw700">${esc(l.amount)}</span><span class="text3">›</span></span></button>`).join('') : `<div class="fs14 text3">你的款項已平衡，無需轉帳</div>`}
      </div>
      <div class="flex between" style="align-items:baseline;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid var(--ln-control)"><span class="fs12 text3">${esc(ctx.myFlow.summaryLabel)}</span><span style="font-size:18px;font-weight:700;color:${ctx.myFlow.positive ? 'var(--receive)' : 'var(--owe)'}">${esc(ctx.myFlow.summary)}</span></div>
    </div>
    <div class="mt-14" style="padding:16px 20px;border-radius:8px;background:rgba(111,183,183,.10);font-size:14px;line-height:1.7">${esc(ctx.transferNote)}</div>
    ${ctx.myPaid ? `<div class="mt-14" style="width:100%;padding:16px;border-radius:8px;background:var(--text);color:#fff;font-size:16px;text-align:center">✓ 已確認繳清</div>`
      : (ctx.myUnpaid ? `<button class="btn mt-14" style="border:1px solid var(--teal);background:#fff;color:var(--teal-hover)" data-click="${H(ctx.askPaid)}">確認已繳清</button>`
      : (ctx.myReceiving ? `<div class="mt-14" style="width:100%;padding:16px;border-radius:8px;background:var(--bg-neutral);color:var(--text3);font-size:14px;text-align:center">${esc(ctx.waitingText)}</div>` : ''))}
    <div class="section-title mt-20">款項現況（結帳不可編輯）</div>
    <div class="grid-cards mt-10">${ctx.items.map(it => `<button class="card card-pad" style="width:100%;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px" data-click="${H(it.open)}"><span class="flex-col gap-6"><span class="fs14">${esc(it.title)}</span><span class="fs12 text3">${esc(it.by)} 代墊 · 明細 ${it.detailCount} 筆</span></span><span class="flex items-center gap-8" style="flex:none"><span class="fs14 fw500 text2">${esc(it.amountText)}</span><span class="text3">›</span></span></button>`).join('')}</div>
    ${ctx.noItems ? `<div class="empty-box">尚無款項</div>` : ''}
  </div>`;
}

/* ---------------- screen: pairDetail ---------------- */
function screenPairDetail(ctx) {
  return `<div class="page-shell">
    ${topbarBack('分攤明細', ctx.toSettledEvent)}
    <div class="mt-12 flex between items-center gap-12" style="padding:14px 20px;border-radius:8px;background:rgba(111,183,183,.12)"><span style="font-size:24px;font-weight:700">${esc(ctx.pair.title)}</span><span style="flex:none;font-size:24px;font-weight:700;color:var(--teal-hover)">${esc(ctx.pair.amount)}</span></div>
    <div class="section-title mt-20">項目分攤明細</div>
    <div class="grid-cards mt-10">${ctx.pair.lines.map(l => `<div class="card card-pad flex between items-center gap-10"><span class="flex-col gap-4"><span class="fs16">${esc(l.label)}</span><span class="fs12 text3">${esc(l.dirText)}</span></span><span class="fs16 fw700">${esc(l.amount)}</span></div>`).join('')}</div>
  </div>`;
}

/* ---------------- screen: payments ---------------- */
function screenPayments(ctx) {
  return `<div class="page-shell">
    ${topbarHamburger(ctx, '繳款情況確認')}
    <div class="grid-cards mt-10">${ctx.transfers.map(t => `<div class="card card-pad flex between items-center gap-12"><span class="flex-col gap-4"><span class="fs14">${esc(t.text)}</span><span class="fs12 text3">${esc(t.statusText)}</span></span><span class="flex items-center gap-12"><span class="fs16 fw700">${esc(t.amount)}</span>${t.paid ? `<button style="width:20px;height:20px;border-radius:99px;border:none;background:var(--teal);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer" data-click="${H(t.toggle)}">✓</button>` : `<button style="width:20px;height:20px;border-radius:99px;border:1px solid var(--ln-control);background:#fff;cursor:pointer" data-click="${H(t.toggle)}"></button>`}</span></div>`).join('')}</div>
    <button class="btn btn-primary mt-20" data-click="${H(ctx.archiveEvent)}">已結清，封存活動</button>
  </div>`;
}

/* ---------------- screen: archived ---------------- */
function screenArchived(ctx) {
  const ctxForInfo = Object.assign({}, ctx, { evDate: ctx.archivedDate, evPlace: ctx.archivedPlace });
  return `<div class="page-shell">
    <div class="topbar"><div class="topbar-row">
      <button class="icon-btn hamburger" title="更多操作" data-click="${H(ctx.openMenu)}"><span></span><span></span><span></span></button>
      <span class="topbar-title">${esc(ctx.archivedName)}</span>
      <span class="pill-archived" style="margin-left:auto">已封存</span>
    </div></div>
    ${evInfoCard(ctxForInfo)}
    <div class="mt-20 flex items-baseline between wrap gap-6">
      <span class="section-title">款項現況</span>
      <span class="flex gap-8 wrap" style="justify-content:flex-end">
        <span class="fs14">合計 ${esc(ctx.itemsTotal)}</span><span class="fs14">｜</span>
        <span class="fs14">應分攤 ${esc(ctx.sharedTotal)}</span><span class="fs14">｜</span>
        <span class="fs14">已代墊 ${esc(ctx.myPaidTotal)}</span>
      </span>
    </div>
    <div class="grid-cards mt-10">${ctx.items.map(it => itemCard(it, { onOpen: it.openArchived })).join('')}</div>
    <div class="section-title mt-24">人員分攤結果</div>
    <div class="grid-cards grid-cards--sm mt-10">${ctx.personSplits.map(personSplitCard).join('')}</div>
    <div class="section-title mt-24">人員付款流向</div>
    <div class="grid-cards grid-cards--sm mt-10">${ctx.flowRows.map(flowRowCard).join('')}</div>
  </div>`;
}

/* ---------------- screen dispatch ---------------- */
function screenFor(ctx) {
  if (ctx.s_login) return screenLogin(ctx);
  if (ctx.s_register) return screenRegister(ctx);
  if (ctx.s_home) return screenHome(ctx);
  if (ctx.s_create) return screenCreate(ctx);
  if (ctx.s_invite) return screenInvite(ctx);
  if (ctx.s_joinForm) return screenJoinForm(ctx);
  if (ctx.s_group) return screenGroup(ctx);
  if (ctx.s_rulesPage) return screenRules(ctx);
  if (ctx.s_addItem) return screenAddItem(ctx);
  if (ctx.s_itemDetail) return screenItemDetail(ctx);
  if (ctx.s_settle) return screenSettle(ctx);
  if (ctx.s_settleDone) return screenSettleDone(ctx);
  if (ctx.s_settledEvent) return screenSettledEvent(ctx);
  if (ctx.s_pairDetail) return screenPairDetail(ctx);
  if (ctx.s_payments) return screenPayments(ctx);
  if (ctx.s_archived) return screenArchived(ctx);
  if (ctx.s_event) return screenEvent(ctx);
  return '';
}

/* ---------------- render loop + focus preservation ---------------- */
let ROOT = null;
function captureFocus() {
  const el = document.activeElement;
  if (!el || !el.dataset || !el.dataset.fk) return null;
  return { fk: el.dataset.fk, start: el.selectionStart, end: el.selectionEnd };
}
function restoreFocus(f) {
  if (!f || !ROOT) return;
  let el;
  try { el = ROOT.querySelector('[data-fk="' + f.fk.replace(/"/g, '\\"') + '"]'); } catch (e) { return; }
  if (!el) return;
  el.focus();
  if (typeof el.setSelectionRange === 'function' && f.start != null) {
    try { el.setSelectionRange(f.start, f.end); } catch (e) {}
  }
}
function render() {
  HANDLERS = {}; HID = 0;
  const focus = captureFocus();
  const ctx = buildCtx();
  ROOT.innerHTML = `<div class="app-body"><div class="app-row">
      ${sidebarNav(ctx)}
      <div class="app-scroll">${screenFor(ctx)}</div>
    </div>
    ${drawerMenu(ctx)}
    ${renderDialogs(ctx)}
  </div>`;
  restoreFocus(focus);
}

/* ---------------- event delegation (replaces JSX onClick/onChange/...) ---------------- */
function delegate(root, evt, dataAttr, pd) {
  root.addEventListener(evt, e => {
    const el = e.target.closest('[' + dataAttr + ']');
    if (!el) return;
    const fn = HANDLERS[el.dataset[dataAttr.replace('data-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())]];
    if (!fn) return;
    if (pd) e.preventDefault();
    fn(e);
  });
}
function setupDelegation(root) {
  delegate(root, 'click', 'data-click');
  delegate(root, 'input', 'data-change');
  delegate(root, 'focusin', 'data-focus');
  delegate(root, 'focusout', 'data-blur');
  delegate(root, 'keydown', 'data-keydown');
  delegate(root, 'dragstart', 'data-dragstart');
  delegate(root, 'dragend', 'data-dragend');
  delegate(root, 'dragover', 'data-dragover', true);
  delegate(root, 'drop', 'data-drop', true);
}

/* ---------------- boot ---------------- */
function boot() {
  ROOT = document.getElementById('app-root');
  bootSeed();
  setupDelegation(ROOT);
  render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
