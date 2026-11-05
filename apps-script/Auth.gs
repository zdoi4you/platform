/*
 * Вход: номер на организация + потребител + парола.
 *
 * Браузърът изчислява PBKDF2 (WebCrypto) от паролата и никога не я изпраща. Сървърът пази
 * HMAC-SHA256(резултат + сол на потребителя) с таен ключ (PEPPER) в свойствата на скрипта. Така
 * хешовете в таблиците не могат да се проверяват офлайн без ключа, който не е в таблица.
 *
 * Номерът на организацията и еднократните връзки за парола се изпращат по имейл на самия потребител.
 * Паролите не се изпращат: потребителят ги избира сам, а сървърът не ги създава и не ги знае.
 */

const NO_RE_ = /^\d{8}$/, USER_RE_ = /^[a-z0-9._-]{3,40}$/, PREHASH_RE_ = /^[A-Za-z0-9+/=]{40,64}$/;

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

function randomToken_() {
  return sha256_(Utilities.getUuid() + Utilities.getUuid() + Date.now());
}

function serverHash_(preHash, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PEPPER');
  if (!pepper) fail_('setup', 'Платформата още не е настроена.');
  const sig = Utilities.computeHmacSha256Signature(preHash + '|' + salt, pepper, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(sig);
}

function sameText_(a, b) {
  a = String(a); b = String(b);
  if (!a || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function newInvite_(hours) {
  const token = randomToken_();
  return { token: token, hash: sha256_(token), exp: String(Date.now() + hours * 36e5) };
}

const inviteLink_ = (no, username, token) => CFG.APP_URL + '#/activate/' + no + '/' + encodeURIComponent(username) + '/' + token;

/* ---------- регистър и кеш ---------- */

function orgByNo_(no) {
  const cache = CacheService.getScriptCache(), key = 'org:' + no, hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const o = read_(master_(), 'orgs').find(x => x.no === no) || null;
  if (o) cache.put(key, JSON.stringify(o), 300);
  return o;
}

const dropOrgCache_ = no => CacheService.getScriptCache().remove('org:' + no);
const dropUserCache_ = (no, username) => CacheService.getScriptCache().remove('usr:' + no + ':' + username);

/* отваря таблицата на организацията само по номер от сървърна сесия или проверен вход */
function orgSheet_(org) {
  if (!org || !org.sheetId) fail_('org', 'Организацията не е намерена.');
  return SpreadsheetApp.openById(org.sheetId);
}

function accountTable_(no) {
  if (no === CFG.OPERATOR_NO) return { ss: master_(), key: 'ops', org: null };
  const org = orgByNo_(no);
  if (!org || org.status !== 'Активна') return null;
  return { ss: orgSheet_(org), key: 'users', org: org };
}

/* ---------- ограничаване на опитите ---------- */

function throttle_(id, limit) {
  const cache = CacheService.getScriptCache(), key = 'f:' + sha256_(id);
  return {
    blocked: () => (Number(cache.get(key)) || 0) >= (limit || CFG.MAX_FAILS),
    hit: () => { const n = (Number(cache.get(key)) || 0) + 1; cache.put(key, String(n), CFG.FAIL_WINDOW_S); return n; },
    clear: () => cache.remove(key)
  };
}

const badLogin_ = left => fail_('login', 'Грешен номер на организация, потребител или парола.' + (left ? ' Остават ' + left + (left === 1 ? ' опит.' : ' опита.') : ''));
const LOCKED_MSG_ = 'Твърде много неуспешни опити. Опитайте отново след 15 минути или поискайте нова парола по имейл.';

/* IP адресът идва от браузъра (Cloudflare), защото Apps Script не вижда адреса на посетителя */
const cleanIp_ = v => { const t = str_(v, 45); return /^[0-9a-fA-F:.]{3,45}$/.test(t) && /[.:]/.test(t) ? t : ''; };

function recordLogin_(ss, username, ip, agent, result) {
  insert_(ss, 'logins', { at: stamp_(), username: username, ip: ip, agent: agent, result: result });
}

/* еднократна връзка за парола заедно с номера и потребителя; самата парола не се изпраща */
function accessMail_(to, no, username, link, validFor) {
  return mail_(to, 'ЗДОИ4You Платформа – достъп',
    'Номер на организацията: ' + no + '\nПотребител: ' + username + '\n\n' +
    'Задайте парола с тази еднократна връзка. Тя важи ' + validFor + ':\n' + link + '\n\n' +
    'Не препращайте това писмо. Ако не го очаквате, не отваряйте връзката и пишете на ' + CFG.SUPPORT + '.');
}

function login_(d) {
  const no = str_(d.no, 8), username = str_(d.username, 40).toLowerCase(), preHash = str_(d.hash, 64);
  if (!NO_RE_.test(no) || !USER_RE_.test(username) || !PREHASH_RE_.test(preHash)) badLogin_();
  const ip = cleanIp_(d.ip), agent = line_(d.agent, 200);
  const t = throttle_(no + '|' + username), byIp = ip ? throttle_('ip|' + ip, CFG.MAX_IP_FAILS) : null;
  if (t.blocked() || (byIp && byIp.blocked())) fail_('locked', LOCKED_MSG_);
  const acc = accountTable_(no);
  const u = acc ? read_(acc.ss, acc.key).find(x => x.username === username) : null;
  const ok = u && u.active === 'Да' && u.salt && sameText_(serverHash_(preHash, u.salt), u.hash);
  if (!ok) {
    const count = t.hit();
    if (byIp) byIp.hit();
    // въведеното име може да е парола, написана погрешно, затова непознато име не се записва
    if (acc) recordLogin_(acc.ss, u ? username : '(непознат)', ip, agent, !u ? 'Непознат потребител' : u.active === 'Да' ? 'Грешна парола' : 'Спрян потребител');
    if (u) audit_(acc.ss, username, 'Неуспешен вход', '', ip);
    if (count >= CFG.MAX_FAILS) {
      if (acc) recordLogin_(acc.ss, u ? username : '(непознат)', ip, agent, 'Заключен за 15 минути');
      if (u && u.email) mail_(u.email, 'ЗДОИ4You Платформа – спрян вход', 'Входът за потребител ' + username + ' е спрян за 15 минути след ' + count + ' неуспешни опита' + (ip ? ' (последен IP адрес: ' + ip + ')' : '') + '.\n\nАко не сте опитвали вие, сменете паролата си след отпадане на ограничението и уведомете администратора.');
      fail_('locked', LOCKED_MSG_);
    }
    badLogin_(CFG.MAX_FAILS - count);
  }
  t.clear();
  const at = stamp_();
  patch_(acc.ss, acc.key, u._row, { lastLogin: at });
  recordLogin_(acc.ss, username, ip, agent, 'Успешен');
  audit_(acc.ss, username, 'Вход', '', ip);
  const token = randomToken_(), exp = Date.now() + CFG.SESSION_MIN * 6e4;
  saveSession_(token, { no: no, u: username, exp: exp });
  const role = acc.org ? u.role : ROLE_OP;
  return { token: token, session: exp, me: Object.assign(meInfo_(no, acc.org, u, role), { perms: acc.org ? permsOf_(u) : {} }) };
}

function meInfo_(no, org, u, role) {
  return { no: no, org: org ? org.name : 'ЗДОИ4You', username: u.username, name: u.name, role: role, operator: !org };
}

/* ---------- сесии ---------- */

function saveSession_(token, s) {
  CacheService.getScriptCache().put('s:' + sha256_(token), JSON.stringify(s), Math.min(21600, Math.ceil((s.exp - Date.now()) / 1000) + 60));
}

function auth_(token, need) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) fail_('session', 'Сесията е изтекла. Влезте отново.');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('s:' + sha256_(token));
  const s = raw ? JSON.parse(raw) : null;
  if (!s || s.exp < Date.now()) fail_('session', 'Сесията е изтекла. Влезте отново.');
  const ctx = { token: token, session: s, no: s.no, username: s.u };
  if (s.no === CFG.OPERATOR_NO) {
    if (need !== 'op' && need !== 'any') fail_('role', 'Нямате достъп до това действие.');
    ctx.operator = true;
    ctx.role = ROLE_OP;
    ctx.ss = () => master_();
    ctx.table = 'ops';
    ctx.user = () => read_(master_(), 'ops').find(x => x.username === s.u);
    const op = cachedUser_(s.no, s.u, ctx.user);
    if (!op || op.active !== 'Да') fail_('session', 'Достъпът е спрян.');
    return ctx;
  }
  if (need === 'op') fail_('role', 'Нямате достъп до това действие.');
  const org = orgByNo_(s.no);
  if (!org || org.status !== 'Активна') fail_('session', 'Достъпът на организацията е спрян.');
  ctx.org = org;
  let book = null;
  ctx.ss = () => book || (book = orgSheet_(org));
  ctx.table = 'users';
  ctx.user = () => read_(ctx.ss(), 'users').find(x => x.username === s.u);
  const me = cachedUser_(s.no, s.u, ctx.user);
  if (!me || me.active !== 'Да') fail_('session', 'Достъпът е спрян.');
  ctx.role = me.role;
  ctx.perms = me.perms || {};
  ctx.name = me.name;
  if (need === 'admin' && me.role !== ROLE_ADMIN) fail_('role', 'Това действие е само за администратор.');
  return ctx;
}

/* правата на потребител: по подразбиране според ролята, освен ако администраторът ги е настроил */
function permsOf_(u) {
  let list = null;
  if (u.perms) { try { list = JSON.parse(u.perms); } catch (_) { list = null; } }
  if (!Array.isArray(list)) list = u.role === ROLE_ADMIN ? PERMS : (u.role === ROLE_STAFF ? STAFF_PERMS : []);
  const out = {};
  list.forEach(k => { if (PERMS.indexOf(k) >= 0) out[k] = true; });
  return out;
}

function cachedUser_(no, username, load) {
  const cache = CacheService.getScriptCache(), key = 'usr:' + no + ':' + username, hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const u = load();
  if (!u) return null;
  const small = { active: u.active, role: u.role || ROLE_OP, name: u.name, perms: permsOf_(u) };
  cache.put(key, JSON.stringify(small), 300);
  return small;
}

function extend_(d, ctx) {
  const s = ctx.session;
  s.exp = Date.now() + CFG.SESSION_MIN * 6e4;
  saveSession_(ctx.token, s);
  return { session: s.exp };
}

function logout_(d, ctx) {
  CacheService.getScriptCache().remove('s:' + sha256_(ctx.token));
  return {};
}

/* ---------- пароли ---------- */

function changePassword_(d, ctx) {
  const cur = str_(d.current, 64), next = str_(d.next, 64);
  if (!PREHASH_RE_.test(cur) || !PREHASH_RE_.test(next)) fail_('value', 'Невалидни данни.');
  const t = throttle_('pw|' + ctx.no + '|' + ctx.username);
  if (t.blocked()) fail_('locked', 'Твърде много грешни опити за текуща парола. Опитайте отново след 15 минути.');
  const ss = ctx.ss(), u = read_(ss, ctx.table).find(x => x.username === ctx.username);
  if (!u || !u.salt || !sameText_(serverHash_(cur, u.salt), u.hash)) {
    t.hit();
    audit_(ss, ctx.username, 'Грешна текуща парола', '', '');
    fail_('password', 'Текущата парола е грешна.');
  }
  t.clear();
  const salt = randomToken_().slice(0, 32);
  if (next === cur) fail_('password', 'Новата парола трябва да е различна от текущата.');
  patch_(ss, ctx.table, u._row, { salt: salt, hash: serverHash_(next, salt), mustChange: '' });
  audit_(ss, ctx.username, 'Смяна на парола', '', '');
  return {};
}

function activate_(d) {
  const no = str_(d.no, 8), username = str_(d.username, 40).toLowerCase(), token = str_(d.token, 64), preHash = str_(d.hash, 64);
  const invalid = () => fail_('invite', 'Връзката е невалидна или изтекла. Поискайте нова от администратора.');
  if (!NO_RE_.test(no) || !USER_RE_.test(username) || !/^[0-9a-f]{64}$/.test(token) || !PREHASH_RE_.test(preHash)) invalid();
  const t = throttle_('activate|' + no + '|' + username);
  if (t.blocked()) fail_('locked', 'Твърде много неуспешни опити. Опитайте отново след 15 минути.');
  const acc = accountTable_(no);
  const u = acc ? read_(acc.ss, acc.key).find(x => x.username === username) : null;
  if (!u || u.active !== 'Да' || !u.inviteHash || Number(u.inviteExp) < Date.now() || !sameText_(sha256_(token), u.inviteHash)) {
    t.hit();
    invalid();
  }
  t.clear();
  throttle_(no + '|' + username).clear(); // новата парола отменя ограничението за вход
  const salt = randomToken_().slice(0, 32);
  patch_(acc.ss, acc.key, u._row, { salt: salt, hash: serverHash_(preHash, salt), inviteHash: '', inviteExp: '', mustChange: '' });
  audit_(acc.ss, username, 'Зададена парола чрез покана', '', '');
  return { no: no, username: username };
}

/* забравена парола: отговорът е еднакъв, за да не се разбира кои потребители съществуват; операторите използват operatorReset */
function forgot_(d) {
  const no = str_(d.no, 8), username = str_(d.username, 40).toLowerCase();
  if (!NO_RE_.test(no) || !USER_RE_.test(username) || no === CFG.OPERATOR_NO) return {};
  const t = throttle_('forgot|' + no + '|' + username);
  if (t.blocked()) return {};
  t.hit();
  const acc = accountTable_(no);
  const u = acc ? read_(acc.ss, acc.key).find(x => x.username === username) : null;
  if (!u || u.active !== 'Да' || !u.email) return {};
  const inv = newInvite_(CFG.RESET_HOURS);
  patch_(acc.ss, acc.key, u._row, { inviteHash: inv.hash, inviteExp: inv.exp });
  audit_(acc.ss, username, 'Поискана нова парола', '', cleanIp_(d.ip));
  accessMail_(u.email, no, username, inviteLink_(no, username, inv.token), CFG.RESET_HOURS + ' часа');
  return {};
}
