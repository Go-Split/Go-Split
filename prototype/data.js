/* ==========================================================================
   分帳吧 — demo data
   --------------------------------------------------------------------------
   ALL hardcoded/seed data lives here (nothing about UI or logic). This is a
   direct extraction of the literals that lived inside v13's
   `class Component extends DCLogic { state = {...} }` and its small number
   of demo-data helper methods (bbqRoster/bbqItems/outdoorSeedItems/
   outdoorMemberTags). app.js reads from this file instead of inlining any
   of it. Everything here is fake client-side demo data — there is no
   backend, no persistence, no real accounts.
   ========================================================================== */

// Deep-clone helper used everywhere we hand out a fresh copy of seed data.
function clone(v) { return JSON.parse(JSON.stringify(v)); }

const INITIAL_STATE = {
  screen: 'login',
  guest: false,
  blank: false,
  role: 'host',
  persona: 'host',
  acc: { name: '小凱', mail: 'kai@example.com', pass: 'demo1234' },
  loginTab: 'acc',
  firstJoin: false,
  join2: { mail: 'kai@example.com', phone: '0912-345-678' },
  code: '4KQ2-8P',
  ev: { name: '', date: '', place: '', template: '自訂', d1: '', t1: '', d2: '', t2: '' },
  events: [
    { name: '公司烤肉聚會', date: '8/22（五）19:00', place: '大安區 好客燒肉', role: 'host', archived: false },
    { name: '週末露營裝備分攤', date: '9/5（六）09:00', place: '南投 武界露營區', role: 'member', archived: false },
    { name: '七月生日會', date: '7/12（六）18:00', place: '信義區 Rooftop Bar', role: 'member', archived: true },
    { name: '中秋公司烤肉', date: '9/26（六）17:00', place: '內湖 河濱烤肉區', role: 'host', archived: false, template: '烤肉/露營模板' },
    { name: '期末慶功 KTV', date: '9/12（六）21:00', place: '西門町 星聚點', role: 'member', archived: false, template: '唱歌模板' },
    { name: '沖繩四天三夜', date: '10/4（六）08:00', place: '日本 沖繩・那霸', role: 'co', archived: false, template: '出國旅遊模板' },
    { name: '攝影社淡水外拍', date: '9/20（六）13:00', place: '淡水 漁人碼頭', role: 'member', archived: false, template: '社團活動模板' },
    { name: '系友會春酒', date: '8/8（五）18:30', place: '中山區 老四川', role: 'host', archived: false, settled: true, template: '聚餐模板' },
    { name: '羽球團月底結算', date: '8/30（六）10:00', place: '松山運動中心', role: 'member', archived: false, settled: true, template: '社團活動模板' },
    { name: '同事送別會', date: '8/15（五）19:30', place: '大同區 居酒屋', role: 'co', archived: false, settled: true, template: '聚餐模板' },
  ],
  paidAsk: false,
  evEdit: null,
  cur: 0,
  join: { name: '', conds: ['吃素'], note: '' },
  settingsBy: {},
  itemTags: ['肉', '酒', '素食', '交通', '其他'],
  condTags: ['吃素', '不喝酒', '不吃牛', '食物過敏'],
  rules: [
    { tag: '肉', groups: [{ conds: ['吃素'], mode: 'exclude', wt: '' }] },
    { tag: '酒', groups: [{ conds: ['不喝酒'], mode: 'exclude', wt: '' }, { conds: ['食物過敏'], mode: 'weight', wt: '0.5' }] },
  ],
  members: [
    { id: '010011', name: '小凱', role: '主辦者', tags: [], login: '帳號（10123）', guest: false },
    { id: '010012', name: '阿豪', role: '協辦者', tags: ['不喝酒'], login: '帳號（10456）', guest: false },
    { id: '010013', name: '小美', role: '參與者', tags: ['吃素'], login: '訪客登入 01000', guest: true, mail: 'mei@example.com', phone: '0912345678' },
    { id: '010014', name: '佳蓉', role: '參與者', tags: [], login: '訪客登入 01001', guest: true, mail: 'jung@example.com', phone: '0922333444' },
  ],
  itemsBy: { 0: [
    { id: 'i1', by: '小凱', receipt: true, details: [
      { name: '包廂場地費', amount: 1200, tags: [], note: '低消已折抵', ids: null },
      { name: '燒肉主餐', amount: 3600, tags: ['肉'], note: '含服務費 10%', ids: null },
      { name: '清酒兩瓶', amount: 800, tags: ['酒'], note: '', ids: null },
    ] },
    { id: 'i2', by: '阿豪', receipt: false, details: [
      { name: '超商飲料', amount: 360, tags: [], note: '', ids: null },
    ] },
  ], 1: [
    { id: 'c1', by: '小凱', receipt: true, details: [
      { name: '帳篷與睡袋租借', amount: 2400, tags: [], note: '兩帳四袋', ids: null },
      { name: '烤肉食材（肉品）', amount: 1800, tags: ['肉'], note: '', ids: null },
      { name: '啤酒一箱', amount: 600, tags: ['酒'], note: '', ids: null },
    ] },
    { id: 'c2', by: '阿豪', receipt: false, details: [
      { name: '來回油錢', amount: 900, tags: ['交通'], note: '兩台車均分', ids: null },
    ] },
  ], 2: [
    { id: 'b1', by: '小美', receipt: true, details: [
      { name: '生日蛋糕', amount: 1280, tags: [], note: '八吋草莓', ids: null },
      { name: '氣球佈置', amount: 460, tags: [], note: '', ids: null },
    ] },
    { id: 'b2', by: '小凱', receipt: false, details: [
      { name: '調酒材料', amount: 900, tags: ['酒'], note: '', ids: null },
      { name: '炸物拼盤', amount: 600, tags: ['肉'], note: '', ids: null },
    ] },
  ], 3: [
    { id: 'g1', by: '小凱', receipt: true, details: [
      { name: '烤肉食材組合', amount: 2800, tags: ['肉'], note: '含海鮮拼盤', ids: null },
      { name: '木炭與烤具', amount: 700, tags: [], note: '', ids: null },
    ] },
    { id: 'g2', by: '阿豪', receipt: false, details: [
      { name: '飲料與啤酒', amount: 1100, tags: ['酒'], note: '啤酒另計', ids: null },
    ] },
  ], 4: [
    { id: 'k1', by: '阿豪', receipt: true, details: [
      { name: '包廂費 3 小時', amount: 2400, tags: [], note: '假日時段', ids: null },
      { name: '酒水無限暢飲', amount: 1600, tags: ['酒'], note: '', ids: null },
    ] },
    { id: 'k2', by: '佳蓉', receipt: false, details: [
      { name: '宵夜炸物', amount: 540, tags: ['肉'], note: '', ids: null },
    ] },
  ], 5: [
    { id: 't1', by: '小凱', receipt: true, details: [
      { name: '來回機票 4 人', amount: 32800, tags: ['交通'], note: '含行李', ids: null },
      { name: '民宿三晚', amount: 18600, tags: [], note: '兩間雙人房', ids: null },
    ] },
    { id: 't3', by: '阿豪', receipt: false, details: [
      { name: '機場接送', amount: 2400, tags: ['交通'], note: '來回兩趟', ids: null },
    ] },
    { id: 't2', by: '小美', receipt: false, details: [
      { name: '租車與油錢', amount: 6400, tags: ['交通'], note: '四天', ids: null },
      { name: '個人紀念品', amount: 1200, tags: ['其他'], note: '個人消費另計', ids: null },
    ] },
  ], 6: [
    { id: 'p1', by: '佳蓉', receipt: true, details: [
      { name: '器材租借', amount: 1800, tags: [], note: '鏡頭與腳架', ids: null },
      { name: '模特兒車馬費', amount: 2000, tags: [], note: '', ids: null },
    ] },
    { id: 'p2', by: '小美', receipt: false, details: [
      { name: '團體交通', amount: 720, tags: ['交通'], note: '捷運＋公車', ids: null },
    ] },
  ], 7: [
    { id: 's1', by: '小凱', receipt: true, details: [
      { name: '桌菜 4 桌', amount: 24000, tags: ['肉'], note: '含服務費', ids: null },
      { name: '紅酒六瓶', amount: 4800, tags: ['酒'], note: '', ids: null },
    ] },
    { id: 's2', by: '阿豪', receipt: true, details: [
      { name: '場地佈置', amount: 2600, tags: [], note: '', ids: null },
    ] },
  ], 8: [
    { id: 'b1', by: '小凱', receipt: true, details: [
      { name: '場地租借 3 小時', amount: 2400, tags: [], note: '含球網', ids: null },
      { name: '羽球 2 筒', amount: 1200, tags: [], note: '', ids: null },
    ] },
    { id: 'b2', by: '阿豪', receipt: false, details: [
      { name: '運動飲料', amount: 480, tags: [], note: '', ids: null },
    ] },
  ], 9: [
    { id: 'f1', by: '阿豪', receipt: true, details: [
      { name: '居酒屋主餐', amount: 8600, tags: ['肉'], note: '含服務費', ids: null },
      { name: '清酒兩瓶', amount: 1800, tags: ['酒'], note: '', ids: null },
    ] },
    { id: 'f2', by: '小美', receipt: false, details: [
      { name: '送別禮物', amount: 1500, tags: [], note: '大家均分', ids: null },
    ] },
  ] },
  paidBy2: { 0: {}, 1: {}, 2: { '010013>010011': true }, 3: {}, 4: {}, 5: {}, 6: {}, 7: { '010014>010011': true }, 8: {}, 9: {} },
  draft: { receipt: false, details: [] },
  tagEdit: null,
  tagMenu: null,
  tagUsedAsk: null,
  ruleEdit: null,
  ruleAlert: null,
  rulePick: null,
  ruleTagQuery: '',
  ruleCondQuery: '',
  expand: {},
  selPair: null,
  sel: 0,
  editMember: null,
  delAsk: null,
  newMember: null,
  memberToast: null,
  tagToast: null,
  copied: false,
  copiedReport: false,
  settled: false,
  settleTab: 'split',
  transferNote: '請大家於 09/12 前繳款至（013）012122131314',
  paid: {},
};

// 情境模板選項；只有「自訂」與「烤肉/露營」有實際內容，其餘 4 個原型標示「未規劃」，
// 選取後行為與烤肉/露營相同（帶入該模板預設值）— 這是直接沿用 v13 的既有行為，非本次新增。
const TEMPLATE_OPTS = [
  { label: '自訂', hint: '自行設定分攤方式與規則' },
  { label: '烤肉/露營模板', hint: '依飲食習慣分攤' },
  { label: '聚餐模板', hint: '均分＋肉／酒標籤自動排除', soon: true },
  { label: '唱歌模板', hint: '包廂費均分、酒水另計', soon: true },
  { label: '出國旅遊模板', hint: '住宿與交通均分、個人消費另計', soon: true },
  { label: '社團活動模板', hint: '場地與器材均分、缺席者排除', soon: true },
];

function bbqRoster() {
  const mk = (n, name, role, tags, extra) => Object.assign({ id: '0100' + (10 + n), name: name, role: role,
    tags: tags, login: role === '參與者' ? '訪客登入 010' + (10 + n) : '帳號（10' + (100 + n) + '）',
    guest: role === '參與者' }, extra || {});
  return [
    mk(1, '小凱', '主辦者', ['大人', '不喝酒/開車']),
    mk(2, '阿豪', '協辦者', ['大人', '需搭主辦的車']),
    mk(3, '家豪', '協辦者', ['大人', '自行前往']),
    mk(4, '佩君', '協辦者', ['大人', '晚到', '需搭主辦的車']),
    mk(5, '小美', '參與者', ['大人', '吃素', '需搭主辦的車'], { mail: 'mei@example.com', phone: '0912345678' }),
    mk(6, '佳蓉', '參與者', ['大人', '海鮮過敏', '自行前往'], { mail: 'jung@example.com', phone: '0922333444' }),
    mk(7, '阿哲', '參與者', ['大人', '需搭主辦的車']),
    mk(8, '宜庭', '參與者', ['大人', '吃素', '自行前往']),
    mk(9, '冠廷', '參與者', ['大人', '不喝酒/開車', '自行前往']),
    mk(10, '雅婷', '參與者', ['大人', '需搭主辦的車']),
    mk(11, '小樂', '參與者', ['小孩', '需搭主辦的車']),
    mk(12, '小圓', '參與者', ['小孩', '需搭主辦的車']),
    mk(13, '承翰', '參與者', ['大人', '晚到', '自行前往']),
    mk(14, '品妤', '參與者', ['大人', '海鮮過敏', '需搭主辦的車']),
    mk(15, '又寧', '參與者', ['大人', '需搭主辦的車']),
  ];
}

function bbqItems() {
  const d = (name, amount, tags, note) => ({ name: name, amount: amount, tags: tags || [], note: note || '', ids: null });
  return [
    { id: 'q1', by: '小凱', receipt: true, details: [
      d('烤肉肉品組', 3600, ['肉品'], '牛豬雞各兩份'),
      d('蔬菜與菇類', 900, ['蔬菜'], ''),
      d('海鮮拼盤', 2400, ['海鮮'], '蝦、蛤蜊、透抽') ] },
    { id: 'q2', by: '阿豪', receipt: false, details: [
      d('白飯與麵包', 800, ['主食'], ''),
      d('烤肉醬與調味料', 350, ['調味料'], '') ] },
    { id: 'q3', by: '小美', receipt: true, details: [
      d('啤酒與氣泡酒', 1500, ['酒精飲品'], ''),
      d('無酒精飲料', 600, ['無酒精飲品'], '茶與汽水') ] },
    { id: 'q4', by: '家豪', receipt: false, details: [
      d('場地與烤爐租借', 2400, ['場地費'], '含木炭'),
      d('免洗餐具與清潔用品', 480, ['免洗餐具'], '') ] },
    { id: 'q5', by: '小凱', receipt: false, details: [
      d('共乘油錢與停車', 1200, ['交通費'], '兩台車') ] },
  ];
}

function outdoorSeedItems(i) {
  const d = (name, amount, tags, note) => ({ name: name, amount: amount, tags: tags || [], note: note || '', ids: null });
  if (i === 1) return [
    { id: 'c1', by: '小凱', receipt: true, details: [
      d('帳篷與睡袋租借', 2400, ['設備租借費'], '兩帳四袋'),
      d('營位費用', 1800, ['場地費'], '兩晚') ] },
    { id: 'c2', by: '阿豪', receipt: false, details: [
      d('烤肉肉品', 1600, ['肉品'], ''),
      d('生鮮蔬菜', 520, ['蔬菜'], '') ] },
    { id: 'c3', by: '小美', receipt: true, details: [
      d('啤酒一箱', 600, ['酒精飲品'], ''),
      d('礦泉水與果汁', 320, ['無酒精飲品'], '') ] },
    { id: 'c4', by: '佳蓉', receipt: false, details: [
      d('來回油錢', 900, ['交通費'], '兩台車') ] },
  ];
  if (i === 3) return [
    { id: 'g1', by: '小凱', receipt: true, details: [
      d('烤肉食材組合', 2800, ['肉品'], '含海鮮拼盤'),
      d('鮮蝦與蛤蜊', 1200, ['海鮮'], ''),
      d('木炭與烤具', 700, ['烤肉工具'], '') ] },
    { id: 'g2', by: '阿豪', receipt: false, details: [
      d('飲料與啤酒', 1100, ['酒精飲品'], '啤酒另計'),
      d('無糖茶飲', 380, ['無酒精飲品'], '') ] },
    { id: 'g3', by: '小美', receipt: false, details: [
      d('免洗餐具', 260, ['免洗餐具'], ''),
      d('烤肉醬與鹽', 240, ['調味料'], '') ] },
  ];
  return [];
}

function outdoorMemberTags(name) {
  const map = { '小凱': ['大人', '不喝酒/開車'], '阿豪': ['大人', '需搭主辦的車'],
    '小美': ['大人', '吃素', '自行前往'], '佳蓉': ['小孩', '需搭主辦的車'] };
  return (map[name] || ['大人']).slice();
}

// 烤肉/露營模板的完整規則／標籤／人員設定（唯一有完整內容的情境模板，另一個是「自訂」＝空白）
function outdoorEvSettingsData(baseMembers) {
  return { rules: [
      { tag: '肉品', groups: [
        { conds: ['吃素'], mode: 'exclude', wt: '' },
        { conds: ['小孩'], mode: 'weight', wt: '0.5' },
        { conds: ['晚到'], mode: 'weight', wt: '0.5' } ] },
      { tag: '蔬菜', groups: [
        { conds: ['吃素'], mode: 'weight', wt: '1.5' },
        { conds: ['小孩'], mode: 'weight', wt: '0.5' } ] },
      { tag: '海鮮', groups: [
        { conds: ['海鮮過敏'], mode: 'exclude', wt: '' },
        { conds: ['小孩'], mode: 'weight', wt: '0.5' } ] },
      { tag: '主食', groups: [
        { conds: ['小孩'], mode: 'weight', wt: '0.5' } ] },
      { tag: '酒精飲品', groups: [
        { conds: ['不喝酒/開車'], mode: 'exclude', wt: '' },
        { conds: ['小孩'], mode: 'exclude', wt: '' } ] },
      { tag: '交通費', groups: [
        { conds: ['自行前往'], mode: 'exclude', wt: '' },
        { conds: ['需搭主辦的車'], mode: 'weight', wt: '1' } ], rest: { mode: 'exclude', wt: '' } },
    ],
    condTags: ['吃素', '大人', '小孩', '晚到', '海鮮過敏', '不喝酒/開車', '自行前往', '需搭主辦的車'],
    itemTags: ['肉品', '蔬菜', '海鮮', '主食', '水果', '甜點', '酒精飲品', '無酒精飲品',
      '調味料', '烤肉工具', '露營工具', '免洗餐具', '清潔用品', '場地費', '設備租借費', '交通費'],
    members: (baseMembers || []).map(m => Object.assign({}, m, { tags: outdoorMemberTags(m.name) })) };
}
