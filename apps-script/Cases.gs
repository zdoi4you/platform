/* Преписки по ЗДОИ, срокове, документи, годишен отчет и информация по чл. 15. */

const CASE_STATUS = ['Нова', 'В обработка', 'Чака уточняване', 'Чака трето лице', 'Решение издадено', 'Приключена'];
const CASE_OPEN = ['Нова', 'В обработка', 'Чака уточняване', 'Чака трето лице'];
const CASE_KIND = ['Достъп до обществена информация', 'Повторно използване на информация'];
const CASE_CHANNEL = ['Писмено', 'По имейл (чл. 15, ал. 1, т. 4)', 'Платформа за достъп (чл. 15в)', 'Устно запитване', 'Сигурно електронно връчване'];
const APPLICANT_TYPE = ['Гражданин', 'Юридическо лице', 'Журналист или медия', 'Неправителствена организация'];
const CASE_OUTCOME = ['', 'Предоставен достъп', 'Частичен достъп', 'Отказ', 'Препратено (чл. 32)', 'Няма информация (чл. 33)', 'Без разглеждане', 'Отказ на заявителя (чл. 36)'];
const REFUSAL = {
  t1: 'чл. 37, ал. 1, т. 1 ЗДОИ – класифицирана информация или друга защитена тайна, или случаите по чл. 13, ал. 2',
  t2: 'чл. 37, ал. 1, т. 2 ЗДОИ – засягат се интересите на трето лице, което изрично е отказало предоставянето',
  t3: 'чл. 37, ал. 1, т. 3 ЗДОИ – информацията е предоставена на заявителя през предходните 6 месеца'
};

/* дължими срокове; изчисляват се само тук, за да има един източник */
function withDue_(c, today) {
  const o = Object.assign({}, c);
  delete o._row;
  o.due = ''; o.dueLabel = ''; o.daysLeft = null;
  o.thirdInvolved = false; o.thirdBy = ''; o.thirdByDays = null; o.thirdReplyBy = ''; o.thirdReplyDays = null;
  if (CASE_OPEN.indexOf(c.status) < 0 || !c.regDate) return o;
  const left = iso => Math.round((parseIso_(iso) - parseIso_(today)) / DAY_MS_);
  const ext30 = Number(c.ext30) || 0, ext31 = Number(c.ext31) || 0, base = c.clarifyGot || c.regDate;
  if (c.clarifyAsked && !c.clarifyGot) {
    o.due = term_(c.clarifyAsked, 30);
    o.dueLabel = 'Уточняване от заявителя (чл. 29, ал. 2)';
  } else {
    o.due = term_(base, 14 + ext30 + ext31);
    o.dueLabel = 'Решение (чл. 28, ал. 1' + (ext30 ? '; чл. 30' : '') + (ext31 ? '; чл. 31' : '') + ')';
  }
  o.daysLeft = left(o.due);
  // трето лице: съгласието се иска до 7 дни от регистрирането (чл. 31, ал. 2);
  // отговорът се очаква в удължения срок (чл. 31, ал. 1 и 4), а без изрично удължаване се смята с максималните 14 дни
  o.thirdBy = term_(c.regDate, 7);
  o.thirdByDays = c.thirdAsked ? null : left(o.thirdBy);
  o.thirdReplyBy = term_(base, 14 + ext30 + (ext31 || 14));
  o.thirdReplyDays = c.thirdGot ? null : left(o.thirdReplyBy);
  o.thirdInvolved = !!(ext31 || c.thirdAsked || c.thirdGot || c.status === 'Чака трето лице');
  return o;
}

function caseList_(d, ctx) {
  const today = todayIso_();
  const rows = read_(ctx.ss(), 'cases').map(c => {
    const o = withDue_(c, today);
    ['applicantAddress', 'applicantPhone', 'appealNote'].forEach(k => delete o[k]);
    return o;
  }).reverse();
  return { cases: rows, statuses: CASE_STATUS };
}

function findCase_(ss, regNo) {
  const c = read_(ss, 'cases').find(x => x.regNo === str_(regNo, 60));
  if (!c) fail_('notfound', 'Преписката не е намерена.');
  return c;
}

function caseGet_(d, ctx) {
  const ss = ctx.ss(), c = findCase_(ss, d.regNo);
  return {
    case: withDue_(c, todayIso_()),
    events: read_(ss, 'events').filter(e => e.regNo === c.regNo).map(e => { delete e._row; return e; }).reverse(),
    docs: publicRows_(read_(ss, 'docs').filter(x => x.regNo === c.regNo)).reverse()
  };
}

function caseFields_(d) {
  const v = {
    kind: oneOf_(d.kind, CASE_KIND, 'Вид заявление'), regDate: isoDate_(d.regDate), channel: oneOf_(d.channel, CASE_CHANNEL, 'Начин на подаване'),
    applicantType: oneOf_(d.applicantType, APPLICANT_TYPE, 'Вид заявител'), applicantName: line_(d.applicantName, 200), applicantSeat: line_(d.applicantSeat, 120), applicantOblast: line_(d.applicantOblast, 80),
    applicantAddress: line_(d.applicantAddress, 300), applicantEmail: line_(d.applicantEmail, 200), applicantPhone: line_(d.applicantPhone, 40),
    subject: str_(d.subject, 8000), form: line_(d.form, 300), noPublish: d.noPublish === true || d.noPublish === 'Да' ? 'Да' : 'Не', owner: line_(d.owner, 40)
  };
  if (!v.regDate) fail_('required', 'Посочете дата на регистриране.');
  if (!v.applicantName) fail_('required', 'Посочете заявителя (чл. 25, ал. 1, т. 1).');
  if (!v.subject) fail_('required', 'Опишете исканата информация (чл. 25, ал. 1, т. 2).');
  if (!v.applicantAddress && !v.applicantEmail) fail_('required', 'Посочете адрес или имейл за кореспонденция (чл. 25, ал. 1, т. 4).');
  if (v.applicantEmail && !isEmail_(v.applicantEmail)) fail_('email', 'Невалиден имейл на заявителя.');
  return v;
}

function caseCreate_(d, ctx) {
  const ss = ctx.ss(), v = caseFields_(d), rows = read_(ss, 'cases');
  let regNo = line_(d.regNo, 60);
  if (regNo) {
    if (rows.some(c => c.regNo === regNo)) fail_('duplicate', 'Вече има преписка с този номер.');
  } else {
    const y = v.regDate.slice(0, 4);
    do { regNo = 'ЗДОИ-' + y + '-' + String(nextCounter_(ss, 'case-' + y)).padStart(4, '0'); } while (rows.some(c => c.regNo === regNo));
  }
  insert_(ss, 'cases', Object.assign({ regNo: regNo, createdAt: stamp_(), createdBy: ctx.username, status: 'Нова', outcome: '', updatedAt: stamp_() }, v));
  event_(ss, regNo, ctx.username, 'Създаване', 'Преписката е въведена.');
  audit_(ss, ctx.username, 'Нова преписка', regNo, '');
  return { regNo: regNo };
}

function caseUpdate_(d, ctx) {
  const ss = ctx.ss(), c = findCase_(ss, d.regNo), v = caseFields_(d);
  Object.assign(v, {
    status: oneOf_(d.status, CASE_STATUS, 'Статус'), outcome: oneOf_(d.outcome || '', CASE_OUTCOME, 'Резултат'),
    clarifyAsked: isoDate_(d.clarifyAsked), clarifyGot: isoDate_(d.clarifyGot), thirdAsked: isoDate_(d.thirdAsked), thirdGot: isoDate_(d.thirdGot),
    ext30: limitDays_(d.ext30, 10, 'чл. 30'), ext31: limitDays_(d.ext31, 14, 'чл. 31'),
    served: isoDate_(d.served), servedHow: line_(d.servedHow, 120), published15c: isoDate_(d.published15c),
    appealed: d.appealed === 'Да' ? 'Да' : 'Не', appealNote: str_(d.appealNote, 1000)
  });
  // след получено уточняване срокът тече отново
  if (v.clarifyGot && !c.clarifyGot && v.status === 'Чака уточняване') v.status = 'В обработка';
  if (v.thirdGot && !c.thirdGot && v.status === 'Чака трето лице') v.status = 'В обработка';
  const changed = Object.keys(v).filter(k => String(v[k]) !== String(c[k] === undefined ? '' : c[k]));
  if (!changed.length) return { regNo: c.regNo };
  const patch = {};
  changed.forEach(k => { patch[k] = v[k]; });
  patch.updatedAt = stamp_();
  patch_(ss, 'cases', c._row, patch);
  const fields = SCHEMA.cases[1];
  event_(ss, c.regNo, ctx.username, 'Промяна', changed.map(k => fields[k] + (['subject', 'appealNote'].indexOf(k) >= 0 ? '' : ': ' + (v[k] || '—'))).join('; '));
  return { regNo: c.regNo };
}

function limitDays_(v, max, label) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) fail_('value', 'Удължаването по ' + label + ' е до ' + max + ' дни.');
  return n ? String(n) : '';
}

function caseComment_(d, ctx) {
  const ss = ctx.ss(), c = findCase_(ss, d.regNo), text = str_(d.text, 2000);
  if (!text) fail_('required', 'Напишете текст.');
  event_(ss, c.regNo, ctx.username, 'Коментар', text);
  return {};
}

const event_ = (ss, regNo, user, kind, text) => insert_(ss, 'events', { at: stamp_(), regNo: regNo, user: user, kind: kind, text: String(text).slice(0, 2000) });

/* ---------- документи ---------- */

/* cls: брояч; need: задължителни полета; apply: промяна на преписката */
const DOC_TYPES = {
  clarify: { cls: 'ИЗХ', need: ['what'], apply: (c, f, p) => ({ status: 'Чака уточняване', clarifyAsked: p.date }) },
  extend30: { cls: 'ИЗХ', need: ['days', 'reason'], apply: (c, f) => ({ ext30: limitDays_(f.days, 10, 'чл. 30') }) },
  extend31: { cls: 'ИЗХ', need: ['days', 'third'], apply: (c, f) => ({ ext31: limitDays_(f.days, 14, 'чл. 31'), status: 'Чака трето лице' }) },
  thirdparty: { cls: 'ИЗХ', need: ['third', 'thirdAddress', 'info', 'by'], apply: (c, f, p) => ({ thirdAsked: p.date, status: 'Чака трето лице' }) },
  forward: { cls: 'ИЗХ', need: ['body', 'bodyAddress'], apply: () => ({ outcome: 'Препратено (чл. 32)', status: 'Приключена' }) },
  noinfo: { cls: 'ИЗХ', need: [], apply: () => ({ outcome: 'Няма информация (чл. 33)', status: 'Приключена' }) },
  dismiss: { cls: 'ИЗХ', need: ['ground'], apply: () => ({ outcome: 'Без разглеждане', status: 'Приключена' }) },
  letter: { cls: 'ИЗХ', need: ['subjectLine', 'text'], apply: () => ({}) },
  grant: { cls: 'РЕШ', decision: true, need: ['scope', 'court', 'accessDays', 'place', 'accessForm', 'costs'], apply: () => ({ outcome: 'Предоставен достъп', status: 'Решение издадено' }) },
  partial: { cls: 'РЕШ', decision: true, need: ['scope', 'withheld', 'groundKey', 'factual', 'court', 'accessDays', 'place', 'accessForm', 'costs'], apply: () => ({ outcome: 'Частичен достъп', status: 'Решение издадено' }) },
  refuse: { cls: 'РЕШ', decision: true, need: ['groundKey', 'factual', 'court'], apply: () => ({ outcome: 'Отказ', status: 'Решение издадено' }) },
  protocol: { cls: 'ПРТ', need: ['given', 'accessForm', 'employee'], apply: () => ({ status: 'Приключена' }) },
  report: { cls: 'ОТЧ', noCase: true, need: ['year'], apply: null },
  art15: { cls: 'ЧЛ15', noCase: true, need: [], apply: null }
};

/* компетентният съд се определя по адреса на адресата */
function courtForOblast_(oblast) {
  if (oblast === 'София (столица)') return 'Административен съд София-град';
  if (oblast === 'София') return 'Административен съд София-област';
  return oblast ? 'Административен съд – ' + oblast : '';
}
const OBLASTS_ = ['Благоевград', 'Бургас', 'Варна', 'Велико Търново', 'Видин', 'Враца', 'Габрово', 'Добрич', 'Кърджали', 'Кюстендил', 'Ловеч', 'Монтана', 'Пазарджик', 'Перник', 'Плевен', 'Пловдив', 'Разград', 'Русе', 'Силистра', 'Сливен', 'Смолян', 'София', 'София (столица)', 'Стара Загора', 'Търговище', 'Хасково', 'Шумен', 'Ямбол'];

/* областта идва от адреса на заявителя; запазената област е само резервен вариант */
function oblastOfCase_(c) {
  const m = /(?:^|,\s*)обл\.\s*([^,]+)/.exec(c.applicantAddress || '');
  const fromAddress = m ? m[1].trim() : '';
  if (OBLASTS_.indexOf(fromAddress) >= 0) return fromAddress;
  return OBLASTS_.indexOf(c.applicantOblast) >= 0 ? c.applicantOblast : '';
}

function docCreate_(d, ctx) {
  const ss = ctx.ss(), type = str_(d.type, 20);
  if (!Object.prototype.hasOwnProperty.call(DOC_TYPES, type)) fail_('value', 'Непознат вид документ.');
  const def = DOC_TYPES[type], org = profile_(ss);
  const missing = Object.keys(ORG_FIELDS).filter(k => !org[k]);
  if (missing.length) fail_('profile', 'Попълнете всички данни на организацията, преди да генерирате документи.');
  const raw = d.fields && typeof d.fields === 'object' ? d.fields : {};
  const f = {};
  Object.keys(raw).slice(0, 40).forEach(k => { f[str_(k, 40)] = str_(raw[k], k === 'edits' ? 40000 : 8000); });
  const c = def.noCase ? null : findCase_(ss, d.regNo);
  if (def.decision) {
    if (!f.court && c && oblastOfCase_(c)) f.court = courtForOblast_(oblastOfCase_(c));
    if (f.court && OBLASTS_.map(courtForOblast_).indexOf(f.court) < 0) fail_('court', 'Изберете административен съд от списъка.');
    if (!f.court) fail_('court', 'Посочете компетентния административен съд според адреса на адресата.');
  }
  def.need.forEach(k => { if (!f[k]) fail_('required', 'Попълнете всички задължителни полета.'); });
  // подписващият идва само от списъка на организацията; ръчно подадено име се пренебрегва
  ['signer', 'signerPosition', 'signerAct'].forEach(k => delete f[k]);
  ['by'].forEach(k => { if (f[k]) f[k] = isoDate_(f[k]); });
  if (f.accessDays !== undefined && f.accessDays !== '' && (!/^\d+$/.test(f.accessDays) || Number(f.accessDays) < 30)) {
    fail_('accessDays', 'Срокът за достъп не може да е по-кратък от 30 дни от получаване на решението (чл. 34, ал. 4).');
  }
  if (f.groundKey) {
    if (!REFUSAL[f.groundKey]) fail_('value', 'Невалидно основание за отказ.');
    f.groundText = REFUSAL[f.groundKey];
  }
  const date = isoDate_(d.date) || todayIso_();
  const year = date.slice(0, 4);
  if (f.signerId) {
    const s = read_(ss, 'signers').find(x => x.id === f.signerId);
    if (!s || s.active !== 'Да' || (s.from && s.from > date) || (s.to && s.to < date)) {
      fail_('signer', 'Избраното лице не е упълномощено към датата на документа.');
    }
    f.signer = s.name; f.signerPosition = s.position; f.signerAct = s.act;
  }
  const no = line_(d.no, 60) || def.cls + '-' + year + '-' + String(nextCounter_(ss, 'doc-' + def.cls + '-' + year)).padStart(4, '0');
  const payload = { type: type, no: no, date: date, org: org, f: f };
  if (c) {
    const pub = Object.assign({}, c);
    delete pub._row;
    payload.case = pub;
  }
  if (type === 'report') payload.stats = stats_(ss, f.year);
  if (type === 'art15') payload.items = art15Rows_(ss);
  const json = JSON.stringify(payload);
  if (json.length > 49000) fail_('size', 'Документът е твърде голям за запис (клетка в Google таблица побира до 50 000 знака). Съкратете текстовете.');
  const id = randomToken_().slice(0, 16);
  insert_(ss, 'docs', {
    id: id, no: no, type: type, title: line_(d.title, 200) || type, regNo: c ? c.regNo : '', date: date, at: stamp_(), author: ctx.username,
    payload: json
  });
  if (c) {
    const patch = def.apply(c, f, payload);
    if (def.decision) { patch.decisionNo = no; patch.decisionDate = date; if (f.groundKey) patch.refusalGround = f.groundKey; }
    patch.updatedAt = stamp_();
    patch_(ss, 'cases', c._row, patch);
    event_(ss, c.regNo, ctx.username, 'Документ', (line_(d.title, 200) || type) + ' № ' + no);
  }
  audit_(ss, ctx.username, 'Генериран документ', no, type);
  return { id: id, no: no, payload: payload };
}

function docList_(d, ctx) {
  return { docs: publicRows_(read_(ctx.ss(), 'docs')).reverse() };
}

function docGet_(d, ctx) {
  const r = read_(ctx.ss(), 'docs').find(x => x.id === str_(d.id, 16));
  if (!r) fail_('notfound', 'Документът не е намерен.');
  try {
    return { payload: JSON.parse(r.payload) };
  } catch (_) {
    fail_('corrupt', 'Данните на документа са твърде големи или повредени.');
  }
}

/* ---------- отчет по чл. 15, ал. 2 ---------- */

function countBy_(rows, key, known) {
  const out = {};
  (known || []).forEach(k => { out[k] = 0; });
  rows.forEach(r => { const v = r[key] || '—'; out[v] = (out[v] || 0) + 1; });
  return out;
}

function stats_(ss, yearRaw) {
  const year = str_(yearRaw, 4);
  if (!/^\d{4}$/.test(year)) fail_('value', 'Невалидна година.');
  const rows = read_(ss, 'cases').filter(c => c.regDate.slice(0, 4) === year);
  const access = rows.filter(c => c.kind === CASE_KIND[0]), reuse = rows.filter(c => c.kind === CASE_KIND[1]);
  const refused = rows.filter(c => c.outcome === 'Отказ' || c.outcome === 'Частичен достъп');
  const grounds = {};
  Object.keys(REFUSAL).forEach(k => { grounds[REFUSAL[k]] = 0; });
  refused.forEach(c => { const g = REFUSAL[c.refusalGround] || 'Не е посочено'; grounds[g] = (grounds[g] || 0) + 1; });
  const today = todayIso_();
  const late = rows.filter(c => {
    if (c.decisionDate) {
      const days = 14 + (Number(c.ext30) || 0) + (Number(c.ext31) || 0);
      return c.decisionDate > term_(c.clarifyGot || c.regDate, days);
    }
    const o = withDue_(c, today);
    return o.daysLeft !== null && o.daysLeft < 0;
  });
  return {
    year: year, total: rows.length, access: access.length, reuse: reuse.length,
    byApplicant: countBy_(rows, 'applicantType', APPLICANT_TYPE),
    byChannel: countBy_(rows, 'channel', CASE_CHANNEL),
    byOutcome: countBy_(rows.map(c => Object.assign({}, c, { outcome: c.outcome || 'В процес' })), 'outcome', CASE_OUTCOME.filter(Boolean).concat('В процес')),
    refusals: refused.length, grounds: grounds,
    appealed: rows.filter(c => c.appealed === 'Да').length, late: late.length,
    published: rows.filter(c => c.published15c).length
  };
}

function reportStats_(d, ctx) {
  return { stats: stats_(ctx.ss(), d.year) };
}

/* ---------- информация по чл. 15 ---------- */

function art15Rows_(ss) {
  return read_(ss, 'art15').map(r => { delete r._row; return r; });
}

function art15Get_(d, ctx) {
  return { items: art15Rows_(ctx.ss()) };
}

function art15Save_(d, ctx) {
  const ss = ctx.ss(), item = str_(d.item, 10);
  if (!/^(?:[1-9]|1[0-7])$/.test(item)) fail_('value', 'Невалидна точка.');
  const url = line_(d.url, 500);
  if (url && !/^https?:\/\/\S+$/i.test(url)) fail_('value', 'Адресът трябва да започва с https://');
  const v = { text: str_(d.text, 4000), url: url, updated: todayIso_(), by: ctx.username };
  const cur = read_(ss, 'art15').find(r => r.item === item);
  if (cur) patch_(ss, 'art15', cur._row, v); else insert_(ss, 'art15', Object.assign({ item: item }, v));
  audit_(ss, ctx.username, 'Обновена информация по чл. 15', 'т. ' + item, '');
  return { updated: v.updated };
}
