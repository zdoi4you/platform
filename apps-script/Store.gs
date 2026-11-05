/* Достъп до Google таблиците. Заглавията са на български, за да се четат таблиците и ръчно. */

const SCHEMA = {
  apps: ['Заявки за регистрация', { id: '№', at: 'Подадена', status: 'Статус', name: 'Организация', eik: 'ЕИК/БУЛСТАТ', type: 'Вид', email: 'Официален имейл', payload: 'Данни (JSON)', reason: 'Причина за отказ', decidedBy: 'Решил', decidedAt: 'Дата на решение', orgNo: 'Номер на организация', salt: 'Сол', hash: 'Хеш' }],
  orgs: ['Организации', { no: 'Номер', name: 'Наименование', eik: 'ЕИК/БУЛСТАТ', type: 'Вид', status: 'Статус', sheetId: 'ID на таблицата', approvedAt: 'Одобрена', approvedBy: 'Одобрил', adminUser: 'Първи администратор', plan: 'План' }],
  ops: ['Оператори', { username: 'Потребител', name: 'Име', email: 'Имейл', active: 'Активен', salt: 'Сол', hash: 'Хеш', inviteHash: 'Покана (хеш)', inviteExp: 'Покана до', lastLogin: 'Последен вход', createdAt: 'Създаден' }],
  changes: ['Заявки за промяна', { id: '№', at: 'Подадена', no: 'Номер на организация', orgName: 'Организация', by: 'Подал', status: 'Статус', basis: 'Основание', changed: 'Промени (JSON)', reason: 'Причина за отказ', decidedBy: 'Решил', decidedAt: 'Дата на решение' }],
  plans: ['Планове', { id: 'ID', name: 'Наименование', description: 'Описание', status: 'Състояние', by: 'Въвел', at: 'Въведен' }],
  logins: ['Входове', { at: 'Време', username: 'Потребител', ip: 'IP адрес', agent: 'Браузър', result: 'Резултат' }],
  log: ['Дневник', { at: 'Време', actor: 'Потребител', action: 'Действие', ref: 'Обект', details: 'Подробности' }],

  profile: ['Профил', { key: 'Ключ', value: 'Стойност' }],
  users: ['Потребители', { username: 'Потребител', name: 'Име', position: 'Длъжност', email: 'Имейл', phone: 'Телефон', role: 'Роля', active: 'Активен', salt: 'Сол', hash: 'Хеш', inviteHash: 'Покана (хеш)', inviteExp: 'Покана до', lastLogin: 'Последен вход', createdAt: 'Създаден', createdBy: 'Създал', mustChange: 'Да смени паролата', perms: 'Права (JSON)' }],
  cases: ['Преписки', {
    regNo: 'Рег. №', createdAt: 'Въведена', createdBy: 'Въвел', kind: 'Вид заявление', regDate: 'Дата на регистриране', channel: 'Начин на подаване',
    applicantType: 'Вид заявител', applicantName: 'Заявител', applicantSeat: 'Седалище', applicantAddress: 'Адрес за кореспонденция', applicantEmail: 'Имейл', applicantPhone: 'Телефон',
    subject: 'Описание на исканата информация', form: 'Предпочитана форма', noPublish: 'Отказ от публикуване (чл. 25, ал. 1, т. 5)',
    status: 'Статус', outcome: 'Резултат', owner: 'Отговорник',
    clarifyAsked: 'Поискано уточняване', clarifyGot: 'Получено уточняване', ext30: 'Удължаване чл. 30 (дни)', ext31: 'Удължаване чл. 31 (дни)', thirdAsked: 'Поискано съгласие',
    refusalGround: 'Основание за отказ', decisionNo: 'Решение №', decisionDate: 'Дата на решение', served: 'Връчено на', servedHow: 'Начин на връчване',
    published15c: 'Публикувано на платформата (чл. 15в)', appealed: 'Обжалвано', appealNote: 'Бележка за обжалването', updatedAt: 'Променена',
    applicantOblast: 'Област на адресата', thirdGot: 'Получен отговор от трето лице', applicantEik: 'ЕИК/БУЛСТАТ на заявителя'
  }],
  events: ['Събития', { at: 'Време', regNo: 'Рег. №', user: 'Потребител', kind: 'Вид', text: 'Текст' }],
  docs: ['Документи', { id: 'ID', no: 'Номер', type: 'Вид', title: 'Заглавие', regNo: 'Рег. №', date: 'Дата', at: 'Създаден', author: 'Автор', payload: 'Данни (JSON)' }],
  art15: ['Чл. 15', { item: 'Точка', text: 'Описание', url: 'Интернет адрес', updated: 'Обновено на', by: 'Обновил' }],
  counters: ['Броячи', { key: 'Ключ', value: 'Стойност' }],
  grounds: ['Правни основания', { id: 'ID', scope: 'Вид акт', text: 'Основание', active: 'Активно', by: 'Въвел', at: 'Въведено' }],
  signers: ['Упълномощени лица', { id: 'ID', name: 'Име', position: 'Длъжност', act: 'Акт за определяне', from: 'В сила от', to: 'В сила до', active: 'Активно', by: 'Въвел', at: 'Въведено' }],
  addressees: ['Адресати', { id: 'ID', type: 'Вид', name: 'Име или наименование', seat: 'Седалище', address: 'Адрес', oblast: 'Област', email: 'Имейл', phone: 'Телефон', by: 'Въвел', at: 'Въведен', eik: 'ЕИК/БУЛСТАТ' }],
  departments: ['Отдели', { id: 'ID', name: 'Наименование', head: 'Ръководител', position: 'Длъжност', email: 'Имейл', active: 'Активен', by: 'Въвел', at: 'Въведен' }],
  courts: ['Дела', { id: 'ID', regNo: 'Преписка', court: 'Съд', caseNo: '№ на дело', year: 'Година', kind: 'Вид', status: 'Статус', nextHearing: 'Следващо заседание', note: 'Бележки', by: 'Въвел', at: 'Въведено', updatedAt: 'Променено' }],
  files: ['Файлове', { id: 'ID', scope: 'Вид', ref: 'Преписка или дело', name: 'Име', type: 'Тип', size: 'Размер', driveId: 'ID в Drive', by: 'Качил', at: 'Качен', sha256: 'SHA-256' }]
};
const ORG_TABLES = ['profile', 'users', 'cases', 'events', 'docs', 'art15', 'counters', 'signers', 'grounds', 'departments', 'addressees', 'courts', 'files', 'logins', 'log'];
const HEADERS_CHECKED_ = {};
/* полета с водещи нули; в колона без текстов формат Google ги превръща в числа */
const EIK_FIELDS_ = { apps: 'eik', orgs: 'eik', cases: 'applicantEik', addressees: 'eik' };
const textFormat_ = (s, width) => s.getRange(1, 1, s.getMaxRows(), width).setNumberFormat('@');

/* връща водещите нули на вече записани номера: 9 цифри, а при 10 до 12 цифри пълният вид е 13 */
function repairEik_(s, key) {
  const field = EIK_FIELDS_[key], last = s.getLastRow();
  if (!field || last < 2) return;
  const col = Object.keys(SCHEMA[key][1]).indexOf(field) + 1, range = s.getRange(2, col, last - 1, 1);
  const padded = range.getValues().map(([v]) => {
    if (typeof v !== 'number') return [v];
    const t = String(v);
    return [t.length <= 9 ? t.padStart(9, '0') : t.padStart(13, '0')];
  });
  range.setValues(padded);
}

const master_ = () => {
  const id = PropertiesService.getScriptProperties().getProperty('MASTER_ID');
  if (!id) fail_('setup', 'Платформата още не е настроена.');
  return SpreadsheetApp.openById(id);
};

function table_(ss, key) {
  const def = SCHEMA[key];
  let s = ss.getSheetByName(def[0]);
  if (!s) {
    s = ss.insertSheet(def[0]);
    const head = Object.values(def[1]);
    // нов лист има 26 колони по подразбиране, а някои таблици имат повече
    if (s.getMaxColumns() < head.length) s.insertColumnsAfter(s.getMaxColumns(), head.length - s.getMaxColumns());
    s.getRange(1, 1, 1, head.length).setValues([head]);
    s.setFrozenRows(1);
    // всичко като текст: датите и телефоните не се преобразуват автоматично
    textFormat_(s, head.length);
  } else if (!HEADERS_CHECKED_[ss.getId() + key]) {
    // новите колони се добавят в края на вече създадените таблици
    const head = Object.values(def[1]), have = s.getLastColumn();
    if (have < head.length) {
      if (s.getMaxColumns() < head.length) s.insertColumnsAfter(s.getMaxColumns(), head.length - s.getMaxColumns());
      s.getRange(1, have + 1, 1, head.length - have).setValues([head.slice(have)]);
    }
    // колона, добавена в края от по-стара версия, може да е останала без текстов формат
    if (s.getRange(2, head.length).getNumberFormat() !== '@') {
      textFormat_(s, head.length);
      repairEik_(s, key);
    }
  }
  HEADERS_CHECKED_[ss.getId() + key] = true;
  return s;
}

/* защита от изпълнение като формула при ръчно отваряне на таблицата */
const safeCell_ = v => {
  if (v === null || v === undefined) return '';
  const t = String(v);
  return /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
};
const readCell_ = v => {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, "yyyy-MM-dd'T'HH:mm:ss");
  const t = v === null || v === undefined ? '' : String(v);
  return /^'[=+\-@\t\r]/.test(t) ? t.slice(1) : t;
};

function read_(ss, key) {
  const def = SCHEMA[key], s = table_(ss, key), last = s.getLastRow();
  if (last < 2) return [];
  const width = Object.keys(def[1]).length;
  const head = s.getRange(1, 1, 1, width).getValues()[0];
  const fields = Object.keys(def[1]).map(f => [f, head.indexOf(def[1][f])]);
  return s.getRange(2, 1, last - 1, width).getValues().map((row, i) => {
    const o = { _row: i + 2 };
    fields.forEach(([f, c]) => { o[f] = c >= 0 ? readCell_(row[c]) : ''; });
    return o;
  });
}

function insert_(ss, key, obj) {
  const def = SCHEMA[key], s = table_(ss, key), fields = Object.keys(def[1]);
  const row = s.getLastRow() + 1;
  if (row > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), 500);
  s.getRange(row, 1, 1, fields.length).setValues([fields.map(f => safeCell_(obj[f]))]);
  return row;
}

function patch_(ss, key, row, obj) {
  const def = SCHEMA[key], s = table_(ss, key), fields = Object.keys(def[1]);
  Object.keys(obj).forEach(f => {
    const c = fields.indexOf(f);
    if (c >= 0 && f !== '_row') s.getRange(row, c + 1, 1, 1).setValues([[safeCell_(obj[f])]]);
  });
}

function nextCounter_(ss, name) {
  const r = read_(ss, 'counters').find(x => x.key === name);
  const n = (r ? Number(r.value) || 0 : 0) + 1;
  if (r) patch_(ss, 'counters', r._row, { value: n });
  else insert_(ss, 'counters', { key: name, value: n });
  return n;
}

function audit_(ss, actor, action, ref, details) {
  insert_(ss, 'log', { at: stamp_(), actor: actor, action: action, ref: ref || '', details: String(details || '').slice(0, 1000) });
}

function publicRows_(rows) {
  return rows.map(r => {
    const o = Object.assign({}, r);
    ['_row', 'salt', 'hash', 'inviteHash', 'payload'].forEach(k => delete o[k]);
    return o;
  });
}

/* ---------- стойности и проверки ---------- */

const stamp_ = () => Utilities.formatDate(new Date(), CFG.TZ, "yyyy-MM-dd'T'HH:mm:ss");
const todayIso_ = () => Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
const str_ = (v, max) => String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 500);
const line_ = (v, max) => str_(v, max).replace(/\s*[\r\n]+\s*/g, ' ');
const isEmail_ = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200;

function isoDate_(v) {
  const t = str_(v, 10);
  if (!t) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) fail_('date', 'Невалидна дата: ' + t);
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== m[2] - 1 || d.getUTCDate() !== +m[3]) fail_('date', 'Невалидна дата: ' + t);
  return t;
}

function oneOf_(v, list, label) {
  const t = str_(v, 200);
  if (list.indexOf(t) < 0) fail_('value', 'Невалидна стойност за „' + label + '“.');
  return t;
}

/* ЕИК/БУЛСТАТ: 9 или 13 цифри с контролни цифри */
function validEik_(raw) {
  const v = String(raw || '');
  if (!/^(\d{9}|\d{13})$/.test(v)) return false;
  const d = v.split('').map(Number);
  const sum = (w, from) => w.reduce((a, x, i) => a + x * d[from + i], 0);
  let c = sum([1, 2, 3, 4, 5, 6, 7, 8], 0) % 11;
  if (c === 10) { c = sum([3, 4, 5, 6, 7, 8, 9, 10], 0) % 11; if (c === 10) c = 0; }
  if (c !== d[8]) return false;
  if (v.length === 9) return true;
  c = sum([2, 7, 3, 5], 8) % 11;
  if (c === 10) { c = sum([4, 9, 5, 7], 8) % 11; if (c === 10) c = 0; }
  return c === d[12];
}

/* ---------- имейл ---------- */

/*
 * Писмата излизат от пощенската кутия в Microsoft 365, когато в свойствата на скрипта има MS_TENANT, MS_CLIENT_ID, MS_SENDER,
 * MS_PRIVATE_KEY, MS_CERT_SHA256 и MS_CERT_SHA1. Без тях, или ако Microsoft откаже, излизат през Google, за да не се губят
 * връзките за достъп. Приложението се удостоверява със сертификат, защото организацията забранява тайни (client secrets).
 */
function msConfig_() {
  const p = PropertiesService.getScriptProperties();
  const c = {
    tenant: p.getProperty('MS_TENANT'), clientId: p.getProperty('MS_CLIENT_ID'), sender: p.getProperty('MS_SENDER'),
    key: p.getProperty('MS_PRIVATE_KEY'), sha256: p.getProperty('MS_CERT_SHA256'), sha1: p.getProperty('MS_CERT_SHA1')
  };
  return c.tenant && c.clientId && c.sender && c.key && c.sha256 && c.sha1 ? c : null;
}

/* при поставяне в свойствата на скрипта редовете на ключа може да се слеят, затова се подреждат наново */
function msPem_(raw) {
  const body = String(raw).replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  return '-----BEGIN PRIVATE KEY-----\n' + body.replace(/(.{64})/g, '$1\n').replace(/\n$/, '') + '\n-----END PRIVATE KEY-----\n';
}

const b64url_ = v => Utilities.base64EncodeWebSafe(v).replace(/=+$/, '');
const hexBytes_ = hex => (String(hex).replace(/[^0-9a-fA-F]/g, '').match(/../g) || []).map(h => { const n = parseInt(h, 16); return n > 127 ? n - 256 : n; });

/* подписано твърдение за вход със сертификат; важи 5 минути */
function msAssertion_(c, tokenUrl) {
  const now = Math.floor(Date.now() / 1000);
  const text = o => b64url_(Utilities.newBlob(JSON.stringify(o)).getBytes());
  const head = text({ alg: 'RS256', typ: 'JWT', x5t: b64url_(hexBytes_(c.sha1)), 'x5t#S256': b64url_(hexBytes_(c.sha256)) });
  const claims = text({ aud: tokenUrl, iss: c.clientId, sub: c.clientId, jti: Utilities.getUuid(), nbf: now, iat: now, exp: now + 300 });
  return head + '.' + claims + '.' + b64url_(Utilities.computeRsaSha256Signature(head + '.' + claims, msPem_(c.key)));
}

function msToken_(c) {
  const cache = CacheService.getScriptCache(), hit = cache.get('ms:token');
  if (hit) return hit;
  const url = 'https://login.microsoftonline.com/' + encodeURIComponent(c.tenant) + '/oauth2/v2.0/token';
  const r = UrlFetchApp.fetch(url, {
    method: 'post', muteHttpExceptions: true,
    payload: {
      client_id: c.clientId, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: msAssertion_(c, url)
    }
  });
  if (r.getResponseCode() !== 200) throw new Error('токен: ' + r.getResponseCode() + ' ' + msError_(r));
  const t = JSON.parse(r.getContentText());
  cache.put('ms:token', t.access_token, Math.max(60, Math.min(21600, (Number(t.expires_in) || 3600) - 300)));
  return t.access_token;
}

/* само кодът на грешката: отговорът не се записва целият в журнала */
function msError_(r) {
  try {
    const e = JSON.parse(r.getContentText());
    const aad = /AADSTS\d+/.exec(e.error_description || '');
    return (String((e.error && e.error.code) || e.error || '').slice(0, 80) + (aad ? ' ' + aad[0] : '')).trim();
  } catch (_) { return ''; }
}

/* писмата не се пазят в „Изпратени“, защото съдържат еднократни връзки за парола */
function msSend_(c, to, subject, text) {
  const r = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(c.sender) + '/sendMail', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + msToken_(c) },
    payload: JSON.stringify({
      message: {
        subject: subject, body: { contentType: 'Text', content: text },
        toRecipients: [{ emailAddress: { address: to } }], replyTo: [{ emailAddress: { address: CFG.SUPPORT } }]
      },
      saveToSentItems: false
    })
  });
  const code = r.getResponseCode();
  if (code === 401) CacheService.getScriptCache().remove('ms:token');
  if (code !== 202) throw new Error('изпращане: ' + code + ' ' + msError_(r));
}

function mail_(to, subject, body) {
  const title = line_(subject, 200), text = body + '\n\n--\n' + CFG.MAINTAINER + '\nПоддръжка: ' + CFG.SUPPORT;
  const ms = msConfig_();
  if (ms) {
    try {
      msSend_(ms, to, title, text);
      return true;
    } catch (e) {
      console.error('microsoft: ' + e.message);
    }
  }
  try {
    MailApp.sendEmail({ to: to, subject: title, body: text, name: 'ЗДОИ4You Платформа', replyTo: CFG.SUPPORT });
    return true;
  } catch (e) {
    console.error('mail: ' + e);
    return false;
  }
}

/* ---------- календар (чл. 154 КТ; срок, изтичащ в неработен ден, се мести на следващия работен) ---------- */

const DAY_MS_ = 864e5;
const mkDate_ = (y, m, d) => new Date(Date.UTC(y, m, d));
const dateKey_ = d => d.toISOString().slice(0, 10);
const addDays_ = (d, n) => new Date(d.getTime() + n * DAY_MS_);
const parseIso_ = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? mkDate_(+m[1], m[2] - 1, +m[3]) : null; };

function orthodoxEaster_(y) { // юлиански Великден + 13 дни (1900–2099)
  const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return addDays_(mkDate_(y, month - 1, day), 13);
}

function holidays_(y) {
  const set = {}, e = orthodoxEaster_(y);
  [-2, -1, 0, 1].forEach(o => { set[dateKey_(addDays_(e, o))] = 1; });
  const fixed = [[0, 1], [2, 3], [4, 1], [4, 6], [4, 24], [8, 6], [8, 22], [11, 24], [11, 25], [11, 26]].map(p => mkDate_(y, p[0], p[1]));
  fixed.forEach(f => { set[dateKey_(f)] = 1; });
  fixed.forEach(f => {
    const w = f.getUTCDay();
    if (w === 0 || w === 6) {
      let x = addDays_(f, 1);
      while (x.getUTCDay() === 0 || x.getUTCDay() === 6 || set[dateKey_(x)]) x = addDays_(x, 1);
      set[dateKey_(x)] = 1;
    }
  });
  return set;
}

const isWorkday_ = d => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !holidays_(d.getUTCFullYear())[dateKey_(d)];

function term_(startIso, days) {
  let end = addDays_(parseIso_(startIso), days);
  while (!isWorkday_(end)) end = addDays_(end, 1);
  return dateKey_(end);
}
