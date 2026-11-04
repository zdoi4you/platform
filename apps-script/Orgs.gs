/* Регистрация, одобрение, организационен профил и потребители. */

const ORG_TYPES = ['Община', 'Областна администрация', 'Министерство', 'Държавна агенция или комисия', 'Друга администрация', 'Публичноправна организация', 'Юридическо лице'];
const ORG_BASES = ['чл. 3, ал. 1', 'чл. 3, ал. 2, т. 1', 'чл. 3, ал. 2, т. 2'];
/* всички полета на организацията са задължителни */
const ORG_FIELDS = {
  name: 200, type: 60, basis: 40, eik: 13, oblast: 80, municipality: 80, city: 80, postcode: 4, address: 300,
  phone: 40, email: 200, web: 200, headName: 120, headPosition: 120,
  unitName: 200, unitAddress: 300, unitEmail: 200, unitPhone: 40, unitHours: 200, court: 120
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

/* ---------- публична заявка ---------- */

function applyPublic_(d) {
  if (d.hp) return { id: 'ok' }; // скрито поле за ботове
  const cache = CacheService.getScriptCache();
  const hour = Number(cache.get('apply:h')) || 0;
  if (hour >= CFG.APPLY_PER_HOUR) fail_('busy', 'Твърде много заявки. Опитайте по-късно.');
  const org = cleanOrg_(d), admin = cleanAdmin_(d);
  if (d.declare !== true) fail_('required', 'Необходимо е да потвърдите декларацията за представителна власт.');
  // номерът се създава в браузъра, защото участва в изчисляването на хеша на паролата
  const no = str_(d.no, 8), preHash = str_(d.hash, 64);
  if (!NO_RE_.test(no) || no === CFG.OPERATOR_NO || no.charAt(0) === '0' || luhn_(no.slice(0, 7)) !== no.charAt(7)) fail_('value', 'Невалиден номер на организация.');
  if (!PREHASH_RE_.test(preHash)) fail_('value', 'Задайте парола на администратора.');
  const m = master_();
  if (read_(m, 'orgs').some(x => x.eik === org.eik && x.status !== 'Закрита')) fail_('duplicate', 'Организация с този ЕИК/БУЛСТАТ вече е регистрирана.');
  if (read_(m, 'apps').some(x => x.eik === org.eik && x.status === 'Чака одобрение')) fail_('duplicate', 'За този ЕИК/БУЛСТАТ вече има подадена заявка, която чака одобрение.');
  const taken = read_(m, 'orgs').some(x => x.no === no) || read_(m, 'apps').some(x => x.orgNo === no && x.status !== 'Отказана');
  if (taken) fail_('retry', 'Номерът е зает. Опитайте отново.');
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
  return { apps: rows.map(r => { const o = publicRows_([r])[0]; o.data = JSON.parse(r.payload || '{}'); return o; }) };
}

function opOrgs_() {
  return { orgs: publicRows_(read_(master_(), 'orgs')).map(o => { delete o.sheetId; return o; }) };
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

  // отделна таблица за организацията
  const book = SpreadsheetApp.create('ЗДОИ4You – ' + no + ' – ' + data.name);
  const folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  DriveApp.getFileById(book.getId()).moveTo(DriveApp.getFolderById(folderId));
  ORG_TABLES.forEach(k => table_(book, k));
  dropDefaultSheet_(book);
  Object.keys(ORG_FIELDS).forEach(k => insert_(book, 'profile', { key: k, value: data[k] }));
  insert_(book, 'users', {
    username: data.adminUsername, name: data.adminName, position: data.adminPosition, email: data.adminEmail, phone: data.adminPhone,
    role: ROLE_ADMIN, active: 'Да', salt: app.salt, hash: app.hash, createdAt: stamp_(), createdBy: ctx.username
  });
  audit_(book, ctx.username, 'Организацията е одобрена', no, app.id);

  insert_(m, 'orgs', { no: no, name: data.name, eik: data.eik, type: data.type, status: 'Активна', sheetId: book.getId(), approvedAt: stamp_(), approvedBy: ctx.username, adminUser: data.adminUsername });
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

function opInviteAdmin_(d, ctx) {
  const no = str_(d.no, 8), org = read_(master_(), 'orgs').find(x => x.no === no);
  if (!org) fail_('notfound', 'Организацията не е намерена.');
  const book = orgSheet_(org), users = read_(book, 'users');
  const u = users.find(x => x.username === org.adminUser && x.active === 'Да') || users.find(x => x.role === ROLE_ADMIN && x.active === 'Да');
  if (!u) fail_('notfound', 'Няма активен администратор.');
  const inv = newInvite_(CFG.INVITE_DAYS * 24);
  patch_(book, 'users', u._row, { inviteHash: inv.hash, inviteExp: inv.exp });
  audit_(book, ctx.username, 'Нова покана от оператор', u.username, '');
  audit_(master_(), ctx.username, 'Нова връзка за администратор', no, u.username);
  return { name: u.name, link: inviteLink_(no, u.username, inv.token) };
}

/* ---------- организация ---------- */

function profile_(ss) {
  const p = {};
  read_(ss, 'profile').forEach(r => { p[r.key] = r.value; });
  return p;
}

function orgBootstrap_(d, ctx) {
  const ss = ctx.ss();
  const users = read_(ss, 'users').filter(u => u.active === 'Да').map(u => ({ username: u.username, name: u.name }));
  const me = read_(ss, 'users').find(u => u.username === ctx.username);
  return {
    profile: profile_(ss), users: users,
    me: { no: ctx.no, org: ctx.org.name, username: ctx.username, name: me.name, position: me.position, role: me.role, operator: false }
  };
}

function orgSave_(d, ctx) {
  const ss = ctx.ss(), cur = profile_(ss), next = cleanOrg_(d);
  // ЕИК идентифицира организацията и не се променя от профила
  next.eik = cur.eik;
  const rows = read_(ss, 'profile');
  const changed = [];
  Object.keys(next).forEach(k => {
    if (next[k] === cur[k]) return;
    const r = rows.find(x => x.key === k);
    if (r) patch_(ss, 'profile', r._row, { value: next[k] }); else insert_(ss, 'profile', { key: k, value: next[k] });
    changed.push(k);
  });
  if (next.name !== cur.name) {
    const m = master_(), reg = read_(m, 'orgs').find(x => x.no === ctx.no);
    patch_(m, 'orgs', reg._row, { name: next.name });
    dropOrgCache_(ctx.no);
  }
  audit_(ss, ctx.username, 'Промяна на данните на организацията', '', changed.join(', '));
  return { profile: next };
}

function usersList_(d, ctx) {
  return { users: publicRows_(read_(ctx.ss(), 'users')).map(u => { const o = Object.assign({}, u); o.pending = !!u.inviteExp; delete o.inviteExp; return o; }) };
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
  if (cur) {
    const stillAdmin = users.some(u => u.username !== username && u.role === ROLE_ADMIN && u.active === 'Да') || (v.role === ROLE_ADMIN && v.active === 'Да');
    if (!stillAdmin) fail_('lastadmin', 'Организацията трябва да има поне един активен администратор.');
    patch_(ss, 'users', cur._row, v);
    dropUserCache_(ctx.no, username);
    audit_(ss, ctx.username, 'Промяна на потребител', username, v.role + ', активен: ' + v.active);
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
