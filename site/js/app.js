/* Платформа за задължените лица – интерфейс. Всички данни се вмъкват с textContent, без innerHTML. */
'use strict';

const API = window.PLATFORM_API;
const { DEFS, art15Items, ACCESS_FORMS, fmt } = window.Docs;
const OP_NO = '00000000';
const SUPPORT = 'support@platform.zdoi4you.eu';
const MAINTAINER = 'Услугите и платформата се поддържат от „БУЛАДМИН“ ЕООД.';
const REGISTRY_TR = 'https://portal.registryagency.bg/CR/bg/Reports/VerificationPersonOrg';
const REGISTRY_BULSTAT = 'https://reports.bulstat.bg/bulstat-ireports/report.jsf?x_rpt=rpt2';
const supportLink = () => h('a', { href: 'mailto:' + SUPPORT }, SUPPORT);

const ORG_TYPES = ['Община', 'Областна администрация', 'Министерство', 'Държавна агенция или комисия', 'Друга администрация', 'Публичноправна организация', 'Юридическо лице'];
const BASIS_BY_TYPE = { 'Публичноправна организация': 'чл. 3, ал. 2, т. 1', 'Юридическо лице': 'чл. 3, ал. 2, т. 2' };
const BASES = [
  ['чл. 3, ал. 1', 'чл. 3, ал. 1 – държавен орган, териториално звено или орган на местното самоуправление'],
  ['чл. 3, ал. 2, т. 1', 'чл. 3, ал. 2, т. 1 – публичноправен субект, включително публичноправна организация'],
  ['чл. 3, ал. 2, т. 2', 'чл. 3, ал. 2, т. 2 – лице с дейност, финансирана от консолидирания бюджет или фондове на ЕС']
];
const SEAT_FIELDS = [{ k: 'oblast', label: 'Област' }, { k: 'municipality', label: 'Община' }, { k: 'city', label: 'Населено място' }, { k: 'postcode', label: 'Пощенски код' }];
const ORG_SECTIONS = [
  ['Организация', [
    { k: 'name', label: 'Пълно официално наименование', req: true, full: true },
    { k: 'type', label: 'Вид', type: 'select', options: ORG_TYPES, req: true },
    { k: 'basis', label: 'Основание по ЗДОИ', type: 'select', options: BASES, req: true },
    { k: 'eik', label: 'ЕИК/БУЛСТАТ', req: true, pattern: '\\d{9}|\\d{13}', hint: '9 или 13 цифри.' },
    { k: 'headName', label: 'Ръководител – имена', req: true },
    { k: 'headPosition', label: 'Ръководител – длъжност', req: true, hint: 'Например: кмет, областен управител, управител.' }
  ]],
  ['Седалище и контакти', [
    { k: 'address', label: 'Адрес', type: 'address', seat: true, req: true },
    { k: 'phone', label: 'Телефон', req: true, type: 'tel' },
    { k: 'email', label: 'Официален имейл', req: true, type: 'email' },
    { k: 'web', label: 'Интернет страница', req: true, type: 'url', placeholder: 'https://' }
  ]],
  ['Звено за приемане на заявления (чл. 15, ал. 1, т. 4)', [
    { k: 'unitName', label: 'Наименование на звеното', req: true, full: true },
    { k: 'unitAddress', label: 'Адрес', type: 'address', req: true },
    { k: 'unitEmail', label: 'Имейл за заявления', req: true, type: 'email' },
    { k: 'unitPhone', label: 'Телефон', req: true, type: 'tel' },
    { k: 'unitHours', label: 'Работно време', req: true }
  ]]
];
const ADMIN_SECTION = ['Администратор на организационния профил', [
  { k: 'adminName', label: 'Имена', req: true },
  { k: 'adminPosition', label: 'Длъжност', req: true },
  { k: 'adminEmail', label: 'Служебен имейл', req: true, type: 'email', hint: 'На него идват номерът на организацията и известията.' },
  { k: 'adminPhone', label: 'Телефон', req: true, type: 'tel' },
  { k: 'adminUsername', label: 'Потребителско име', req: true, pattern: '[a-z0-9._\\-]{3,40}', autocomplete: 'username', hint: 'Малки латински букви, цифри и . _ -' },
  { k: 'password', label: 'Парола', type: 'password', req: true, autocomplete: 'new-password', hint: 'Поне 12 знака, с букви и цифри.' },
  { k: 'again', label: 'Повторете паролата', type: 'password', req: true, autocomplete: 'new-password' }
]];

const CASE_KIND = ['Достъп до обществена информация', 'Повторно използване на информация'];
const CASE_CHANNEL = ['Писмено', 'По имейл (чл. 15, ал. 1, т. 4)', 'Платформа за достъп (чл. 15в)', 'Устно запитване', 'Сигурно електронно връчване'];
const APPLICANT_TYPE = ['Гражданин', 'Юридическо лице', 'Журналист или медия', 'Неправителствена организация'];
const ADDRESSEE_TYPE = APPLICANT_TYPE.concat('Орган или друга организация');
const PLAN_STATUS = ['Подготвя се', 'Въведен'];
const CASE_STATUS = ['Нова', 'В обработка', 'Чака уточняване', 'Чака трето лице', 'Решение издадено', 'Приключена'];
const CASE_OUTCOME = [['', '—'], 'Предоставен достъп', 'Частичен достъп', 'Отказ', 'Препратено (чл. 32)', 'Няма информация (чл. 33)', 'Без разглеждане', 'Отказ на заявителя (чл. 36)'];
const SERVED_HOW = [['', '—'], 'Срещу подпис', 'С препоръчано писмо с обратна разписка', 'По имейл', 'Сигурно електронно връчване', 'Чрез платформата по чл. 15в'];

/* ---------- помощни ---------- */

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  });
  kids.flat(Infinity).forEach(c => { if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c)); });
  return el;
}
const $app = () => document.getElementById('app');
const setView = (...nodes) => { const v = document.getElementById('view') || $app(); v.replaceChildren(...nodes.flat(Infinity).filter(n => n !== null && n !== undefined && n !== false)); window.scrollTo(0, 0); };
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3500);
}
const fmtTime = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}` : (iso || '—'); };
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' });
const optionPair = o => (Array.isArray(o) ? o : [o, o]);

/* ---------- адреси от списък: ЕКАТТЕ на НСИ, а улици и квартали от OpenStreetMap, където има данни ---------- */

const memo = {};
const fetchJson = url => memo[url] || (memo[url] = fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { delete memo[url]; throw e; }));
let listSeq = 0;

/* разчита записан адрес, за да се възстанови изборът при редакция */
function parseAddress(text) {
  const out = { postcode: '', oblast: '', municipality: '', city: '', raion: '', quarter: '', street: '', rest: [] };
  String(text || '').split(/,\s*/).map(t => t.trim()).filter(Boolean).forEach(t => {
    let m;
    if ((m = /^п\.\s?к\.\s*(\d{4})$/.exec(t))) out.postcode = m[1];
    else if ((m = /^обл\.\s*(.+)$/.exec(t))) out.oblast = m[1];
    else if ((m = /^общ\.\s*(.+)$/.exec(t))) out.municipality = m[1];
    else if (/^(гр|с|ман)\.\s/.test(t)) out.city = t;
    else if ((m = /^р-н\s+(.+)$/.exec(t))) out.raion = m[1];
    else if (/^(ж\.?\s?к\.?|кв\.?|квартал)\s/i.test(t)) out.quarter = t;
    else if (/^(ул\.?|улица|бул\.?|булевард|пл\.?|площад|алея|шосе|път)\s/i.test(t)) out.street = t;
    else out.rest.push(t);
  });
  return out;
}

function addressField(def, value, seat, ctx) {
  const presetOblast = def.oblastName && ctx ? ctx[def.oblastName] : '';
  const oblastOut = def.oblastName ? h('input', { type: 'hidden', name: def.oblastName, value: presetOblast || '' }) : null;
  const placeholder = t => h('option', { value: '' }, t);
  const pick = (label, name) => {
    const select = h('select', { name: name || null, required: !!name && !!def.req, disabled: true, 'aria-label': label }, placeholder('Изберете…'));
    return { select, wrap: h('label', { class: 'field' }, h('span', null, label, name && def.req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), select) };
  };
  const oblast = pick('Област', seat ? 'oblast' : null), muni = pick('Община', seat ? 'municipality' : null), place = pick('Населено място', seat ? 'city' : null), raion = pick('Район');
  raion.wrap.hidden = true;
  const qList = h('datalist', { id: 'addr-q-' + (++listSeq) }), sList = h('datalist', { id: 'addr-s-' + listSeq });
  const quarter = h('input', { list: qList.id, 'aria-label': 'Ж.к. или квартал', autocomplete: 'off' });
  const street = h('input', { list: sList.id, 'aria-label': 'Улица или булевард', autocomplete: 'off' });
  const number = h('input', { 'aria-label': 'Номер, блок, вход, етаж, апартамент', placeholder: '№ 5, бл. 12, вх. А, ет. 3, ап. 8', autocomplete: 'off' });
  const postcode = h('input', { 'aria-label': 'Пощенски код', name: seat ? 'postcode' : null, required: !!seat && !!def.req, pattern: '\\d{4}', maxlength: 4, inputmode: 'numeric', autocomplete: 'off', placeholder: '1000' });
  if (seat) postcode.value = seat.postcode || '';
  const output = h('input', { name: def.k, required: !!def.req, maxlength: 300, autocomplete: 'off' });
  output.value = value || '';
  const initial = output.value, parsed = parseAddress(initial);
  quarter.value = parsed.quarter; street.value = parsed.street; number.value = parsed.rest.join(', ');
  if (!seat) postcode.value = parsed.postcode;
  const note = h('small', null, 'Селища и райони: НСИ, ЕКАТТЕ. Улици и квартали: © OpenStreetMap contributors. Ако липсват, напишете ги ръчно.');
  let data = null;

  const current = () => {
    if (!data) return {};
    const o = data.oblasts.find(x => x.n === oblast.select.value);
    const m = o && o.m.find(x => x.n === muni.select.value);
    const s = m && m.s.find(x => x.n === place.select.value);
    return { o, m, s };
  };
  const fillSelect = (sel, names, keep) => {
    sel.replaceChildren(placeholder('Изберете…'), ...names.map(n => h('option', { value: n }, n)));
    if (keep && !names.includes(keep)) sel.append(h('option', { value: keep }, keep));
    sel.value = keep || '';
    sel.disabled = !names.length && !keep;
  };
  const compose = () => {
    const { o, m, s } = current();
    const parts = [];
    if (!seat && /^\d{4}$/.test(postcode.value.trim())) parts.push(`п.к. ${postcode.value.trim()}`);
    if (!seat && s) parts.push(`обл. ${o.n}`, `общ. ${m.n}`, s.n);
    if (raion.select.value) parts.push(`р-н ${raion.select.value}`);
    const q = quarter.value.trim(), st = street.value.trim(), num = number.value.trim();
    if (q) parts.push(/^(ж\.?\s?к\.?|кв\.?|квартал)\s/i.test(q) ? q : `ж.к. ${q}`);
    if (st) parts.push(/^(ул\.?|улица|бул\.?|булевард|пл\.?|площад|алея|шосе|път)\s/i.test(st) ? st : `ул. ${st}`);
    if (num) parts.push(num);
    if (parts.length) output.value = parts.join(', ');
    checkComplete();
  };
  /* нов адрес за документи трябва да е пълен; вече записан и непроменен адрес не спира работата */
  const checkComplete = () => {
    const v = output.value.trim();
    let msg = '';
    if (!seat && data && v && output.value !== initial) {
      const p = parseAddress(v);
      if (!p.postcode || !p.oblast || !p.municipality || !p.city) msg = 'Изберете област, община и населено място и въведете пощенски код.';
    }
    output.setCustomValidity(msg);
    if (oblastOut && parseAddress(v).oblast) oblastOut.value = parseAddress(v).oblast;
  };
  output.addEventListener('input', checkComplete);
  const loadStreets = async s => {
    qList.replaceChildren(); sList.replaceChildren();
    if (!s) return;
    const index = await fetchJson('data/streets/index.json').catch(() => []);
    if (!index.includes(s.e)) return;
    const d = await fetchJson(`data/streets/${s.e}.json`).catch(() => null);
    if (!d || current().s !== s) return;
    qList.replaceChildren(...d.quarters.map(n => h('option', { value: n })));
    sList.replaceChildren(...d.streets.map(n => h('option', { value: n })));
  };
  const onPlace = () => {
    const { s } = current();
    const list = (s && data.raions[s.e]) || [];
    fillSelect(raion.select, list, list.includes(parsed.raion) ? parsed.raion : undefined);
    raion.wrap.hidden = !list.length;
    loadStreets(s);
  };
  const onMuni = keep => { const { m } = current(); fillSelect(place.select, m ? m.s.map(x => x.n) : [], keep); onPlace(); };
  const onOblast = (keepM, keepP) => { const { o } = current(); fillSelect(muni.select, o ? o.m.map(x => x.n) : [], keepM); onMuni(keepP); };
  oblast.select.addEventListener('change', () => { if (oblastOut) oblastOut.value = oblast.select.value; onOblast(); compose(); });
  muni.select.addEventListener('change', () => { onMuni(); compose(); });
  place.select.addEventListener('change', () => { onPlace(); compose(); });
  raion.select.addEventListener('change', compose);
  [quarter, street, number, postcode].forEach(el => el.addEventListener('input', compose));

  fetchJson('data/places.json').then(d => {
    data = d;
    const keep = seat || { oblast: parsed.oblast || presetOblast, municipality: parsed.municipality, city: parsed.city };
    fillSelect(oblast.select, d.oblasts.map(x => x.n), keep.oblast);
    oblast.select.disabled = false;
    onOblast(keep.municipality, keep.city);
  }).catch(() => {
    // без списък формата остава годна: полетата за седалище стават текстови
    [oblast, muni, place].forEach((p, i) => {
      if (!seat) { p.wrap.hidden = true; return; }
      const k = ['oblast', 'municipality', 'city'][i];
      p.select.replaceWith(h('input', { name: k, required: !!def.req, value: seat[k] || '' }));
    });
    raion.wrap.hidden = true;
    note.textContent = 'Списъкът не можа да се зареди. Попълнете адреса ръчно.';
  });

  return h('div', { class: 'addr full field' },
    h('div', { class: 'addr-title' }, def.label, def.req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
    oblastOut,
    h('div', { class: 'form-grid' }, oblast.wrap, muni.wrap, place.wrap, raion.wrap,
      h('label', { class: 'field' }, h('span', null, 'Пощенски код', seat && def.req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), postcode),
      h('label', { class: 'field' }, h('span', null, 'Ж.к. или квартал'), quarter, qList),
      h('label', { class: 'field' }, h('span', null, 'Улица или булевард'), street, sList),
      h('label', { class: 'field' }, h('span', null, 'Номер, блок, вход'), number)),
    h('label', { class: 'field' }, h('span', null, seat ? 'Улица, номер и останалото (областта, общината, селището и п.к. се добавят в документите)' : 'Пълен адрес (така излиза в документите)'), output, note));
}

function fieldEl(def, value, ctx) {
  if (def.type === 'address') return addressField(def, value, def.seat ? (ctx || {}) : null, ctx);
  const name = def.k, req = !!def.req;
  let input;
  if (def.type === 'select') {
    const hasEmpty = (def.options || []).some(x => optionPair(x)[0] === '');
    input = h('select', { name, required: req }, hasEmpty ? null : h('option', { value: '' }, 'Изберете…'), (def.options || []).map(o => { const [v, l] = optionPair(o); return h('option', { value: v }, l); }));
    input.value = value === undefined || value === null ? '' : value;
  } else if (def.type === 'textarea') {
    input = h('textarea', { name, required: req, rows: def.rows || 4, maxlength: 8000 });
    input.value = value || '';
  } else {
    input = h('input', { name, type: def.type || 'text', required: req, pattern: def.pattern, placeholder: def.placeholder, min: def.min, max: def.max, readonly: def.readonly, autocomplete: def.autocomplete || 'off', inputmode: def.inputmode });
    input.value = value === undefined || value === null ? '' : value;
  }
  return h('label', { class: 'field' + (def.full || def.type === 'textarea' ? ' full' : '') },
    h('span', null, def.label, req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), input, def.hint ? h('small', null, def.hint) : null, def.eik ? registryLinks() : null);
}
const externalLink = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
const registryLinks = () => h('small', null, 'Справка: ', externalLink(REGISTRY_TR, 'Търговски регистър и ЮЛНЦ'), ' · ', externalLink(REGISTRY_BULSTAT, 'БУЛСТАТ'));
/* полето за ЕИК или БУЛСТАТ не се показва за граждани */
function bindEik(form, typeName, eikName) {
  const type = form.querySelector('[name="' + typeName + '"]'), eik = form.querySelector('[name="' + eikName + '"]');
  const sync = () => {
    const citizen = type.value === 'Гражданин';
    eik.closest('.field').hidden = citizen;
    if (citizen) eik.value = '';
  };
  type.addEventListener('change', sync);
  sync();
}
const formData = form => Object.fromEntries(new FormData(form).entries());

/* изпраща форма с индикация и грешка на място */
function submitter(form, fn) {
  const box = h('div', { class: 'err', role: 'alert', hidden: true });
  form.append(box);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    box.hidden = true;
    const btns = form.querySelectorAll('button[type=submit]');
    btns.forEach(b => { b.disabled = true; });
    try { await fn(formData(form)); }
    catch (e) { box.textContent = e.message; box.hidden = false; box.scrollIntoView({ block: 'nearest' }); }
    finally { btns.forEach(b => { b.disabled = false; }); }
  });
  return form;
}

/* ---------- API и сесия ---------- */

let session = null; // { token, me, exp, skew }
try { session = JSON.parse(sessionStorage.getItem('session')); } catch (e) { session = null; }
const saveSession = () => { try { if (session) sessionStorage.setItem('session', JSON.stringify(session)); else sessionStorage.removeItem('session'); } catch (e) {} };

/* Apps Script не вижда адреса на посетителя, затова браузърът го взема от Cloudflare на същия адрес */
let ipMemo;
function clientIp() {
  if (!ipMemo) {
    ipMemo = Promise.race([
      fetch('/cdn-cgi/trace').then(r => (r.ok ? r.text() : '')).then(t => (/^ip=(.+)$/m.exec(t) || [])[1] || ''),
      new Promise(ok => setTimeout(() => ok(''), 1500))
    ]).catch(() => '');
  }
  return ipMemo;
}

async function api(action, data) {
  if (!API) throw new Error('Платформата още не е свързана със сървъра.');
  let res;
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, data: data || {}, token: session && session.token }) });
    res = await r.json();
  } catch (e) { throw new Error('Няма връзка със сървъра. Проверете интернет връзката и опитайте отново.'); }
  if (res.ok) return res;
  if (res.error === 'session' && session) { endSession(res.message); throw new Error(res.message); }
  throw Object.assign(new Error(res.message || 'Възникна грешка.'), { code: res.error });
}

function endSession(msg) {
  session = null; saveSession(); clearInterval(timerId); closeSessionDialog();
  Store.boot = null;
  location.hash = '#/login';
  route();
  if (msg) toast(msg);
}

/* PBKDF2 в браузъра: паролата не напуска устройството */
async function preHash(no, username, password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600000, salt: enc.encode(`zdoi-platform:v1:${no}:${username}`) }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
/* осемцифрен номер: 7 случайни цифри и контролна (Luhn); сървърът проверява дали е свободен */
function newOrgNumber() {
  const r = crypto.getRandomValues(new Uint32Array(1))[0];
  const base = String(1000000 + r % 9000000);
  let sum = 0;
  [...base].reverse().forEach((c, i) => {
    let x = Number(c);
    if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9; }
    sum += x;
  });
  return base + String((10 - sum % 10) % 10);
}
/* нов номер за заявка или добавяне; при зает номер се опитва с друг */
async function withNewNumber(username, password, send) {
  for (let i = 0; ; i++) {
    const no = newOrgNumber();
    try {
      return { no, res: await send(no, await preHash(no, username, password)) };
    } catch (e) {
      if (e.code !== 'retry' || i >= 4) throw e;
    }
  }
}
function checkPassword(p, again) {
  if (p.length < 12) throw new Error('Паролата трябва да е поне 12 знака.');
  if (!/\p{L}/u.test(p) || !/\d/.test(p)) throw new Error('Паролата трябва да съдържа букви и цифри.');
  if (again !== undefined && p !== again) throw new Error('Двете пароли не съвпадат.');
}

let timerId, sessionDialog;
function startTimer() {
  clearInterval(timerId);
  const tick = () => {
    const el = document.getElementById('timer');
    if (!session) return;
    const left = session.exp - Date.now();
    if (left <= 0) { api('logout').catch(() => {}); endSession('Сесията изтече. Влезте отново.'); return; }
    const m = Math.floor(left / 6e4), s = Math.floor(left / 1000) % 60;
    if (el) { el.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`; el.classList.toggle('warn', left < 12e4); }
    if (left < 12e4) openSessionDialog();
  };
  tick();
  timerId = setInterval(tick, 1000);
}
async function extendSession() {
  const r = await api('extend');
  session.exp = r.session; saveSession();
  closeSessionDialog();
  toast('Сесията е удължена с 30 минути.');
}
function openSessionDialog() {
  if (sessionDialog) return;
  sessionDialog = h('dialog', null, h('h2', null, 'Сесията изтича след по-малко от 2 минути'),
    h('p', null, 'Искате ли да продължите работа? Незаписаните данни ще се загубят при изход.'),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: logout }, 'Изход'),
      h('button', { class: 'btn primary', onclick: () => extendSession().catch(e => toast(e.message)) }, 'Удължи с 30 минути')));
  document.body.append(sessionDialog);
  sessionDialog.showModal();
}
function closeSessionDialog() { if (sessionDialog) { sessionDialog.close(); sessionDialog.remove(); sessionDialog = null; } }
async function logout() {
  try { await api('logout'); } catch (e) { /* сесията се прекратява и локално */ }
  endSession('Излязохте от платформата.');
}

/* ---------- PDF ---------- */

let pdfReady;
function loadScript(src) {
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Библиотеката за PDF не се зареди.')); document.head.append(s); });
}
function pdfLib() {
  if (!pdfReady) {
    pdfReady = (async () => {
      await loadScript('vendor/pdfmake.min.js');
      await loadScript('vendor/vfs_fonts.js');
      const blob = await (await fetch('assets/logo-pdf.png')).blob();
      return new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(blob); });
    })();
    pdfReady.catch(() => { pdfReady = null; });
  }
  return pdfReady;
}
async function downloadPdf(payload) {
  const logo = await pdfLib();
  window.pdfMake.createPdf(window.Docs.pdfDefinition(payload, logo)).download(window.Docs.fileName(payload));
}

const can = p => !!(session && session.me.perms && session.me.perms[p]);

/* ---------- обща рамка ---------- */

function themePicker() {
  const cur = document.documentElement.getAttribute('data-theme');
  const sel = h('select', { class: 'theme', 'aria-label': 'Тема', onchange: e => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    try { localStorage.setItem('theme', e.target.value); } catch (err) {}
  } }, h('option', { value: 'light' }, 'Бяла тема'), h('option', { value: 'dark' }, 'Тъмна тема'), h('option', { value: 'blue' }, 'Синя тема'));
  sel.value = cur;
  return sel;
}
const logoEl = mini => h('span', { class: 'logo-plate' + (mini ? ' mini' : '') }, h('img', { src: 'assets/logo-site.png', alt: 'ЗДОИ4You' }));

function gate(card, wide) {
  $app().replaceChildren(h('div', { class: 'gate' }, h('a', { href: '#/home', 'aria-label': 'Начална страница' }, logoEl(false)), h('div', { class: 'card gate-card' + (wide ? ' wide' : '') }, card), h('div', { class: 'gate-foot' }, themePicker(), h('a', { href: 'https://zdoi4you.eu', rel: 'noopener' }, 'zdoi4you.eu'), h('span', null, 'Поддръжка: ', supportLink())), h('p', { class: 'small muted gate-maint' }, MAINTAINER)));
  window.scrollTo(0, 0);
}

function shell() {
  const me = session.me;
  const tabs = me.operator
    ? [['#/op/apps', 'Заявки за регистрация'], ['#/op/changes', 'Заявки за промяна'], ['#/op/orgs', 'Организации'], ['#/op/addressees', 'Адресати'], ['#/op/plans', 'Планове'], ['#/op/log', 'Дневник'], ['#/me', 'Моят профил']]
    : [['#/', 'Табло'], ['#/cases', 'Преписки'], ['#/space', 'Дела и файлове'], ['#/addressees', 'Адресати'], ['#/docs', 'Документи']]
      .concat(can('reports') ? [['#/reports', 'Отчети']] : [], [['#/art15', 'Чл. 15'], ['#/org', 'Организация']])
      .concat(me.role === 'Администратор' ? [['#/users', 'Потребители'], ['#/logins', 'Входове']] : [], can('log') ? [['#/log', 'Дневник']] : [], [['#/me', 'Моят профил']]);
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Основно меню' }, tabs.map(([href, label]) => h('a', { href }, label)));
  $app().replaceChildren(
    h('header', { class: 'top' }, h('div', { class: 'bar' },
      h('a', { class: 'brand', href: me.operator ? '#/op/apps' : '#/', 'aria-label': 'Начало' }, logoEl(true)), nav,
      h('div', { class: 'user' },
        h('span', { class: 'who' }, h('b', null, me.name || me.username), h('br'), h('span', { class: 'muted' }, `${me.role} · ${me.org}`)),
        h('span', { id: 'timer', class: 'timer', title: 'Оставащо време на сесията' }),
        h('button', { class: 'btn sm', onclick: () => extendSession().catch(e => toast(e.message)) }, 'Удължи'),
        themePicker(),
        h('button', { class: 'btn sm', onclick: logout }, 'Изход')))),
    h('main', { id: 'view' }, h('p', { class: 'loading' }, 'Зареждане…')),
    h('footer', { class: 'app-foot small muted' }, MAINTAINER, ' Поддръжка: ', supportLink()));
  startTimer();
}
function markTab() {
  const cur = location.hash || '#/';
  document.querySelectorAll('nav.tabs a').forEach(a => {
    const href = a.getAttribute('href');
    const on = href === '#/' ? cur === '#/' : cur === href || cur.startsWith(href + '/') || (href === '#/cases' && (cur.startsWith('#/case/') || cur === '#/new')) || (href === '#/space' && cur.startsWith('#/court/')) || (href === '#/op/orgs' && (cur.startsWith('#/op/org/') || cur === '#/op/new'));
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
const Store = { boot: null };
async function boot() {
  if (!Store.boot) {
    Store.boot = await api('org.bootstrap');
    session.me.perms = Store.boot.me.perms; // правата може да са променени след входа
    saveSession();
  }
  return Store.boot;
}

/* ---------- публични страници ---------- */

/* 404 за грешен вътрешен път; същият вид има и site/404.html */
function notFoundBody() {
  return h('div', { class: 'nf' },
    h('p', { class: 'nf-code', 'aria-hidden': 'true' }, '404'),
    h('h1', null, 'Страницата не е намерена'),
    h('p', { class: 'muted' }, 'Адресът е грешен или страницата вече не съществува.'),
    h('div', { class: 'actions nf-actions' },
      h('a', { class: 'btn primary', href: session ? (session.me.operator ? '#/op/apps' : '#/') : '#/login' }, session ? 'Към платформата' : 'Вход'),
      h('a', { class: 'btn', href: '#/home' }, 'Начална страница')));
}
function viewNotFound() {
  $app().replaceChildren(h('div', { class: 'nf-page' }, h('a', { href: '#/home', 'aria-label': 'Начална страница' }, logoEl(false)), notFoundBody(),
    h('p', { class: 'small muted nf-foot' }, 'Поддръжка: ', supportLink())));
  window.scrollTo(0, 0);
}

function viewLogin(prefill) {
  const no = (prefill && prefill.no) || '', username = (prefill && prefill.username) || '';
  const applyLink = h('a', { href: '#/apply' }, 'Регистрация на организация');
  api('public.config').then(c => { if (!c.applyOpen) applyLink.remove(); }).catch(() => {});
  const form = h('form', { novalidate: false },
    h('div', { class: 'stack' },
      fieldEl({ k: 'no', label: 'Номер на организацията', req: true, pattern: '\\d{8}', inputmode: 'numeric', autocomplete: 'organization', hint: 'Осемцифреният номер, получен по имейл.' }, no),
      fieldEl({ k: 'username', label: 'Потребителско име', req: true, autocomplete: 'username' }, username),
      fieldEl({ k: 'password', label: 'Парола', type: 'password', req: true, autocomplete: 'current-password' })),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Вход'));
  submitter(form, async d => {
    const user = d.username.trim().toLowerCase(), num = d.no.trim();
    const r = await api('login', { no: num, username: user, hash: await preHash(num, user, d.password), ip: await clientIp(), agent: navigator.userAgent });
    session = { token: r.token, me: r.me, exp: r.session };
    saveSession();
    location.hash = r.me.operator ? '#/op/apps' : '#/';
    route();
  });
  gate([
    h('h1', null, 'Вход в платформата'),
    h('p', { class: 'muted' }, 'Платформа за задължените лица по ЗДОИ'),
    form,
    h('div', { class: 'gate-links' }, h('a', { href: '#/home' }, 'Начална страница'), h('a', { href: '#/forgot' }, 'Забравена парола'), applyLink)
  ]);
}

function viewForgot() {
  const form = h('form', null,
    h('div', { class: 'stack' },
      fieldEl({ k: 'no', label: 'Номер на организацията', req: true, pattern: '\\d{8}', inputmode: 'numeric' }),
      fieldEl({ k: 'username', label: 'Потребителско име', req: true, autocomplete: 'username' })),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Изпрати връзка за нова парола'));
  submitter(form, async d => {
    await api('forgot', { no: d.no.trim(), username: d.username.trim().toLowerCase(), ip: await clientIp() });
    gate([
      h('h1', null, 'Проверете имейла си'),
      h('p', { class: 'muted' }, 'Ако данните са верни, на служебния ви имейл ще получите еднократна връзка за нова парола. Тя важи 2 часа.'),
      h('div', { class: 'gate-links' }, h('a', { href: '#/login' }, 'Към входа'))
    ]);
  });
  gate([
    h('h1', null, 'Забравена парола'),
    h('p', { class: 'muted' }, 'Ще получите еднократна връзка на служебния си имейл.'),
    form,
    h('p', { class: 'small muted forgot-note' }, 'Загубили сте номера на организацията? Администраторът го вижда в „Организация“ или пишете на ', supportLink(), '. Не изпращайте пароли на този адрес.'),
    h('div', { class: 'gate-links' }, h('a', { href: '#/login' }, 'Към входа'))
  ]);
}

function viewActivate(no, username, token) {
  const form = h('form', null,
    h('dl', { class: 'kv' }, h('dt', null, 'Номер на организацията'), h('dd', { class: 'mono' }, no), h('dt', null, 'Потребител'), h('dd', null, username)),
    h('div', { class: 'stack' },
      h('input', { class: 'hidden-field', type: 'text', name: 'u', value: username, autocomplete: 'username', tabindex: '-1', 'aria-hidden': 'true' }),
      fieldEl({ k: 'password', label: 'Нова парола', type: 'password', req: true, autocomplete: 'new-password', hint: 'Поне 12 знака, с букви и цифри.' }),
      fieldEl({ k: 'again', label: 'Повторете паролата', type: 'password', req: true, autocomplete: 'new-password' })),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Задай парола'));
  submitter(form, async d => {
    checkPassword(d.password, d.again);
    await api('activate', { no, username, token, hash: await preHash(no, username, d.password) });
    history.replaceState(null, '', '#/login');
    viewLogin({ no, username });
    toast('Паролата е зададена. Влезте с нея.');
  });
  gate([h('h1', null, 'Задаване на парола'), h('p', { class: 'muted' }, 'Паролата се използва само за вход в платформата.'), form]);
}

async function viewApply() {
  gate(h('p', { class: 'loading' }, 'Зареждане…'));
  const config = await api('public.config').catch(() => ({ applyOpen: true })); // сървърът така или иначе проверява при подаване
  if ((location.hash || '').slice(0, 7) !== '#/apply') return;
  if (!config.applyOpen) {
    gate([
      h('h1', null, 'Заявките за регистрация са спрени'),
      h('p', { class: 'muted' }, 'В момента не приемаме нови заявки. За въпроси пишете на ', supportLink(), '.'),
      h('div', { class: 'gate-links' }, h('a', { href: '#/login' }, 'Към входа'))
    ]);
    return;
  }
  const sections = [...ORG_SECTIONS, ADMIN_SECTION].map(([title, fields]) =>
    h('fieldset', null, h('legend', null, title), h('div', { class: 'form-grid' }, fields.map(f => fieldEl(f)))));
  const form = h('form', null, sections,
    h('div', { class: 'hidden-field', 'aria-hidden': 'true' }, h('label', null, 'Не попълвайте', h('input', { name: 'hp', tabindex: '-1', autocomplete: 'off' }))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'declare', required: true }),
      h('span', null, 'Декларирам, че съм упълномощен/а да подам заявката от името на организацията, че данните са верни и че посоченото лице е определено за администратор на организационния профил.')),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Подай заявка за регистрация'));
  form.querySelector('[name=type]').addEventListener('change', e => {
    form.querySelector('[name=basis]').value = BASIS_BY_TYPE[e.target.value] || 'чл. 3, ал. 1';
  });
  submitter(form, async d => {
    checkPassword(d.password, d.again);
    const { password, again, ...data } = d;
    data.declare = d.declare === 'on';
    const username = String(d.adminUsername).trim().toLowerCase();
    const { no, res: r } = await withNewNumber(username, password, (num, hash) => api('public.apply', Object.assign({}, data, { no: num, hash })));
    gate([
      h('h1', null, 'Заявката е подадена'),
      h('p', { class: 'muted' }, `Номер на заявката: ${r.id}`), h('br'),
      h('dl', { class: 'kv' }, h('dt', null, 'Номер на организацията'), h('dd', { class: 'bigdue', id: 'org-no' }, no), h('dt', null, 'Потребителско име'), h('dd', { class: 'mono' }, username)), h('br'),
      h('p', { class: 'muted' }, 'Ще можете да влезете с тези данни и избраната парола след одобрение от екипа на ЗДОИ4You. След одобрение администраторът получава номера и по имейл.'),
      h('div', { class: 'gate-links' }, h('a', { href: '#/login' }, 'Към входа'))
    ]);
  });
  gate([h('h1', null, 'Заявка за регистрация'), h('p', { class: 'muted' }, 'За общини, администрации и юридически лица – задължени субекти по ЗДОИ. Всички полета са задължителни. Достъпът се открива след одобрение от екипа на ЗДОИ4You.'), form, h('div', { class: 'gate-links' }, h('a', { href: '#/login' }, 'Вече имате профил? Вход'))], true);
}

/* ---------- табло и преписки ---------- */

function duePill(c) {
  if (c.daysLeft === null || c.daysLeft === undefined) return h('span', { class: 'muted' }, '—');
  const cls = c.daysLeft < 0 ? 'bad' : c.daysLeft <= 3 ? 'warn' : 'info';
  const txt = c.daysLeft < 0 ? `просрочена с ${-c.daysLeft} дни` : c.daysLeft === 0 ? 'изтича днес' : `остават ${c.daysLeft} дни`;
  return h('span', { class: 'pill ' + cls }, txt);
}
/* срок по чл. 31: дата и оставащи дни; след изпълнение показва какво е направено */
function thirdRow(label, due, doneText, days) {
  return h('div', { class: 'doc-row' },
    h('div', null, h('div', { class: 'small' }, label), h('div', { class: 'mono' }, fmt(due))),
    doneText ? h('span', { class: 'pill ok' }, doneText) : duePill({ daysLeft: days }));
}
function statusPill(s) {
  const cls = s === 'Приключена' ? 'ok' : s === 'Нова' ? 'info' : s === 'Чака уточняване' || s === 'Чака трето лице' ? 'warn' : '';
  return h('span', { class: 'pill ' + cls }, s);
}
function caseTable(rows) {
  if (!rows.length) return h('p', { class: 'muted' }, 'Няма преписки.');
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, ['Рег. №', 'Дата', 'Заявител', 'Искана информация', 'Статус', 'Срок', 'Отговорник'].map(t => h('th', null, t)))),
    h('tbody', null, rows.map(c => h('tr', { class: 'link', onclick: () => { location.hash = '#/case/' + encodeURIComponent(c.regNo); } },
      h('td', { class: 'mono' }, h('a', { href: '#/case/' + encodeURIComponent(c.regNo) }, c.regNo)),
      h('td', { class: 'mono' }, fmt(c.regDate)),
      h('td', null, c.applicantName),
      h('td', null, h('div', { class: 'subject' }, c.subject)),
      h('td', null, statusPill(c.status), c.outcome ? h('div', { class: 'small muted' }, c.outcome) : null),
      h('td', null, c.due ? h('div', { class: 'mono small' }, fmt(c.due)) : null, duePill(c),
        c.thirdInvolved ? h('div', { class: 'small muted' }, c.thirdAsked ? (c.thirdGot ? 'Трето лице: отговорило' : `Трето лице: отговор до ${fmt(c.thirdReplyBy)}`) : `Трето лице: искане до ${fmt(c.thirdBy)}`) : null),
      h('td', null, c.owner || '—'))))));
}

async function viewDash() {
  const [b, list] = await Promise.all([boot(), api('case.list')]);
  const rows = list.cases, year = todayIso().slice(0, 4);
  const open = rows.filter(c => c.due);
  const late = open.filter(c => c.daysLeft < 0), soon = open.filter(c => c.daysLeft >= 0 && c.daysLeft <= 3);
  const tile = (n, label, cls, href) => h('a', { class: 'card tile ' + (cls || ''), href }, h('b', null, n), h('span', { class: 'muted small' }, label));
  setView(
    h('div', { class: 'head' }, h('div', null, h('h1', null, b.profile.name), h('p', { class: 'muted small' }, `Номер на организацията: ${b.me.no}`)),
      can('casesEdit') ? h('a', { class: 'btn primary', href: '#/new' }, '+ Нова преписка') : null),
    h('div', { class: 'tiles' },
      tile(open.length, 'Активни преписки', '', '#/cases'),
      tile(late.length, 'С изтекъл срок', late.length ? 'bad' : '', '#/cases'),
      tile(soon.length, 'Изтичат до 3 дни', soon.length ? 'warn' : '', '#/cases'),
      tile(rows.filter(c => c.regDate.startsWith(year)).length, `Заявления през ${year} г.`, '', can('reports') ? '#/reports' : '#/cases')),
    h('div', { class: 'card' }, h('h2', null, 'Най-близки срокове'), h('div', { class: 'small muted' }, 'Срокът, който изтича в неработен ден, се мести на следващия работен.'), h('br'),
      caseTable(open.slice().sort((a, c) => a.daysLeft - c.daysLeft).slice(0, 10))));
}

async function viewCases() {
  const { cases } = await api('case.list');
  const q = h('input', { type: 'search', placeholder: 'Търсене по номер, заявител или текст', 'aria-label': 'Търсене' });
  const st = h('select', { 'aria-label': 'Статус' }, h('option', { value: '' }, 'Всички статуси'), CASE_STATUS.map(s => h('option', { value: s }, s)));
  const yr = h('select', { 'aria-label': 'Година' }, h('option', { value: '' }, 'Всички години'), [...new Set(cases.map(c => c.regDate.slice(0, 4)))].sort().reverse().map(y => h('option', { value: y }, y)));
  const box = h('div');
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    box.replaceChildren(caseTable(cases.filter(c => (!st.value || c.status === st.value) && (!yr.value || c.regDate.startsWith(yr.value)) && (!t || [c.regNo, c.applicantName, c.subject].join(' ').toLowerCase().includes(t)))));
  };
  [q, st, yr].forEach(el => el.addEventListener('input', draw));
  draw();
  setView(h('div', { class: 'head' }, h('h1', null, 'Преписки по ЗДОИ'), can('casesEdit') ? h('a', { class: 'btn primary', href: '#/new' }, '+ Нова преписка') : null),
    h('div', { class: 'card' }, h('div', { class: 'filters' }, q, st, yr), box));
}

function caseFields(users) {
  const owners = [['', '—']].concat(users.map(u => [u.username, u.name || u.username]));
  return {
    main: [
      { k: 'kind', label: 'Вид заявление', type: 'select', options: CASE_KIND, req: true },
      { k: 'regDate', label: 'Дата на регистриране', type: 'date', req: true, hint: 'От нея тече срокът по чл. 28, ал. 1.' },
      { k: 'channel', label: 'Начин на подаване', type: 'select', options: CASE_CHANNEL, req: true },
      { k: 'owner', label: 'Отговорник', type: 'select', options: owners }
    ],
    applicant: [
      { k: 'applicantType', label: 'Вид заявител', type: 'select', options: APPLICANT_TYPE, req: true },
      { k: 'applicantName', label: 'Три имена или наименование', req: true },
      { k: 'applicantEik', label: 'ЕИК или БУЛСТАТ', pattern: '\\d{9}|\\d{13}', eik: true },
      { k: 'applicantSeat', label: 'Седалище (за юридически лица)' },
      { k: 'applicantAddress', label: 'Адрес за кореспонденция (адрес или имейл е задължителен, чл. 25, ал. 1, т. 4). По него се определя съдът в решенията.', type: 'address', oblastName: 'applicantOblast' },
      { k: 'applicantEmail', label: 'Имейл', type: 'email' },
      { k: 'applicantPhone', label: 'Телефон', type: 'tel' }
    ],
    request: [
      { k: 'subject', label: 'Описание на исканата информация', type: 'textarea', req: true, rows: 5 },
      { k: 'form', label: 'Предпочитана форма (чл. 26)', type: 'select', options: [['', '—']].concat(ACCESS_FORMS), full: true },
      { k: 'noPublish', label: 'Заявителят отказва публикуване на платформата (чл. 25, ал. 1, т. 5)', type: 'select', options: ['Не', 'Да'] }
    ]
  };
}

async function viewNew() {
  const b = await boot(), F = caseFields(b.users);
  const form = h('form', { class: 'card' },
    h('fieldset', null, h('legend', null, 'Регистриране'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'regNo', label: 'Рег. № (по желание)', hint: 'Ако водите собствен регистър. Иначе номерът се създава автоматично.' }),
      F.main.map(f => fieldEl(f, { regDate: todayIso(), kind: CASE_KIND[0], channel: CASE_CHANNEL[0], owner: b.me.username }[f.k])))),
    h('fieldset', null, h('legend', null, 'Заявител'), h('div', { class: 'form-grid' },
      addresseePicker(b.addressees, a => {
        const set = { applicantType: APPLICANT_TYPE.includes(a.type) ? a.type : 'Юридическо лице', applicantName: a.name, applicantSeat: a.seat, applicantEmail: a.email, applicantPhone: a.phone, applicantEik: a.eik };
        Object.entries(set).forEach(([k, v]) => { form.querySelector('[name="' + k + '"]').value = v || ''; });
        form.querySelector('[name=applicantType]').dispatchEvent(new Event('change'));
        replaceAddress(form, F.applicant.find(f => f.k === 'applicantAddress'), a.address, { applicantOblast: a.oblast });
      }),
      F.applicant.map(f => fieldEl(f, f.k === 'applicantType' ? APPLICANT_TYPE[0] : '')),
      h('label', { class: 'check full' }, h('input', { type: 'checkbox', name: 'saveAddressee' }), h('span', null, 'Запази заявителя в адресатите')))),
    h('fieldset', null, h('legend', null, 'Заявление'), h('div', { class: 'form-grid' }, F.request.map(f => fieldEl(f, f.k === 'noPublish' ? 'Не' : '')))),
    h('button', { class: 'btn primary', type: 'submit' }, 'Създай преписка'));
  bindEik(form, 'applicantType', 'applicantEik');
  submitter(form, async d => {
    const r = await api('case.create', d);
    Store.boot = null;
    toast(`Преписка ${r.regNo} е създадена.`);
    location.hash = '#/case/' + encodeURIComponent(r.regNo);
  });
  setView(h('div', { class: 'head' }, h('h1', null, 'Нова преписка')), form);
}

async function viewCase(regNo) {
  const [b, r] = await Promise.all([boot(), api('case.get', { regNo })]);
  const c = r.case, F = caseFields(b.users);
  const form = h('form', { class: 'card' },
    h('fieldset', null, h('legend', null, 'Статус и резултат'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'status', label: 'Статус', type: 'select', options: CASE_STATUS, req: true }, c.status),
      fieldEl({ k: 'outcome', label: 'Резултат', type: 'select', options: CASE_OUTCOME }, c.outcome),
      F.main.map(f => fieldEl(f, c[f.k])))),
    h('fieldset', null, h('legend', null, 'Заявител'), h('div', { class: 'form-grid' }, F.applicant.map(f => fieldEl(f, c[f.k], c)))),
    h('fieldset', null, h('legend', null, 'Заявление'), h('div', { class: 'form-grid' }, F.request.map(f => fieldEl(f, f.k === 'noPublish' ? (c.noPublish || 'Не') : c[f.k])))),
    h('fieldset', null, h('legend', null, 'Срокове и движение'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'clarifyAsked', label: 'Поискано уточняване (чл. 29)', type: 'date' }, c.clarifyAsked),
      fieldEl({ k: 'clarifyGot', label: 'Получено уточняване', type: 'date', hint: 'Срокът от 14 дни тече от тази дата.' }, c.clarifyGot),
      fieldEl({ k: 'ext30', label: 'Удължаване чл. 30 (дни)', type: 'number', min: 0, max: 10 }, c.ext30),
      fieldEl({ k: 'ext31', label: 'Удължаване чл. 31 (дни)', type: 'number', min: 0, max: 14 }, c.ext31),
      fieldEl({ k: 'thirdAsked', label: 'Поискано съгласие от трето лице', type: 'date' }, c.thirdAsked),
      fieldEl({ k: 'thirdGot', label: 'Получен отговор от третото лице', type: 'date' }, c.thirdGot))),
    h('fieldset', null, h('legend', null, 'Връчване, публикуване, обжалване'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'served', label: 'Връчено на', type: 'date' }, c.served),
      fieldEl({ k: 'servedHow', label: 'Начин на връчване', type: 'select', options: SERVED_HOW }, c.servedHow),
      fieldEl({ k: 'published15c', label: 'Публикувано на платформата (чл. 15в)', type: 'date' }, c.published15c),
      fieldEl({ k: 'appealed', label: 'Обжалвано', type: 'select', options: ['Не', 'Да'] }, c.appealed || 'Не'),
      fieldEl({ k: 'appealNote', label: 'Бележка за обжалването', type: 'textarea', rows: 2 }, c.appealNote))),
    h('button', { class: 'btn primary', type: 'submit' }, 'Запази промените'));
  submitter(form, async d => {
    await api('case.update', Object.assign(d, { regNo: c.regNo }));
    toast('Промените са записани.');
    viewCase(c.regNo).catch(showError);
  });

  const dueCard = h('div', { class: 'card' }, h('h2', null, 'Срок'),
    c.due ? [h('p', { class: 'bigdue' }, fmt(c.due)), h('p', { class: 'small muted' }, c.dueLabel), duePill(c)] : h('p', { class: 'muted' }, c.decisionNo ? `Решение № ${c.decisionNo} от ${fmt(c.decisionDate)}` : 'Няма текущ срок.'),
    c.thirdInvolved ? h('div', { class: 'stack third' }, h('h3', null, 'Трето лице (чл. 31)'),
      thirdRow('Искане на съгласие (ал. 2)', c.thirdBy, c.thirdAsked ? `изпратено на ${fmt(c.thirdAsked)}` : null, c.thirdByDays),
      thirdRow('Отговор на третото лице (ал. 1)', c.thirdReplyBy, c.thirdGot ? `получен на ${fmt(c.thirdGot)}` : null, c.thirdReplyDays),
      !Number(c.ext31) ? h('p', { class: 'small muted' }, 'Срокът за отговор е смятан с максималните 14 дни, защото още няма удължаване по чл. 31.') : null) : null);

  bindEik(form, 'applicantType', 'applicantEik');
  if (!can('casesEdit')) {
    form.querySelectorAll('fieldset').forEach(f => { f.disabled = true; });
    form.querySelector('button[type=submit]').remove();
  }
  const types = Object.entries(DEFS).filter(([k, d]) => k !== 'report' && k !== 'art15' && can(d.decision ? 'decisions' : 'letters'));
  const groups = [...new Set(types.map(([, d]) => d.group))];
  const pick = h('select', { 'aria-label': 'Вид документ' }, h('option', { value: '' }, 'Изберете документ…'),
    groups.map(g => h('optgroup', { label: g }, types.filter(([, d]) => d.group === g).map(([k, d]) => h('option', { value: k }, d.title)))));
  const docCard = h('div', { class: 'card stack' }, h('h2', null, 'Генериране на документ'), pick,
    h('button', { class: 'btn primary', onclick: () => { if (pick.value) docDialog(pick.value, c, b); else toast('Изберете вид документ.'); } }, 'Продължи'));

  const docsCard = h('div', { class: 'card' }, h('h2', null, 'Документи по преписката'), h('br'), r.docs.length ? docList(r.docs) : h('p', { class: 'muted' }, 'Още няма документи.'));

  const note = h('form', null, h('label', { class: 'field' }, h('span', null, 'Вътрешен коментар'), h('textarea', { name: 'text', rows: 2, required: true, maxlength: 2000 })), h('button', { class: 'btn sm block', type: 'submit' }, 'Добави'));
  submitter(note, async d => { await api('case.comment', { regNo: c.regNo, text: d.text }); viewCase(c.regNo).catch(showError); });
  const hist = h('div', { class: 'card stack' }, h('h2', null, 'История'), can('casesEdit') ? note : null,
    h('ul', { class: 'timeline' }, r.events.map(e => h('li', null, h('div', { class: 'small muted' }, `${fmtTime(e.at)} · ${e.user} · ${e.kind}`), h('div', { class: 'pre' }, e.text)))));

  const saveApplicant = h('button', { class: 'btn sm', type: 'button' }, 'Запази заявителя в адресатите');
  saveApplicant.addEventListener('click', () => withBusy(saveApplicant, async () => {
    const r2 = await api('addressees.save', { type: c.applicantType, name: c.applicantName, seat: c.applicantSeat, address: c.applicantAddress, oblast: c.applicantOblast, email: c.applicantEmail, phone: c.applicantPhone, eik: c.applicantEik });
    Store.boot = null;
    toast(r2.existed ? 'Вече е в адресатите.' : 'Записано в адресатите.');
  }));
  setView(h('div', { class: 'head' }, h('div', null, h('p', { class: 'small' }, h('a', { href: '#/cases' }, '← Всички преписки')), h('h1', null, `Преписка ${c.regNo}`), h('p', { class: 'muted' }, c.applicantName)), h('div', { class: 'actions' }, can('casesEdit') ? saveApplicant : null, statusPill(c.status))),
    h('div', { class: 'split' }, form, h('div', { class: 'stack' }, dueCard, types.length ? docCard : null, docsCard,
      caseCourtsCard(c, r.courts), filesCard({ scope: 'case', ref: c.regNo, files: r.files, space: r.space, reload: () => viewCase(c.regNo).catch(showError) }), hist)));
}

function docList(rows) {
  return h('div', { class: 'stack' }, rows.map(d => {
    const def = DEFS[d.type] || { title: d.type };
    const btn = h('button', { class: 'btn sm' }, 'PDF');
    btn.addEventListener('click', () => withBusy(btn, async () => { const r = await api('doc.get', { id: d.id }); await downloadPdf(r.payload); }));
    return h('div', { class: 'doc-row' }, h('div', null, h('div', null, def.title), h('div', { class: 'small muted mono' }, `№ ${d.no} · ${fmt(d.date)}`)), btn);
  }));
}
async function withBusy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message); } finally { btn.disabled = false; }
}

/* активните към датата лица за полето „Издава“ */
function signerOptions(boot, date) {
  const head = [['', `${boot.profile.headName}, ${boot.profile.headPosition} (ръководител)`]];
  return head.concat((boot.signers || [])
    .filter(s => s.active === 'Да' && (!s.from || s.from <= date) && (!s.to || s.to >= date))
    .map(s => [s.id, `${s.name}, ${s.position} (${s.act})`]));
}

/* отметки за основанията от закона и от списъка на организацията, плюс свободен текст за този документ */
function groundsField(def, boot) {
  const own = (boot.grounds || []).filter(g => g.scope === def.scope && g.active === 'Да');
  const hidden = h('input', { type: 'hidden', name: 'groundKeys', value: '[]' });
  const other = h('textarea', { name: 'groundOther', rows: 2, maxlength: 1000 });
  const box = (key, text) => h('label', { class: 'check' }, h('input', { type: 'checkbox', 'data-ground': key, onchange: sync }), h('span', null, text));
  const list = Object.entries(Docs.GROUNDS[def.scope]).map(([k, t]) => box(k, t)).concat(own.map(g => box(g.id, g.text)));
  const wrap = h('div', { class: 'addr full field grounds' },
    h('div', { class: 'addr-title' }, def.label, def.must ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
    hidden, list.length ? h('div', { class: 'stack ground-list' }, list) : null,
    h('label', { class: 'field' }, h('span', null, 'Друго правно основание (само за този документ)'), other,
      h('small', null, 'Постоянни основания на организацията се добавят в „Организация“.')));
  function sync() {
    const keys = [...wrap.querySelectorAll('input[data-ground]:checked')].map(i => i.dataset.ground);
    hidden.value = JSON.stringify(keys);
    other.setCustomValidity(def.must && !keys.length && !other.value.trim() ? 'Изберете или напишете поне едно правно основание.' : '');
  }
  other.addEventListener('input', sync);
  sync();
  return wrap;
}

/* първа стъпка: данни; втора стъпка: преглед и допълване на абзаците преди PDF */
function docDialog(type, c, boot) {
  const def = DEFS[type], org = boot.profile;
  const initial = f => (typeof f.value === 'function' ? f.value(c, org) : f.value);
  const today = todayIso();
  const form = h('form', null,
    h('h2', null, def.title),
    def.effect ? h('p', { class: 'note' }, def.effect) : null, h('br'),
    h('div', { class: 'form-grid' },
      fieldEl({ k: '__date', label: 'Дата на документа', type: 'date', req: true }, today),
      fieldEl({ k: '__no', label: 'Номер (по желание)', hint: 'Празно = автоматичен номер.' }),
      def.book ? addresseePicker(boot.addressees, a => {
        form.querySelector('[name="' + def.book[0] + '"]').value = a.name;
        if (def.book[1]) replaceAddress(form, def.fields.find(f => f.k === def.book[1]), a.address);
      }) : null,
      def.fields.map(f => (f.type === 'grounds' ? groundsField(f, boot) : f.type === 'signer' ? fieldEl(Object.assign({}, f, { type: 'select', options: signerOptions(boot, today) }), '') : fieldEl(f, initial(f)))),
      def.book && def.book[1] && can('casesEdit') ? h('label', { class: 'check full' }, h('input', { type: 'checkbox', name: '__saveAddr' }), h('span', null, 'Запази в адресатите')) : null),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, 'Преглед и допълване →')));
  const dlg = h('dialog', { class: 'wide' }, form);
  dlg.addEventListener('close', () => dlg.remove());

  const dateEl = form.querySelector('[name=__date]'), signerEl = form.querySelector('[name=signerId]');
  if (signerEl) {
    dateEl.addEventListener('change', () => {
      const keep = signerEl.value;
      signerEl.replaceChildren(...signerOptions(boot, dateEl.value).map(([v, l]) => h('option', { value: v }, l)));
      signerEl.value = [...signerEl.options].some(o => o.value === keep) ? keep : '';
    });
  }

  submitter(form, async d => {
    const { __date: date, __no: no, __saveAddr: saveAddr, ...fields } = d;
    const groundDef = def.fields.find(f => f.type === 'grounds');
    if (groundDef) {
      const text = Docs.groundsText(groundDef.scope, JSON.parse(fields.groundKeys || '[]'), boot.grounds, fields.groundOther);
      if (text) fields.groundText = text;
      if (type === 'dismiss') fields.ground = text;
    }
    const draft = { type, no: no || '(номер)', date, org, case: c, f: fields };
    const original = Docs.editableParagraphs(draft);
    const areas = original.map(t => {
      const ta = h('textarea', { rows: Math.max(2, Math.ceil(t.length / 85)), maxlength: 8000, 'aria-label': 'Абзац' });
      ta.value = t;
      return ta;
    });
    const extra = h('textarea', { name: 'extra', rows: 4, maxlength: 8000 });
    const step2 = h('form', null,
      h('h2', null, `Преглед: ${def.title}`),
      h('p', { class: 'note' }, 'Тук може да промените или изтриете всеки абзац и да добавите текст. Заглавието, получателят, номерът и подписът идват от данните. Прегледайте текста преди подпис: шаблоните не заменят преценката на юрист.'), h('br'),
      h('div', { class: 'stack' }, areas,
        h('label', { class: 'field' }, h('span', null, 'Допълнителен текст (по желание)'), extra, h('small', null, 'Разделете абзаците с празен ред.'))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => { step2.remove(); form.hidden = false; } }, '← Назад'),
        h('button', { class: 'btn primary', type: 'submit' }, 'Генерирай PDF')));
    submitter(step2, async () => {
      const edits = {};
      areas.forEach((ta, i) => { if (ta.value.trim() !== original[i].trim()) edits[i] = ta.value.trim(); });
      const r = await api('doc.create', { type, regNo: c.regNo, date, no, title: def.title, fields: Object.assign({}, fields, { edits: JSON.stringify(edits), extra: extra.value }) });
      await downloadPdf(r.payload);
      dlg.close();
      toast(`Документ № ${r.no} е генериран.`);
      if (saveAddr) {
        const addr = fields[def.book[1]];
        await api('addressees.save', { type: def.bookType, name: fields[def.book[0]], address: addr, oblast: parseAddress(addr).oblast })
          .then(() => { Store.boot = null; }, e => toast('Документът е издаден, но адресатът не е записан: ' + e.message));
      }
      viewCase(c.regNo).catch(showError);
    });
    form.hidden = true;
    dlg.append(step2);
    dlg.scrollTop = 0;
  });
  document.body.append(dlg);
  dlg.showModal();
}

async function viewDocs() {
  const { docs } = await api('doc.list');
  setView(h('div', { class: 'head' }, h('h1', null, 'Документи')), h('div', { class: 'card' }, docs.length ? h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, ['Номер', 'Дата', 'Документ', 'Преписка', 'Автор', ''].map(t => h('th', null, t)))),
    h('tbody', null, docs.map(d => {
      const btn = h('button', { class: 'btn sm' }, 'PDF');
      btn.addEventListener('click', () => withBusy(btn, async () => { const r = await api('doc.get', { id: d.id }); await downloadPdf(r.payload); }));
      return h('tr', null, h('td', { class: 'mono' }, d.no), h('td', { class: 'mono' }, fmt(d.date)), h('td', null, (DEFS[d.type] || {}).title || d.type),
        h('td', null, d.regNo ? h('a', { href: '#/case/' + encodeURIComponent(d.regNo) }, d.regNo) : '—'), h('td', null, d.author), h('td', { class: 'right' }, btn));
    })))) : h('p', { class: 'muted' }, 'Още няма генерирани документи.')));
}

/* ---------- отчети и чл. 15 ---------- */

function statTable(title, obj) {
  return h('div', { class: 'card' }, h('h2', null, title), h('br'), h('table', null, h('tbody', null, Object.entries(obj).map(([k, v]) => h('tr', null, h('td', null, k), h('td', { class: 'right mono' }, v))))));
}

async function viewReports() {
  const cur = Number(todayIso().slice(0, 4));
  const sel = h('select', { 'aria-label': 'Година' }, [0, 1, 2, 3, 4, 5].map(i => h('option', { value: cur - i }, `${cur - i} г.`)));
  sel.value = cur - 1;
  const box = h('div', { class: 'stack' });
  const note = h('textarea', { rows: 3, maxlength: 4000 });
  const gen = h('button', { class: 'btn primary' }, 'Генерирай годишния отчет (PDF)');
  gen.addEventListener('click', () => withBusy(gen, async () => {
    const r = await api('doc.create', { type: 'report', title: `Годишен отчет ${sel.value}`, date: todayIso(), fields: { year: sel.value, note: note.value } });
    await downloadPdf(r.payload);
    toast(`Отчет № ${r.no} е генериран.`);
  }));
  const load = async () => {
    box.replaceChildren(h('p', { class: 'loading' }, 'Зареждане…'));
    const { stats: s } = await api('report.stats', { year: sel.value });
    box.replaceChildren(
      h('div', { class: 'tiles' }, [['Заявления', s.total], ['За достъп', s.access], ['За повторно използване', s.reuse], ['Откази', s.refusals], ['След срока', s.late], ['Обжалвани', s.appealed]].map(([l, n]) => h('div', { class: 'card tile' }, h('b', null, n), h('span', { class: 'muted small' }, l)))),
      h('div', { class: 'form-grid' }, statTable('По вид заявител', s.byApplicant), statTable('По начин на подаване', s.byChannel), statTable('По резултат', s.byOutcome), statTable('Откази и причини', s.grounds)));
  };
  sel.addEventListener('change', () => load().catch(showError));
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Годишен отчет по чл. 15, ал. 2'), h('p', { class: 'muted small' }, 'Постъпили заявления, направени откази и причините за тях. Отчетът е част от докладите по чл. 62, ал. 1 от Закона за администрацията.')), h('div', { class: 'actions' }, sel, gen)),
    h('label', { class: 'field card' }, h('span', null, 'Допълнителна информация за отчета (по желание)'), note), h('br'), box);
  await load();
}

async function viewArt15() {
  const b = await boot(), { items } = await api('art15.get');
  const map = {};
  items.forEach(i => { map[i.item] = i; });
  const list = art15Items(b.profile.basis);
  const done = list.filter(([n]) => map[String(n)] && map[String(n)].text).length;
  const gen = h('button', { class: 'btn primary' }, 'Генерирай PDF');
  gen.addEventListener('click', () => withBusy(gen, async () => {
    const r = await api('doc.create', { type: 'art15', title: 'Информация по чл. 15', date: todayIso(), fields: {} });
    await downloadPdf(r.payload);
    toast(`Документ № ${r.no} е генериран.`);
  }));
  const basisNote = b.profile.basis === 'чл. 3, ал. 1'
    ? 'Списъкът е по чл. 15, ал. 1.'
    : b.profile.basis === 'чл. 3, ал. 2, т. 1' ? 'За лицата по чл. 3, ал. 2, т. 1 важат точките по чл. 15, ал. 3.'
      : 'Чл. 15 не задава изрично това задължение за лицата по чл. 3, ал. 2, т. 2. Показаните точки (по ал. 3) могат да се ползват доброволно.';
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Информация по чл. 15 ЗДОИ'), h('p', { class: 'muted small' }, `Попълнени: ${done} от ${list.length}. ${basisNote} Публикува се на интернет страницата в срок до 3 работни дни от приемането на акта или създаването на информацията (чл. 15а, ал. 4).`)), can('art15') ? gen : null),
    h('div', { class: 'stack' }, list.map(([n, label]) => {
      const cur = map[String(n)] || {};
      const stamp = h('span', { class: 'small muted' }, cur.updated ? `Обновено на ${fmt(cur.updated)}` : 'Не е попълнено');
      const form = h('form', { class: 'card' }, h('h3', null, `т. ${n}. ${label}`), h('br'),
        h('div', { class: 'form-grid' }, fieldEl({ k: 'text', label: 'Описание', type: 'textarea', rows: 3 }, cur.text), fieldEl({ k: 'url', label: 'Интернет адрес', type: 'url', placeholder: 'https://', full: true }, cur.url)),
        h('br'), h('div', { class: 'actions' }, can('art15') ? h('button', { class: 'btn sm', type: 'submit' }, 'Запази') : null, stamp));
      if (!can('art15')) form.querySelectorAll('input,textarea').forEach(el => { el.disabled = true; });
      return submitter(form, async d => {
        const r = await api('art15.save', { item: String(n), text: d.text, url: d.url });
        stamp.textContent = `Обновено на ${fmt(r.updated)}`;
        toast(`Точка ${n} е записана.`);
      });
    })));
}

/* ---------- адресати ---------- */

function addresseePicker(list, onPick) {
  const items = list || [];
  const sel = h('select', { 'aria-label': 'Адресат от списъка' }, h('option', { value: '' }, 'Въвеждане ръчно'),
    items.map(a => h('option', { value: a.id }, a.name + (a.address || a.email ? ' – ' + (a.address || a.email) : ''))));
  sel.addEventListener('change', () => { const a = items.find(x => x.id === sel.value); if (a) onPick(a); });
  return h('label', { class: 'field full' }, h('span', null, 'Адресат от списъка или ръчно'), sel,
    h('small', null, items.length ? 'Избраният адресат попълва полетата, а те могат да се променят за този случай.' : 'Още няма запазени адресати. Попълнете данните ръчно.'));
}

/* адресното поле се създава наново, за да покаже областта, общината и селището на избрания адресат */
function replaceAddress(form, def, value, ctx) {
  form.querySelector('[name="' + def.k + '"]').closest('.addr').replaceWith(addressField(def, value, null, ctx));
}

/* една и съща страница за организацията и за оператора; различават се само извикванията към сървъра */
function addresseesPage({ rows, canEdit, save, del, reload, before }) {
  const edit = a => {
    const form = h('form', null, h('h2', null, a ? 'Промяна на адресат' : 'Нов адресат'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'type', label: 'Вид', type: 'select', options: ADDRESSEE_TYPE, req: true }, a ? a.type : ADDRESSEE_TYPE[0]),
      fieldEl({ k: 'name', label: 'Три имена или наименование', req: true }, a && a.name),
      fieldEl({ k: 'eik', label: 'ЕИК или БУЛСТАТ', pattern: '\\d{9}|\\d{13}', eik: true, hint: 'За търговци, сдружения и други юридически лица.' }, a && a.eik),
      fieldEl({ k: 'seat', label: 'Седалище (за юридически лица)' }, a && a.seat),
      fieldEl({ k: 'address', label: 'Адрес (адрес или имейл е задължителен)', type: 'address', oblastName: 'oblast' }, a && a.address, a || {}),
      fieldEl({ k: 'email', label: 'Имейл', type: 'email' }, a && a.email),
      fieldEl({ k: 'phone', label: 'Телефон', type: 'tel' }, a && a.phone)),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, 'Запази')));
    bindEik(form, 'type', 'eik');
    const dlg = h('dialog', { class: 'wide' }, form);
    dlg.addEventListener('close', () => dlg.remove());
    submitter(form, async d => {
      const r = await save(Object.assign(d, { id: a ? a.id : '' }));
      dlg.close();
      toast(r.existed ? 'Този адресат вече е в списъка.' : 'Записано.');
      reload();
    });
    document.body.append(dlg); dlg.showModal();
  };
  const remove = (a, btn) => {
    if (!window.confirm('Да се изтрие ли адресатът „' + a.name + '“? Издадените документи и преписките не се променят.')) return;
    withBusy(btn, async () => { await del(a.id); toast('Адресатът е изтрит.'); reload(); });
  };
  const q = h('input', { type: 'search', placeholder: 'Търсене по име, адрес или имейл', 'aria-label': 'Търсене' });
  const box = h('div', { class: 'table-wrap' });
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    const list = rows.filter(a => !t || [a.name, a.eik, a.address, a.email].join(' ').toLowerCase().includes(t));
    box.replaceChildren(list.length ? h('table', null,
      h('thead', null, h('tr', null, ['Име или наименование', 'ЕИК/БУЛСТАТ', 'Вид', 'Адрес', 'Имейл', 'Телефон', ''].map(x => h('th', null, x)))),
      h('tbody', null, list.map(a => {
        const del = h('button', { class: 'btn sm danger', onclick: () => remove(a, del) }, 'Изтрий');
        return h('tr', null, h('td', null, a.name), h('td', { class: 'mono' }, a.eik || '—'), h('td', null, a.type), h('td', { class: 'wide-cell' }, a.address || '—'), h('td', null, a.email || '—'), h('td', null, a.phone || '—'),
          h('td', { class: 'right' }, canEdit ? h('div', { class: 'actions' }, h('button', { class: 'btn sm', onclick: () => edit(a) }, 'Промени'), del) : null));
      }))) : h('p', { class: 'muted' }, rows.length ? 'Няма съвпадения.' : 'Още няма запазени адресати.'));
  };
  q.addEventListener('input', draw);
  draw();
  return [h('div', { class: 'head' }, h('div', null, h('h1', null, 'Адресати'), h('p', { class: 'muted small' }, 'Запазени заявители, трети лица и органи. Въвеждат се и се редактират тук, независимо от преписките. Избират се при нова преписка и в писмата, а данните винаги могат да се въведат и ръчно. Пазете само адресати, за които имате нужда, защото това са лични данни.')),
    canEdit ? h('button', { class: 'btn primary', onclick: () => edit(null) }, '+ Нов адресат') : null),
    before || null,
    h('div', { class: 'card' }, h('div', { class: 'filters' }, q), box)];
}

async function viewAddressees() {
  Store.boot = null;
  const b = await boot();
  setView(addresseesPage({
    rows: b.addressees, canEdit: can('casesEdit'), save: d => api('addressees.save', d), del: id => api('addressees.delete', { id }),
    reload: () => viewAddressees().catch(showError)
  }));
}

/* оператор: адресатите принадлежат на организация, затова първо се избира тя */
async function viewOpAddressees(no) {
  const { orgs } = await api('op.orgs');
  const selected = no || (orgs.length === 1 ? orgs[0].no : '');
  if (!orgs.length) {
    setView(h('div', { class: 'head' }, h('h1', null, 'Адресати')), h('div', { class: 'card stack' },
      h('p', { class: 'muted' }, 'Адресатите се пазят към организация, а още няма одобрени организации.'),
      h('div', null, h('a', { class: 'btn primary', href: '#/op/new' }, '+ Добави организация'))));
    return;
  }
  const sel = h('select', { 'aria-label': 'Организация', onchange: e => { location.hash = '#/op/addressees/' + e.target.value; } },
    h('option', { value: '' }, 'Изберете организация…'), orgs.map(o => h('option', { value: o.no }, o.no + ' – ' + o.name)));
  sel.value = selected;
  const picker = h('div', { class: 'card' }, h('label', { class: 'field' }, h('span', null, 'Организация'), sel));
  if (!selected) {
    setView(h('div', { class: 'head' }, h('h1', null, 'Адресати')), picker);
    return;
  }
  const r = await api('op.addressees', { no: selected });
  setView(addresseesPage({
    rows: r.addressees, canEdit: true, before: [picker, h('br')],
    save: d => api('op.addressee.save', Object.assign(d, { no: selected })), del: id => api('op.addressee.delete', { no: selected, id }),
    reload: () => viewOpAddressees(selected).catch(showError)
  }));
}

/* ---------- дела и файлове ---------- */

const COURT_KIND = ['Административно дело', 'Касационно дело', 'Друго'];
const COURT_STATUS = ['Образувано', 'Насрочено', 'Решено', 'Обжалвано', 'Приключено'];
const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.rtf,.txt,.jpg,.jpeg,.png,.eml';

function fmtSize(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

function courtPill(s) {
  return h('span', { class: 'pill ' + (s === 'Приключено' || s === 'Решено' ? 'ok' : s === 'Насрочено' ? 'warn' : 'info') }, s);
}

function hearingCell(x) {
  if (!x.nextHearing) return h('span', { class: 'muted' }, '—');
  const days = Math.round((Date.parse(x.nextHearing) - Date.parse(todayIso())) / 864e5);
  return [h('div', { class: 'mono small' }, fmt(x.nextHearing)), days >= 0 ? duePill({ daysLeft: days }) : h('span', { class: 'small muted' }, 'минало')];
}

function courtDialog(x, preset, cases, done) {
  const courts = [...new Set(Docs.OBLASTS.map(o => Docs.courtForOblast(o)).filter(Boolean))].concat('Върховен административен съд');
  const list = h('datalist', { id: 'court-list' }, courts.map(c => h('option', { value: c })));
  const form = h('form', null, h('h2', null, x ? 'Промяна на дело' : 'Ново съдебно дело'), h('div', { class: 'form-grid' },
    fieldEl({ k: 'court', label: 'Съд', req: true, full: true, hint: 'Изберете от списъка или напишете.' }, x ? x.court : (preset && preset.court) || ''),
    fieldEl({ k: 'caseNo', label: '№ на дело', req: true }, x && x.caseNo),
    fieldEl({ k: 'year', label: 'Година', req: true, pattern: '\\d{4}', inputmode: 'numeric' }, x ? x.year : todayIso().slice(0, 4)),
    fieldEl({ k: 'kind', label: 'Вид', type: 'select', options: COURT_KIND, req: true }, x ? x.kind : COURT_KIND[0]),
    fieldEl({ k: 'status', label: 'Статус', type: 'select', options: COURT_STATUS, req: true }, x ? x.status : COURT_STATUS[0]),
    fieldEl({ k: 'nextHearing', label: 'Следващо заседание', type: 'date' }, x && x.nextHearing),
    fieldEl({ k: 'regNo', label: 'Преписка', type: 'select', options: [['', 'Без преписка']].concat(cases.map(c => [c.regNo, c.regNo + ' – ' + c.applicantName])) }, x ? x.regNo : (preset && preset.regNo) || ''),
    fieldEl({ k: 'note', label: 'Бележки', type: 'textarea', rows: 3 }, x && x.note)),
  list,
  h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, 'Запази')));
  form.querySelector('[name=court]').setAttribute('list', 'court-list');
  const dlg = h('dialog', null, form);
  dlg.addEventListener('close', () => dlg.remove());
  submitter(form, async d => {
    const r = await api('court.save', Object.assign(d, { id: x ? x.id : '' }));
    dlg.close();
    toast('Делото е записано.');
    done(r.id);
  });
  document.body.append(dlg); dlg.showModal();
}

function caseCourtsCard(c, courts) {
  const add = h('button', { class: 'btn sm', type: 'button' }, '+ Ново дело');
  add.addEventListener('click', () => withBusy(add, async () => {
    const { cases } = await api('case.list');
    const oblast = Docs.oblastOf(c);
    courtDialog(null, { regNo: c.regNo, court: oblast ? Docs.courtForOblast(oblast) : '' }, cases, id => { location.hash = '#/court/' + id; });
  }));
  return h('div', { class: 'card stack' }, h('div', { class: 'head' }, h('h2', null, 'Съдебни дела'), can('casesEdit') ? add : null),
    courts.length ? courts.map(x => h('div', { class: 'doc-row' }, h('div', null, h('a', { href: '#/court/' + x.id }, 'Дело № ' + x.caseNo + '/' + x.year), h('div', { class: 'small muted' }, x.court)), courtPill(x.status))) : h('p', { class: 'muted' }, 'Няма дела по преписката.'));
}

/* файлове към преписка или дело */
function filesCard({ scope, ref, files, space, reload }) {
  const input = h('input', { type: 'file', accept: FILE_ACCEPT, class: 'hidden-field', 'aria-label': 'Изберете файл' });
  const busy = h('p', { class: 'small muted', hidden: true }, 'Качване…');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > space.fileLimit) { toast('Файлът е над ' + fmtSize(space.fileLimit) + '.'); input.value = ''; return; }
    busy.hidden = false;
    try {
      const data = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = no; fr.readAsDataURL(file); });
      await api('file.upload', { scope, ref, name: file.name, data });
      toast('Файлът е качен.');
      reload();
    } catch (e) { toast(e.message || 'Файлът не можа да се качи.'); busy.hidden = true; input.value = ''; }
  });
  return h('div', { class: 'card stack' },
    h('div', { class: 'head' }, h('div', null, h('h2', null, 'Файлове'), h('p', { class: 'small muted' }, 'До ' + fmtSize(space.fileLimit) + ' за файл: PDF, Word, Excel, OpenDocument, изображения, имейл.')),
      can('casesEdit') ? h('label', { class: 'btn sm' }, '+ Качи файл', input) : null),
    busy, fileRows(files, null));
}

function fileRows(files, showRef) {
  if (!files.length) return h('p', { class: 'muted' }, 'Няма качени файлове.');
  return h('div', { class: 'stack' }, files.map(f => {
    const get = h('button', { class: 'btn sm', type: 'button' }, 'Изтегли');
    get.addEventListener('click', () => withBusy(get, async () => {
      const r = await api('file.get', { id: f.id });
      const bytes = Uint8Array.from(atob(r.data), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.type }));
      const a = h('a', { href: url, download: r.name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }));
    const del = h('button', { class: 'btn sm danger', type: 'button' }, 'Изтрий');
    del.addEventListener('click', () => {
      if (!window.confirm('Да се изтрие ли файлът „' + f.name + '“?')) return;
      withBusy(del, async () => { await api('file.delete', { id: f.id }); toast('Файлът е изтрит.'); route(); });
    });
    return h('div', { class: 'doc-row' },
      h('div', null, h('div', { class: 'wrap-any' }, f.name), h('div', { class: 'small muted' }, fmtSize(f.size) + ' · ' + f.by + ' · ' + fmtTime(f.at) + (showRef && f.refLabel ? ' · ' + f.refLabel : ''))),
      h('div', { class: 'actions' }, get, can('casesEdit') ? del : null));
  }));
}

async function viewSpace() {
  const r = await api('space.list');
  const add = h('button', { class: 'btn primary' }, '+ Ново дело');
  add.addEventListener('click', () => withBusy(add, async () => {
    const { cases } = await api('case.list');
    courtDialog(null, null, cases, id => { location.hash = '#/court/' + id; });
  }));
  const pct = Math.round(r.space.used / r.space.limit * 100);
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Дела и файлове'), h('p', { class: 'muted small' }, 'Съдебните дела и файловете към преписките и делата. Файлове се качват от страницата на преписката или делото.')), can('casesEdit') ? add : null),
    h('div', { class: 'stack' },
      h('div', { class: 'card stack' }, h('div', { class: 'head' }, h('h2', null, 'Използвано пространство'), h('span', { class: 'small mono' }, fmtSize(r.space.used) + ' от ' + fmtSize(r.space.limit))),
        h('progress', { class: 'space-bar', max: 100, value: pct, 'aria-label': 'Използвано пространство' })),
      h('div', { class: 'card table-wrap' }, h('h2', null, 'Съдебни дела'), h('br'), r.courts.length ? h('table', null,
        h('thead', null, h('tr', null, ['Дело', 'Съд', 'Преписка', 'Статус', 'Следващо заседание'].map(t => h('th', null, t)))),
        h('tbody', null, r.courts.map(x => h('tr', { class: 'link', onclick: () => { location.hash = '#/court/' + x.id; } },
          h('td', { class: 'mono' }, h('a', { href: '#/court/' + x.id }, x.caseNo + '/' + x.year)), h('td', null, x.court), h('td', { class: 'mono small' }, x.regNo || '—'), h('td', null, courtPill(x.status)), h('td', null, hearingCell(x))))) ) : h('p', { class: 'muted' }, 'Още няма дела.')),
      h('div', { class: 'card' }, h('h2', null, 'Всички файлове'), h('br'), fileRows(r.files, true))));
}

async function viewCourt(id) {
  const r = await api('court.get', { id }), x = r.court;
  const edit = h('button', { class: 'btn', type: 'button' }, 'Промени');
  edit.addEventListener('click', () => withBusy(edit, async () => {
    const { cases } = await api('case.list');
    courtDialog(x, null, cases, () => viewCourt(id).catch(showError));
  }));
  const del = h('button', { class: 'btn danger', type: 'button' }, 'Изтрий');
  del.addEventListener('click', () => {
    if (!window.confirm('Да се изтрие ли делото заедно с файловете му?')) return;
    withBusy(del, async () => { await api('court.delete', { id }); toast('Делото е изтрито.'); location.hash = '#/space'; });
  });
  setView(h('div', { class: 'head' }, h('div', null, h('p', { class: 'small' }, h('a', { href: '#/space' }, '← Дела и файлове')), h('h1', null, 'Дело № ' + x.caseNo + '/' + x.year), h('p', { class: 'muted' }, x.court)),
    h('div', { class: 'actions' }, can('casesEdit') ? [edit, del] : null, courtPill(x.status))),
    h('div', { class: 'split' },
      h('div', { class: 'card' }, h('dl', { class: 'kv' },
        h('dt', null, 'Вид'), h('dd', null, x.kind),
        h('dt', null, 'Следващо заседание'), h('dd', null, x.nextHearing ? fmt(x.nextHearing) : '—'),
        h('dt', null, 'Преписка'), h('dd', null, x.regNo ? h('a', { href: '#/case/' + encodeURIComponent(x.regNo) }, x.regNo) : '—'),
        h('dt', null, 'Бележки'), h('dd', { class: 'pre' }, x.note || '—'))),
      filesCard({ scope: 'court', ref: x.id, files: r.files, space: r.space, reload: () => viewCourt(id).catch(showError) })));
}

/* ---------- входове ---------- */

function loginsTable(rows) {
  if (!rows.length) return h('p', { class: 'muted' }, 'Още няма записани входове.');
  const cls = r => (r === 'Успешен' ? 'ok' : /Заключен|Спрян/.test(r) ? 'bad' : 'warn');
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, ['Време', 'Потребител', 'IP адрес', 'Резултат', 'Браузър'].map(t => h('th', null, t)))),
    h('tbody', null, rows.map(l => h('tr', null, h('td', { class: 'mono small' }, fmtTime(l.at)), h('td', null, l.username), h('td', { class: 'mono' }, l.ip || '—'),
      h('td', null, h('span', { class: 'pill ' + cls(l.result) }, l.result), l.newIp ? [' ', h('span', { class: 'pill info' }, 'Нов адрес')] : null),
      h('td', { class: 'small muted login-agent' }, l.agent || '—'))))));
}

async function viewLogins() {
  const { logins } = await api('logins.list');
  const q = h('input', { type: 'search', placeholder: 'Потребител или IP адрес', 'aria-label': 'Търсене' });
  const failed = h('input', { type: 'checkbox' });
  const box = h('div');
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    box.replaceChildren(loginsTable(logins.filter(l => (!failed.checked || l.result !== 'Успешен') && (!t || (l.username + ' ' + l.ip).toLowerCase().includes(t)))));
  };
  q.addEventListener('input', draw);
  failed.addEventListener('change', draw);
  draw();
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Входове'), h('p', { class: 'muted small' }, 'Последните 500 опита за вход. IP адресът се отчита от браузъра на потребителя през Cloudflare, затова е мярка за наблюдение, а не доказателство. Проверявайте непознатите адреси и заключванията.'))),
    h('div', { class: 'card' }, h('div', { class: 'filters' }, q, h('label', { class: 'check' }, failed, h('span', null, 'Само неуспешните'))), box));
}

/* ---------- организация, потребители ---------- */

const ORG_LABELS = () => Object.fromEntries(ORG_SECTIONS.flatMap(s => s[1]).concat(SEAT_FIELDS).map(f => [f.k, f.label]));

function changeList(changed) {
  const labels = ORG_LABELS();
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, ['Поле', 'Сега', 'Иска се'].map(t => h('th', null, t)))),
    h('tbody', null, Object.entries(changed).map(([k, v]) => h('tr', null, h('td', null, labels[k] || k), h('td', null, v.from || '—'), h('td', null, h('b', null, v.to)))))));
}
const changeStatus = s => h('span', { class: 'pill ' + (s === 'Одобрена' ? 'ok' : s === 'Отказана' ? 'bad' : 'warn') }, s);

/* организациите не променят данните си директно: администраторът праща заявка с основание */
async function viewOrg() {
  Store.boot = null;
  const [b, { changes }] = await Promise.all([boot(), api('org.changes')]);
  const pending = changes.find(c => c.status === 'Чака одобрение');
  const missing = ORG_SECTIONS.flatMap(s => s[1]).concat(SEAT_FIELDS).filter(f => !b.profile[f.k]);
  const canAsk = can('changes') && !pending;
  const form = h('form', { class: 'card' },
    ORG_SECTIONS.map(([title, fields]) => h('fieldset', { disabled: !canAsk }, h('legend', null, title), h('div', { class: 'form-grid' },
      fields.map(f => fieldEl(f, b.profile[f.k], b.profile))))),
    canAsk ? [
      h('fieldset', null, h('legend', null, 'Заявка за промяна'),
        h('p', { class: 'note' }, 'Данните не се променят директно. Променете полетата по-горе, посочете основанието и изпратете заявка. Промяната влиза в сила след одобрение от екипа на ЗДОИ4You.'), h('br'),
        fieldEl({ k: 'changeBasis', label: 'Основание за промяната', type: 'textarea', req: true, rows: 3, hint: 'Например: решение на общинския съвет, заповед, вписване в регистър, с номер и дата.' })),
      h('button', { class: 'btn primary', type: 'submit' }, 'Изпрати заявка за промяна')
    ] : h('p', { class: 'muted small' }, pending ? 'Данните не могат да се променят, докато заявката чака решение.' : 'Нямате право да изпращате заявки за промяна на данните.'));
  if (canAsk) {
    submitter(form, async d => {
      const r = await api('org.changeRequest', d);
      toast('Заявка ' + r.id + ' е изпратена.');
      viewOrg().catch(showError);
    });
  }
  const history = changes.length ? h('div', { class: 'card stack' }, h('h2', null, 'Заявки за промяна'), changes.map(c => h('div', { class: 'stack change' },
    h('div', { class: 'head' }, h('div', null, h('b', { class: 'mono' }, c.id), h('div', { class: 'small muted' }, fmtTime(c.at) + ' · ' + c.by)), changeStatus(c.status)),
    h('p', { class: 'small' }, 'Основание: ' + c.basis),
    c.reason ? h('p', { class: 'small' }, 'Причина за отказа: ' + c.reason) : null,
    changeList(c.changed)))) : null;
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Данни на организацията'), h('p', { class: 'muted small' }, 'Номер на организацията: ', h('b', { class: 'mono' }, b.me.no), '. Служителите го въвеждат при вход.'), b.plan ? h('p', { class: 'muted small' }, 'План: ', h('b', null, b.plan.name), b.plan.description ? ' – ' + b.plan.description : '') : null)),
    missing.length ? [h('p', { class: 'warnbox' }, 'Има непопълнени данни. Документи не могат да се генерират, докато не са попълнени всички.'), h('br')] : null,
    pending ? [h('p', { class: 'warnbox' }, 'Заявка ' + pending.id + ' чака решение от екипа на ЗДОИ4You.'), h('br')] : null,
    h('div', { class: 'stack' }, form, history, signersCard(b.signers, can('signers'), d => api('signers.save', d), () => { Store.boot = null; viewOrg().catch(showError); }),
      groundsCard(b.grounds, can('grounds'), d => api('grounds.save', d), () => { Store.boot = null; viewOrg().catch(showError); })));
}

/* оператор: заявки за промяна на данни */
async function viewOpChanges() {
  const { changes } = await api('op.changes');
  const pendingCount = changes.filter(c => c.status === 'Чака одобрение').length;
  const decide = (c, approve, reason) => api('op.changeDecide', { id: c.id, approve, reason }).then(() => { toast(approve ? 'Промяната е одобрена и нанесена.' : 'Заявката е отказана.'); viewOpChanges().catch(showError); });
  const reject = c => {
    const form = h('form', null, h('h2', null, 'Отказ за ' + c.orgName),
      fieldEl({ k: 'reason', label: 'Причина (ще бъде изпратена на организацията)', type: 'textarea', req: true }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Назад'), h('button', { class: 'btn danger', type: 'submit' }, 'Откажи заявката')));
    const dlg = h('dialog', null, form);
    dlg.addEventListener('close', () => dlg.remove());
    submitter(form, async d => { await decide(c, false, d.reason); dlg.close(); });
    document.body.append(dlg); dlg.showModal();
  };
  setView(h('div', { class: 'head' }, h('h1', null, 'Заявки за промяна на данни'), h('span', { class: 'pill warn' }, 'Чакат решение: ' + pendingCount)),
    changes.length ? h('div', { class: 'stack' }, changes.map(c => h('div', { class: 'card stack' },
      h('div', { class: 'head' }, h('div', null, h('h2', null, c.orgName), h('p', { class: 'small muted mono' }, c.id + ' · № ' + c.no + ' · ' + fmtTime(c.at) + ' · ' + c.by)), changeStatus(c.status)),
      h('p', null, h('b', null, 'Основание: '), c.basis),
      changeList(c.changed),
      c.reason ? h('p', { class: 'small' }, 'Причина за отказа: ' + c.reason) : null,
      c.status === 'Чака одобрение' ? h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: e => withBusy(e.target, () => decide(c, true)) }, 'Одобри и нанеси'),
        h('button', { class: 'btn danger', onclick: () => reject(c) }, 'Откажи')) : null))) : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Няма заявки за промяна.')));
}

/* собствени правни основания на организацията */
function groundsCard(list, canEdit, save, done) {
  const scopes = Object.entries(Docs.GROUND_SCOPE_LABELS);
  const edit = g => {
    const form = h('form', null, h('h2', null, g ? 'Промяна на основание' : 'Ново правно основание'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'scope', label: 'За кои актове', type: 'select', options: scopes, req: true }, g ? g.scope : 'refuse'),
      g ? fieldEl({ k: 'active', label: 'Активно', type: 'select', options: ['Да', 'Не'], req: true }, g.active) : null,
      fieldEl({ k: 'text', label: 'Правно основание', type: 'textarea', req: true, rows: 3, hint: 'Например: чл. … от Закона за … – кратко описание.' }, g && g.text)),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, 'Запази')));
    const dlg = h('dialog', null, form);
    dlg.addEventListener('close', () => dlg.remove());
    submitter(form, async d => {
      await save(Object.assign(d, { id: g ? g.id : '', active: g ? d.active === 'Да' : true }));
      dlg.close();
      toast('Записано.');
      done();
    });
    document.body.append(dlg); dlg.showModal();
  };
  return h('div', { class: 'card' },
    h('div', { class: 'head' }, h('div', null, h('h2', null, 'Собствени правни основания'), h('p', { class: 'muted small' }, 'Появяват се като отметки при издаване на съответните актове, до основанията от ЗДОИ. Отговорността за верността им е на организацията.')),
      canEdit ? h('button', { class: 'btn sm', type: 'button', onclick: () => edit(null) }, '+ Добави основание') : null),
    list.length ? h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Основание', 'За кои актове', 'Състояние', ''].map(t => h('th', null, t)))),
      h('tbody', null, list.map(g => h('tr', null, h('td', null, g.text), h('td', null, Docs.GROUND_SCOPE_LABELS[g.scope] || g.scope),
        h('td', null, h('span', { class: 'pill ' + (g.active === 'Да' ? 'ok' : 'bad') }, g.active === 'Да' ? 'Активно' : 'Неактивно')),
        h('td', { class: 'right' }, canEdit ? h('button', { class: 'btn sm', type: 'button', onclick: () => edit(g) }, 'Промени') : null)))))) : h('p', { class: 'muted' }, 'Няма добавени основания.'));
}

/* лица, определени да издават решения (чл. 28, ал. 2 ЗДОИ) */
function signersCard(list, canEdit, save, done) {
  const edit = s => {
    const form = h('form', null, h('h2', null, s ? `Лице: ${s.name}` : 'Ново упълномощено лице'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'name', label: 'Три имена', req: true }, s && s.name),
      fieldEl({ k: 'position', label: 'Длъжност', req: true }, s && s.position),
      fieldEl({ k: 'act', label: 'Акт за определяне', req: true, full: true, placeholder: 'Заповед № … от …', hint: 'Посочва се под подписа в документите.' }, s && s.act),
      fieldEl({ k: 'from', label: 'В сила от', type: 'date' }, s && s.from),
      fieldEl({ k: 'to', label: 'В сила до', type: 'date' }, s && s.to),
      s ? fieldEl({ k: 'active', label: 'Активно', type: 'select', options: ['Да', 'Не'], req: true }, s.active) : null),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, 'Запази')));
    const dlg = h('dialog', null, form);
    dlg.addEventListener('close', () => dlg.remove());
    submitter(form, async d => {
      await save(Object.assign(d, { id: s ? s.id : '', active: s ? d.active === 'Да' : true }));
      dlg.close();
      toast('Записано.');
      done();
    });
    document.body.append(dlg); dlg.showModal();
  };
  return h('div', { class: 'card' },
    h('div', { class: 'head' }, h('div', null, h('h2', null, 'Лица, упълномощени да издават решения'), h('p', { class: 'muted small' }, 'Изрично определени от органа лица (чл. 28, ал. 2 ЗДОИ). Избират се в полето „Издава“ при генериране на документ.')),
      canEdit ? h('button', { class: 'btn sm', type: 'button', onclick: () => edit(null) }, '+ Добави лице') : null),
    list.length ? h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Име', 'Длъжност', 'Акт за определяне', 'Срок', 'Състояние', ''].map(t => h('th', null, t)))),
      h('tbody', null, list.map(s => h('tr', null, h('td', null, s.name), h('td', null, s.position), h('td', null, s.act),
        h('td', { class: 'small mono' }, s.from || s.to ? `${s.from ? fmt(s.from) : '…'} – ${s.to ? fmt(s.to) : '…'}` : 'безсрочно'),
        h('td', null, h('span', { class: 'pill ' + (s.active === 'Да' ? 'ok' : 'bad') }, s.active === 'Да' ? 'Активно' : 'Неактивно')),
        h('td', { class: 'right' }, canEdit ? h('button', { class: 'btn sm', type: 'button', onclick: () => edit(s) }, 'Промени') : null)))))) : h('p', { class: 'muted' }, 'Няма добавени лица. Документите се издават от ръководителя.'));
}

function userDialog(u, save, done) {
  const isNew = !u;
  const permBoxes = h('div', { class: 'addr full field' }, h('div', { class: 'addr-title' }, 'Права'),
    h('p', { class: 'small muted' }, 'Смяната на ролята връща правата по подразбиране за нея. Управлението на потребители е само за роля Администратор.'),
    h('div', { class: 'stack ground-list' }, Docs.PERMS.map(([k, label, hint]) => h('label', { class: 'check' }, h('input', { type: 'checkbox', 'data-perm': k }), h('span', null, label, hint ? h('small', { class: 'muted' }, ' ' + hint) : null)))));
  const form = h('form', null, h('h2', null, isNew ? 'Нов потребител' : `Потребител ${u.username}`), h('div', { class: 'form-grid' },
    fieldEl({ k: 'username', label: 'Потребителско име', req: true, readonly: !isNew, pattern: '[a-z0-9._\\-]{3,40}', hint: 'Малки латински букви, цифри и . _ -' }, u && u.username),
    fieldEl({ k: 'name', label: 'Имена', req: true }, u && u.name),
    fieldEl({ k: 'position', label: 'Длъжност', req: true }, u && u.position),
    fieldEl({ k: 'email', label: 'Служебен имейл', type: 'email', req: true }, u && u.email),
    fieldEl({ k: 'phone', label: 'Телефон', type: 'tel' }, u && u.phone),
    fieldEl({ k: 'role', label: 'Роля', type: 'select', options: ['Служител', 'Администратор'], req: true }, u ? u.role : 'Служител'),
    isNew ? null : fieldEl({ k: 'active', label: 'Активен', type: 'select', options: ['Да', 'Не'], req: true }, u.active)),
  permBoxes,
  h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, isNew ? 'Създай потребител' : 'Запази')));
  const roleEl = form.querySelector('[name=role]');
  const setPerms = list => permBoxes.querySelectorAll('input[data-perm]').forEach(i => { i.checked = list.includes(i.dataset.perm); });
  setPerms(u ? u.perms : Docs.defaultPerms(roleEl.value));
  roleEl.addEventListener('change', () => setPerms(Docs.defaultPerms(roleEl.value)));
  const dlg = h('dialog', null, form);
  dlg.addEventListener('close', () => dlg.remove());
  submitter(form, async d => {
    const perms = [...permBoxes.querySelectorAll('input[data-perm]:checked')].map(i => i.dataset.perm);
    const r = await save(Object.assign(d, { isNew, perms, active: isNew ? true : d.active === 'Да' }));
    dlg.close();
    if (r.created) toast(r.emailed ? 'Връзка за парола е изпратена на ' + d.email + '.' : 'Потребителят е създаден, но имейлът не се изпрати. Изпратете нова връзка.'); else toast('Записано.');
    done();
  });
  document.body.append(dlg); dlg.showModal();
}

async function viewUsers() {
  const { users } = await api('users.list');
  const edit = u => userDialog(u, d => api('users.save', d), () => { Store.boot = null; viewUsers().catch(showError); });
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Потребители'), h('p', { class: 'muted small' }, 'Всеки потребител получава на имейла си номера на организацията и еднократна връзка, с която сам задава паролата си.')), h('button', { class: 'btn primary', onclick: () => edit(null) }, '+ Нов потребител')),
    h('div', { class: 'card table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Потребител', 'Имена', 'Длъжност', 'Имейл', 'Роля', 'Права', 'Състояние', 'Последен вход', ''].map(t => h('th', null, t)))),
      h('tbody', null, users.map(u => {
        const invite = h('button', { class: 'btn sm' }, 'Изпрати връзка за парола');
        invite.addEventListener('click', () => withBusy(invite, async () => { const r = await api('users.invite', { username: u.username }); toast(r.emailed ? 'Връзката е изпратена на ' + u.email + '.' : 'Имейлът не се изпрати. Опитайте отново.'); }));
        return h('tr', null, h('td', { class: 'mono' }, u.username), h('td', null, u.name), h('td', null, u.position), h('td', null, u.email), h('td', null, u.role),
          h('td', { class: 'small' }, u.perms.length === Docs.defaultPerms(u.role).length && Docs.defaultPerms(u.role).every(k => u.perms.includes(k)) ? 'по подразбиране' : Docs.PERMS.filter(p => u.perms.includes(p[0])).map(p => p[1]).join('; ') || 'без права'),
          h('td', null, u.active !== 'Да' ? h('span', { class: 'pill bad' }, 'Спрян') : u.pending ? h('span', { class: 'pill warn' }, 'Чака парола') : h('span', { class: 'pill ok' }, 'Активен')),
          h('td', { class: 'mono small' }, fmtTime(u.lastLogin)),
          h('td', { class: 'right' }, h('div', { class: 'actions' }, h('button', { class: 'btn sm', onclick: () => edit(u) }, 'Промени'), invite)));
      })))));
}

function logView(rows) {
  return [h('div', { class: 'head' }, h('h1', null, 'Дневник')), h('div', { class: 'card table-wrap' }, rows.length ? h('table', null,
    h('thead', null, h('tr', null, ['Време', 'Потребител', 'Действие', 'Обект', 'Подробности'].map(t => h('th', null, t)))),
    h('tbody', null, rows.map(l => h('tr', null, h('td', { class: 'mono small' }, fmtTime(l.at)), h('td', null, l.actor), h('td', null, l.action), h('td', null, l.ref), h('td', { class: 'small' }, l.details))))) : h('p', { class: 'muted' }, 'Няма записи.'))];
}

function viewMe() {
  const me = session.me;
  const form = h('form', { class: 'card' }, h('h2', null, 'Смяна на парола'), h('br'), h('div', { class: 'stack' },
    h('input', { class: 'hidden-field', type: 'text', value: me.username, autocomplete: 'username', tabindex: '-1', 'aria-hidden': 'true' }),
    fieldEl({ k: 'current', label: 'Текуща парола', type: 'password', req: true, autocomplete: 'current-password' }),
    fieldEl({ k: 'next', label: 'Нова парола', type: 'password', req: true, autocomplete: 'new-password', hint: 'Поне 12 знака, с букви и цифри.' }),
    fieldEl({ k: 'again', label: 'Повторете новата парола', type: 'password', req: true, autocomplete: 'new-password' })),
  h('button', { class: 'btn primary block', type: 'submit' }, 'Смени паролата'));
  submitter(form, async d => {
    checkPassword(d.next, d.again);
    await api('password', { current: await preHash(me.no, me.username, d.current), next: await preHash(me.no, me.username, d.next) });
    form.reset();
    toast('Паролата е сменена.');
  });
  setView(h('div', { class: 'head' }, h('h1', null, 'Моят профил')),
    h('div', { class: 'split' }, form, h('div', { class: 'card' }, h('dl', { class: 'kv' },
      h('dt', null, 'Име'), h('dd', null, me.name), h('dt', null, 'Потребител'), h('dd', { class: 'mono' }, me.username),
      h('dt', null, 'Роля'), h('dd', null, me.role), h('dt', null, 'Организация'), h('dd', null, me.org), h('dt', null, 'Номер'), h('dd', { class: 'mono' }, me.no)))));
}

/* ---------- оператор ---------- */

async function viewOpApps() {
  const { apps, applyOpen } = await api('op.apps');
  const pending = apps.filter(a => a.status === 'Чака одобрение');
  const row = a => h('div', { class: 'card stack' },
    h('div', { class: 'head' }, h('div', null, h('h2', null, a.name), h('p', { class: 'small muted mono' }, `${a.id} · ${fmtTime(a.at)} · ЕИК/БУЛСТАТ ${a.eik}`)),
      h('span', { class: 'pill ' + (a.status === 'Одобрена' ? 'ok' : a.status === 'Отказана' ? 'bad' : 'warn') }, a.status)),
    h('details', { open: a.status === 'Чака одобрение' }, h('summary', null, 'Всички данни'), h('br'),
      h('dl', { class: 'kv' }, [...ORG_SECTIONS, ADMIN_SECTION].flatMap(s => s[1]).concat(SEAT_FIELDS).filter(f => f.k !== 'password' && f.k !== 'again').flatMap(f => [h('dt', null, f.label), h('dd', null, a.data[f.k] || '—')]))),
    a.status === 'Чака одобрение' ? [
      h('p', { class: 'warnbox small' }, 'Преди одобрение проверете ЕИК/БУЛСТАТ в официалния регистър и потвърдете заявката през официалния контакт на организацията.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: async e => { await withBusy(e.target, async () => {
          const r = await api('op.decide', { id: a.id, approve: true });
          toast(`Одобрена. Номер на организацията: ${r.no}`);
          viewOpApps().catch(showError);
        }); } }, 'Одобри и създай таблица'),
        h('button', { class: 'btn danger', onclick: () => rejectDialog(a) }, 'Откажи'))
    ] : (a.reason ? h('p', { class: 'small' }, `Причина: ${a.reason}`) : a.orgNo ? h('p', { class: 'small' }, `Номер на организацията: ${a.orgNo}`) : null));
  const toggle = h('button', { class: 'btn' + (applyOpen ? ' danger' : ' primary') }, applyOpen ? 'Спри заявките' : 'Включи заявките');
  toggle.addEventListener('click', () => withBusy(toggle, async () => {
    await api('op.applyOpen', { open: !applyOpen });
    toast(applyOpen ? 'Новите заявки са спрени.' : 'Новите заявки са включени.');
    viewOpApps().catch(showError);
  }));
  setView(h('div', { class: 'head' }, h('h1', null, 'Заявки за регистрация'), h('span', { class: 'pill warn' }, `Чакат одобрение: ${pending.length}`)),
    h('div', { class: 'card head' }, h('div', null, h('h2', null, 'Прием на нови заявки: ', h('span', { class: 'pill ' + (applyOpen ? 'ok' : 'bad') }, applyOpen ? 'включен' : 'спрян')),
      h('p', { class: 'small muted' }, 'Когато е спрян, формата за регистрация не приема заявки. Подадените заявки може да се решават, а операторите могат да добавят организации.')), toggle),
    apps.length ? h('div', { class: 'stack' }, apps.map(row)) : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Няма подадени заявки.')));
}
function rejectDialog(a) {
  const form = h('form', null, h('h2', null, `Отказ за ${a.name}`),
    fieldEl({ k: 'reason', label: 'Причина (ще бъде изпратена на организацията)', type: 'textarea', req: true }),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Назад'), h('button', { class: 'btn danger', type: 'submit' }, 'Откажи заявката')));
  const dlg = h('dialog', null, form);
  dlg.addEventListener('close', () => dlg.remove());
  submitter(form, async d => { await api('op.decide', { id: a.id, approve: false, reason: d.reason }); dlg.close(); viewOpApps().catch(showError); });
  document.body.append(dlg); dlg.showModal();
}
async function viewOpOrgs() {
  const { orgs } = await api('op.orgs');
  setView(h('div', { class: 'head' }, h('h1', null, 'Организации'), h('a', { class: 'btn primary', href: '#/op/new' }, '+ Добави организация')), h('div', { class: 'card table-wrap' }, orgs.length ? h('table', null,
    h('thead', null, h('tr', null, ['Номер', 'Наименование', 'ЕИК/БУЛСТАТ', 'Вид', 'План', 'Статус', 'Одобрена', ''].map(t => h('th', null, t)))),
    h('tbody', null, orgs.map(o => {
      const next = o.status === 'Активна' ? 'Спряна' : 'Активна';
      const toggle = h('button', { class: 'btn sm' + (next === 'Спряна' ? ' danger' : '') }, next === 'Спряна' ? 'Спри достъпа' : 'Активирай');
      toggle.addEventListener('click', () => withBusy(toggle, async () => { await api('op.status', { no: o.no, status: next }); viewOpOrgs().catch(showError); }));
      const inv = h('a', { class: 'btn sm', href: '#/op/org/' + o.no }, 'Данни и пароли');
      return h('tr', null, h('td', { class: 'mono' }, o.no), h('td', null, o.name), h('td', { class: 'mono' }, o.eik), h('td', null, o.type), h('td', null, o.planName || '—'),
        h('td', null, h('span', { class: 'pill ' + (o.status === 'Активна' ? 'ok' : 'bad') }, o.status)), h('td', { class: 'mono small' }, fmtTime(o.approvedAt)),
        h('td', null, h('div', { class: 'actions' }, toggle, inv)));
    }))) : h('p', { class: 'muted' }, 'Още няма одобрени организации.')));
}

function viewOpNew() {
  const adminFields = ADMIN_SECTION[1].filter(f => f.k !== 'password' && f.k !== 'again');
  const form = h('form', { class: 'card' },
    ORG_SECTIONS.map(([title, fields]) => h('fieldset', null, h('legend', null, title), h('div', { class: 'form-grid' }, fields.map(f => fieldEl(f))))),
    h('fieldset', null, h('legend', null, ADMIN_SECTION[0]), h('div', { class: 'form-grid' }, adminFields.map(f => fieldEl(f)))),
    h('p', { class: 'note' }, 'Организацията се създава веднага, без одобрение, в собствена Google таблица. Администраторът получава на имейла си номера и еднократна връзка, с която задава парола.'), h('br'),
    h('button', { class: 'btn primary', type: 'submit' }, 'Създай организация и изпрати връзка'));
  form.querySelector('[name=type]').addEventListener('change', e => {
    form.querySelector('[name=basis]').value = BASIS_BY_TYPE[e.target.value] || 'чл. 3, ал. 1';
  });
  submitter(form, async d => {
    for (let i = 0; ; i++) {
      const no = newOrgNumber();
      try {
        const r = await api('op.org.create', Object.assign({}, d, { no }));
        toast(r.emailed ? 'Организацията е създадена. Връзката е изпратена на ' + d.adminEmail + '.' : 'Организацията е създадена, но имейлът не се изпрати. Изпратете нова връзка от потребителите.');
        location.hash = '#/op/org/' + no;
        return;
      } catch (e) { if (e.code !== 'retry' || i >= 4) throw e; }
    }
  });
  setView(h('div', { class: 'head' }, h('div', null, h('p', { class: 'small' }, h('a', { href: '#/op/orgs' }, '← Всички организации')), h('h1', null, 'Нова организация'))), form);
}

async function viewOpOrg(no) {
  const r = await api('op.org.get', { no });
  const form = h('form', { class: 'card' },
    ORG_SECTIONS.map(([title, fields]) => h('fieldset', null, h('legend', null, title), h('div', { class: 'form-grid' }, fields.map(f => fieldEl(f, r.profile[f.k], r.profile))))),
    h('button', { class: 'btn primary', type: 'submit' }, 'Запази данните'));
  submitter(form, async d => {
    await api('op.org.save', Object.assign(d, { no }));
    toast('Данните са записани.');
    viewOpOrg(no).catch(showError);
  });
  const reload = () => viewOpOrg(no).catch(showError);
  const planForm = h('form', { class: 'card' }, h('h2', null, 'План'), h('br'),
    fieldEl({ k: 'plan', label: 'План на организацията', type: 'select', options: [['', 'Без план']].concat(r.plans.map(p => [p.id, `${p.name} (${p.status})`])), hint: 'Плановете още не ограничават нищо. Организацията вижда плана си, когато е „Въведен“.' }, r.plan), h('br'),
    h('button', { class: 'btn sm', type: 'submit' }, 'Запази плана'));
  submitter(planForm, async d => { await api('op.org.plan', { no, plan: d.plan }); toast('Планът е записан.'); reload(); });
  const users = h('div', { class: 'card table-wrap' },
    h('div', { class: 'head' }, h('h2', null, 'Потребители'), h('button', { class: 'btn sm', onclick: () => userDialog(null, d => api('op.user.save', Object.assign(d, { no })), reload) }, '+ Нов потребител')),
    h('table', null,
      h('thead', null, h('tr', null, ['Потребител', 'Имена', 'Роля', 'Права', 'Състояние', 'Последен вход', ''].map(t => h('th', null, t)))),
      h('tbody', null, r.users.map(u => {
        const gen = h('button', { class: 'btn sm' }, 'Изпрати връзка за парола');
        gen.addEventListener('click', () => withBusy(gen, async () => {
          const res = await api('op.user.invite', { no, username: u.username });
          toast(res.emailed ? 'Връзката е изпратена на ' + u.email + '.' : 'Имейлът не се изпрати. Опитайте отново.');
          reload();
        }));
        return h('tr', null, h('td', { class: 'mono' }, u.username), h('td', null, u.name), h('td', null, u.role),
          h('td', { class: 'small' }, u.perms.length === Docs.defaultPerms(u.role).length && Docs.defaultPerms(u.role).every(k => u.perms.includes(k)) ? 'по подразбиране' : Docs.PERMS.filter(p => u.perms.includes(p[0])).map(p => p[1]).join('; ') || 'без права'),
          h('td', null, u.active !== 'Да' ? h('span', { class: 'pill bad' }, 'Спрян') : u.pending ? h('span', { class: 'pill warn' }, 'Чака парола') : h('span', { class: 'pill ok' }, 'Активен')),
          h('td', { class: 'mono small' }, fmtTime(u.lastLogin)),
          h('td', { class: 'right' }, h('div', { class: 'actions' }, h('button', { class: 'btn sm', onclick: () => userDialog(u, d => api('op.user.save', Object.assign(d, { no })), reload) }, 'Промени'), gen)));
      }))));
  setView(h('div', { class: 'head' }, h('div', null, h('p', { class: 'small' }, h('a', { href: '#/op/orgs' }, '← Всички организации')), h('h1', null, r.profile.name), h('p', { class: 'muted small' }, 'Номер на организацията: ', h('b', { class: 'mono' }, no))), h('div', { class: 'actions' }, h('a', { class: 'btn sm', href: '#/op/addressees/' + no }, 'Адресати'), h('span', { class: 'pill ' + (r.status === 'Активна' ? 'ok' : 'bad') }, r.status))),
    h('div', { class: 'stack' }, users, h('details', { class: 'card' }, h('summary', null, 'Входове на потребителите'), h('br'), loginsTable(r.logins)), planForm, signersCard(r.signers, true, d => api('op.signer.save', Object.assign(d, { no })), reload),
      groundsCard(r.grounds, true, d => api('op.ground.save', Object.assign(d, { no })), reload), form));
}

async function viewOpPlans() {
  const { plans } = await api('op.plans');
  const edit = p => {
    const form = h('form', null, h('h2', null, p ? 'Промяна на план' : 'Нов план'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'name', label: 'Наименование', req: true }, p && p.name),
      fieldEl({ k: 'status', label: 'Състояние', type: 'select', options: PLAN_STATUS, req: true }, p ? p.status : PLAN_STATUS[0]),
      fieldEl({ k: 'description', label: 'Описание', type: 'textarea', rows: 4, hint: 'Организацията го вижда, след като планът е „Въведен“ и ѝ е зададен.' }, p && p.description)),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, 'Запази')));
    const dlg = h('dialog', null, form);
    dlg.addEventListener('close', () => dlg.remove());
    submitter(form, async d => {
      await api('op.plan.save', Object.assign(d, { id: p ? p.id : '' }));
      dlg.close();
      toast('Планът е записан.');
      viewOpPlans().catch(showError);
    });
    document.body.append(dlg); dlg.showModal();
  };
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Планове'), h('p', { class: 'muted small' }, 'Подготовка за по-късно. Плановете засега нямат цени и ограничения и не променят какво може да прави организацията.')),
    h('button', { class: 'btn primary', onclick: () => edit(null) }, '+ Нов план')),
    h('div', { class: 'card table-wrap' }, plans.length ? h('table', null,
      h('thead', null, h('tr', null, ['Наименование', 'Описание', 'Състояние', ''].map(t => h('th', null, t)))),
      h('tbody', null, plans.map(p => h('tr', null, h('td', null, p.name), h('td', { class: 'pre' }, p.description || '—'),
        h('td', null, h('span', { class: 'pill ' + (p.status === 'Въведен' ? 'ok' : 'warn') }, p.status)),
        h('td', { class: 'right' }, h('button', { class: 'btn sm', onclick: () => edit(p) }, 'Промени')))))) : h('p', { class: 'muted' }, 'Още няма планове.')));
}

/* ---------- маршрути ---------- */

function showError(e) {
  if (!session) return;
  setView(h('div', { class: 'card' }, h('h2', null, 'Неуспешно зареждане'), h('br'), h('p', { class: 'err' }, e.message), h('br'), h('button', { class: 'btn', onclick: route }, 'Опитай отново')));
}

const PROTECTED_PAGES = ['cases', 'new', 'case', 'addressees', 'space', 'court', 'logins', 'docs', 'reports', 'art15', 'org', 'users', 'log', 'me', 'op'];

async function route() {
  const parts = (location.hash || '#/').slice(2).split('/').map(p => { try { return decodeURIComponent(p); } catch (e) { return ''; } });
  const page = parts[0] || '';
  if (page === 'activate') return viewActivate(parts[1], parts[2], parts[3]);
  if (page === 'apply') return viewApply();
  if (page === 'forgot') return viewForgot();
  if (page === 'home') return viewHome();
  if (!session) {
    if (page === '') return viewHome();
    if (page !== 'login' && !PROTECTED_PAGES.includes(page)) return viewNotFound();
    if (page !== 'login') history.replaceState(null, '', '#/login');
    return viewLogin();
  }
  if (page === 'login') { location.hash = session.me.operator ? '#/op/apps' : '#/'; return; }
  if (!document.getElementById('view')) shell();
  markTab();
  document.getElementById('view').replaceChildren(h('p', { class: 'loading' }, 'Зареждане…'));
  try {
    if (session.me.operator) {
      if (page === 'me') return viewMe();
      if (parts[1] === 'changes') return await viewOpChanges();
      if (parts[1] === 'orgs') return await viewOpOrgs();
      if (parts[1] === 'plans') return await viewOpPlans();
      if (parts[1] === 'addressees') return await viewOpAddressees(parts[2]);
      if (parts[1] === 'org') return await viewOpOrg(parts[2]);
      if (parts[1] === 'new') return viewOpNew();
      if (parts[1] === 'log') return setView(logView((await api('op.log')).log));
      if (parts[0] === 'op' && parts[1] === 'apps') return await viewOpApps();
      if (page === '' || (page === 'op' && !parts[1])) { location.hash = '#/op/apps'; return; }
      return setView(notFoundBody());
    }
    switch (page) {
      case '': return await viewDash();
      case 'cases': return await viewCases();
      case 'new': return await viewNew();
      case 'case': return await viewCase(parts[1]);
      case 'addressees': return await viewAddressees();
      case 'docs': return await viewDocs();
      case 'reports': return await viewReports();
      case 'art15': return await viewArt15();
      case 'org': return await viewOrg();
      case 'users': return await viewUsers();
      case 'log': return setView(logView((await api('log.list')).log));
      case 'me': return viewMe();
      case 'space': return await viewSpace();
      case 'court': return await viewCourt(parts[1]);
      case 'logins': return await viewLogins();
      default: return setView(notFoundBody());
    }
  } catch (e) { showError(e); }
}

window.addEventListener('hashchange', route);
route();
