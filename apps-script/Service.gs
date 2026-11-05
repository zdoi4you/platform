/*
 * Връзка с екипа на ЗДОИ4You: тикети, статус на системите и профилактики.
 * Данните са в главната таблица, защото се четат от операторите през всички организации.
 */

/* ---------- работно време на операторите: работни дни, 9:30–18:30 ч. ---------- */

const SUPPORT_FROM_ = 570, SUPPORT_TO_ = 1110;

function supportAt_(dateIso, minutes) {
  const day = parseIso_(dateIso), work = isWorkday_(day);
  if (work && minutes >= SUPPORT_FROM_ && minutes < SUPPORT_TO_) return { open: true, next: '' };
  let d = work && minutes < SUPPORT_FROM_ ? day : addDays_(day, 1);
  while (!isWorkday_(d)) d = addDays_(d, 1);
  return { open: false, next: dateKey_(d) + 'T09:30' };
}

function supportHours_() {
  const t = stamp_();
  return supportAt_(t.slice(0, 10), Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16)));
}

/* ---------- тикети ---------- */

const TICKET_STATUS = ['Нов', 'В обработка', 'Чака отговор от вас', 'Затворен'];
const TICKET_KIND = ['Технически проблем', 'Вход и потребители', 'Документи и PDF', 'Данни на организацията', 'Друго'];
const TICKET_CLOSED_ = 'Затворен';
const TICKETS_KEY_ = 'ticketsStaff';
const TICKET_TEAM_ = 'Екип на ЗДОИ4You';

const ticketLink_ = (id, op) => CFG.APP_URL + (op ? '#/op/ticket/' : '#/ticket/') + encodeURIComponent(id);
const ticketsStaffOn_ = ss => (read_(ss, 'profile').find(r => r.key === TICKETS_KEY_) || {}).value === 'Да';
const canOpenTicket_ = (ctx, ss) => ctx.role === ROLE_ADMIN || ticketsStaffOn_(ss);
const rowView_ = r => { const o = Object.assign({}, r); delete o._row; return o; };
const ticketMsgs_ = (m, id) => read_(m, 'ticketMsgs').filter(x => x.ticket === id).map(rowView_);

/* администраторът вижда тикетите на организацията си, а служителят само своите */
function ownTicket_(m, id, ctx) {
  const t = read_(m, 'tickets').find(x => x.id === str_(id, 40));
  if (!t || t.no !== ctx.no || (ctx.role !== ROLE_ADMIN && t.by !== ctx.username)) fail_('notfound', 'Тикетът не е намерен.');
  return t;
}

function ticketList_(d, ctx) {
  const ss = ctx.ss(), staffOn = ticketsStaffOn_(ss);
  return {
    tickets: read_(master_(), 'tickets').filter(t => t.no === ctx.no && (ctx.role === ROLE_ADMIN || t.by === ctx.username)).map(rowView_).reverse(),
    canOpen: ctx.role === ROLE_ADMIN || staffOn, staffOn: staffOn, kinds: TICKET_KIND, hours: supportHours_()
  };
}

function ticketGet_(d, ctx) {
  const m = master_(), t = ownTicket_(m, d.id, ctx);
  return { ticket: rowView_(t), messages: ticketMsgs_(m, t.id), hours: supportHours_() };
}

/* писмата съдържат само номера и вида събитие; текстът остава зад входа */
function mailOperators_(ctx, m, subject, body) {
  const seen = {};
  const props = PropertiesService.getScriptProperties().getProperty('NOTIFY');
  read_(m, 'ops').filter(o => o.active === 'Да' && o.email).map(o => o.email).concat(props ? [props] : []).forEach(to => {
    const key = to.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    afterLock_(ctx, () => mail_(to, subject, body));
  });
}

function ticketCreate_(d, ctx) {
  const ss = ctx.ss();
  if (!canOpenTicket_(ctx, ss)) fail_('role', 'В организацията ви тикети отварят само администраторите.');
  const subject = line_(d.subject, 160), text = str_(d.text, 4000), kind = oneOf_(d.kind, TICKET_KIND, 'Вид');
  if (!subject || !text) fail_('required', 'Напишете тема и описание на проблема.');
  const t = throttle_('ticket|' + ctx.no + '|' + ctx.username, 10);
  if (t.blocked()) fail_('locked', 'Отворихте много тикети за кратко време. Опитайте отново след 15 минути.');
  t.hit();
  const m = master_(), id = 'Т-' + todayIso_().slice(0, 4) + '-' + String(nextCounter_(m, 'tickets')).padStart(4, '0'), at = stamp_();
  insert_(m, 'tickets', { id: id, at: at, no: ctx.no, orgName: ctx.org.name, by: ctx.username, byName: ctx.name || ctx.username, kind: kind, subject: subject, status: TICKET_STATUS[0], updatedAt: at });
  insert_(m, 'ticketMsgs', { at: at, ticket: id, side: 'org', author: ctx.username, name: ctx.name || ctx.username, text: text });
  audit_(ss, ctx.username, 'Отворен тикет', id, kind);
  audit_(m, ctx.username, 'Отворен тикет', ctx.no, id);
  mailOperators_(ctx, m, 'Нов тикет ' + id, ctx.org.name + '\nВид: ' + kind + '\n\n' + ticketLink_(id, true));
  return { id: id, hours: supportHours_() };
}

function ticketReply_(d, ctx) {
  const m = master_(), t = ownTicket_(m, d.id, ctx), text = str_(d.text, 4000);
  if (t.status === TICKET_CLOSED_) fail_('state', 'Тикетът е затворен. Отворете нов.');
  if (!text) fail_('required', 'Напишете текст.');
  insert_(m, 'ticketMsgs', { at: stamp_(), ticket: t.id, side: 'org', author: ctx.username, name: ctx.name || ctx.username, text: text });
  patch_(m, 'tickets', t._row, { status: t.status === TICKET_STATUS[2] ? TICKET_STATUS[1] : t.status, updatedAt: stamp_() });
  mailOperators_(ctx, m, 'Нов отговор по тикет ' + t.id, t.orgName + '\n\n' + ticketLink_(t.id, true));
  return {};
}

function ticketClose_(d, ctx) {
  const m = master_(), t = ownTicket_(m, d.id, ctx);
  if (t.status === TICKET_CLOSED_) return {};
  patch_(m, 'tickets', t._row, { status: TICKET_CLOSED_, closedAt: stamp_(), updatedAt: stamp_() });
  audit_(ctx.ss(), ctx.username, 'Затворен тикет', t.id, '');
  return {};
}

function ticketSetting_(d, ctx) {
  if (typeof d.staff !== 'boolean') fail_('value', 'Невалидна стойност.');
  const ss = ctx.ss(), row = read_(ss, 'profile').find(r => r.key === TICKETS_KEY_), value = d.staff ? 'Да' : 'Не';
  if (row) patch_(ss, 'profile', row._row, { value: value }); else insert_(ss, 'profile', { key: TICKETS_KEY_, value: value });
  audit_(ss, ctx.username, d.staff ? 'Служителите могат да отварят тикети' : 'Тикети отварят само администраторите', '', '');
  return { staffOn: d.staff };
}

function opTickets_() {
  return { tickets: read_(master_(), 'tickets').map(rowView_).reverse(), statuses: TICKET_STATUS, hours: supportHours_() };
}

function opTicketGet_(d) {
  const m = master_(), t = read_(m, 'tickets').find(x => x.id === str_(d.id, 40));
  if (!t) fail_('notfound', 'Тикетът не е намерен.');
  return { ticket: rowView_(t), messages: ticketMsgs_(m, t.id), statuses: TICKET_STATUS, hours: supportHours_() };
}

/* текущият имейл на подателя, ако междувременно е сменен */
function ticketOwnerEmail_(t) {
  try {
    const u = read_(orgSheet_(regOrg_(t.no)), 'users').find(x => x.username === t.by);
    return u && u.active === 'Да' ? u.email : '';
  } catch (e) {
    console.error('тикет ' + t.id + ': ' + e.message);
    return '';
  }
}

function opTicketReply_(d, ctx) {
  const m = master_(), t = read_(m, 'tickets').find(x => x.id === str_(d.id, 40));
  if (!t) fail_('notfound', 'Тикетът не е намерен.');
  const text = str_(d.text, 4000), status = d.status ? oneOf_(d.status, TICKET_STATUS, 'Статус') : (text ? TICKET_STATUS[2] : t.status);
  if (!text && status === t.status) fail_('required', 'Напишете отговор или сменете статуса.');
  if (text) insert_(m, 'ticketMsgs', { at: stamp_(), ticket: t.id, side: 'op', author: ctx.username, name: TICKET_TEAM_, text: text });
  const closed = status === TICKET_CLOSED_;
  patch_(m, 'tickets', t._row, { status: status, handler: ctx.username, updatedAt: stamp_(), closedAt: closed ? stamp_() : '' });
  audit_(m, ctx.username, text ? 'Отговор по тикет' : 'Статус на тикет', t.no, t.id + ': ' + status);
  const to = ticketOwnerEmail_(t);
  if (to) afterLock_(ctx, () => mail_(to, 'ЗДОИ4You Платформа – тикет ' + t.id, (text ? 'Екипът отговори по тикета.' : 'Променен е статусът на тикета.') + '\nСтатус: ' + status + '\n\nОтворете тикета:\n' + ticketLink_(t.id, false)));
  return {};
}

/* ---------- статус на системите и профилактики ---------- */

const SYSTEM_STATES = ['Работи', 'Профилактика', 'Частичен проблем', 'Не работи'];
const DEFAULT_SYSTEMS = [['platform', 'Платформа и вход'], ['data', 'Данни и файлове'], ['docs', 'Документи в PDF'], ['mail', 'Имейл известия']];
const NOTICE_CANCELLED_ = 'Отменена';
const NOTICE_BUDGET_MS_ = 40000;
const STATUS_CACHE_ = 'status:v1';

/* публичното четене не създава листове: при липсващ лист важат стойностите по подразбиране */
const rowsIf_ = (m, key) => (m.getSheetByName(SCHEMA[key][0]) ? read_(m, key) : []);

function statusData_() {
  const cache = CacheService.getScriptCache(), hit = cache.get(STATUS_CACHE_);
  if (hit) return JSON.parse(hit);
  const m = master_(), saved = rowsIf_(m, 'systems');
  const systems = DEFAULT_SYSTEMS.map(([id, name]) => Object.assign({ id: id, name: name, state: SYSTEM_STATES[0], note: '', updatedAt: '' }, publicSystem_(saved.find(s => s.id === id))))
    .concat(saved.filter(s => !DEFAULT_SYSTEMS.some(x => x[0] === s.id)).map(publicSystem_));
  const notices = rowsIf_(m, 'notices').filter(n => n.state !== NOTICE_CANCELLED_).slice(-10).reverse()
    .map(n => ({ id: n.id, at: n.at, title: n.title, text: n.text, from: n.from, to: n.to }));
  const data = { systems: systems, notices: notices };
  try { cache.put(STATUS_CACHE_, JSON.stringify(data), 60); } catch (e) { console.error('статус: ' + e.message); }
  return data;
}

function publicSystem_(s) {
  if (!s) return {};
  return { id: s.id, name: s.name, state: s.state, note: s.note, updatedAt: s.updatedAt };
}

/* фазата зависи от часа, затова се изчислява при всяко четене, а не се кешира */
function statusView_() {
  const data = statusData_(), now = stamp_();
  const notices = data.notices.map(n => Object.assign({}, n, { phase: now < n.from ? 'upcoming' : now <= n.to ? 'active' : 'past' }));
  let worst = data.systems.reduce((w, s) => Math.max(w, SYSTEM_STATES.indexOf(s.state)), 0);
  if (!worst && notices.some(n => n.phase === 'active')) worst = 1;
  return { overall: SYSTEM_STATES[worst], systems: data.systems, notices: notices };
}

function publicStatus_() {
  return Object.assign(statusView_(), { hours: supportHours_(), states: SYSTEM_STATES });
}

const dropStatus_ = () => CacheService.getScriptCache().remove(STATUS_CACHE_);

function opSystemSave_(d, ctx) {
  const m = master_(), rows = read_(m, 'systems'), id = str_(d.id, 24);
  const v = { name: line_(d.name, 80), state: oneOf_(d.state, SYSTEM_STATES, 'Състояние'), note: line_(d.note, 300), updatedAt: stamp_(), by: ctx.username };
  const preset = DEFAULT_SYSTEMS.find(x => x[0] === id);
  if (!v.name) v.name = preset ? preset[1] : '';
  if (!v.name) fail_('required', 'Напишете наименование на системата.');
  const cur = rows.find(s => s.id === id);
  if (cur) patch_(m, 'systems', cur._row, v);
  else if (id && !preset) fail_('notfound', 'Системата не е намерена.');
  else insert_(m, 'systems', Object.assign({ id: id || 's' + randomToken_().slice(0, 15) }, v));
  audit_(m, ctx.username, 'Статус на система', v.name, v.state + (v.note ? ': ' + v.note : ''));
  dropStatus_();
  return {};
}

function opSystemDelete_(d, ctx) {
  const m = master_(), id = str_(d.id, 24);
  if (DEFAULT_SYSTEMS.some(x => x[0] === id)) fail_('value', 'Основните системи не се премахват.');
  const cur = read_(m, 'systems').find(s => s.id === id);
  if (!cur) fail_('notfound', 'Системата не е намерена.');
  table_(m, 'systems').deleteRow(cur._row);
  audit_(m, ctx.username, 'Премахната система', cur.name, '');
  dropStatus_();
  return {};
}

const NOTICE_TIME_RE_ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const bgTime_ = iso => iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) + ' ' + iso.slice(11, 16) + ' ч.';

function opNotices_() {
  return { notices: rowsIf_(master_(), 'notices').slice(-30).reverse().map(rowView_) };
}

function opNoticeSave_(d, ctx) {
  const title = line_(d.title, 160), text = str_(d.text, 2000), from = str_(d.from, 16), to = str_(d.to, 16);
  if (!title || !text) fail_('required', 'Напишете заглавие и текст на известието.');
  if (!NOTICE_TIME_RE_.test(from) || !NOTICE_TIME_RE_.test(to)) fail_('date', 'Посочете начало и край на профилактиката.');
  if (from >= to) fail_('date', 'Краят трябва да е след началото.');
  if (to <= stamp_()) fail_('date', 'Краят на профилактиката вече е минал.');
  const m = master_(), id = 'ПФ-' + todayIso_().slice(0, 4) + '-' + String(nextCounter_(m, 'notices')).padStart(4, '0');
  insert_(m, 'notices', { id: id, at: stamp_(), by: ctx.username, title: title, text: text, from: from, to: to, state: 'Активна', mail: d.mail === true ? 'Да' : 'Не', mailCursor: '0', mailSent: '0', mailFailed: '0' });
  audit_(m, ctx.username, 'Нова профилактика', id, title);
  dropStatus_();
  return { id: id, mail: d.mail === true };
}

function opNoticeCancel_(d, ctx) {
  const m = master_(), n = read_(m, 'notices').find(x => x.id === str_(d.id, 40));
  if (!n) fail_('notfound', 'Профилактиката не е намерена.');
  patch_(m, 'notices', n._row, { state: NOTICE_CANCELLED_ });
  audit_(m, ctx.username, 'Отменена профилактика', n.id, n.title);
  dropStatus_();
  return {};
}

const noticeBody_ = n => 'От ' + bgTime_(n.from) + ' до ' + bgTime_(n.to) + '\n\n' + n.text + '\n\nСтатус на системите:\n' + CFG.APP_URL + '#/status';

/*
 * Браузърът на оператора вика това действие, докато не получи done. Така няма нужда от нови права за тригери, а прекъснато изпращане
 * продължава от мястото, където е спряло: всеки адрес се записва веднага и не получава второ писмо.
 */
function opNoticeSend_(d) {
  const cache = CacheService.getScriptCache(), busy = 'notice:send';
  if (cache.get(busy)) fail_('busy', 'В момента се изпращат писма. Опитайте след малко.');
  cache.put(busy, '1', 90);
  try {
    const m = master_(), n = read_(m, 'notices').find(x => x.id === str_(d.id, 40));
    if (!n) fail_('notfound', 'Профилактиката не е намерена.');
    if (n.state === NOTICE_CANCELLED_) fail_('state', 'Профилактиката е отменена.');
    if (n.mail !== 'Да') fail_('state', 'За тази профилактика не се изпраща имейл.');
    let sent = Number(n.mailSent) || 0, failed = Number(n.mailFailed) || 0, cursor = Number(n.mailCursor) || 0;
    if (n.mailDone) return { done: true, sent: sent, failed: failed };
    const started = Date.now(), orgs = read_(m, 'orgs').filter(o => o.status === 'Активна'), seen = {};
    rowsIf_(m, 'noticeSent').forEach(r => { if (r.notice === n.id) seen[r.email] = true; });
    const subject = 'ЗДОИ4You Платформа – профилактика: ' + n.title, body = noticeBody_(n);
    let out = false;
    for (; cursor < orgs.length && !out; cursor++) {
      let users = [];
      try { users = read_(orgSheet_(orgs[cursor]), 'users'); } catch (e) { console.error('профилактика ' + orgs[cursor].no + ': ' + e.message); failed++; }
      for (let i = 0; i < users.length; i++) {
        const u = users[i], email = String(u.email || '').toLowerCase();
        if (u.active !== 'Да' || !email || seen[email]) continue;
        if (Date.now() - started > NOTICE_BUDGET_MS_) { out = true; break; }
        const ok = mail_(u.email, subject, body);
        if (ok) sent++; else failed++;
        seen[email] = true;
        insert_(m, 'noticeSent', { notice: n.id, email: email, at: stamp_(), ok: ok ? 'Да' : 'Не' });
      }
      if (out) break;
    }
    const done = cursor >= orgs.length;
    patch_(m, 'notices', n._row, { mailCursor: String(cursor), mailSent: String(sent), mailFailed: String(failed), mailDone: done ? stamp_() : '' });
    return { done: done, sent: sent, failed: failed };
  } finally {
    cache.remove(busy);
  }
}

function noticesSeen_(d, ctx) {
  const ss = ctx.ss(), u = read_(ss, 'users').find(x => x.username === ctx.username), at = stamp_();
  patch_(ss, 'users', u._row, { noticeSeen: at });
  return { noticeSeen: at };
}
