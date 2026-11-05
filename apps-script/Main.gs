/**
 * ЗДОИ4You – Платформа за задължените лица (https://platform.zdoi4you.eu).
 *
 * Данни:
 *   Главна таблица        – заявки за регистрация, регистър на организациите, оператори, дневник.
 *   Таблица на организация – отделна Google таблица за всяка организация, създава се при одобрението:
 *                            профил, потребители, преписки, събития, документи, чл. 15, дневник.
 * Всяка сесия е обвързана с една организация. Идентификаторът на таблицата идва само от регистъра,
 * никога от браузъра, затова заявка от една организация не може да отвори таблицата на друга.
 *
 * Настройка: изпълнете setup() веднъж от редактора. Вижте README.md.
 */
const CFG = {
  APP_URL: 'https://platform.zdoi4you.eu/',
  TZ: 'Europe/Sofia',
  SESSION_MIN: 30,
  INVITE_DAYS: 7,
  RESET_HOURS: 2,
  OPERATOR_NO: '00000000',
  MAX_FAILS: 5,
  MAX_IP_FAILS: 20,
  SPACE_MB: 1024,
  FILE_MB: 10,
  FAIL_WINDOW_S: 900,
  APPLY_PER_HOUR: 30,
  SUPPORT: 'support@platform.zdoi4you.eu',
  MAINTAINER: 'Услугите и платформата се поддържат от „БУЛАДМИН“ ЕООД.'
};

const ROLE_ADMIN = 'Администратор', ROLE_STAFF = 'Служител', ROLE_OP = 'Оператор';
/* права на потребителите; управлението на потребители е само за роля Администратор и не се отнема */
const PERMS = ['casesAll', 'casesEdit', 'letters', 'decisions', 'reports', 'art15', 'signers', 'grounds', 'departments', 'changes', 'log'];
const STAFF_PERMS = ['casesAll', 'casesEdit', 'letters', 'decisions', 'reports', 'art15'];

/* auth: public | user (всеки потребител на организация) | admin (администратор на организация) | op (оператор) | any */
function actions_() {
  return {
    'public.config': { auth: 'public', fn: publicConfig_ },
    'public.apply': { auth: 'public', write: true, fn: applyPublic_ },
    login: { auth: 'public', write: true, fn: login_ },
    activate: { auth: 'public', write: true, fn: activate_ },
    forgot: { auth: 'public', write: true, fn: forgot_ },

    extend: { auth: 'any', fn: extend_ },
    logout: { auth: 'any', fn: logout_ },
    password: { auth: 'any', write: true, fn: changePassword_ },

    'org.bootstrap': { auth: 'user', fn: orgBootstrap_ },
    'org.changeRequest': { auth: 'user', perm: 'changes', write: true, fn: orgChangeRequest_ },
    'org.changes': { auth: 'user', fn: orgChanges_ },
    'signers.save': { auth: 'user', perm: 'signers', write: true, fn: signersSave_ },
    'grounds.save': { auth: 'user', perm: 'grounds', write: true, fn: groundsSave_ },
    'departments.save': { auth: 'user', perm: 'departments', write: true, fn: departmentsSave_ },
    'addressees.save': { auth: 'user', perm: 'casesEdit', write: true, fn: addresseesSave_ },
    'addressees.delete': { auth: 'user', perm: 'casesEdit', write: true, fn: addresseesDelete_ },
    'users.list': { auth: 'admin', fn: usersList_ },
    'users.save': { auth: 'admin', write: true, fn: usersSave_ },
    'users.invite': { auth: 'admin', write: true, fn: usersInvite_ },
    'log.list': { auth: 'user', perm: 'log', fn: orgLog_ },
    'logins.list': { auth: 'admin', fn: loginsList_ },

    'space.list': { auth: 'user', fn: spaceList_ },
    'court.get': { auth: 'user', fn: courtGet_ },
    'court.save': { auth: 'user', perm: 'casesEdit', write: true, fn: courtSave_ },
    'court.delete': { auth: 'user', perm: 'casesEdit', write: true, fn: courtDelete_ },
    'file.upload': { auth: 'user', perm: 'casesEdit', write: true, fn: fileUpload_ },
    'file.get': { auth: 'user', fn: fileGet_ },
    'file.delete': { auth: 'user', perm: 'casesEdit', write: true, fn: fileDelete_ },

    'case.list': { auth: 'user', fn: caseList_ },
    'case.get': { auth: 'user', fn: caseGet_ },
    'case.create': { auth: 'user', perm: 'casesEdit', write: true, fn: caseCreateWithAddressee_ },
    'case.update': { auth: 'user', perm: 'casesEdit', write: true, fn: caseUpdate_ },
    'case.comment': { auth: 'user', perm: 'casesEdit', write: true, fn: caseComment_ },
    'case.dossier': { auth: 'user', write: true, fn: caseDossier_ },

    'doc.create': { auth: 'user', write: true, fn: docCreate_ },
    'doc.list': { auth: 'user', fn: docList_ },
    'doc.get': { auth: 'user', fn: docGet_ },
    'report.stats': { auth: 'user', perm: 'reports', fn: reportStats_ },
    'art15.get': { auth: 'user', fn: art15Get_ },
    'art15.save': { auth: 'user', perm: 'art15', write: true, fn: art15Save_ },

    'op.apps': { auth: 'op', fn: opApps_ },
    'op.decide': { auth: 'op', write: true, fn: opDecide_ },
    'op.applyOpen': { auth: 'op', write: true, fn: opApplyOpen_ },
    'op.plans': { auth: 'op', fn: opPlans_ },
    'op.plan.save': { auth: 'op', write: true, fn: opPlanSave_ },
    'op.org.plan': { auth: 'op', write: true, fn: opOrgPlan_ },
    'op.orgs': { auth: 'op', fn: opOrgs_ },
    'op.status': { auth: 'op', write: true, fn: opStatus_ },
    'op.changes': { auth: 'op', fn: opChanges_ },
    'op.changeDecide': { auth: 'op', write: true, fn: opChangeDecide_ },
    'op.org.get': { auth: 'op', fn: opOrgGet_ },
    'op.org.create': { auth: 'op', write: true, fn: opOrgCreate_ },
    'op.org.save': { auth: 'op', write: true, fn: opOrgSave_ },
    'op.signer.save': { auth: 'op', write: true, fn: opSignerSave_ },
    'op.ground.save': { auth: 'op', write: true, fn: opGroundSave_ },
    'op.department.save': { auth: 'op', write: true, fn: opDepartmentSave_ },
    'op.addressees': { auth: 'op', fn: opAddressees_ },
    'op.addressee.save': { auth: 'op', write: true, fn: opAddresseeSave_ },
    'op.addressee.delete': { auth: 'op', write: true, fn: opAddresseeDelete_ },
    'op.user.save': { auth: 'op', write: true, fn: opUserSave_ },
    'op.user.invite': { auth: 'op', write: true, fn: opUserInvite_ },
    'op.logins': { auth: 'op', fn: opLogins_ },
    'op.log': { auth: 'op', fn: opLog_ }
  };
}

function doGet() {
  return out_({ ok: true, service: 'zdoi-platform' });
}

function doPost(e) {
  let req;
  try {
    const raw = e.postData.contents;
    // само качването на файл е голямо
    if (raw.length > (CFG.FILE_MB * 1048576 * 4 / 3) + 4096) return out_({ ok: false, error: 'size', message: 'Данните са твърде големи.' });
    req = JSON.parse(raw);
    if (raw.length > 300000 && req.action !== 'file.upload') return out_({ ok: false, error: 'size', message: 'Данните са твърде големи.' });
  } catch (_) {
    return out_({ ok: false, error: 'bad', message: 'Невалидна заявка.' });
  }
  return out_(dispatch_(req));
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function dispatch_(req) {
  try {
    const all = actions_();
    const name = String(req && req.action);
    if (!Object.prototype.hasOwnProperty.call(all, name)) fail_('action', 'Непознато действие.');
    const a = all[name];
    const data = req.data && typeof req.data === 'object' ? req.data : {};
    const ctx = a.auth === 'public' ? null : auth_(req.token, a.auth);
    if (a.perm && !ctx.perms[a.perm]) fail_('role', 'Нямате право за това действие.');
    const run = () => a.fn(data, ctx);
    return Object.assign({ ok: true, now: Date.now() }, a.write ? locked_(run) : run());
  } catch (err) {
    if (err && err.code) return { ok: false, error: err.code, message: err.message };
    console.error(err && err.stack || err);
    return { ok: false, error: 'server', message: 'Вътрешна грешка. Опитайте отново.' };
  }
}

function fail_(code, message) {
  const e = new Error(message || code);
  e.code = code;
  throw e;
}

function locked_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) fail_('busy', 'Системата е заета. Опитайте след малко.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- еднократна настройка ---------- */

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PEPPER')) props.setProperty('PEPPER', randomToken_() + randomToken_());
  let folderId = props.getProperty('FOLDER_ID');
  if (!folderId) {
    folderId = DriveApp.createFolder('ЗДОИ4You – Платформа (данни)').getId();
    props.setProperty('FOLDER_ID', folderId);
  }
  let masterId = props.getProperty('MASTER_ID');
  if (!masterId) {
    const ss = SpreadsheetApp.create('ЗДОИ4You – Платформа – главна таблица');
    DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(folderId));
    masterId = ss.getId();
    props.setProperty('MASTER_ID', masterId);
  }
  const master = SpreadsheetApp.openById(masterId);
  ['apps', 'orgs', 'ops', 'log', 'logins', 'counters', 'plans'].forEach(k => table_(master, k));
  dropDefaultSheet_(master);
  const email = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  props.setProperty('NOTIFY', props.getProperty('NOTIFY') || email);
  const ops = read_(master, 'ops');
  if (!ops.length) {
    const invite = newInvite_(CFG.INVITE_DAYS * 24);
    insert_(master, 'ops', { username: 'admin', name: 'Оператор', email: email, active: 'Да', inviteHash: invite.hash, inviteExp: invite.exp, createdAt: stamp_() });
    const link = inviteLink_(CFG.OPERATOR_NO, 'admin', invite.token);
    mail_(email, 'ЗДОИ4You Платформа – активиране на оператор',
      'Номер: ' + CFG.OPERATOR_NO + '\nПотребител: admin\n\nЗадайте парола тук:\n' + link);
    console.log('Активиране на оператора: ' + link);
    return link;
  }
  console.log('Настройката вече е направена. Главна таблица: ' + master.getUrl());
  return master.getUrl();
}

/* проверка на връзката с Microsoft 365: изпълнява се от редактора и не преминава към Google при грешка */
function msTest() {
  const c = msConfig_();
  if (!c) throw new Error('Липсват свойства на скрипта: MS_TENANT, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER.');
  const to = String(Session.getEffectiveUser().getEmail());
  msSend_(c, to, 'ЗДОИ4You Платформа – проверка на пощата', 'Връзката с Microsoft 365 работи. Това писмо е изпратено от ' + c.sender + '.');
  console.log('Изпратено от ' + c.sender + ' до ' + to);
}

/* забравена парола на оператор: изпълнява се от редактора, връзката се вижда само в журнала */
function operatorReset() {
  const m = master_(), op = read_(m, 'ops').find(x => x.username === 'admin');
  if (!op) fail_('notfound', 'Няма такъв оператор.');
  const invite = newInvite_(CFG.RESET_HOURS);
  patch_(m, 'ops', op._row, { inviteHash: invite.hash, inviteExp: invite.exp });
  audit_(m, 'редактор', 'Нова парола за оператор', 'admin', '');
  console.log('Нова парола за оператора: ' + inviteLink_(CFG.OPERATOR_NO, 'admin', invite.token));
}

/* първият лист на нова таблица има различно име според езика на акаунта */
function dropDefaultSheet_(ss) {
  const ours = Object.keys(SCHEMA).map(k => SCHEMA[k][0]);
  ss.getSheets().forEach(s => {
    if (ours.indexOf(s.getName()) < 0 && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
}
