/* Регистрация, одобрение, организационен профил и потребители. */

const ORG_TYPES = ['Община', 'Областна администрация', 'Министерство', 'Държавна агенция или комисия', 'Друга администрация', 'Публичноправна организация', 'Юридическо лице'];
const ORG_BASES = ['чл. 3, ал. 1', 'чл. 3, ал. 2, т. 1', 'чл. 3, ал. 2, т. 2'];
/* всички полета на организацията са задължителни */
const ORG_FIELDS = {
  name: 200, type: 60, basis: 40, eik: 13, oblast: 80, municipality: 80, city: 80, postcode: 4, address: 300,
  phone: 40, email: 200, web: 200, headName: 120, headPosition: 120,
  unitName: 200, unitAddress: 300, unitEmail: 200, unitPhone: 40, unitHours: 200
};
const ADMIN_FIELDS = { adminName: 120, adminPosition: 120, adminEmail: 200, adminPhone: 40, adminUsername: 40 };

function cleanOrg_(d) {
  const o = {};
  Object.keys(ORG_FIELDS).forEach(k => {
    o[k] = line_(d[k], ORG_FIELDS[k]);
    if (!o[k]) fail_('required', 'Попълнете всички данни на организацията (липсва: ' + k + ').');
  });
  oneOf_(o.type, ORG_TYPES, 'Вид');
  oneOf_(o.basis, ORG_BASES, 'Основание по ЗДОИ');
  if (!validEik_(o.eik)) fail_('eik', 'Невалиден ЕИК/БУЛСТАТ.');
  if (!/^\d{4}$/.test(o.postcode)) fail_('postcode', 'Пощенският код трябва да е от 4 цифри.');
  if (!isEmail_(o.email)) fail_('email', 'Невалиден официален имейл.');
  if (!isEmail_(o.unitEmail)) fail_('email', 'Невалиден имейл на звеното за достъп.');
  if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(o.web)) fail_('web', 'Интернет страницата трябва да започва с https://');
  return o;
}

function cleanAdmin_(d) {
  const a = {};
  Object.keys(ADMIN_FIELDS).forEach(k => {
    a[k] = line_(d[k], ADMIN_FIELDS[k]);
    if (!a[k]) fail_('required', 'Попълнете всички данни на администратора.');
  });
  a.adminUsername = a.adminUsername.toLowerCase();
  if (!USER_RE_.test(a.adminUsername)) fail_('username', 'Потребителското име може да съдържа само малки латински букви, цифри и . _ - (3–40 знака).');
  if (!isEmail_(a.adminEmail)) fail_('email', 'Невалиден имейл на администратора.');
  return a;
}

/* номерът се създава в браузъра, защото участва в изчисляването на хеша на паролата */
function newNumber_(raw) {
  const no = str_(raw, 8);
  if (!NO_RE_.test(no) || no === CFG.OPERATOR_NO || no.charAt(0) === '0' || luhn_(no.slice(0, 7)) !== no.charAt(7)) fail_('value', 'Невалиден номер на организация.');
  return no;
}

function newPreHash_(raw) {
  const preHash = str_(raw, 64);
  if (!PREHASH_RE_.test(preHash)) fail_('value', 'Задайте парола на администратора.');
  return preHash;
}

const numberTaken_ = (m, no) => read_(m, 'orgs').some(x => x.no === no) || read_(m, 'apps').some(x => x.orgNo === no && x.status !== 'Отказана');

/* отделна таблица за организацията и първият ѝ администратор */
function createOrg_(m, data, no, salt, hash, actor, mustChange, ref) {
  const book = SpreadsheetApp.create('ЗДОИ4You – ' + no + ' – ' + data.name);
  const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  DriveApp.getFileById(book.getId()).moveTo(DriveApp.getFolderById(folderId));
  ORG_TABLES.forEach(k => table_(book, k));
  dropDefaultSheet_(book);
  Object.keys(ORG_FIELDS).forEach(k => insert_(book, 'profile', { key: k, value: data[k] }));
  insert_(book, 'users', {
    username: data.adminUsername, name: data.adminName, position: data.adminPosition, email: data.adminEmail, phone: data.adminPhone,
    role: ROLE_ADMIN, active: 'Да', salt: salt, hash: hash, createdAt: stamp_(), createdBy: actor, mustChange: mustChange ? 'Да' : ''
  });
  audit_(book, actor, 'Организацията е създадена', no, ref);
  insert_(m, 'orgs', { no: no, name: data.name, eik: data.eik, type: data.type, status: 'Активна', sheetId: book.getId(), approvedAt: stamp_(), approvedBy: actor, adminUser: data.adminUsername });
}

/* ---------- публична заявка ---------- */

const applyOpen_ = () => PropertiesService.getScriptProperties().getProperty('APPLY_CLOSED') !== '1';

function publicConfig_() {
  return { applyOpen: applyOpen_() };
}

function opApplyOpen_(d, ctx) {
  if (typeof d.open !== 'boolean') fail_('value', 'Невалидна стойност.');
  PropertiesService.getScriptProperties().setProperty('APPLY_CLOSED', d.open ? '0' : '1');
  audit_(master_(), ctx.username, d.open ? 'Включени заявки за регистрация' : 'Спрени заявки за регистрация', '', '');
  return { applyOpen: d.open };
}

function applyPublic_(d) {
  if (!applyOpen_()) fail_('closed', 'Заявките за регистрация временно са спрени. За въпроси: ' + CFG.SUPPORT);
  if (d.hp) return { id: 'ok' }; // скрито поле за ботове
  const cache = CacheService.getScriptCache();
  const hour = Number(cache.get('apply:h')) || 0;
  if (hour >= CFG.APPLY_PER_HOUR) fail_('busy', 'Твърде много заявки. Опитайте по-късно.');
  const org = cleanOrg_(d), admin = cleanAdmin_(d);
  if (d.declare !== true) fail_('required', 'Необходимо е да потвърдите декларацията за представителна власт.');
  const no = newNumber_(d.no), preHash = newPreHash_(d.hash);
  const m = master_();
  if (read_(m, 'orgs').some(x => x.eik === org.eik && x.status !== 'Закрита')) fail_('duplicate', 'Организация с този ЕИК/БУЛСТАТ вече е регистрирана.');
  if (read_(m, 'apps').some(x => x.eik === org.eik && x.status === 'Чака одобрение')) fail_('duplicate', 'За този ЕИК/БУЛСТАТ вече има подадена заявка, която чака одобрение.');
  if (numberTaken_(m, no)) fail_('retry', 'Номерът е зает. Опитайте отново.');
  cache.put('apply:h', String(hour + 1), 3600);
  const id = 'Р-' + todayIso_().slice(0, 4) + '-' + String(nextCounter_(m, 'apps')).padStart(4, '0');
  const salt = randomToken_().slice(0, 32);
  insert_(m, 'apps', {
    id: id, at: stamp_(), status: 'Чака одобрение', name: org.name, eik: org.eik, type: org.type, email: org.email,
    payload: JSON.stringify(Object.assign({}, org, admin)), orgNo: no, salt: salt, hash: serverHash_(preHash, salt)
  });
  audit_(m, 'публично', 'Заявка за регистрация', id, org.name + ' (' + org.eik + ')');
  mail_(org.email, 'ЗДОИ4You Платформа – получена заявка ' + id,
    'Получихме заявката за регистрация на „' + org.name + '“ с № ' + id + '.\n' +
    'След проверка ще изпратим решението на този адрес. Ако не сте я подали вие, отговорете на това писмо.');
  const notify = PropertiesService.getScriptProperties().getProperty('NOTIFY');
  if (notify) mail_(notify, 'Нова заявка за регистрация ' + id, org.name + ' (' + org.eik + ')\n' + CFG.APP_URL + '#/op/apps');
  return { id: id };
}

/* ---------- оператор ---------- */

function opApps_() {
  const rows = read_(master_(), 'apps').reverse();
  return { applyOpen: applyOpen_(), apps: rows.map(r => { const o = publicRows_([r])[0]; o.data = JSON.parse(r.payload || '{}'); return o; }) };
}

function opOrgs_() {
  const m = master_(), plans = plansOf_(m);
  return { orgs: publicRows_(read_(m, 'orgs')).map(o => { delete o.sheetId; const p = plans.find(x => x.id === o.plan); o.planName = p ? p.name : ''; return o; }) };
}

function opLog_() {
  return { log: read_(master_(), 'log').slice(-400).reverse().map(l => { delete l._row; return l; }) };
}

function luhn_(s) {
  let sum = 0;
  s.split('').reverse().forEach((c, i) => {
    let x = Number(c);
    if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9; }
    sum += x;
  });
  return String((10 - sum % 10) % 10);
}

function opDecide_(d, ctx) {
  const m = master_(), app = read_(m, 'apps').find(x => x.id === str_(d.id, 40));
  if (!app) fail_('notfound', 'Заявката не е намерена.');
  if (app.status !== 'Чака одобрение') fail_('state', 'По тази заявка вече има решение.');
  if (d.approve !== true) {
    const reason = str_(d.reason, 1000);
    if (!reason) fail_('required', 'Посочете причина за отказа.');
    patch_(m, 'apps', app._row, { status: 'Отказана', reason: reason, decidedBy: ctx.username, decidedAt: stamp_() });
    audit_(m, ctx.username, 'Отказана регистрация', app.id, reason);
    mail_(app.email, 'ЗДОИ4You Платформа – заявка ' + app.id, 'Заявката за регистрация на „' + app.name + '“ не е одобрена.\n\nПричина: ' + reason);
    return {};
  }
  const data = JSON.parse(app.payload);
  const orgs = read_(m, 'orgs');
  if (orgs.some(x => x.eik === data.eik && x.status !== 'Закрита')) fail_('duplicate', 'Организация с този ЕИК/БУЛСТАТ вече е регистрирана.');
  const no = app.orgNo;
  if (orgs.some(x => x.no === no)) fail_('duplicate', 'Номерът на организацията вече се използва.');

  createOrg_(m, data, no, app.salt, app.hash, ctx.username, false, app.id);
  // хешът вече е в таблицата на организацията и не остава в главната
  patch_(m, 'apps', app._row, { status: 'Одобрена', decidedBy: ctx.username, decidedAt: stamp_(), salt: '', hash: '' });
  audit_(m, ctx.username, 'Одобрена регистрация', app.id, no + ' ' + data.name);

  // само известие: без номер, потребител, парола или връзка
  const notice = 'Заявката за регистрация на „' + data.name + '“ е одобрена.\n\n' +
    'Влезте на ' + CFG.APP_URL + ' с номера на организацията, показан при подаването на заявката, и с избраните потребителско име и парола.';
  [data.adminEmail, data.email].filter((x, i, all) => all.indexOf(x) === i).forEach(to => mail_(to, 'ЗДОИ4You Платформа – одобрена регистрация', notice));
  return { no: no };
}

function opStatus_(d, ctx) {
  const m = master_(), no = str_(d.no, 8), org = read_(m, 'orgs').find(x => x.no === no);
  if (!org) fail_('notfound', 'Организацията не е намерена.');
  const status = oneOf_(d.status, ['Активна', 'Спряна'], 'Статус');
  patch_(m, 'orgs', org._row, { status: status });
  dropOrgCache_(no);
  audit_(m, ctx.username, status === 'Активна' ? 'Активирана организация' : 'Спряна организация', no, org.name);
  return {};
}

function regOrg_(raw) {
  const no = str_(raw, 8), org = read_(master_(), 'orgs').find(x => x.no === no);
  if (!org) fail_('notfound', 'Организацията не е намерена.');
  return org;
}

const opActor_ = ctx => 'оператор ' + ctx.username;

function usersPublic_(ss) {
  return publicRows_(read_(ss, 'users')).map(u => { const o = Object.assign({}, u); o.pending = !!u.inviteExp; delete o.inviteExp; o.perms = Object.keys(permsOf_(u)); return o; });
}

function opOrgGet_(d, ctx) {
  const org = regOrg_(d.no), book = orgSheet_(org);
  return { no: org.no, status: org.status, plan: org.plan, plans: plansOf_(master_()), profile: profile_(book), users: usersPublic_(book), signers: signersOf_(book), grounds: groundsOf_(book) };
}

/* ---------- собствени правни основания на организацията ---------- */

const GROUND_SCOPES = ['refuse', 'grant', 'dismiss', 'letter'];
const groundsOf_ = ss => read_(ss, 'grounds').map(s => { const x = Object.assign({}, s); delete x._row; return x; });

function saveGround_(ss, d, actor) {
  const v = { scope: oneOf_(d.scope, GROUND_SCOPES, 'Вид акт'), text: line_(d.text, 500), active: d.active === false ? 'Не' : 'Да' };
  if (!v.text) fail_('required', 'Напишете правното основание.');
  const id = str_(d.id, 16);
  if (id) {
    const cur = read_(ss, 'grounds').find(s => s.id === id);
    if (!cur) fail_('notfound', 'Основанието не е намерено.');
    patch_(ss, 'grounds', cur._row, v);
    audit_(ss, actor, 'Променено правно основание', v.scope, v.text);
    return { id: id };
  }
  const newId = 'c' + randomToken_().slice(0, 15);
  insert_(ss, 'grounds', Object.assign({ id: newId, by: actor, at: stamp_() }, v));
  audit_(ss, actor, 'Добавено правно основание', v.scope, v.text);
  return { id: newId };
}

function groundsSave_(d, ctx) {
  return saveGround_(ctx.ss(), d, ctx.username);
}

function opGroundSave_(d, ctx) {
  const reg = regOrg_(d.no), r = saveGround_(orgSheet_(reg), d, opActor_(ctx));
  audit_(master_(), ctx.username, 'Правно основание в организация', reg.no, line_(d.text, 200));
  return r;
}

/* ---------- лица, определени да издават решения (чл. 28, ал. 2 ЗДОИ) ---------- */

const signersOf_ = ss => read_(ss, 'signers').map(s => { const o = Object.assign({}, s); delete o._row; return o; });

function saveSigner_(ss, d, actor) {
  const v = { name: line_(d.name, 120), position: line_(d.position, 120), act: line_(d.act, 300), from: isoDate_(d.from), to: isoDate_(d.to), active: d.active === false ? 'Не' : 'Да' };
  if (!v.name || !v.position || !v.act) fail_('required', 'Попълнете име, длъжност и акта за определяне.');
  if (v.from && v.to && v.from > v.to) fail_('value', 'Началната дата е след крайната.');
  const id = str_(d.id, 16);
  if (id) {
    const cur = read_(ss, 'signers').find(s => s.id === id);
    if (!cur) fail_('notfound', 'Лицето не е намерено.');
    patch_(ss, 'signers', cur._row, v);
    audit_(ss, actor, 'Променено упълномощено лице', v.name, v.act);
    return { id: id };
  }
  const newId = randomToken_().slice(0, 16);
  insert_(ss, 'signers', Object.assign({ id: newId, by: actor, at: stamp_() }, v));
  audit_(ss, actor, 'Добавено упълномощено лице', v.name, v.act);
  return { id: newId };
}

function signersSave_(d, ctx) {
  return saveSigner_(ctx.ss(), d, ctx.username);
}

function opSignerSave_(d, ctx) {
  const reg = regOrg_(d.no), r = saveSigner_(orgSheet_(reg), d, opActor_(ctx));
  audit_(master_(), ctx.username, 'Упълномощено лице в организация', reg.no, line_(d.name, 120));
  return r;
}

/* ---------- планове: подготвят се от оператора и още не ограничават нищо ---------- */

const PLAN_STATUS = ['Подготвя се', 'Въведен'];
const plansOf_ = m => read_(m, 'plans').map(p => { const o = Object.assign({}, p); delete o._row; return o; });

function opPlans_() {
  return { plans: plansOf_(master_()) };
}

function opPlanSave_(d, ctx) {
  const m = master_(), rows = read_(m, 'plans'), id = str_(d.id, 24);
  const v = { name: line_(d.name, 80), description: str_(d.description, 2000), status: oneOf_(d.status, PLAN_STATUS, 'Състояние') };
  if (!v.name) fail_('required', 'Напишете наименование на плана.');
  if (rows.some(p => p.id !== id && p.name.toLowerCase() === v.name.toLowerCase())) fail_('duplicate', 'Вече има план с това наименование.');
  if (id) {
    const cur = rows.find(p => p.id === id);
    if (!cur) fail_('notfound', 'Планът не е намерен.');
    patch_(m, 'plans', cur._row, v);
    audit_(m, ctx.username, 'Променен план', v.name, v.status);
    return { id: id };
  }
  const newId = 'p' + randomToken_().slice(0, 15);
  insert_(m, 'plans', Object.assign({ id: newId, by: ctx.username, at: stamp_() }, v));
  audit_(m, ctx.username, 'Добавен план', v.name, v.status);
  return { id: newId };
}

function opOrgPlan_(d, ctx) {
  const m = master_(), reg = regOrg_(d.no), plan = str_(d.plan, 24);
  const p = plan ? plansOf_(m).find(x => x.id === plan) : null;
  if (plan && !p) fail_('notfound', 'Планът не е намерен.');
  patch_(m, 'orgs', reg._row, { plan: plan });
  dropOrgCache_(reg.no);
  audit_(m, ctx.username, 'Променен план на организация', reg.no, p ? p.name : 'без план');
  return {};
}

/* организацията вижда плана си едва когато е въведен */
function orgPlan_(org) {
  if (!org.plan) return null;
  const p = plansOf_(master_()).find(x => x.id === org.plan);
  return p && p.status === 'Въведен' ? { name: p.name, description: p.description } : null;
}

/* ---------- адресати: запазени получатели, които се избират вместо ръчно въвеждане ---------- */

const addresseeTypes_ = () => APPLICANT_TYPE.concat('Орган или друга организация');
/* без право да вижда всички преписки потребителят вижда само въведените от него адресати */
const seesAddressee_ = (a, ctx) => !!ctx.perms.casesAll || a.by === ctx.username;

function addresseesOf_(ss, ctx) {
  return read_(ss, 'addressees').filter(a => seesAddressee_(a, ctx)).map(a => { const o = Object.assign({}, a); delete o._row; return o; });
}

/* в дневника остава само идентификатор, защото адресатите често са физически лица */
function saveAddressee_(ss, d, ctx) {
  const v = {
    type: oneOf_(d.type, addresseeTypes_(), 'Вид'), name: line_(d.name, 200), seat: line_(d.seat, 120), address: line_(d.address, 300),
    oblast: line_(d.oblast, 80), email: line_(d.email, 200), phone: line_(d.phone, 40)
  };
  if (!v.name) fail_('required', 'Напишете име или наименование на адресата.');
  if (!v.address && !v.email) fail_('required', 'Посочете адрес или имейл на адресата.');
  if (v.email && !isEmail_(v.email)) fail_('email', 'Невалиден имейл на адресата.');
  const rows = read_(ss, 'addressees').filter(a => seesAddressee_(a, ctx)), id = str_(d.id, 24);
  if (id) {
    const cur = rows.find(a => a.id === id);
    if (!cur) fail_('notfound', 'Адресатът не е намерен.');
    patch_(ss, 'addressees', cur._row, v);
    audit_(ss, ctx.username, 'Променен адресат', id, '');
    return { id: id };
  }
  const same = rows.find(a => a.name === v.name && a.address === v.address && a.email === v.email);
  if (same) return { id: same.id, existed: true };
  const newId = 'a' + randomToken_().slice(0, 15);
  insert_(ss, 'addressees', Object.assign({ id: newId, by: ctx.username, at: stamp_() }, v));
  audit_(ss, ctx.username, 'Добавен адресат', newId, '');
  return { id: newId };
}

function addresseesSave_(d, ctx) {
  return saveAddressee_(ctx.ss(), d, ctx);
}

function addresseesDelete_(d, ctx) {
  const ss = ctx.ss(), id = str_(d.id, 24), cur = read_(ss, 'addressees').find(a => a.id === id && seesAddressee_(a, ctx));
  if (!cur) fail_('notfound', 'Адресатът не е намерен.');
  table_(ss, 'addressees').deleteRow(cur._row);
  audit_(ss, ctx.username, 'Изтрит адресат', id, '');
  return {};
}

/* новата преписка може да запише заявителя и в адресатите */
function caseCreateWithAddressee_(d, ctx) {
  const r = caseCreate_(d, ctx);
  if (d.saveAddressee === 'on') {
    saveAddressee_(ctx.ss(), { type: d.applicantType, name: d.applicantName, seat: d.applicantSeat, address: d.applicantAddress, oblast: d.applicantOblast, email: d.applicantEmail, phone: d.applicantPhone }, ctx);
  }
  return r;
}

/* операторът добавя организация директно, без заявка */
function opOrgCreate_(d, ctx) {
  const org = cleanOrg_(d), admin = cleanAdmin_(d), no = newNumber_(d.no), preHash = newPreHash_(d.hash), m = master_();
  if (read_(m, 'orgs').some(x => x.eik === org.eik && x.status !== 'Закрита')) fail_('duplicate', 'Организация с този ЕИК/БУЛСТАТ вече е регистрирана.');
  if (read_(m, 'apps').some(x => x.eik === org.eik && x.status === 'Чака одобрение')) fail_('duplicate', 'За този ЕИК/БУЛСТАТ има подадена заявка, която чака одобрение. Решете я от „Заявки за регистрация“.');
  if (numberTaken_(m, no)) fail_('retry', 'Номерът е зает. Опитайте отново.');
  const salt = randomToken_().slice(0, 32);
  createOrg_(m, Object.assign({}, org, admin), no, salt, serverHash_(preHash, salt), opActor_(ctx), true, 'добавена от оператор');
  audit_(m, ctx.username, 'Добавена организация', no, org.name);
  mail_(org.email, 'ЗДОИ4You Платформа – регистрирана организация',
    '„' + org.name + '“ е регистрирана в платформата ' + CFG.APP_URL + ' от екипа на ЗДОИ4You. Данните за вход се предават лично.');
  return { no: no };
}

function saveProfile_(book, cur, next, actor) {
  const rows = read_(book, 'profile'), changed = [];
  Object.keys(next).forEach(k => {
    if (next[k] === cur[k]) return;
    const r = rows.find(x => x.key === k);
    if (r) patch_(book, 'profile', r._row, { value: next[k] }); else insert_(book, 'profile', { key: k, value: next[k] });
    changed.push(k);
  });
  audit_(book, actor, 'Промяна на данните на организацията', '', changed.join(', '));
  return changed;
}

/* профилът и регистърът се променят заедно */
function applyOrg_(m, reg, book, next, actor) {
  if (read_(m, 'orgs').some(x => x.no !== reg.no && x.eik === next.eik && x.status !== 'Закрита')) fail_('duplicate', 'Друга организация вече е с този ЕИК/БУЛСТАТ.');
  const changed = saveProfile_(book, profile_(book), next, actor);
  patch_(m, 'orgs', reg._row, { name: next.name, eik: next.eik, type: next.type });
  dropOrgCache_(reg.no);
  return changed;
}

function opOrgSave_(d, ctx) {
  const m = master_(), reg = regOrg_(d.no), next = cleanOrg_(d);
  const changed = applyOrg_(m, reg, orgSheet_(reg), next, opActor_(ctx));
  audit_(m, ctx.username, 'Променени данни на организация', reg.no, changed.join(', '));
  return { profile: next };
}

/* ---------- заявки за промяна: организациите не редактират данните си, а искат промяна с основание ---------- */

const PENDING_ = 'Чака одобрение';

const changeView_ = r => {
  const o = Object.assign({}, r);
  delete o._row;
  o.changed = JSON.parse(r.changed || '{}');
  return o;
};

function orgChangeRequest_(d, ctx) {
  const m = master_(), book = ctx.ss(), cur = profile_(book), next = cleanOrg_(d), basis = str_(d.changeBasis, 2000);
  if (!basis) fail_('required', 'Посочете основанието за промяната.');
  if (read_(m, 'changes').some(x => x.no === ctx.no && x.status === PENDING_)) fail_('pending', 'Вече има заявка за промяна, която чака решение.');
  const changed = {};
  Object.keys(ORG_FIELDS).forEach(k => { if (next[k] !== (cur[k] || '')) changed[k] = { from: cur[k] || '', to: next[k] }; });
  if (!Object.keys(changed).length) fail_('nochange', 'Няма променени данни.');
  const id = 'П-' + todayIso_().slice(0, 4) + '-' + String(nextCounter_(m, 'changes')).padStart(4, '0');
  insert_(m, 'changes', { id: id, at: stamp_(), no: ctx.no, orgName: cur.name, by: ctx.username, status: PENDING_, basis: basis, changed: JSON.stringify(changed) });
  audit_(book, ctx.username, 'Заявка за промяна на данните', id, Object.keys(changed).join(', '));
  audit_(m, ctx.username, 'Заявка за промяна на данните', ctx.no, id);
  const notify = PropertiesService.getScriptProperties().getProperty('NOTIFY');
  if (notify) mail_(notify, 'Заявка за промяна ' + id, cur.name + '\n' + CFG.APP_URL + '#/op/changes');
  return { id: id };
}

function orgChanges_(d, ctx) {
  return { changes: read_(master_(), 'changes').filter(x => x.no === ctx.no).reverse().map(changeView_) };
}

function opChanges_() {
  return { changes: read_(master_(), 'changes').reverse().map(changeView_) };
}

function opChangeDecide_(d, ctx) {
  const m = master_(), r = read_(m, 'changes').find(x => x.id === str_(d.id, 40));
  if (!r) fail_('notfound', 'Заявката не е намерена.');
  if (r.status !== PENDING_) fail_('state', 'По тази заявка вече има решение.');
  const reg = regOrg_(r.no), book = orgSheet_(reg);
  const official = profile_(book).email;
  if (d.approve !== true) {
    const reason = str_(d.reason, 1000);
    if (!reason) fail_('required', 'Посочете причина за отказа.');
    patch_(m, 'changes', r._row, { status: 'Отказана', reason: reason, decidedBy: ctx.username, decidedAt: stamp_() });
    audit_(book, opActor_(ctx), 'Отказана заявка за промяна', r.id, reason);
    audit_(m, ctx.username, 'Отказана заявка за промяна', r.no, r.id);
    mail_(official, 'ЗДОИ4You Платформа – заявка за промяна ' + r.id, 'Заявката за промяна на данните не е одобрена.\n\nПричина: ' + reason);
    return {};
  }
  // промените се нанасят върху текущите данни и се проверяват отново
  const changed = JSON.parse(r.changed), next = Object.assign({}, profile_(book));
  Object.keys(changed).forEach(k => { next[k] = changed[k].to; });
  const clean = cleanOrg_(next);
  applyOrg_(m, reg, book, clean, opActor_(ctx));
  patch_(m, 'changes', r._row, { status: 'Одобрена', decidedBy: ctx.username, decidedAt: stamp_() });
  audit_(m, ctx.username, 'Одобрена заявка за промяна', r.no, r.id);
  mail_(official, 'ЗДОИ4You Платформа – заявка за промяна ' + r.id, 'Заявката за промяна на данните на „' + clean.name + '“ е одобрена и данните са обновени.');
  return {};
}

function opUserSave_(d, ctx) {
  const reg = regOrg_(d.no), book = orgSheet_(reg);
  const r = usersSave_(d, { ss: () => book, no: reg.no, username: opActor_(ctx) });
  audit_(master_(), ctx.username, r.created ? 'Нов потребител в организация' : 'Променен потребител в организация', reg.no, str_(d.username, 40));
  return r;
}

/* паролата се генерира в браузъра на оператора; тук идва само нейният хеш */
function opUserPassword_(d, ctx) {
  const reg = regOrg_(d.no), book = orgSheet_(reg), preHash = newPreHash_(d.hash);
  const username = str_(d.username, 40).toLowerCase();
  const u = read_(book, 'users').find(x => x.username === username);
  if (!u) fail_('notfound', 'Потребителят не е намерен.');
  const salt = randomToken_().slice(0, 32);
  patch_(book, 'users', u._row, { salt: salt, hash: serverHash_(preHash, salt), inviteHash: '', inviteExp: '', mustChange: 'Да' });
  throttle_(reg.no + '|' + username).clear();
  audit_(book, opActor_(ctx), 'Генерирана парола от оператор', username, '');
  audit_(master_(), ctx.username, 'Генерирана парола', reg.no, username);
  return {};
}

/* ---------- организация ---------- */

function profile_(ss) {
  const p = {};
  // съдът вече не е данни на организацията: определя се за всяко решение по адреса на заявителя
  read_(ss, 'profile').forEach(r => { if (r.key !== 'court') p[r.key] = r.value; });
  return p;
}

function orgBootstrap_(d, ctx) {
  const ss = ctx.ss();
  const users = read_(ss, 'users').filter(u => u.active === 'Да').map(u => ({ username: u.username, name: u.name }));
  const me = read_(ss, 'users').find(u => u.username === ctx.username);
  return {
    profile: profile_(ss), users: users, signers: signersOf_(ss), grounds: groundsOf_(ss), addressees: addresseesOf_(ss, ctx), plan: orgPlan_(ctx.org),
    me: { no: ctx.no, org: ctx.org.name, username: ctx.username, name: me.name, position: me.position, role: me.role, operator: false, perms: permsOf_(me) }
  };
}

function usersList_(d, ctx) {
  return { users: usersPublic_(ctx.ss()) };
}

function usersSave_(d, ctx) {
  const ss = ctx.ss(), users = read_(ss, 'users');
  const username = str_(d.username, 40).toLowerCase();
  if (!USER_RE_.test(username)) fail_('username', 'Потребителското име може да съдържа само малки латински букви, цифри и . _ - (3–40 знака).');
  const v = {
    name: line_(d.name, 120), position: line_(d.position, 120), email: line_(d.email, 200), phone: line_(d.phone, 40),
    role: oneOf_(d.role, [ROLE_ADMIN, ROLE_STAFF], 'Роля'), active: d.active === false ? 'Не' : 'Да'
  };
  if (!v.name || !v.position || !v.email) fail_('required', 'Попълнете име, длъжност и имейл.');
  if (!isEmail_(v.email)) fail_('email', 'Невалиден имейл.');
  const cur = users.find(u => u.username === username);
  if (d.perms !== undefined) {
    if (!Array.isArray(d.perms) || d.perms.some(k => PERMS.indexOf(k) < 0)) fail_('value', 'Невалидни права.');
    // записва се само ако се различава от правата по подразбиране за ролята
    const base = v.role === ROLE_ADMIN ? PERMS : STAFF_PERMS;
    const same = d.perms.length === base.length && base.every(k => d.perms.indexOf(k) >= 0);
    v.perms = same ? '' : JSON.stringify(d.perms);
  } else if (cur && cur.role !== v.role) v.perms = '';
  if (cur) {
    const stillAdmin = users.some(u => u.username !== username && u.role === ROLE_ADMIN && u.active === 'Да') || (v.role === ROLE_ADMIN && v.active === 'Да');
    if (!stillAdmin) fail_('lastadmin', 'Организацията трябва да има поне един активен администратор.');
    patch_(ss, 'users', cur._row, v);
    dropUserCache_(ctx.no, username);
    audit_(ss, ctx.username, 'Промяна на потребител', username, v.role + ', активен: ' + v.active + (v.perms !== undefined ? ', права: ' + (v.perms || 'по подразбиране') : ''));
    return { created: false };
  }
  if (d.isNew !== true) fail_('notfound', 'Потребителят не е намерен.');
  const inv = newInvite_(CFG.INVITE_DAYS * 24);
  insert_(ss, 'users', Object.assign({ username: username, inviteHash: inv.hash, inviteExp: inv.exp, createdAt: stamp_(), createdBy: ctx.username }, v));
  audit_(ss, ctx.username, 'Нов потребител', username, v.role);
  return { created: true, link: inviteLink_(ctx.no, username, inv.token) };
}

function usersInvite_(d, ctx) {
  const ss = ctx.ss(), u = read_(ss, 'users').find(x => x.username === str_(d.username, 40).toLowerCase());
  if (!u || u.active !== 'Да') fail_('notfound', 'Няма такъв активен потребител.');
  const inv = newInvite_(CFG.INVITE_DAYS * 24);
  patch_(ss, 'users', u._row, { inviteHash: inv.hash, inviteExp: inv.exp });
  audit_(ss, ctx.username, 'Нова връзка за парола', u.username, '');
  return { link: inviteLink_(ctx.no, u.username, inv.token) };
}

function orgLog_(d, ctx) {
  return { log: read_(ctx.ss(), 'log').slice(-400).reverse().map(l => { delete l._row; return l; }) };
}
