/* Шаблоните: всеки документ се изгражда и формата съответства на изискванията на сървъра. */
const test = require('node:test'), assert = require('node:assert/strict');
const Docs = require('../site/js/docs.js');
const { load } = require('./mock-google');

const org = { name: 'Община Тест', basis: 'чл. 3, ал. 1', eik: '000696327', postcode: '1000', city: 'София', address: 'ул. 1', phone: '02', email: 'a@b.bg', web: 'https://a.bg', headName: 'Иван Иванов', headPosition: 'Кмет', unitName: 'Деловодство', unitAddress: 'ул. 1', unitEmail: 'z@b.bg', unitPhone: '02', unitHours: '9–17', court: 'Административен съд София-град' };
const kase = { regNo: 'ЗДОИ-2026-0001', regDate: '2026-11-02', applicantName: 'Петър Петров', applicantType: 'Гражданин', applicantAddress: 'ул. 2', subject: 'Договори', form: '' };
const fields = { what: 'x', days: '10', reason: 'x', third: 'Трето лице', thirdAddress: 'адрес', info: 'x', by: '2026-11-20', body: 'Орган', bodyAddress: 'адрес', ground: 'чл. 25, ал. 2', subjectLine: 'тема', text: 'текст', scope: 'пълен', accessDays: '30', place: 'място', accessForm: 'устна справка', costs: 'няма', withheld: 'част', groundKey: 't1', groundText: 'чл. 37, ал. 1, т. 1 ЗДОИ – основание', factual: 'факти', given: 'копия', employee: 'Служител', year: '2025', attachments: '1. Заявление\nРешение № 5', toName: 'Получател', toAddress: 'адрес', ofNo: 'РЕШ-1', ofDate: '2026-11-03', ofTitle: 'Решение', departmentId: 'o1', department: 'Правен отдел', departmentHead: 'Анна Иванова', departmentPosition: 'Началник', fromName: 'Служител Тест', fromPosition: 'Експерт' };
const stats = { year: '2025', total: 1, access: 1, reuse: 0, byApplicant: { Гражданин: 1 }, byChannel: { Писмено: 1 }, byOutcome: { Отказ: 1 }, refusals: 1, grounds: { x: 1 }, appealed: 0, late: 0, published: 0 };

const flatten = n => (n === null || n === undefined ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(flatten).join(' ') : typeof n === 'object' ? [n.text, n.stack, n.columns, n.ol, n.table && n.table.body].map(flatten).join(' ') : String(n));
const render = type => flatten(Docs.pdfDefinition({ type, no: 'X-1', date: '2026-11-04', org, case: kase, f: fields, stats, items: [{ item: '4', text: 'Звено', url: 'https://a.bg', updated: '2026-11-04' }] }, 'data:image/png;base64,AA==').content);

test('every document type on the server has a template and the reverse', () => {
  const server = Object.keys(load().t.DOC_TYPES).sort();
  assert.deepEqual(Object.keys(Docs.DEFS).sort(), server);
});

test('every field the server requires can be entered in the form', () => {
  const { DOC_TYPES } = load().t;
  for (const [type, def] of Object.entries(DOC_TYPES)) {
    if (def.noCase) continue;
    const keys = Docs.DEFS[type].fields.map(f => f.k);
    def.need.forEach(k => assert.ok(keys.includes(k), `${type}: липсва поле ${k}`));
    Docs.DEFS[type].fields.filter(f => f.req).forEach(f => assert.ok(def.need.includes(f.k), `${type}: ${f.k} е задължително само във формата`));
  }
});

test('all templates build, carry the logo and contain no broken values', () => {
  for (const type of Object.keys(Docs.DEFS)) {
    const t = render(type);
    assert.ok(t.includes('Община Тест'), type);
    assert.ok(!/undefined|\[object|NaN/.test(t), `${type}: ${t.slice(0, 300)}`);
    assert.ok(!/ г\.\.(\s|$)/.test(t), `${type}: двойна точка`);
    const def = Docs.pdfDefinition({ type, no: 'X-1', date: '2026-11-04', org, case: kase, f: fields, stats, items: [] }, 'data:image/png;base64,AA==');
    assert.ok(def.images.logo);
    assert.ok(JSON.stringify(def.content).includes('"image":"logo"'), `${type}: без лого`);
  }
});

test('decisions contain the elements the law requires', () => {
  const grant = render('grant');
  ['Степен на осигурения достъп', 'Срок, в който е осигурен', 'Място на предоставяне', 'Форма на предоставяне', 'Разходи по предоставянето', 'Административен съд София-град', '14-дневен срок', 'чл. 34'].forEach(x => assert.ok(grant.includes(x), x));
  const refuse = render('refuse');
  ['Правно основание за отказа', 'Фактическо основание за отказа', 'от 04.11.2026 г.', 'обжалвано', 'чл. 38', 'чл. 39'].forEach(x => assert.ok(refuse.includes(x), x));
  assert.ok(render('partial').includes('чл. 37, ал. 2'));
});

test('appeal clause follows the basis of the organization', () => {
  assert.ok(render('refuse').includes('чл. 40, ал. 1'));
  const t = flatten(Docs.pdfDefinition({ type: 'refuse', no: 'X', date: '2026-11-04', org: { ...org, basis: 'чл. 3, ал. 2, т. 1' }, case: kase, f: fields }, 'x').content);
  assert.ok(t.includes('чл. 40, ал. 2'));
});

const payload = over => ({ type: 'refuse', no: 'X', date: '2026-11-04', org, case: kase, f: Object.assign({}, fields, over) });
const text = p => flatten(Docs.pdfDefinition(p, 'x').content);

test('refusal grounds are the same in the browser and on the server', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(load().t.GROUNDS)), Docs.GROUNDS);
});

test('documents carry the full addresses: postcode, oblast, municipality, settlement', () => {
  const full = Object.assign({}, org, { postcode: '4700', oblast: 'Смолян', municipality: 'Смолян', city: 'гр. Смолян', address: 'бул. България 12' });
  assert.equal(Docs.orgAddress(full), 'п.к. 4700, обл. Смолян, общ. Смолян, гр. Смолян, бул. България 12');
  const addr = 'п.к. 1000, обл. София (столица), общ. Столична, гр. София, ул. Шипка 5';
  const kase2 = Object.assign({}, kase, { applicantAddress: addr, applicantSeat: 'София', applicantEmail: 'a@b.bg', applicantPhone: '0888' });
  for (const type of ['clarify', 'refuse', 'grant', 'partial', 'protocol']) {
    const t = flatten(Docs.pdfDefinition({ type, no: 'X', date: '2026-11-04', org: full, case: kase2, f: fields }, 'x').content);
    assert.ok(t.includes('п.к. 4700, обл. Смолян, общ. Смолян'), type + ': адрес на организацията');
    assert.ok(t.includes(addr), type + ': адрес на заявителя');
    assert.ok(t.includes('София'), type);
  }
  const letter = flatten(Docs.pdfDefinition({ type: 'clarify', no: 'X', date: '2026-11-04', org: full, case: kase2, f: fields }, 'x').content);
  assert.ok(letter.includes('седалище: София') && letter.includes('тел. 0888') && letter.includes('a@b.bg'));
});

test('the decision form suggests the court from the written address', () => {
  const field = Docs.DEFS.refuse.fields.find(f => f.k === 'court');
  assert.equal(field.value({ applicantAddress: 'п.к. 9000, обл. Варна, общ. Варна, гр. Варна', applicantOblast: 'Русе' }), 'Административен съд – Варна');
  assert.equal(field.value({ applicantAddress: 'ул. 1', applicantOblast: 'Русе' }), 'Административен съд – Русе');
  assert.equal(field.value({ applicantAddress: 'ул. 1', applicantOblast: '' }), '');
  assert.ok(field.options.includes(field.value({ applicantAddress: 'обл. София (столица), гр. София' })));
});

test('the appeal clause names the court of the addressee, and old documents keep theirs', () => {
  assert.ok(text(payload({ court: 'Административен съд – Варна' })).includes('Административен съд – Варна'));
  assert.ok(text(payload({})).includes('Административен съд София-град'), 'stored documents without a court field');
  assert.equal(Docs.courtForOblast('София (столица)'), 'Административен съд София-град');
  assert.equal(Docs.courtForOblast('София'), 'Административен съд София-област');
  assert.equal(Docs.OBLASTS.length, 28);
  const places = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'site', 'data', 'places.json'), 'utf8'));
  assert.deepEqual(places.oblasts.map(o => o.n), Docs.OBLASTS, 'every oblast in the address list has a court');
});

test('legal grounds: several in one act, in every kind of act', () => {
  assert.ok(Object.keys(Docs.REFUSAL).length >= 10);
  const own = [{ id: 'c1', text: 'чл. 5 от Закон за пример' }];
  assert.equal(Docs.groundsText('refuse', ['t2', 'c1'], own, ' Друго\nоснование '), Docs.REFUSAL.t2 + '; чл. 5 от Закон за пример; Друго основание');
  assert.ok(text(Object.assign(payload({ groundText: 'чл. 5 от Закон за пример' }), { type: 'noinfo' })).includes('Правно основание: чл. 5 от Закон за пример.'));
  assert.ok(text(Object.assign(payload({ groundText: 'чл. 31, ал. 5' }), { type: 'grant' })).includes('Допълнителни правни основания: чл. 31, ал. 5.'));
  for (const type of ['grant', 'partial', 'refuse', 'dismiss', 'clarify', 'noinfo', 'forward', 'letter']) {
    assert.equal(Docs.DEFS[type].fields.filter(f => f.type === 'grounds').length, 1, type);
  }
});

test('a re-use decision cites the appeal provision for re-use', () => {
  const kind = k => text(Object.assign(payload({}), { case: Object.assign({}, kase, { kind: k }) }));
  assert.ok(kind('Повторно използване на информация').includes('чл. 41к'));
  assert.ok(kind('Достъп до обществена информация').includes('чл. 40, ал. 1'));
});

test('the list of rights is the same in the browser and on the server', () => {
  const g = load();
  assert.deepEqual([...g.ctx.__perms.all], Docs.PERMS.map(p => p[0]));
  assert.deepEqual([...g.ctx.__perms.staff], Docs.STAFF_PERMS);
});

test('motives appear in decisions and letters, split into paragraphs, before the operative part', () => {
  for (const type of ['grant', 'partial', 'refuse']) {
    const t = text(Object.assign(payload({ motives: 'Първи мотив.\n\nВтори мотив.' }), { type }));
    assert.ok(t.includes('МОТИВИ:'), type);
    assert.ok(t.indexOf('Втори мотив.') < t.indexOf('РЕШИХ:'), type);
  }
  assert.ok(text(Object.assign(payload({ motives: 'Обосновка.' }), { type: 'noinfo' })).includes('Обосновка.'));
  assert.ok(!text(payload({ motives: '' })).includes('МОТИВИ:'));
  for (const type of ['grant', 'partial', 'refuse', 'clarify', 'noinfo']) assert.ok(Docs.DEFS[type].fields.some(f => f.k === 'motives'), type);
});

test('review before PDF: paragraphs can be changed, deleted and supplemented', () => {
  const base = payload({});
  const list = Docs.editableParagraphs(base);
  assert.ok(list.length >= 5);
  const i = list.findIndex(x => x.startsWith('ОТКАЗВАМ'));
  const del = list.findIndex(x => x.includes('(чл. 39 ЗДОИ)'));
  const t = text(payload({ edits: JSON.stringify({ [i]: 'ОТКАЗВАМ частично и с промяна.', [del]: '' }), extra: 'Добавен абзац едно.\n\nДобавен абзац две.' }));
  assert.ok(t.includes('ОТКАЗВАМ частично и с промяна.'));
  assert.ok(!t.includes('ОТКАЗВАМ да предоставя'));
  assert.ok(!t.includes('(чл. 39 ЗДОИ)'));
  assert.ok(t.includes('Добавен абзац едно.') && t.includes('Добавен абзац две.'));
  assert.ok(t.indexOf('Добавен абзац две.') < t.indexOf('14-дневен'), 'before the appeal clause');
  assert.deepEqual(Docs.editableParagraphs(payload({ edits: JSON.stringify({ 0: 'x' }) })), list, 'originals stay available');
  assert.ok(text(payload({ edits: 'повреден json' })).includes('ОТКАЗВАМ да предоставя'), 'broken edits are ignored');
});

test('an authorized person is shown with the act under the signature', () => {
  const t = text(payload({ signer: 'Петя Иванова', signerPosition: 'Секретар', signerAct: 'Заповед № 12 от 01.02.2026 г.' }));
  assert.ok(t.includes('Петя Иванова') && t.includes('Заповед № 12') && t.includes('чл. 28, ал. 2'));
  assert.ok(!t.includes('Иван Иванов'), 'head does not sign');
  assert.ok(text(payload({})).includes('Иван Иванов'));
});

test('article 15 list depends on the basis of the organization', () => {
  assert.equal(Docs.art15Items('чл. 3, ал. 1').length, 17);
  assert.deepEqual(Docs.art15Items('чл. 3, ал. 2, т. 1').map(i => i[0]), [1, 4, 5, 6, 8, 11, 15, 16, 17]);
});

const textOf = (type, f) => flatten(Docs.pdfDefinition({ type, no: 'X-1', date: '2026-11-04', org, case: kase, f: Object.assign({}, fields, f), stats, items: [] }, 'data:image/png;base64,AA==').content);

test('forwarding letter to the other obligated entity names the body, the law and the attachments', () => {
  const t = textOf('forwardBody', {});
  assert.ok(t.includes('Орган') && t.includes('чл. 32, ал. 1') && t.includes('чл. 32, ал. 2'));
  assert.ok(t.includes('Приложения:') && t.includes('Заявление') && t.includes('Решение № 5'));
  assert.ok(!t.includes('1. Заявление'), 'номерацията не се удвоява');
  assert.ok(t.includes('се уведомява за препращането'));
  assert.ok(textOf('forwardBody', { notice: 'ИЗХ-7 от 03.11.2026 г.' }).includes('с писмо ИЗХ-7 от 03.11.2026 г.'));
});

test('cover letter refers to the document it accompanies, with or without a case', () => {
  const t = textOf('cover', { note: 'Бележка' });
  assert.ok(t.includes('Получател') && t.includes('„Решение“ № РЕШ-1') && t.includes('Приложения:') && t.includes('Бележка'));
  assert.ok(textOf('cover', { toName: kase.applicantName }).includes('Уважаеми/а'));
  const noCase = flatten(Docs.pdfDefinition({ type: 'cover', no: 'X', date: '2026-11-04', org, f: fields }, 'data:image/png;base64,AA==').content);
  assert.ok(noCase.includes('Получател') && !/undefined/.test(noCase));
});

test('internal forms address the department', () => {
  const r = textOf('internalRequest', { what: 'Договорите', by: '2026-11-20' });
  assert.ok(r.includes('Правен отдел') && r.includes('Анна Иванова') && r.includes('Договорите') && r.includes('20.11.2026'));
  assert.ok(textOf('internalReply', {}).includes('[   ] да'));
  assert.ok(textOf('internalNote', { text: 'Първи\n\nВтори' }).includes('Служител Тест'));
});

test('signature: a line for manual signing, a note instead of the line for electronic signing', () => {
  const LINE = '.........';
  const all = Object.keys(Docs.DEFS).filter(k => !['report', 'art15'].includes(k));
  for (const type of all) assert.ok(Docs.DEFS[type].fields.some(f => f.k === 'signMode'), type + ': няма избор на подпис');
  for (const type of ['forwardBody', 'grant', 'refuse', 'cover', 'internalRequest', 'internalNote', 'report']) {
    const manual = textOf(type, {}), electronic = textOf(type, { signMode: 'electronic' });
    assert.ok(manual.includes(LINE) && !manual.includes('електронен подпис'), type);
    assert.ok(electronic.includes('електронен подпис') && !electronic.includes(LINE), type);
  }
  const art = textOf('art15', { signMode: 'electronic' });
  assert.ok(art.includes('електронен подпис'));
  assert.ok(!textOf('art15', {}).includes(LINE));
  const proto = textOf('protocol', { signMode: 'electronic' });
  assert.ok(proto.includes('електронен подпис') && proto.includes(LINE), 'заявителят подписва протокола на ръка');
});

test('postal codes: known places, source and credit', () => {
  const pc = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../site/data/postcodes.json'), 'utf8'));
  assert.equal(pc.codes['68134'], '1000'); assert.equal(pc.codes['10135'], '9000'); assert.equal(pc.codes['56784'], '4000'); assert.equal(pc.codes['00084'], '9135');
  assert.ok(Object.keys(pc.codes).length > 5000);
  assert.ok(Object.values(pc.codes).every(c => /^\d{4}$/.test(c)));
  assert.ok(pc.source.includes('GeoNames'));
});

test('department reply: filled answers become text, the rest stays as lines for manual filling', () => {
  const blank = textOf('internalReply', {});
  assert.ok(blank.includes('[   ] да') && blank.includes('.'.repeat(60)));
  const filled = textOf('internalReply', { hasInfo: 'частично', protectedInfo: 'не', thirdAffected: 'да', location: 'Архив, стая 5', protectedBasis: 'няма', thirdWho: 'Фирма ООД', opinion: 'Първи абзац\n\nВтори абзац', replyDate: '2026-11-06', respondent: 'Гергана Колева', respondentPosition: 'Експерт', attachments: 'Договор № 5' });
  assert.ok(filled.includes('[ X ] частично') && filled.includes('[ X ] не') && filled.includes('[ X ] да'));
  assert.ok(filled.includes('Архив, стая 5') && filled.includes('Втори абзац') && filled.includes('Гергана Колева') && filled.includes('06.11.2026') && filled.includes('Договор № 5'));
  assert.ok(!filled.includes('.'.repeat(60)), 'няма празни редове');
  assert.ok(textOf('internalReply', { hasInfo: 'не' }).includes('Анна Иванова'), 'по подразбиране отговаря ръководителят');
});

test('cover letter works as a blank without a specific document', () => {
  const t = textOf('cover', { ofNo: '', ofTitle: '', ofDate: '' });
  assert.ok(t.includes('посочените по-долу документи') && t.includes('Приложения:'));
  assert.ok(!Docs.DEFS.cover.hidden, 'предлага се в избора на документ');
});

test('dossier contains the case data, history, files with checksums and the full documents', () => {
  const data = {
    case: Object.assign({}, kase, { kind: 'Достъп', status: 'Приключена', outcome: 'Отказ', due: '', decisionNo: 'РЕШ-1', decisionDate: '2026-11-05', ext30: '', thirdInvolved: false }),
    org, generatedAt: '2026-11-10T09:30:00', generatedBy: 'Мария Петрова', generatedPosition: 'Юрисконсулт',
    events: [{ at: '2026-11-02T10:00:00', user: 'mpetrova', kind: 'Създаване', text: 'Преписката е въведена.' }],
    docs: [
      { no: 'РЕШ-1', type: 'refuse', title: 'Отказ', date: '2026-11-05', author: 'mpetrova', payload: { type: 'refuse', no: 'РЕШ-1', date: '2026-11-05', org, case: kase, f: fields } },
      { no: 'ИЗХ-2', type: 'cover', title: 'Съпроводително писмо към № РЕШ-1', date: '2026-11-05', author: 'mpetrova', payload: null }
    ],
    courts: [{ caseNo: '1234', year: '2026', court: 'Административен съд – Варна', kind: 'Административно дело', status: 'Насрочено', nextHearing: '2026-12-10', note: '' }],
    files: [{ name: 'Жалба.pdf', size: 2048, at: '2026-11-06T08:00:00', by: 'mpetrova', sha256: 'abc123', courtNo: '' }]
  };
  const def = Docs.dossierDefinition(data, 'data:image/png;base64,AA==', {});
  const t = flatten(def.content);
  for (const part of ['ДОСИЕ НА ПРЕПИСКА', kase.regNo, 'Петър Петров', 'Договори', 'РЕШЕНИЕ № РЕШ-1', 'Преписката е въведена.', '1234/2026', 'abc123', 'Жалба.pdf', 'Мария Петрова', 'Приложение 1:', 'Съпроводително писмо към № РЕШ-1']) assert.ok(t.includes(part), part);
  assert.ok(!/undefined|\[object|NaN/.test(t), t.slice(0, 400));
  assert.ok(!t.includes('Приложение 2:'), 'документ без текст е само в списъка');
  assert.ok(def.content.some(n => n.toc), 'съдържание');
  assert.ok(def.content.some(n => n.pageBreak === 'before'));
  assert.ok(flatten(Docs.dossierDefinition(data, 'x', { signMode: 'electronic' }).content).includes('електронен подпис'));
  assert.equal(Docs.dossierFileName(data), 'Досие-ЗДОИ-2026-0001.pdf');
  const empty = flatten(Docs.dossierDefinition(Object.assign({}, data, { docs: [], events: [], courts: [], files: [] }), 'x', {}).content);
  assert.ok(empty.includes('Няма.') && !/undefined/.test(empty));
});

test('the browser and the server use the same cost norms and the same sum', () => {
  const g = load();
  assert.deepEqual(JSON.parse(JSON.stringify(g.t.COST_NORMS)), JSON.parse(JSON.stringify(Docs.COST_NORMS)));
  for (const items of [{}, { a4: 1 }, { a4: 100, tonerA4: 100 }, { a3: 7, tonerA3: 14, cd: 2, dvd47: 1, dvd85: 3, usb4: 1, usb8: 1, usb16: 1, usb32: 2 }]) {
    assert.deepEqual(JSON.parse(JSON.stringify(g.ctx.costsOf_(items))), Docs.costsOf(items));
  }
});

test('the published norms are exact (Наредба № Н-1, ДВ, бр. 22 от 2022 г.)', () => {
  const prices = Object.fromEntries(Object.entries(Docs.COST_NORMS).map(([k, n]) => [k, n[2]]));
  assert.deepEqual(prices, { a4: 1, a3: 2, tonerA4: 2, tonerA3: 4, cd: 26, dvd47: 30, dvd85: 67, usb4: 346, usb8: 572, usb16: 793, usb32: 947 });
});

test('a decision with costs names the sum and the payment data; without them it says nothing about payment', () => {
  const paid = { type: 'grant', no: 'РЕШ-1', date: '2026-11-05', case: kase, org: Object.assign({}, org, { payIban: 'BG80BNBG96611020345678', payBic: 'BNBGBGSD', payBank: 'БНБ', payCode: '448090', payCash: 'на касата' }), f: Object.assign({}, fields, { costs: 'Общо', costTotal: '1,67', accessDays: '30' }) };
  const text = flatten(Docs.pdfDefinition(paid, 'data:image/png;base64,AA==').content);
  for (const t of ['1,67 евро', 'BG80BNBG96611020345678', 'BNBGBGSD', 'БНБ', '448090', 'на касата', 'решение № РЕШ-1']) assert.ok(text.includes(t), t);
  const free = flatten(Docs.pdfDefinition(Object.assign({}, paid, { f: Object.assign({}, paid.f, { costTotal: undefined }) }), 'data:image/png;base64,AA==').content);
  assert.ok(!free.includes('BG80BNBG96611020345678'), 'без разходи няма банкови данни');
});
