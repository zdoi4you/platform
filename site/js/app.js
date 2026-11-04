/* Платформа за задължените лица – интерфейс. Всички данни се вмъкват с textContent, без innerHTML. */
'use strict';

const API = window.PLATFORM_API;
const { DEFS, art15Items, ACCESS_FORMS, fmt } = window.Docs;
const OP_NO = '00000000';

const ORG_TYPES = ['Община', 'Областна администрация', 'Министерство', 'Държавна агенция или комисия', 'Друга администрация', 'Публичноправна организация', 'Юридическо лице'];
const BASIS_BY_TYPE = { 'Публичноправна организация': 'чл. 3, ал. 2, т. 1', 'Юридическо лице': 'чл. 3, ал. 2, т. 2' };
const BASES = [
  ['чл. 3, ал. 1', 'чл. 3, ал. 1 – държавен орган, териториално звено или орган на местното самоуправление'],
  ['чл. 3, ал. 2, т. 1', 'чл. 3, ал. 2, т. 1 – публичноправен субект, включително публичноправна организация'],
  ['чл. 3, ал. 2, т. 2', 'чл. 3, ал. 2, т. 2 – лице с дейност, финансирана от консолидирания бюджет или фондове на ЕС']
];
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
    { k: 'oblast', label: 'Област', req: true },
    { k: 'municipality', label: 'Община', req: true },
    { k: 'city', label: 'Населено място', req: true },
    { k: 'postcode', label: 'Пощенски код', req: true, pattern: '\\d{4}' },
    { k: 'address', label: 'Адрес', req: true, full: true },
    { k: 'phone', label: 'Телефон', req: true, type: 'tel' },
    { k: 'email', label: 'Официален имейл', req: true, type: 'email' },
    { k: 'web', label: 'Интернет страница', req: true, type: 'url', placeholder: 'https://' },
    { k: 'court', label: 'Компетентен административен съд', req: true, hint: 'Посочва се в решенията (чл. 40 ЗДОИ).', placeholder: 'Административен съд – …' }
  ]],
  ['Звено за приемане на заявления (чл. 15, ал. 1, т. 4)', [
    { k: 'unitName', label: 'Наименование на звеното', req: true, full: true },
    { k: 'unitAddress', label: 'Адрес', req: true, full: true },
    { k: 'unitEmail', label: 'Имейл за заявления', req: true, type: 'email' },
    { k: 'unitPhone', label: 'Телефон', req: true, type: 'tel' },
    { k: 'unitHours', label: 'Работно време', req: true }
  ]]
];
const ADMIN_SECTION = ['Администратор на организационния профил', [
  { k: 'adminName', label: 'Имена', req: true },
  { k: 'adminPosition', label: 'Длъжност', req: true },
  { k: 'adminEmail', label: 'Служебен имейл', req: true, type: 'email', hint: 'За известия. Данни за вход не се изпращат по имейл.' },
  { k: 'adminPhone', label: 'Телефон', req: true, type: 'tel' },
  { k: 'adminUsername', label: 'Потребителско име', req: true, pattern: '[a-z0-9._\\-]{3,40}', autocomplete: 'username', hint: 'Малки латински букви, цифри и . _ -' },
  { k: 'password', label: 'Парола', type: 'password', req: true, autocomplete: 'new-password', hint: 'Поне 12 знака, с букви и цифри.' },
  { k: 'again', label: 'Повторете паролата', type: 'password', req: true, autocomplete: 'new-password' }
]];

const CASE_KIND = ['Достъп до обществена информация', 'Повторно използване на информация'];
const CASE_CHANNEL = ['Писмено', 'По имейл (чл. 15, ал. 1, т. 4)', 'Платформа за достъп (чл. 15в)', 'Устно запитване', 'Сигурно електронно връчване'];
const APPLICANT_TYPE = ['Гражданин', 'Юридическо лице', 'Журналист или медия', 'Неправителствена организация'];
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
const setView = (...nodes) => { const v = document.getElementById('view') || $app(); v.replaceChildren(...nodes.flat()); window.scrollTo(0, 0); };
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3500);
}
const fmtTime = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}` : (iso || '—'); };
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia' });
const optionPair = o => (Array.isArray(o) ? o : [o, o]);

function fieldEl(def, value) {
  const name = def.k, req = !!def.req;
  let input;
  if (def.type === 'select') {
    input = h('select', { name, required: req }, h('option', { value: '' }, 'Изберете…'), (def.options || []).map(o => { const [v, l] = optionPair(o); return h('option', { value: v }, l); }));
    input.querySelectorAll('option').forEach(o => { if (o.value === '' && (def.options || []).some(x => optionPair(x)[0] === '')) o.remove(); });
    input.value = value === undefined || value === null ? '' : value;
  } else if (def.type === 'textarea') {
    input = h('textarea', { name, required: req, rows: def.rows || 4, maxlength: 8000 });
    input.value = value || '';
  } else {
    input = h('input', { name, type: def.type || 'text', required: req, pattern: def.pattern, placeholder: def.placeholder, min: def.min, max: def.max, readonly: def.readonly, autocomplete: def.autocomplete || 'off', inputmode: def.inputmode });
    input.value = value === undefined || value === null ? '' : value;
  }
  return h('label', { class: 'field' + (def.full || def.type === 'textarea' ? ' full' : '') },
    h('span', null, def.label, req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), input, def.hint ? h('small', null, def.hint) : null);
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
  $app().replaceChildren(h('div', { class: 'gate' }, logoEl(false), h('div', { class: 'card gate-card' + (wide ? ' wide' : '') }, card), h('div', { class: 'gate-foot' }, themePicker(), h('a', { href: 'https://zdoi4you.eu', rel: 'noopener' }, 'zdoi4you.eu'))));
  window.scrollTo(0, 0);
}

function shell() {
  const me = session.me;
  const tabs = me.operator
    ? [['#/op/apps', 'Заявки за регистрация'], ['#/op/orgs', 'Организации'], ['#/op/log', 'Дневник'], ['#/me', 'Моят профил']]
    : [['#/', 'Табло'], ['#/cases', 'Преписки'], ['#/docs', 'Документи'], ['#/reports', 'Отчети'], ['#/art15', 'Чл. 15'], ['#/org', 'Организация']]
      .concat(me.role === 'Администратор' ? [['#/users', 'Потребители'], ['#/log', 'Дневник']] : []).concat([['#/me', 'Моят профил']]);
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
    h('main', { id: 'view' }, h('p', { class: 'loading' }, 'Зареждане…')));
  startTimer();
}
function markTab() {
  const cur = location.hash || '#/';
  document.querySelectorAll('nav.tabs a').forEach(a => {
    const href = a.getAttribute('href');
    const on = href === '#/' ? cur === '#/' : cur === href || cur.startsWith(href + '/') || (href === '#/cases' && (cur.startsWith('#/case/') || cur === '#/new'));
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
const Store = { boot: null };
async function boot() {
  if (!Store.boot) Store.boot = await api('org.bootstrap');
  return Store.boot;
}

/* ---------- публични страници ---------- */

function viewLogin(prefill) {
  const no = (prefill && prefill.no) || '', username = (prefill && prefill.username) || '';
  const form = h('form', { novalidate: false },
    h('div', { class: 'stack' },
      fieldEl({ k: 'no', label: 'Номер на организацията', req: true, pattern: '\\d{8}', inputmode: 'numeric', autocomplete: 'organization', hint: 'Осемцифреният номер, получен при одобрението.' }, no),
      fieldEl({ k: 'username', label: 'Потребителско име', req: true, autocomplete: 'username' }, username),
      fieldEl({ k: 'password', label: 'Парола', type: 'password', req: true, autocomplete: 'current-password' })),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Вход'));
  submitter(form, async d => {
    const user = d.username.trim().toLowerCase(), num = d.no.trim();
    const r = await api('login', { no: num, username: user, hash: await preHash(num, user, d.password) });
    session = { token: r.token, me: r.me, exp: r.session };
    saveSession();
    location.hash = r.me.operator ? '#/op/apps' : '#/';
    route();
  });
  gate([
    h('h1', null, 'Вход в платформата'),
    h('p', { class: 'muted' }, 'Платформа за задължените лица по ЗДОИ'),
    form,
    h('div', { class: 'gate-links' }, h('a', { href: '#/forgot' }, 'Забравена парола'), h('a', { href: '#/apply' }, 'Регистрация на организация'))
  ]);
}

function viewForgot() {
  gate([
    h('h1', null, 'Забравена парола'),
    h('p', null, 'От съображения за сигурност данни за вход не се изпращат по имейл.'), h('br'),
    h('p', { class: 'muted' }, 'Служител: обърнете се към администратора на организацията. Той ще създаде еднократна връзка за нова парола и ще ви я предаде лично.'), h('br'),
    h('p', { class: 'muted' }, 'Администратор: обърнете се към друг администратор на организацията или към екипа на ЗДОИ4You. Същото важи, ако сте загубили номера на организацията.'),
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

function viewApply() {
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
    let r, no;
    for (let i = 0; i < 5 && !r; i++) {
      no = newOrgNumber();
      try {
        r = await api('public.apply', Object.assign({}, data, { no, hash: await preHash(no, username, password) }));
      } catch (e) {
        if (e.code !== 'retry' || i === 4) throw e;
      }
    }
    gate([
      h('h1', null, 'Заявката е подадена'),
      h('p', { class: 'muted' }, `Номер на заявката: ${r.id}`), h('br'),
      h('p', { class: 'warnbox' }, 'Запишете номера на организацията сега. Той не се изпраща по имейл.'), h('br'),
      h('dl', { class: 'kv' }, h('dt', null, 'Номер на организацията'), h('dd', { class: 'bigdue', id: 'org-no' }, no), h('dt', null, 'Потребителско име'), h('dd', { class: 'mono' }, username)), h('br'),
      h('p', { class: 'muted' }, 'Ще можете да влезете с тези данни и избраната парола след одобрение от екипа на ЗДОИ4You. За решението ще получите известие на официалния имейл.'),
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
      h('td', null, c.due ? h('div', { class: 'mono small' }, fmt(c.due)) : null, duePill(c)),
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
      h('a', { class: 'btn primary', href: '#/new' }, '+ Нова преписка')),
    h('div', { class: 'tiles' },
      tile(open.length, 'Активни преписки', '', '#/cases'),
      tile(late.length, 'С изтекъл срок', late.length ? 'bad' : '', '#/cases'),
      tile(soon.length, 'Изтичат до 3 дни', soon.length ? 'warn' : '', '#/cases'),
      tile(rows.filter(c => c.regDate.startsWith(year)).length, `Заявления през ${year} г.`, '', '#/reports')),
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
  setView(h('div', { class: 'head' }, h('h1', null, 'Преписки по ЗДОИ'), h('a', { class: 'btn primary', href: '#/new' }, '+ Нова преписка')),
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
      { k: 'applicantSeat', label: 'Седалище (за юридически лица)' },
      { k: 'applicantAddress', label: 'Адрес за кореспонденция', hint: 'Адрес или имейл е задължителен (чл. 25, ал. 1, т. 4).' },
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
    h('fieldset', null, h('legend', null, 'Заявител'), h('div', { class: 'form-grid' }, F.applicant.map(f => fieldEl(f, f.k === 'applicantType' ? APPLICANT_TYPE[0] : '')))),
    h('fieldset', null, h('legend', null, 'Заявление'), h('div', { class: 'form-grid' }, F.request.map(f => fieldEl(f, f.k === 'noPublish' ? 'Не' : '')))),
    h('button', { class: 'btn primary', type: 'submit' }, 'Създай преписка'));
  submitter(form, async d => {
    const r = await api('case.create', d);
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
    h('fieldset', null, h('legend', null, 'Заявител'), h('div', { class: 'form-grid' }, F.applicant.map(f => fieldEl(f, c[f.k])))),
    h('fieldset', null, h('legend', null, 'Заявление'), h('div', { class: 'form-grid' }, F.request.map(f => fieldEl(f, f.k === 'noPublish' ? (c.noPublish || 'Не') : c[f.k])))),
    h('fieldset', null, h('legend', null, 'Срокове и движение'), h('div', { class: 'form-grid' },
      fieldEl({ k: 'clarifyAsked', label: 'Поискано уточняване (чл. 29)', type: 'date' }, c.clarifyAsked),
      fieldEl({ k: 'clarifyGot', label: 'Получено уточняване', type: 'date', hint: 'Срокът от 14 дни тече от тази дата.' }, c.clarifyGot),
      fieldEl({ k: 'ext30', label: 'Удължаване чл. 30 (дни)', type: 'number', min: 0, max: 10 }, c.ext30),
      fieldEl({ k: 'ext31', label: 'Удължаване чл. 31 (дни)', type: 'number', min: 0, max: 14 }, c.ext31),
      fieldEl({ k: 'thirdAsked', label: 'Поискано съгласие от трето лице', type: 'date' }, c.thirdAsked))),
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
    c.thirdBy ? h('p', { class: 'warnbox small' }, `Съгласието на третото лице се иска до ${fmt(c.thirdBy)} (чл. 31, ал. 2).`) : null);

  const types = Object.entries(DEFS).filter(([k]) => k !== 'report' && k !== 'art15');
  const groups = [...new Set(types.map(([, d]) => d.group))];
  const pick = h('select', { 'aria-label': 'Вид документ' }, h('option', { value: '' }, 'Изберете документ…'),
    groups.map(g => h('optgroup', { label: g }, types.filter(([, d]) => d.group === g).map(([k, d]) => h('option', { value: k }, d.title)))));
  const docCard = h('div', { class: 'card stack' }, h('h2', null, 'Генериране на документ'), pick,
    h('button', { class: 'btn primary', onclick: () => { if (pick.value) docDialog(pick.value, c, b.profile); else toast('Изберете вид документ.'); } }, 'Продължи'));

  const docsCard = h('div', { class: 'card' }, h('h2', null, 'Документи по преписката'), h('br'), r.docs.length ? docList(r.docs) : h('p', { class: 'muted' }, 'Още няма документи.'));

  const note = h('form', null, h('label', { class: 'field' }, h('span', null, 'Вътрешен коментар'), h('textarea', { name: 'text', rows: 2, required: true, maxlength: 2000 })), h('button', { class: 'btn sm block', type: 'submit' }, 'Добави'));
  submitter(note, async d => { await api('case.comment', { regNo: c.regNo, text: d.text }); viewCase(c.regNo).catch(showError); });
  const hist = h('div', { class: 'card stack' }, h('h2', null, 'История'), note,
    h('ul', { class: 'timeline' }, r.events.map(e => h('li', null, h('div', { class: 'small muted' }, `${fmtTime(e.at)} · ${e.user} · ${e.kind}`), h('div', { class: 'pre' }, e.text)))));

  setView(h('div', { class: 'head' }, h('div', null, h('p', { class: 'small' }, h('a', { href: '#/cases' }, '← Всички преписки')), h('h1', null, `Преписка ${c.regNo}`), h('p', { class: 'muted' }, c.applicantName)), statusPill(c.status)),
    h('div', { class: 'split' }, form, h('div', { class: 'stack' }, dueCard, docCard, docsCard, hist)));
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

function docDialog(type, c, org) {
  const def = DEFS[type];
  const initial = f => (typeof f.value === 'function' ? f.value(c, org) : f.value);
  const form = h('form', null,
    h('h2', null, def.title),
    def.effect ? h('p', { class: 'note' }, def.effect) : null, h('br'),
    h('div', { class: 'form-grid' },
      fieldEl({ k: '__date', label: 'Дата на документа', type: 'date', req: true }, todayIso()),
      fieldEl({ k: '__no', label: 'Номер (по желание)', hint: 'Празно = автоматичен номер.' }),
      def.fields.map(f => fieldEl(f, initial(f)))),
    h('p', { class: 'small muted' }, 'Прегледайте текста преди подпис. Шаблоните не заменят преценката на юрист.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, 'Генерирай PDF')));
  const dlg = h('dialog', null, form);
  dlg.addEventListener('close', () => dlg.remove());
  submitter(form, async d => {
    const { __date: date, __no: no, ...fields } = d;
    const r = await api('doc.create', { type, regNo: c.regNo, date, no, title: def.title, fields });
    await downloadPdf(r.payload);
    dlg.close();
    toast(`Документ № ${r.no} е генериран.`);
    viewCase(c.regNo).catch(showError);
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
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Информация по чл. 15 ЗДОИ'), h('p', { class: 'muted small' }, `Попълнени: ${done} от ${list.length}. ${basisNote} Публикува се на интернет страницата в срок до 3 работни дни от приемането на акта или създаването на информацията (чл. 15а, ал. 4).`)), gen),
    h('div', { class: 'stack' }, list.map(([n, label]) => {
      const cur = map[String(n)] || {};
      const stamp = h('span', { class: 'small muted' }, cur.updated ? `Обновено на ${fmt(cur.updated)}` : 'Не е попълнено');
      const form = h('form', { class: 'card' }, h('h3', null, `т. ${n}. ${label}`), h('br'),
        h('div', { class: 'form-grid' }, fieldEl({ k: 'text', label: 'Описание', type: 'textarea', rows: 3 }, cur.text), fieldEl({ k: 'url', label: 'Интернет адрес', type: 'url', placeholder: 'https://', full: true }, cur.url)),
        h('br'), h('div', { class: 'actions' }, h('button', { class: 'btn sm', type: 'submit' }, 'Запази'), stamp));
      return submitter(form, async d => {
        const r = await api('art15.save', { item: String(n), text: d.text, url: d.url });
        stamp.textContent = `Обновено на ${fmt(r.updated)}`;
        toast(`Точка ${n} е записана.`);
      });
    })));
}

/* ---------- организация, потребители ---------- */

async function viewOrg() {
  const b = await boot(), admin = b.me.role === 'Администратор';
  const missing = ORG_SECTIONS.flatMap(s => s[1]).filter(f => !b.profile[f.k]);
  const form = h('form', { class: 'card' },
    ORG_SECTIONS.map(([title, fields]) => h('fieldset', { disabled: !admin }, h('legend', null, title), h('div', { class: 'form-grid' },
      fields.map(f => fieldEl(f.k === 'eik' ? Object.assign({}, f, { readonly: true, hint: 'ЕИК/БУЛСТАТ не се променя тук. Обърнете се към ЗДОИ4You.' }) : f, b.profile[f.k]))))),
    admin ? h('button', { class: 'btn primary', type: 'submit' }, 'Запази данните') : h('p', { class: 'muted small' }, 'Данните се променят от администратора на организацията.'));
  if (admin) {
    submitter(form, async d => {
      await api('org.save', d);
      Store.boot = null;
      const nb = await boot();
      session.me.org = nb.profile.name; saveSession();
      toast('Данните са записани.');
    });
  }
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Данни на организацията'), h('p', { class: 'muted small' }, 'Номер на организацията: ', h('b', { class: 'mono' }, b.me.no), '. Служителите го въвеждат при вход.'))),
    missing.length ? [h('p', { class: 'warnbox' }, 'Има непопълнени данни. Документи не могат да се генерират, докато не са попълнени всички.'), h('br')] : null, form);
}

/* еднократната връзка се показва само на екрана и се предава лично, не по имейл */
function showLink(res, name) {
  const input = h('input', { readonly: true, value: res.link, 'aria-label': 'Връзка за задаване на парола' });
  const dlg = h('dialog', null, h('h2', null, 'Еднократна връзка за парола'),
    h('p', null, `Предайте я лично на ${name || 'потребителя'}, заедно с номера на организацията и потребителското име. Показва се само сега и важи 7 дни.`), h('br'),
    input,
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: async () => { input.select(); try { await navigator.clipboard.writeText(res.link); toast('Връзката е копирана.'); } catch (e) { toast('Копирайте връзката ръчно.'); } } }, 'Копирай'),
      h('button', { class: 'btn primary', onclick: () => dlg.close() }, 'Затвори')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

async function viewUsers() {
  const { users } = await api('users.list');
  const edit = u => {
    const isNew = !u;
    const form = h('form', null, h('h2', null, isNew ? 'Нов потребител' : `Потребител ${u.username}`), h('div', { class: 'form-grid' },
      fieldEl({ k: 'username', label: 'Потребителско име', req: true, readonly: !isNew, pattern: '[a-z0-9._\\-]{3,40}', hint: 'Малки латински букви, цифри и . _ -' }, u && u.username),
      fieldEl({ k: 'name', label: 'Имена', req: true }, u && u.name),
      fieldEl({ k: 'position', label: 'Длъжност', req: true }, u && u.position),
      fieldEl({ k: 'email', label: 'Служебен имейл', type: 'email', req: true }, u && u.email),
      fieldEl({ k: 'phone', label: 'Телефон', type: 'tel' }, u && u.phone),
      fieldEl({ k: 'role', label: 'Роля', type: 'select', options: ['Служител', 'Администратор'], req: true }, u ? u.role : 'Служител'),
      isNew ? null : fieldEl({ k: 'active', label: 'Активен', type: 'select', options: ['Да', 'Не'], req: true }, u.active)),
    h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, 'Отказ'), h('button', { class: 'btn primary', type: 'submit' }, isNew ? 'Създай потребител' : 'Запази')));
    const dlg = h('dialog', null, form);
    dlg.addEventListener('close', () => dlg.remove());
    submitter(form, async d => {
      const r = await api('users.save', Object.assign(d, { isNew, active: isNew ? true : d.active === 'Да' }));
      dlg.close();
      Store.boot = null;
      if (r.created) showLink(r, d.name); else toast('Записано.');
      viewUsers().catch(showError);
    });
    document.body.append(dlg); dlg.showModal();
  };
  setView(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Потребители'), h('p', { class: 'muted small' }, 'Всеки потребител получава от вас лично еднократна връзка и сам задава паролата си. Данни за вход не се изпращат по имейл.')), h('button', { class: 'btn primary', onclick: () => edit(null) }, '+ Нов потребител')),
    h('div', { class: 'card table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Потребител', 'Имена', 'Длъжност', 'Имейл', 'Роля', 'Състояние', 'Последен вход', ''].map(t => h('th', null, t)))),
      h('tbody', null, users.map(u => {
        const invite = h('button', { class: 'btn sm' }, 'Нова парола');
        invite.addEventListener('click', () => withBusy(invite, async () => showLink(await api('users.invite', { username: u.username }), u.name)));
        return h('tr', null, h('td', { class: 'mono' }, u.username), h('td', null, u.name), h('td', null, u.position), h('td', null, u.email), h('td', null, u.role),
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
  const { apps } = await api('op.apps');
  const pending = apps.filter(a => a.status === 'Чака одобрение');
  const row = a => h('div', { class: 'card stack' },
    h('div', { class: 'head' }, h('div', null, h('h2', null, a.name), h('p', { class: 'small muted mono' }, `${a.id} · ${fmtTime(a.at)} · ЕИК/БУЛСТАТ ${a.eik}`)),
      h('span', { class: 'pill ' + (a.status === 'Одобрена' ? 'ok' : a.status === 'Отказана' ? 'bad' : 'warn') }, a.status)),
    h('details', { open: a.status === 'Чака одобрение' }, h('summary', null, 'Всички данни'), h('br'),
      h('dl', { class: 'kv' }, [...ORG_SECTIONS, ADMIN_SECTION].flatMap(s => s[1]).flatMap(f => [h('dt', null, f.label), h('dd', null, a.data[f.k] || '—')]))),
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
  setView(h('div', { class: 'head' }, h('h1', null, 'Заявки за регистрация'), h('span', { class: 'pill warn' }, `Чакат одобрение: ${pending.length}`)),
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
  setView(h('div', { class: 'head' }, h('h1', null, 'Организации')), h('div', { class: 'card table-wrap' }, orgs.length ? h('table', null,
    h('thead', null, h('tr', null, ['Номер', 'Наименование', 'ЕИК/БУЛСТАТ', 'Вид', 'Статус', 'Одобрена', ''].map(t => h('th', null, t)))),
    h('tbody', null, orgs.map(o => {
      const next = o.status === 'Активна' ? 'Спряна' : 'Активна';
      const toggle = h('button', { class: 'btn sm' + (next === 'Спряна' ? ' danger' : '') }, next === 'Спряна' ? 'Спри достъпа' : 'Активирай');
      toggle.addEventListener('click', () => withBusy(toggle, async () => { await api('op.status', { no: o.no, status: next }); viewOpOrgs().catch(showError); }));
      const inv = h('button', { class: 'btn sm' }, 'Нова парола за администратора');
      inv.addEventListener('click', () => withBusy(inv, async () => { const r = await api('op.inviteAdmin', { no: o.no }); showLink(r, r.name); }));
      return h('tr', null, h('td', { class: 'mono' }, o.no), h('td', null, o.name), h('td', { class: 'mono' }, o.eik), h('td', null, o.type),
        h('td', null, h('span', { class: 'pill ' + (o.status === 'Активна' ? 'ok' : 'bad') }, o.status)), h('td', { class: 'mono small' }, fmtTime(o.approvedAt)),
        h('td', null, h('div', { class: 'actions' }, toggle, inv)));
    }))) : h('p', { class: 'muted' }, 'Още няма одобрени организации.')));
}

/* ---------- маршрути ---------- */

function showError(e) {
  if (!session) return;
  setView(h('div', { class: 'card' }, h('h2', null, 'Неуспешно зареждане'), h('br'), h('p', { class: 'err' }, e.message), h('br'), h('button', { class: 'btn', onclick: route }, 'Опитай отново')));
}

async function route() {
  const parts = (location.hash || '#/').slice(2).split('/').map(p => { try { return decodeURIComponent(p); } catch (e) { return ''; } });
  const page = parts[0] || '';
  if (page === 'activate') return viewActivate(parts[1], parts[2], parts[3]);
  if (page === 'apply') return viewApply();
  if (page === 'forgot') return viewForgot();
  if (!session) {
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
      if (parts[1] === 'orgs') return await viewOpOrgs();
      if (parts[1] === 'log') return setView(logView((await api('op.log')).log));
      if (parts[0] === 'op' && parts[1] === 'apps') return await viewOpApps();
      location.hash = '#/op/apps';
      return;
    }
    switch (page) {
      case '': return await viewDash();
      case 'cases': return await viewCases();
      case 'new': return await viewNew();
      case 'case': return await viewCase(parts[1]);
      case 'docs': return await viewDocs();
      case 'reports': return await viewReports();
      case 'art15': return await viewArt15();
      case 'org': return await viewOrg();
      case 'users': return await viewUsers();
      case 'log': return setView(logView((await api('log.list')).log));
      case 'me': return viewMe();
      default: location.hash = '#/';
    }
  } catch (e) { showError(e); }
}

window.addEventListener('hashchange', route);
route();
