/*
 * Известия по имейл за преписките. Всеки потребител сам избира какво да получава.
 * Писмата съдържат номера на преписката и какво се е случило, но не и данни за заявителя и текст на искането:
 * те остават в платформата, зад входа.
 */

const NOTIFY_KEYS = ['assigned', 'status', 'docs', 'comments', 'deadlines', 'allCases'];
const NOTIFY_DEFAULT = ['assigned', 'deadlines'];
/* напомняне за срок: 3 дни и 1 ден преди него, в деня на срока и ден след изтичането му */
const REMIND_DAYS = [3, 1, 0, -1];
const REMIND_FROM_HOUR = 8, REMIND_BUDGET_MS = 270000;

/* празна клетка означава „не е избирал“; изключените известия се пазят като [] */
function notifyOf_(u) {
  if (!u.notify) return NOTIFY_DEFAULT.slice();
  try {
    const list = JSON.parse(u.notify);
    if (Array.isArray(list)) return NOTIFY_KEYS.filter(k => list.indexOf(k) >= 0);
  } catch (_) {}
  return NOTIFY_DEFAULT.slice();
}

const caseLink_ = regNo => CFG.APP_URL + '#/case/' + encodeURIComponent(regNo);
const SETTINGS_NOTE_ = 'Известията се настройват от „Моят профил“ в платформата.';

/* писмата тръгват след освобождаване на заключването, за да не чакат другите потребители */
function afterLock_(ctx, fn) {
  (ctx.after = ctx.after || []).push(fn);
}

function runAfter_(ctx) {
  (ctx && ctx.after || []).forEach(fn => {
    try { fn(); } catch (e) { console.error('известие: ' + e.message); }
  });
}

function caseMail_(ctx, u, regNo, what) {
  afterLock_(ctx, () => mail_(u.email, 'ЗДОИ4You Платформа – преписка ' + regNo,
    'Преписка: ' + regNo + '\n' + what + '\nОт: ' + (ctx.name || ctx.username) + '\n\nОтворете преписката:\n' + caseLink_(regNo) + '\n\n' + SETTINGS_NOTE_));
}

/* получатели: отговорникът и който следи всички преписки, ако има право да ги вижда; извършителят не се уведомява */
function notifyCase_(ctx, c, keys, what, skipOwner) {
  read_(ctx.ss(), 'users').forEach(u => {
    if (u.active !== 'Да' || !u.email || u.username === ctx.username) return;
    const mine = notifyOf_(u);
    if (!keys.some(k => mine.indexOf(k) >= 0)) return;
    const isOwner = u.username === c.owner;
    if (isOwner ? skipOwner : !(mine.indexOf('allCases') >= 0 && permsOf_(u).casesAll)) return;
    caseMail_(ctx, u, c.regNo, what);
  });
}

function notifyAssigned_(ctx, regNo, owner) {
  if (!owner || owner === ctx.username) return;
  const u = read_(ctx.ss(), 'users').find(x => x.username === owner);
  if (!u || u.active !== 'Да' || !u.email || notifyOf_(u).indexOf('assigned') < 0) return;
  caseMail_(ctx, u, regNo, 'Определени сте за отговорник по преписката.');
}

/* отговорникът е активен потребител на организацията; вече определен, но спрян потребител може да остане */
function checkOwner_(ss, owner, current) {
  if (!owner || owner === current) return owner;
  const u = read_(ss, 'users').find(x => x.username === owner);
  if (!u || u.active !== 'Да') fail_('owner', 'Изберете активен потребител за отговорник.');
  return owner;
}

/* първото определяне е за всеки с право да променя преписки; после отговорника сменя само администратор */
function ownerGuard_(c, next, ctx) {
  if (c.owner && next !== c.owner && ctx.role !== ROLE_ADMIN) fail_('role', 'Вече определен отговорник може да промени само администратор.');
}

function caseAssign_(d, ctx) {
  const ss = ctx.ss(), c = visibleCase_(ss, d.regNo, ctx);
  unlocked_(c);
  const owner = checkOwner_(ss, line_(d.owner, 40), c.owner);
  if (owner === c.owner) return { owner: owner, visible: true };
  ownerGuard_(c, owner, ctx);
  patch_(ss, 'cases', c._row, { owner: owner, updatedAt: stamp_() });
  event_(ss, c.regNo, ctx.username, 'Отговорник', owner ? 'Определен отговорник: ' + owner : 'Премахнат е отговорникът.');
  audit_(ss, ctx.username, 'Определен отговорник', c.regNo, owner || 'няма');
  notifyAssigned_(ctx, c.regNo, owner);
  // потребител без право за всички преписки може да престане да вижда преписка, която е предал
  return { owner: owner, visible: canSee_(Object.assign({}, c, { owner: owner }), ctx) };
}

function notifySave_(d, ctx) {
  if (!Array.isArray(d.events) || d.events.some(k => NOTIFY_KEYS.indexOf(k) < 0)) fail_('value', 'Невалидни известия.');
  const ss = ctx.ss(), u = read_(ss, 'users').find(x => x.username === ctx.username);
  const list = NOTIFY_KEYS.filter(k => d.events.indexOf(k) >= 0 && (k !== 'allCases' || ctx.perms.casesAll));
  patch_(ss, 'users', u._row, { notify: JSON.stringify(list) });
  audit_(ss, ctx.username, 'Настройка на известия', '', list.join(', ') || 'без известия');
  return { notify: list };
}

/* пробно писмо до собствения адрес на потребителя */
function notifyTest_(d, ctx) {
  const t = throttle_('notifytest|' + ctx.no + '|' + ctx.username, 3);
  if (t.blocked()) fail_('locked', 'Вече изпратихте няколко пробни писма. Опитайте отново след 15 минути.');
  t.hit();
  const u = read_(ctx.ss(), 'users').find(x => x.username === ctx.username);
  return {
    to: u.email,
    emailed: mail_(u.email, 'ЗДОИ4You Платформа – пробно известие', 'Това е пробно писмо. Щом го виждате, известията стигат до този адрес.\n\n' + SETTINGS_NOTE_)
  };
}

/* ---------- напомняния за срокове ---------- */

/* настройките показват дали ежечасният тригер работи, защото без него напомняния няма */
function remindersOn_() {
  const last = parseIso_(PropertiesService.getScriptProperties().getProperty('REMINDERS_LAST'));
  return !!last && (parseIso_(todayIso_()) - last) / DAY_MS_ <= 1;
}

const isoToBg_ = iso => iso.split('-').reverse().join('.');

function daysText_(n) {
  if (n === 0) return 'изтича днес';
  if (n < 0) return 'изтекъл преди ' + (n === -1 ? '1 ден' : -n + ' дни');
  return n === 1 ? 'остава 1 ден' : 'остават ' + n + ' дни';
}

/* срокове на преписките, за които днес се напомня */
function dueItems_(ss, today) {
  const items = [];
  read_(ss, 'cases').forEach(raw => {
    const c = withDue_(raw, today);
    const add = (label, due, days) => {
      if (due && REMIND_DAYS.indexOf(days) >= 0) items.push({ regNo: c.regNo, owner: c.owner, line: c.regNo + ' – ' + label + ': ' + isoToBg_(due) + ', ' + daysText_(days) });
    };
    if (c.daysLeft !== null) add(c.dueLabel, c.due, c.daysLeft);
    if (c.thirdInvolved) {
      add('Искане на съгласие от трето лице (чл. 31, ал. 2)', c.thirdBy, c.thirdByDays);
      add('Отговор на трето лице (чл. 31, ал. 1)', c.thirdReplyBy, c.thirdReplyDays);
    }
  });
  return items;
}

function remindOrg_(ss, today) {
  const items = dueItems_(ss, today);
  if (!items.length) return;
  read_(ss, 'users').forEach(u => {
    if (u.active !== 'Да' || !u.email) return;
    const mine = notifyOf_(u);
    if (mine.indexOf('deadlines') < 0) return;
    const all = mine.indexOf('allCases') >= 0 && permsOf_(u).casesAll;
    const list = items.filter(i => all || i.owner === u.username);
    if (!list.length) return;
    mail_(u.email, 'ЗДОИ4You Платформа – срокове по преписки',
      list.map(i => i.line + '\n' + caseLink_(i.regNo)).join('\n\n') + '\n\n' + SETTINGS_NOTE_);
  });
}

/*
 * Изпълнява се от тригер „на всеки час“, който собственикът създава в редактора (Triggers → Time-driven → Hour timer).
 * Организация, която вече е обработена днес, се прескача. Така следващият час довършва започнатото при изчерпано време или грешка.
 */
function remindDeadlines() {
  const props = PropertiesService.getScriptProperties(), today = todayIso_(), started = Date.now();
  props.setProperty('REMINDERS_LAST', today);
  if (Number(Utilities.formatDate(new Date(), CFG.TZ, 'H')) < REMIND_FROM_HOUR) return;
  read_(master_(), 'orgs').some(org => {
    if (org.status !== 'Активна') return false;
    if (Date.now() - started > REMIND_BUDGET_MS) return true;
    const key = 'REMINDED_' + org.no;
    if (props.getProperty(key) === today) return false;
    try {
      remindOrg_(orgSheet_(org), today);
      props.setProperty(key, today);
    } catch (e) {
      console.error('напомняния ' + org.no + ': ' + e.message);
    }
    return false;
  });
}
