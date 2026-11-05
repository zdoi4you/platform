/*
 * Двуфакторен вход с код по имейл. Всеки потребител го включва сам.
 * Кодът е от 8 цифри, важи 2 минути и се използва веднъж. В кеша се пази само HMAC от него, никога самият код.
 */

const CODE_TTL_S_ = 120, CODE_TRIES_ = 5, CODE_SENDS_ = 5, CODE_RE_ = /^\d{8}$/, CHALLENGE_RE_ = /^[0-9a-f]{64}$/;
const CODE_EXPIRED_MSG_ = 'Кодът е изтекъл или вече е използван. Поискайте нов.';

const codeKey_ = challenge => '2fa:' + sha256_(challenge);

/* изпраща нов код; без изпратено писмо няма и предизвикателство */
function sendCode_(purpose, no, u, intro) {
  const sends = throttle_('2fa-send|' + no + '|' + u.username, CODE_SENDS_);
  if (sends.blocked()) fail_('locked', 'Изпратени са твърде много кодове. Опитайте отново след 15 минути.');
  if (!u.email) fail_('mail', 'Няма въведен имейл. Обърнете се към администратора.');
  sends.hit();
  const code = String(parseInt(randomToken_().slice(0, 12), 16) % 1e8).padStart(8, '0');
  const challenge = randomToken_();
  const entry = { purpose: purpose, no: no, username: u.username, pass: sha256_(u.hash), hash: serverHash_(code, challenge), exp: Date.now() + CODE_TTL_S_ * 1000, tries: 0 };
  CacheService.getScriptCache().put(codeKey_(challenge), JSON.stringify(entry), CODE_TTL_S_);
  const sent = mail_(u.email, 'ЗДОИ4You Платформа – код за потвърждение',
    intro + '\n\nКод: ' + code + '\n\nКодът важи 2 минути и се използва веднъж. Не го споделяйте с никого, включително с поддръжката.\n\nАко не сте поискали код, някой може да знае паролата ви. Сменете я и уведомете администратора.');
  if (!sent) {
    CacheService.getScriptCache().remove(codeKey_(challenge));
    fail_('mail', 'Кодът не можа да се изпрати. Опитайте отново или пишете на ' + CFG.SUPPORT + '.');
  }
  return { challenge: challenge, validFor: CODE_TTL_S_ };
}

function readCode_(challenge, purpose) {
  if (!CHALLENGE_RE_.test(challenge)) fail_('code', CODE_EXPIRED_MSG_);
  const raw = CacheService.getScriptCache().get(codeKey_(challenge));
  const s = raw ? JSON.parse(raw) : null;
  if (!s || s.exp < Date.now() || s.purpose.split('|')[0] !== purpose) fail_('code', CODE_EXPIRED_MSG_);
  return s;
}

/* вярваме само на верен код за същото предизвикателство; след 5 грешни опита кодът отпада */
function matchCode_(challenge, s, code) {
  const cache = CacheService.getScriptCache(), key = codeKey_(challenge);
  if (CODE_RE_.test(code) && sameText_(serverHash_(code, challenge), s.hash)) {
    cache.remove(key);
    return true;
  }
  s.tries += 1;
  if (s.tries >= CODE_TRIES_) cache.remove(key);
  else cache.put(key, JSON.stringify(s), Math.max(1, Math.ceil((s.exp - Date.now()) / 1000)));
  return false;
}

/* ---------- вход ---------- */

function startLoginCode_(acc, no, u, ip, agent) {
  const r = sendCode_('login', no, u, 'Опит за вход в ЗДОИ4You Платформа за потребител ' + u.username + (ip ? ' от IP адрес ' + ip : '') + '.');
  recordLogin_(acc.ss, u.username, ip, agent, 'Вярна парола, изпратен код');
  return { twoFactor: true, challenge: r.challenge, validFor: r.validFor };
}

function loginCode_(d) {
  const challenge = str_(d.challenge, 64), code = str_(d.code, 8), ip = cleanIp_(d.ip), agent = line_(d.agent, 200);
  const s = readCode_(challenge, 'login');
  const t = throttle_(s.no + '|' + s.username), byIp = ip ? throttle_('ip|' + ip, CFG.MAX_IP_FAILS) : null;
  if (t.blocked() || (byIp && byIp.blocked())) fail_('locked', LOCKED_MSG_);
  const acc = accountTable_(s.no);
  const u = acc ? read_(acc.ss, acc.key).find(x => x.username === s.username) : null;
  // кодът не важи, ако междувременно потребителят е спрян или паролата е сменена
  if (!u || u.active !== 'Да' || !sameText_(sha256_(u.hash), s.pass)) fail_('code', CODE_EXPIRED_MSG_);
  if (!matchCode_(challenge, s, code)) {
    const count = t.hit();
    if (byIp) byIp.hit();
    recordLogin_(acc.ss, u.username, ip, agent, 'Грешен код');
    audit_(acc.ss, u.username, 'Грешен код за вход', '', ip);
    if (count >= CFG.MAX_FAILS) {
      CacheService.getScriptCache().remove(codeKey_(challenge));
      lockNotice_(acc, u, count, ip, agent);
      fail_('locked', LOCKED_MSG_);
    }
    const left = CFG.MAX_FAILS - count;
    fail_('code', 'Грешен код. Остават ' + left + (left === 1 ? ' опит.' : ' опита.'));
  }
  t.clear();
  return openSession_(acc, s.no, u, ip, agent);
}

/* ---------- включване и изключване от профила ---------- */

function twofaStatus_(d, ctx) {
  const u = ctx.user();
  return { on: u.twofa === 'Да', email: u.email };
}

/* нужни са паролата и код от имейла, затова отворена сесия сама не може да промени настройката */
function twofaStart_(d, ctx) {
  const cur = str_(d.current, 64), on = d.on === true;
  if (!PREHASH_RE_.test(cur)) fail_('value', 'Невалидни данни.');
  const t = throttle_('pw|' + ctx.no + '|' + ctx.username);
  if (t.blocked()) fail_('locked', 'Твърде много грешни опити за текуща парола. Опитайте отново след 15 минути.');
  const ss = ctx.ss(), u = read_(ss, ctx.table).find(x => x.username === ctx.username);
  if (!u || !u.salt || !sameText_(serverHash_(cur, u.salt), u.hash)) {
    t.hit();
    audit_(ss, ctx.username, 'Грешна текуща парола', '', '');
    fail_('password', 'Текущата парола е грешна.');
  }
  t.clear();
  if ((u.twofa === 'Да') === on) fail_('state', on ? 'Двуфакторният вход вече е включен.' : 'Двуфакторният вход вече е изключен.');
  return sendCode_('twofa|' + (on ? 'on' : 'off'), ctx.no, u, (on ? 'Включване' : 'Изключване') + ' на двуфакторния вход за потребител ' + u.username + '.');
}

function twofaConfirm_(d, ctx) {
  const challenge = str_(d.challenge, 64), s = readCode_(challenge, 'twofa');
  if (s.no !== ctx.no || s.username !== ctx.username) fail_('code', CODE_EXPIRED_MSG_);
  if (!matchCode_(challenge, s, str_(d.code, 8))) fail_('code', 'Грешен код.');
  const on = s.purpose === 'twofa|on', ss = ctx.ss(), u = read_(ss, ctx.table).find(x => x.username === ctx.username);
  patch_(ss, ctx.table, u._row, { twofa: on ? 'Да' : '' });
  audit_(ss, ctx.username, on ? 'Включен двуфакторен вход' : 'Изключен двуфакторен вход', '', '');
  afterLock_(ctx, () => mail_(u.email, 'ЗДОИ4You Платформа – двуфакторен вход',
    'Двуфакторният вход за потребител ' + u.username + ' е ' + (on ? 'включен' : 'изключен') + '.\n\nАко не сте го направили вие, сменете паролата си и уведомете администратора.'));
  return { on: on };
}
