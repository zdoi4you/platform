/* Пространство на организацията: съдебни дела и файлове към преписки и дела. Файловете са в отделна папка в Drive, недостъпна пряко за организациите. */

const COURT_KIND = ['Административно дело', 'Касационно дело', 'Друго'];
const COURT_STATUS = ['Образувано', 'Насрочено', 'Решено', 'Обжалвано', 'Приключено'];
const FILE_TYPES = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  rtf: 'application/rtf', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', eml: 'message/rfc822'
};

/* ---------- видимост: следва правата за преписките ---------- */

function visibleCases_(ss, ctx) {
  const set = {};
  read_(ss, 'cases').forEach(c => { if (canSee_(c, ctx)) set[c.regNo] = true; });
  return set;
}

const courtVisible_ = (x, cases, ctx) => !!ctx.perms.casesAll || x.by === ctx.username || (!!x.regNo && !!cases[x.regNo]);

function findCourt_(ss, id, ctx) {
  const x = read_(ss, 'courts').find(r => r.id === str_(id, 24));
  if (!x || !courtVisible_(x, visibleCases_(ss, ctx), ctx)) fail_('notfound', 'Делото не е намерено.');
  return x;
}

const courtView_ = x => { const o = Object.assign({}, x); delete o._row; return o; };
const fileView_ = f => { const o = Object.assign({}, f); delete o._row; delete o.driveId; o.size = Number(f.size) || 0; return o; };

function visibleFiles_(ss, ctx) {
  const cases = visibleCases_(ss, ctx), courts = {};
  read_(ss, 'courts').forEach(x => { if (courtVisible_(x, cases, ctx)) courts[x.id] = x; });
  return read_(ss, 'files').filter(f => (f.scope === 'case' ? !!cases[f.ref] : !!courts[f.ref]));
}

const spaceUsed_ = ss => read_(ss, 'files').reduce((sum, f) => sum + (Number(f.size) || 0), 0);
const spaceInfo_ = ss => ({ used: spaceUsed_(ss), limit: CFG.SPACE_MB * 1048576, fileLimit: CFG.FILE_MB * 1048576 });

/* ---------- дела ---------- */

function spaceList_(d, ctx) {
  const ss = ctx.ss(), cases = visibleCases_(ss, ctx);
  const courts = read_(ss, 'courts').filter(x => courtVisible_(x, cases, ctx));
  const labels = {};
  courts.forEach(x => { labels[x.id] = 'Дело № ' + x.caseNo + '/' + x.year; });
  return {
    courts: courts.map(courtView_).reverse(),
    files: visibleFiles_(ss, ctx).map(f => Object.assign(fileView_(f), { refLabel: f.scope === 'case' ? 'Преписка ' + f.ref : labels[f.ref] })).reverse(),
    space: spaceInfo_(ss)
  };
}

function courtGet_(d, ctx) {
  const ss = ctx.ss(), x = findCourt_(ss, d.id, ctx);
  return { court: courtView_(x), files: filesOf_(ss, 'court', x.id), space: spaceInfo_(ss) };
}

const filesOf_ = (ss, scope, ref) => read_(ss, 'files').filter(f => f.scope === scope && f.ref === ref).map(fileView_).reverse();
const courtsOfCase_ = (ss, regNo) => read_(ss, 'courts').filter(x => x.regNo === regNo).map(courtView_).reverse();

function courtSave_(d, ctx) {
  const ss = ctx.ss();
  const v = {
    regNo: line_(d.regNo, 60), court: line_(d.court, 160), caseNo: line_(d.caseNo, 40), year: line_(d.year, 4), kind: oneOf_(d.kind, COURT_KIND, 'Вид дело'),
    status: oneOf_(d.status, COURT_STATUS, 'Статус'), nextHearing: isoDate_(d.nextHearing), note: str_(d.note, 4000), updatedAt: stamp_()
  };
  if (!v.court || !v.caseNo) fail_('required', 'Посочете съда и номера на делото.');
  if (!/^\d{4}$/.test(v.year)) fail_('value', 'Годината на делото трябва да е от 4 цифри.');
  if (v.regNo) visibleCase_(ss, v.regNo, ctx);
  const label = 'Дело № ' + v.caseNo + '/' + v.year + ', ' + v.court;
  const id = str_(d.id, 24);
  if (id) {
    const cur = findCourt_(ss, id, ctx);
    patch_(ss, 'courts', cur._row, v);
    audit_(ss, ctx.username, 'Променено дело', id, label);
    return { id: id };
  }
  const newId = 'd' + randomToken_().slice(0, 15);
  insert_(ss, 'courts', Object.assign({ id: newId, by: ctx.username, at: stamp_() }, v));
  audit_(ss, ctx.username, 'Ново дело', newId, label);
  if (v.regNo) event_(ss, v.regNo, ctx.username, 'Съдебно дело', label);
  return { id: newId };
}

function courtDelete_(d, ctx) {
  const ss = ctx.ss(), cur = findCourt_(ss, d.id, ctx);
  read_(ss, 'files').filter(f => f.scope === 'court' && f.ref === cur.id).reverse().forEach(f => dropFile_(ss, f));
  table_(ss, 'courts').deleteRow(cur._row);
  audit_(ss, ctx.username, 'Изтрито дело', cur.id, 'Дело № ' + cur.caseNo + '/' + cur.year);
  return {};
}

/* ---------- файлове ---------- */

function orgFilesFolder_(no) {
  const props = PropertiesService.getScriptProperties(), key = 'FILES_' + no;
  const id = props.getProperty(key);
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID')).createFolder('ЗДОИ4You – ' + no + ' – файлове');
  props.setProperty(key, folder.getId());
  return folder;
}

function dropFile_(ss, f) {
  DriveApp.getFileById(f.driveId).setTrashed(true);
  table_(ss, 'files').deleteRow(f._row);
}

function fileRef_(ss, scope, ref, ctx) {
  if (scope === 'case') return visibleCase_(ss, ref, ctx).regNo;
  return findCourt_(ss, ref, ctx).id;
}

function fileUpload_(d, ctx) {
  const ss = ctx.ss(), scope = oneOf_(d.scope, ['case', 'court'], 'Вид'), ref = fileRef_(ss, scope, d.ref, ctx);
  if (scope === 'case') unlocked_(findCase_(ss, ref));
  const name = line_(d.name, 180).replace(/[\\/:*?"<>|]/g, '_'), ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1];
  const mime = ext ? FILE_TYPES[ext.toLowerCase()] : null;
  if (!name || !mime) fail_('filetype', 'Разрешени са файлове ' + Object.keys(FILE_TYPES).join(', ') + '.');
  const data = typeof d.data === 'string' ? d.data : '';
  if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) fail_('value', 'Файлът не можа да се прочете.');
  const info = spaceInfo_(ss);
  if (Math.floor(data.length * 3 / 4) > info.fileLimit + 2) fail_('filesize', 'Файлът е над ' + CFG.FILE_MB + ' MB.');
  const bytes = Utilities.base64Decode(data);
  if (!bytes.length) fail_('value', 'Файлът е празен.');
  if (bytes.length > info.fileLimit) fail_('filesize', 'Файлът е над ' + CFG.FILE_MB + ' MB.');
  if (info.used + bytes.length > info.limit) fail_('quota', 'Няма достатъчно свободно пространство (' + CFG.SPACE_MB + ' MB за организация).');
  const file = orgFilesFolder_(ctx.no).createFile(Utilities.newBlob(bytes, mime, name));
  const id = 'f' + randomToken_().slice(0, 15);
  insert_(ss, 'files', { id: id, scope: scope, ref: ref, name: name, type: mime, size: bytes.length, driveId: file.getId(), by: ctx.username, at: stamp_(), sha256: bytesHash_(bytes) });
  audit_(ss, ctx.username, 'Качен файл', ref, id);
  if (scope === 'case') event_(ss, ref, ctx.username, 'Файл', 'Качен файл: ' + name);
  return { id: id };
}

const bytesHash_ = bytes => Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');

/* ---------- досие на преписка: данните към момента на генериране; PDF се сглобява в браузъра ---------- */

function caseDossier_(d, ctx) {
  const ss = ctx.ss(), c = visibleCase_(ss, d.regNo, ctx);
  const events = read_(ss, 'events').filter(e => e.regNo === c.regNo && (d.comments !== false || e.kind !== 'Коментар'))
    .map(e => { const o = Object.assign({}, e); delete o._row; return o; });
  const docs = read_(ss, 'docs').filter(x => x.regNo === c.regNo).map(x => {
    let payload = null;
    try { payload = JSON.parse(x.payload); } catch (_) { payload = null; }
    return { no: x.no, type: x.type, title: x.title, date: x.date, at: x.at, author: x.author, payload: d.fullDocs === false ? null : payload };
  });
  const files = read_(ss, 'files').filter(f => f.scope === 'case' && f.ref === c.regNo);
  const courts = read_(ss, 'courts').filter(x => x.regNo === c.regNo);
  const allFiles = files.concat(read_(ss, 'files').filter(f => f.scope === 'court' && courts.some(x => x.id === f.ref)));
  // файлове отпреди въвеждането на контролната сума
  allFiles.forEach(f => {
    if (f.sha256) return;
    f.sha256 = bytesHash_(DriveApp.getFileById(f.driveId).getBlob().getBytes());
    patch_(ss, 'files', f._row, { sha256: f.sha256 });
  });
  const me = read_(ss, 'users').find(u => u.username === ctx.username);
  audit_(ss, ctx.username, 'Генерирано досие на преписка', c.regNo, '');
  event_(ss, c.regNo, ctx.username, 'Досие', 'Генерирано досие на преписката.');
  return {
    case: withDue_(c, todayIso_()), org: profile_(ss), events: events, docs: docs, courts: courts.map(courtView_),
    files: allFiles.map(f => Object.assign(fileView_(f), { courtNo: f.scope === 'court' ? (x => x.caseNo + '/' + x.year)(courts.find(x => x.id === f.ref)) : '' })),
    generatedAt: stamp_(), generatedBy: me ? me.name : ctx.username, generatedPosition: me ? me.position : ''
  };
}

function visibleFile_(ss, id, ctx) {
  const f = visibleFiles_(ss, ctx).find(x => x.id === str_(id, 24));
  if (!f) fail_('notfound', 'Файлът не е намерен.');
  return f;
}

function fileGet_(d, ctx) {
  const f = visibleFile_(ctx.ss(), d.id, ctx);
  return { name: f.name, type: f.type, data: Utilities.base64Encode(DriveApp.getFileById(f.driveId).getBlob().getBytes()) };
}

function fileDelete_(d, ctx) {
  const ss = ctx.ss(), f = visibleFile_(ss, d.id, ctx);
  if (f.scope === 'case') unlocked_(findCase_(ss, f.ref));
  dropFile_(ss, f);
  audit_(ss, ctx.username, 'Изтрит файл', f.ref, f.id);
  if (f.scope === 'case') event_(ss, f.ref, ctx.username, 'Файл', 'Изтрит файл: ' + f.name);
  return {};
}
