/* Шаблоните: всеки документ се изгражда и формата съответства на изискванията на сървъра. */
const test = require('node:test'), assert = require('node:assert/strict');
const Docs = require('../site/js/docs.js');
const { load } = require('./mock-google');

const org = { name: 'Община Тест', basis: 'чл. 3, ал. 1', eik: '000696327', postcode: '1000', city: 'София', address: 'ул. 1', phone: '02', email: 'a@b.bg', web: 'https://a.bg', headName: 'Иван Иванов', headPosition: 'Кмет', unitName: 'Деловодство', unitAddress: 'ул. 1', unitEmail: 'z@b.bg', unitPhone: '02', unitHours: '9–17', court: 'Административен съд София-град' };
const kase = { regNo: 'ЗДОИ-2026-0001', regDate: '2026-11-02', applicantName: 'Петър Петров', applicantType: 'Гражданин', applicantAddress: 'ул. 2', subject: 'Договори', form: '' };
const fields = { what: 'x', days: '10', reason: 'x', third: 'Трето лице', thirdAddress: 'адрес', info: 'x', by: '2026-11-20', body: 'Орган', bodyAddress: 'адрес', ground: 'чл. 25, ал. 2', subjectLine: 'тема', text: 'текст', scope: 'пълен', accessDays: '30', place: 'място', accessForm: 'устна справка', costs: 'няма', withheld: 'част', groundKey: 't1', groundText: 'чл. 37, ал. 1, т. 1 ЗДОИ – основание', factual: 'факти', given: 'копия', employee: 'Служител', year: '2025' };
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

test('article 15 list depends on the basis of the organization', () => {
  assert.equal(Docs.art15Items('чл. 3, ал. 1').length, 17);
  assert.deepEqual(Docs.art15Items('чл. 3, ал. 2, т. 1').map(i => i[0]), [1, 4, 5, 6, 8, 11, 15, 16, 17]);
});
