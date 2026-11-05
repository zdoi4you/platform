/* Шаблони на документите по ЗДОИ: полета за формата и съдържание за PDF (pdfmake). Работи и в Node за тестовете. */
(function (root) {
  const fmt = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}.${m[2]}.${m[1]} г.` : '—';
  };

  const ACCESS_FORMS = [
    'преглед на информацията – оригинал или копие или чрез публичен общодостъпен регистър',
    'устна справка',
    'копия на материален носител',
    'копия, предоставени по електронен път, или интернет адрес, където се съхраняват или са публикувани данните',
    'публикуване на информацията на платформата за достъп до обществена информация'
  ];

  /*
   * Наредба № Н-1 от 7 март 2022 г. (ДВ, бр. 22 от 2022 г.), нормативите са в стотинки. Сборът се превръща в евро и се закръгля веднъж.
   * Сървърът изчислява същото (apps-script/Cases.gs). В обнародвания текст DVD дисковете са с „MB“, очевидна грешка за GB.
   */
  const COST_NORMS = {
    a4: ['Хартия А4', 'лист', 1], a3: ['Хартия А3', 'лист', 2], tonerA4: ['Тонер за едностранно отпечатване А4', 'стр.', 2], tonerA3: ['Тонер за едностранно отпечатване А3', 'стр.', 4],
    cd: ['CD диск 700 MB', 'бр.', 26], dvd47: ['DVD диск 4,7 GB', 'бр.', 30], dvd85: ['DVD диск 8,5 GB', 'бр.', 67],
    usb4: ['USB флаш памет 4 GB', 'бр.', 346], usb8: ['USB флаш памет 8 GB', 'бр.', 572], usb16: ['USB флаш памет 16 GB', 'бр.', 793], usb32: ['USB флаш памет 32 GB', 'бр.', 947]
  };
  const NO_COST_FORM = /електронен път|платформата|устна справка/;
  const money = n => n.toFixed(2).replace('.', ',');
  function costsOf(items) {
    let sum = 0;
    const lines = Object.keys(COST_NORMS).filter(k => Number(items[k]) > 0).map(k => {
      const n = COST_NORMS[k], qty = Number(items[k]), line = qty * n[2];
      sum += line;
      return `${n[0]}: ${qty} ${n[1]} × ${money(n[2] / 100)} лв. = ${money(line / 100)} лв.`;
    });
    if (!sum) return { text: 'Няма дължими разходи.', total: '' };
    const total = money(Math.round(sum / 1.95583) / 100);
    return { text: `${lines.join('; ')} Общо ${money(sum / 100)} лв., равни на ${total} евро по фиксирания курс 1 евро = 1,95583 лв. (Наредба № Н-1 от 7 март 2022 г.).`, total };
  }

  /* чл. 15, ал. 1 ЗДОИ; ал. 3 задава кои точки важат за лицата по чл. 3, ал. 2, т. 1 */
  const ART15 = [
    [1, 'Описание на правомощията и данни за организацията, функциите и отговорностите на администрацията'],
    [2, 'Списък на издадените актове и текстовете на издадените нормативни и общи административни актове'],
    [3, 'Описание на информационните масиви, наборите от данни и ресурсите'],
    [4, 'Наименование, адрес, имейл, телефон и работно време на звеното, което приема заявленията'],
    [5, 'Устройствен правилник и вътрешни правила за административните услуги'],
    [6, 'Стратегии, планове, програми и отчети за дейността'],
    [7, 'Информация за бюджета и финансовите отчети'],
    [8, 'Информация за обществените поръчки, определена за профила на купувача'],
    [9, 'Проекти на нормативни актове с мотивите, доклада и резултатите от общественото обсъждане'],
    [10, 'Уведомления за откриване на производство по издаване на общ административен акт (чл. 66 АПК)'],
    [11, 'Упражняване на правото на достъп, ред и условия за повторно използване, такси по чл. 41ж и формати'],
    [12, 'Обявления за конкурси за държавни служители'],
    [13, 'Подлежащата на публикуване информация по Закона за противодействие на корупцията сред лица, заемащи публични длъжности'],
    [14, 'Информация, която е публична съгласно Закона за защита на класифицираната информация'],
    [15, 'Информацията по чл. 14, ал. 2, т. 1–3'],
    [16, 'Информацията, предоставена повече от три пъти по реда на глава трета'],
    [17, 'Друга информация, определена със закон']
  ];
  const ART15_AL3 = [1, 4, 5, 6, 8, 11, 15, 16, 17];
  const art15Items = basis => (basis === 'чл. 3, ал. 1' ? ART15 : ART15.filter(i => ART15_AL3.includes(i[0])));

  const signModeField = { k: 'signMode', label: 'Начин на подписване', type: 'select', options: [['', 'Ръчен подпис'], ['electronic', 'Електронен подпис']], hint: 'При електронен подпис няма линия за ръчно подписване. Файлът се подписва след изтеглянето със средството за електронен подпис на подписващия.' };
  const signerFields = [
    { k: 'signerId', label: 'Издава', type: 'signer', hint: 'Ръководителят или лице, определено по чл. 28, ал. 2. Лицата се добавят в „Организация“.' }
  ];
  /* компетентният съд се определя по адреса на адресата */
  const OBLASTS = ['Благоевград', 'Бургас', 'Варна', 'Велико Търново', 'Видин', 'Враца', 'Габрово', 'Добрич', 'Кърджали', 'Кюстендил', 'Ловеч', 'Монтана', 'Пазарджик', 'Перник', 'Плевен', 'Пловдив', 'Разград', 'Русе', 'Силистра', 'Сливен', 'Смолян', 'София', 'София (столица)', 'Стара Загора', 'Търговище', 'Хасково', 'Шумен', 'Ямбол'];
  const courtForOblast = o => (o === 'София (столица)' ? 'Административен съд София-град' : o === 'София' ? 'Административен съд София-област' : o ? `Административен съд – ${o}` : '');
  /* областта идва от адреса на заявителя; запазената област е само резервен вариант */
  const oblastOf = c => {
    const m = /(?:^|,\s*)обл\.\s*([^,]+)/.exec(c.applicantAddress || '');
    const fromAddress = m ? m[1].trim() : '';
    return OBLASTS.includes(fromAddress) ? fromAddress : (OBLASTS.includes(c.applicantOblast) ? c.applicantOblast : '');
  };
  const courtField = { k: 'court', label: 'Компетентен административен съд', type: 'select', req: true, options: OBLASTS.map(courtForOblast), value: c => courtForOblast(oblastOf(c)), hint: 'Съдът се определя по адреса на заявителя и се посочва в решението. Ако заявителят няма адрес в преписката, изберете съда ръчно.' };
  const decisionMotives = { k: 'motives', label: 'Мотиви', type: 'textarea', rows: 8, hint: 'Разделете абзаците с празен ред.' };
  const letterMotives = { k: 'motives', label: 'Мотиви или обосновка (по желание)', type: 'textarea', rows: 5, hint: 'Разделете абзаците с празен ред.' };
  const REFUSAL = {
    t1: 'чл. 37, ал. 1, т. 1 ЗДОИ – класифицирана информация или друга защитена тайна, или случаите по чл. 13, ал. 2',
    t1a: 'чл. 37, ал. 1, т. 1 във връзка с чл. 13, ал. 2, т. 1 ЗДОИ – служебна информация, свързана с оперативната подготовка на актовете, без самостоятелно значение',
    t1b: 'чл. 37, ал. 1, т. 1 във връзка с чл. 13, ал. 2, т. 2 ЗДОИ – мнения и позиции във връзка с настоящи или предстоящи преговори',
    t1c: 'чл. 37, ал. 1, т. 1 във връзка с чл. 17, ал. 2 ЗДОИ – търговска тайна, чието предоставяне би довело до нелоялна конкуренция',
    t2: 'чл. 37, ал. 1, т. 2 ЗДОИ – засягат се интересите на трето лице, което изрично е отказало предоставянето',
    t3: 'чл. 37, ал. 1, т. 3 ЗДОИ – информацията е предоставена на заявителя през предходните 6 месеца',
    p1: 'чл. 2, ал. 1 ЗДОИ – исканата информация не е обществена информация по смисъла на закона',
    p5: 'чл. 2, ал. 5 ЗДОИ – законът не се прилага за достъпа до лични данни',
    r1: 'чл. 41б, ал. 1, т. 1 ЗДОИ – повторно използване: съдържанието е свързано с дейност извън правомощията и функциите на организацията',
    r2: 'чл. 41б, ал. 1, т. 2 ЗДОИ – повторно използване: информация на публичноправна организация с търговска дейност, създадена извън обхвата на обществените услуги',
    r3: 'чл. 41б, ал. 1, т. 3 ЗДОИ – повторно използване: обект на право на интелектуална собственост на трето лице',
    r4: 'чл. 41б, ал. 1, т. 4 ЗДОИ – повторно използване: събрана или създадена от обществени радио- и телевизионни оператори',
    r5: 'чл. 41а, ал. 2 ЗДОИ – повторно използване: изисква създаване или адаптиране или непропорционално много усилия'
  };
  const GRANT_GROUNDS = {
    g1: 'чл. 31, ал. 3 ЗДОИ – при спазване на условията, при които третото лице е дало съгласие',
    g2: 'чл. 31, ал. 4 ЗДОИ – при изрично несъгласие достъпът е в обем и по начин, които не разкриват информацията, засягаща третото лице',
    g3: 'чл. 31, ал. 5 ЗДОИ – третото лице е задължен субект и отнасящата се до него информация е обществена',
    g4: 'чл. 31, ал. 5 ЗДОИ – надделяващ обществен интерес от разкриването на информацията',
    g5: 'чл. 13, ал. 3 ЗДОИ – изтекли са 2 години от създаването на служебната информация',
    g6: 'чл. 13, ал. 4 ЗДОИ – надделяващ обществен интерес при служебна обществена информация',
    g7: 'чл. 17, ал. 2 ЗДОИ – надделяващ обществен интерес при търговска тайна'
  };
  const DISMISS_GROUNDS = {
    d1: 'чл. 25, ал. 2 ЗДОИ – заявлението не съдържа данните по чл. 25, ал. 1, т. 1, 2 и 4',
    d2: 'чл. 29, ал. 2 ЗДОИ – предметът на исканата информация не е уточнен до 30 дни'
  };
  const GROUNDS = { refuse: REFUSAL, grant: GRANT_GROUNDS, dismiss: DISMISS_GROUNDS, letter: {} };
  const GROUND_SCOPE_LABELS = { refuse: 'Отказ и частичен достъп', grant: 'Предоставяне на достъп', dismiss: 'Оставяне без разглеждане', letter: 'Писма' };
  /* текстът на основанията за прегледа преди PDF; сървърът го определя по същия начин */
  const groundsText = (scope, keys, own, other) => keys.map(k => GROUNDS[scope][k] || ((own || []).find(x => x.id === k) || {}).text).filter(Boolean).concat(String(other || '').trim() ? [String(other).trim().replace(/\s*[\r\n]+\s*/g, ' ')] : []).join('; ');
  const decisionAccess = [
    { k: 'accessDays', label: 'Срок за достъп (дни от получаване на решението)', type: 'number', req: true, min: 30, value: '30', hint: 'Не по-малко от 30 дни (чл. 34, ал. 4).' },
    { k: 'place', label: 'Място за достъп', req: true, value: (c, o) => o.unitAddress },
    { k: 'accessForm', label: 'Форма на достъп', type: 'select', req: true, options: ACCESS_FORMS, value: c => (ACCESS_FORMS.includes(c.form) ? c.form : '') },
    { k: 'costs', label: 'Разходи за материални носители', type: 'costs', req: true, value: 'Няма дължими разходи.', hint: 'По нормативите на министъра на финансите (чл. 20, ал. 2). При достъп по електронен път не се заплащат (чл. 35, ал. 3).' },
    { k: 'others', label: 'Други органи с по-пълна информация (по желание)', hint: 'чл. 34, ал. 2' }
  ];
  const groundField = { k: 'groundKeys', label: 'Правни основания', type: 'grounds', scope: 'refuse', must: true };
  const grantGrounds = { k: 'groundKeys', label: 'Допълнителни правни основания (по желание)', type: 'grounds', scope: 'grant' };
  const letterGrounds = { k: 'groundKeys', label: 'Правни основания (по желание)', type: 'grounds', scope: 'letter' };

  const DEFS = {
    clarify: { group: 'Писма до заявителя', title: 'Уведомление за уточняване (чл. 29)', subject: 'уточняване на предмета на исканата информация', effect: 'Статусът става „Чака уточняване“.', fields: [
      { k: 'what', label: 'Какво трябва да се уточни', type: 'textarea', req: true }
    ] },
    extend30: { group: 'Писма до заявителя', title: 'Удължаване на срока (чл. 30)', subject: 'удължаване на срока за разглеждане', effect: 'Срокът за решение се удължава.', fields: [
      { k: 'days', label: 'Удължаване (дни, до 10)', type: 'number', req: true, min: 1, max: 10, value: '10' },
      { k: 'reason', label: 'Причини за удължаването', type: 'textarea', req: true, value: 'Поисканата информация е в голямо количество и е необходимо допълнително време за нейната подготовка.' }
    ] },
    extend31: { group: 'Писма до заявителя', title: 'Удължаване заради трето лице (чл. 31)', subject: 'удължаване на срока поради необходимост от съгласие на трето лице', effect: 'Статусът става „Чака трето лице“ и срокът се удължава.', book: ['third'], fields: [
      { k: 'days', label: 'Удължаване (дни, до 14)', type: 'number', req: true, min: 1, max: 14, value: '14' },
      { k: 'third', label: 'Трето лице', req: true }
    ] },
    forward: { group: 'Писма до заявителя', title: 'Препращане на заявлението (чл. 32)', subject: 'препращане на заявление за достъп до обществена информация', effect: 'Преписката се приключва с резултат „Препратено“. Това е уведомлението до заявителя. До органа се издава отделно „Препращане до друг задължен субект“.', book: ['body', 'bodyAddress'], bookType: 'Орган или друга организация', fields: [
      { k: 'body', label: 'Орган или юридическо лице, към което се препраща', req: true },
      { k: 'bodyAddress', label: 'Адрес на органа', type: 'address', req: true }
    ] },
    forwardBody: { group: 'Писма до други задължени субекти', title: 'Препращане до друг задължен субект (чл. 32)', subject: 'препращане на заявление за достъп до обществена информация по компетентност', effect: 'Статусът не се променя. Отбелязва се в историята на преписката.', book: ['body', 'bodyAddress'], bookType: 'Орган или друга организация', fields: [
      { k: 'body', label: 'Задължен субект, към който се препраща', req: true },
      { k: 'bodyAddress', label: 'Адрес на задължения субект', type: 'address', req: true },
      { k: 'notice', label: 'Писмо до заявителя (изх. № и дата, по желание)', hint: 'Ако е празно, в писмото пише, че заявителят се уведомява едновременно с него.' },
      { k: 'attachments', label: 'Приложения', type: 'attachments', req: true, value: c => `Заявление с рег. № ${c.regNo} от ${fmt(c.regDate)}` }
    ] },
    noinfo: { group: 'Писма до заявителя', title: 'Няма исканата информация (чл. 33)', subject: 'липса на исканата информация', effect: 'Преписката се приключва с резултат „Няма информация“.', fields: [
      { k: 'note', label: 'Допълнително пояснение (по желание)', type: 'textarea' }
    ] },
    dismiss: { group: 'Писма до заявителя', title: 'Оставяне без разглеждане', subject: 'оставяне на заявление без разглеждане', effect: 'Преписката се приключва с резултат „Без разглеждане“.', fields: [
      { k: 'groundKeys', label: 'Правни основания', type: 'grounds', scope: 'dismiss', must: true },
      { k: 'note', label: 'Фактически обстоятелства', type: 'textarea' }
    ] },
    letter: { group: 'Писма до заявителя', title: 'Свободно писмо', subject: f => f.subjectLine, fields: [
      { k: 'subjectLine', label: 'Относно', req: true },
      { k: 'text', label: 'Текст', type: 'textarea', req: true, rows: 8 }
    ] },
    thirdparty: { group: 'Писма до трети лица', title: 'Искане за съгласие от трето лице (чл. 31)', subject: 'искане за съгласие за предоставяне на информация', effect: 'Записва се датата на искането. Искането се прави в 7-дневен срок от регистрирането (чл. 31, ал. 2).', book: ['third', 'thirdAddress'], bookType: 'Юридическо лице', fields: [
      { k: 'third', label: 'Трето лице', req: true },
      { k: 'thirdAddress', label: 'Адрес на третото лице', type: 'address', req: true },
      { k: 'info', label: 'Информацията, която го засяга', type: 'textarea', req: true },
      { k: 'by', label: 'Отговор до', type: 'date', req: true, value: c => c.thirdReplyBy, hint: 'Изчислен по чл. 31, ал. 1: регистрация + 14 дни + удължаването (до 14 дни), с преместване от неработен ден.' }
    ] },
    grant: { group: 'Решения', title: 'Решение за предоставяне на достъп', decision: true, effect: 'Статусът става „Решение издадено“. Срокът по чл. 28 спира да се следи.', fields: [
      { k: 'scope', label: 'Степен на осигурения достъп', req: true, value: 'Пълен достъп до исканата обществена информация.' },
      grantGrounds,
      courtField,
      decisionMotives,
      ...decisionAccess
    ] },
    partial: { group: 'Решения', title: 'Решение за частичен достъп (чл. 37, ал. 2)', decision: true, effect: 'Статусът става „Решение издадено“ с резултат „Частичен достъп“.', fields: [
      { k: 'scope', label: 'До коя част се предоставя достъп', type: 'textarea', req: true },
      { k: 'withheld', label: 'До коя част не се предоставя достъп', type: 'textarea', req: true },
      groundField,
      { k: 'factual', label: 'Фактическо основание', type: 'textarea', req: true },
      courtField,
      decisionMotives,
      ...decisionAccess
    ] },
    refuse: { group: 'Решения', title: 'Решение за отказ (чл. 38)', decision: true, effect: 'Статусът става „Решение издадено“ с резултат „Отказ“.', fields: [
      groundField,
      { k: 'factual', label: 'Фактическо основание', type: 'textarea', req: true, rows: 6 },
      courtField,
      decisionMotives
    ] },
    protocol: { group: 'Протоколи', title: 'Протокол за предоставяне на достъп (чл. 35, ал. 2)', effect: 'Преписката се приключва.', fields: [
      { k: 'given', label: 'Предоставена информация', type: 'textarea', req: true },
      { k: 'accessForm', label: 'Форма на достъп', type: 'select', req: true, options: ACCESS_FORMS },
      { k: 'paid', label: 'Платени разходи и платежен документ (по желание)' },
      { k: 'employee', label: 'Служител, който предоставя достъпа', req: true }
    ] }
  };
  Object.keys(DEFS).filter(k => k !== 'protocol').forEach(k => {
    const extra = DEFS[k].decision ? [] : (k === 'dismiss' ? [letterMotives] : [letterGrounds, letterMotives]);
    DEFS[k].fields = DEFS[k].fields.concat(extra, signerFields);
  });
  DEFS.cover = { group: 'Съпроводителни писма', title: 'Съпроводително писмо', book: ['toName', 'toAddress'], bookType: 'Орган или друга организация', effect: 'Отделен PDF към документа, който изпращате.', fields: [
    { k: 'toName', label: 'До', req: true, value: c => (c ? c.applicantName : '') },
    { k: 'toAddress', label: 'Адрес или имейл на получателя', type: 'address', value: c => (c ? c.applicantAddress || c.applicantEmail || '' : '') },
    { k: 'note', label: 'Допълнителен текст (по желание)', type: 'textarea', rows: 3 },
    { k: 'attachments', label: 'Приложения', type: 'attachments', req: true },
    ...signerFields
  ] };
  const departmentField = { k: 'departmentId', label: 'Отдел', type: 'department', req: true, hint: 'Отделите се въвеждат в „Организация“.' };
  DEFS.internalRequest = { group: 'Вътрешни бланки', title: 'Вътрешно искане до отдел', effect: 'Отделът и срокът се отбелязват в историята на преписката.', fields: [
    departmentField,
    { k: 'what', label: 'Каква информация или становище се иска', type: 'textarea', req: true, rows: 5 },
    { k: 'by', label: 'Срок за отговор', type: 'date', req: true, hint: 'Оставете време преди срока за решение по преписката.' },
    ...signerFields
  ] };
  const yesNo = [['', 'Не е попълнено'], 'да', 'не'];
  DEFS.internalReply = { group: 'Вътрешни бланки', title: 'Отговор на отдел', effect: 'Попълнете отговора и генерирайте готов документ. Непопълнените полета излизат като празни редове за ръчно попълване.', fields: [
    departmentField,
    { k: 'requestNo', label: 'Към вътрешно искане № (по желание)' },
    { k: 'hasInfo', label: 'Отделът разполага с исканата информация', type: 'select', options: [['', 'Не е попълнено'], 'да', 'частично', 'не'] },
    { k: 'location', label: 'Местонахождение на информацията, ако не е в отдела' },
    { k: 'protectedInfo', label: 'Съдържа защитена информация (класифицирана, тайна, лични данни)', type: 'select', options: yesNo },
    { k: 'protectedBasis', label: 'Вид и основание' },
    { k: 'thirdAffected', label: 'Засяга трето лице (чл. 31 ЗДОИ)', type: 'select', options: yesNo },
    { k: 'thirdWho', label: 'Кое лице и данни за контакт' },
    { k: 'opinion', label: 'Становище', type: 'textarea', rows: 5 },
    { k: 'attachments', label: 'Приложения (по желание)', type: 'attachments' },
    { k: 'respondent', label: 'Отговаря (имена)', hint: 'Празно = ръководителят на отдела.' },
    { k: 'respondentPosition', label: 'Длъжност' },
    { k: 'replyDate', label: 'Дата на отговора', type: 'date' }
  ] };
  DEFS.internalNote = { group: 'Вътрешни бланки', title: 'Докладна записка', effect: 'Докладна записка до ръководителя по преписката.', fields: [
    { k: 'fromName', label: 'От (имена)', req: true, value: (c, o, b) => (b && b.me && b.me.name) || '' },
    { k: 'fromPosition', label: 'Длъжност', value: (c, o, b) => (b && b.me && b.me.position) || '' },
    { k: 'subjectLine', label: 'Относно', req: true, value: c => `преписка с рег. № ${c.regNo} от ${fmt(c.regDate)}` },
    { k: 'text', label: 'Текст', type: 'textarea', req: true, rows: 7 }
  ] };
  Object.keys(DEFS).forEach(k => { DEFS[k].fields = DEFS[k].fields.concat(signModeField); });
  DEFS.report = { title: 'Годишен отчет по чл. 15, ал. 2 ЗДОИ', fields: [] };
  DEFS.art15 = { title: 'Информация по чл. 15 ЗДОИ', fields: [] };

  /* ---------- PDF ---------- */

  /*
   * Всеки абзац получава пореден номер при изграждането. Така прегледът преди PDF може да покаже абзаците
   * за редакция, а промените (f.edits) се прилагат по номер и документът се възпроизвежда същият и по-късно.
   */
  const track = { edits: {}, list: [], i: 0 };
  const paraNode = (text, extra) => Object.assign({ text: String(text).replace(/ г\.\.(?=\s|$)/g, ' г.'), margin: [0, 0, 0, 8], alignment: 'justify' }, extra);
  const P = (text, extra) => {
    const node = paraNode(text, extra), idx = track.i++;
    track.list.push(node.text);
    if (Object.prototype.hasOwnProperty.call(track.edits, idx)) {
      node.text = track.edits[idx];
      if (!node.text) node.margin = [0, 0, 0, 0];
    }
    return node;
  };
  const paragraphs = t => String(t || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  const motives = p => {
    const list = paragraphs(p.f.motives);
    return list.length ? [{ text: 'МОТИВИ:', bold: true, margin: [0, 6, 0, 6] }, ...list.map(t => P(t))] : [];
  };
  /* добавеният при прегледа текст е извън номерацията, за да не измества редакциите */
  const extraText = p => paragraphs(p.f.extra).map(t => paraNode(t));

  /* пълният адрес на организацията: п.к., област, община, населено място, адрес */
  const orgAddress = o => [o.postcode && `п.к. ${o.postcode}`, o.oblast && `обл. ${o.oblast}`, o.municipality && `общ. ${o.municipality}`, o.city, o.address].filter(Boolean).join(', ');

  function letterhead(o) {
    return [
      { columns: [
        { image: 'logo', width: 118 },
        { stack: [
          { text: o.name, bold: true, fontSize: 12, color: '#0E3A6E' },
          { text: orgAddress(o), fontSize: 8.5, color: '#44546A' },
          { text: `тел. ${o.phone} · ${o.email}`, fontSize: 8.5, color: '#44546A' },
          { text: `${o.web} · ЕИК/БУЛСТАТ ${o.eik}`, fontSize: 8.5, color: '#44546A' }
        ], alignment: 'right' }
      ], columnGap: 12 },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1, lineColor: '#1A8FE3' }], margin: [0, 8, 0, 14] }
    ];
  }

  const ELECTRONIC_NOTE = 'Документът се подписва с електронен подпис.';
  const isElectronic = p => p.f.signMode === 'electronic';
  /* при електронен подпис няма линия, а само място за видимия подпис */
  const signLine = p => (isElectronic(p) ? { text: ELECTRONIC_NOTE, fontSize: 9, color: '#44546A', margin: [0, 0, 0, 34] } : { text: '....................................' });
  const signBlock = (p, name, position) => ({ margin: [0, 26, 0, 0], unbreakable: true, stack: [
    signLine(p),
    { text: name || '', bold: true, margin: [0, 2, 0, 0] },
    { text: position || '' }
  ] });

  function signature(p) {
    const f = p.f, o = p.org;
    return { margin: [0, 26, 0, 0], unbreakable: true, stack: [
      signLine(p),
      { text: f.signer || o.headName, bold: true, margin: [0, 2, 0, 0] },
      { text: f.signerPosition || o.headPosition },
      ...(f.signerAct ? [{ text: `Лице, определено по чл. 28, ал. 2 ЗДОИ: ${f.signerAct}`, fontSize: 9, color: '#44546A', margin: [0, 2, 0, 0] }] : [])
    ] };
  }

  const toApplicant = c => ({ margin: [0, 0, 0, 12], stack: [
    { text: 'ДО', bold: true },
    { text: c.applicantName, bold: true },
    ...(c.applicantEik ? [{ text: `ЕИК/БУЛСТАТ: ${c.applicantEik}` }] : []),
    ...(c.applicantSeat ? [{ text: `седалище: ${c.applicantSeat}` }] : []),
    { text: c.applicantAddress || '' },
    { text: c.applicantEmail || '' },
    ...(c.applicantPhone ? [{ text: `тел. ${c.applicantPhone}` }] : [])
  ] });
  const salute = c => (c.applicantType === 'Гражданин' || c.applicantType === 'Журналист или медия' ? `Уважаеми/а г-н/г-жо ${c.applicantName},` : 'Уважаеми дами и господа,');
  const reqRef = c => `заявление за достъп до обществена информация с рег. № ${c.regNo} от ${fmt(c.regDate)}`;
  const applicantLine = c => [c.applicantName, c.applicantEik && `ЕИК/БУЛСТАТ: ${c.applicantEik}`, c.applicantSeat && `седалище: ${c.applicantSeat}`, c.applicantAddress && `адрес: ${c.applicantAddress}`, c.applicantEmail && `имейл: ${c.applicantEmail}`].filter(Boolean).join(', ');
  const reqAbout = c => `Заявител: ${applicantLine(c)}. Искана информация: ${c.subject}`;

  /* номерацията идва от списъка, затова евентуални номера в началото на реда се махат */
  function attachmentsBlock(p) {
    const list = String(p.f.attachments || '').split(/\n/).map(s => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
    return list.length ? [{ text: 'Приложения:', bold: true, margin: [0, 16, 0, 4] }, { ol: list }] : [];
  }

  function letter(p, opts) {
    const c = p.case;
    return [
      ...letterhead(p.org),
      { text: `Изх. № ${p.no} / ${fmt(p.date)}`, margin: [0, 0, 0, 12] },
      opts.to || toApplicant(c),
      { text: [{ text: 'ОТНОСНО: ', bold: true }, opts.subject], margin: [0, 0, 0, 12] },
      P(opts.salute || salute(c)),
      ...opts.body.map(t => (typeof t === 'string' ? P(t) : t)),
      ...(p.type !== 'dismiss' && p.f.groundText ? [P(`Правно основание: ${p.f.groundText}.`)] : []),
      ...motives(p),
      ...extraText(p),
      { text: 'С уважение,', margin: [0, 8, 0, 0] },
      signature(p),
      ...attachmentsBlock(p)
    ];
  }

  function appealClause(p) {
    const al = p.org.basis === 'чл. 3, ал. 1' ? 1 : 2;
    const reuse = p.case && p.case.kind === 'Повторно използване на информация';
    return `Решението може да бъде обжалвано пред ${p.f.court || p.org.court} по реда на Административнопроцесуалния кодекс (${reuse ? 'чл. 41к' : `чл. 40, ал. ${al}`} ЗДОИ) в 14-дневен срок от съобщаването му (чл. 149, ал. 1 АПК).`;
  }

  function decisionHead(p, of) {
    const c = p.case;
    return [
      ...letterhead(p.org),
      { text: `РЕШЕНИЕ № ${p.no}`, bold: true, fontSize: 14, alignment: 'center', margin: [0, 6, 0, 2] },
      { text: `от ${fmt(p.date)}`, alignment: 'center' },
      { text: of, alignment: 'center', margin: [0, 2, 0, 14], bold: true }
    ].concat(P(`Постъпило е ${reqRef(c)}. ${reqAbout(c)}`));
  }

  function accessPoints(p) {
    const f = p.f;
    const list = [
      `Степен на осигурения достъп: ${f.scope}`,
      `Срок, в който е осигурен достъпът: ${f.accessDays} дни от датата на получаване на решението.`,
      `Място на предоставяне: ${f.place}`,
      `Форма на предоставяне: ${f.accessForm}`,
      `Разходи по предоставянето: ${f.costs}`
    ];
    return { ol: list, margin: [0, 0, 0, 10] };
  }

  const accessNotes = p => {
    const out = [], o = p.org;
    if (p.f.costTotal && o.payIban) {
      out.push(P(`Разходите в размер на ${p.f.costTotal} евро могат да се заплатят по банков път: получател ${o.name}, IBAN ${o.payIban}${o.payBic ? `, BIC ${o.payBic}` : ''}${o.payBank ? `, банка ${o.payBank}` : ''}${o.payCode ? `, код за вид плащане ${o.payCode}` : ''}, основание за плащане: разходи по ЗДОИ, решение № ${p.no}.`));
    }
    if (p.f.costTotal && o.payCash) out.push(P(`Разходите могат да се заплатят и на място: ${o.payCash}.`));
    if (p.f.others) out.push(P(`По-пълна информация могат да предоставят: ${p.f.others} (чл. 34, ал. 2 ЗДОИ).`));
    out.push(P('Достъпът се предоставя след заплащане на определените разходи и представяне на платежен документ, като за него се съставя протокол (чл. 35, ал. 1 и 2 ЗДОИ). Когато достъпът е поискан по електронен път на посочен имейл, информацията или интернет адресът се изпращат с решението, без протокол и без разходи (чл. 35, ал. 3 ЗДОИ). При неявяване в срока или неплащане на разходите е налице отказ на заявителя от достъп, освен за заявления, подадени по електронен път или чрез платформата (чл. 36 ЗДОИ).'));
    return out;
  };

  /* заглавна част на вътрешните бланки */
  function internalHead(p, title, rows) {
    return [
      ...letterhead(p.org),
      { text: `${title} № ${p.no}`, bold: true, fontSize: 14, alignment: 'center', margin: [0, 6, 0, 2] },
      { text: `от ${fmt(p.date)}`, alignment: 'center', margin: [0, 0, 0, 12] },
      ...rows.map(([k, v]) => ({ columns: [{ text: k, bold: true, width: 70 }, { text: v }], margin: [0, 0, 0, 4] })),
      { text: '', margin: [0, 0, 0, 8] }
    ];
  }
  const caseRef = c => (c ? `преписка с рег. № ${c.regNo} от ${fmt(c.regDate)}` : '');
  const deptTo = f => [f.departmentPosition || 'Ръководител', f.department].filter(Boolean).join(', ') + (f.departmentHead ? ` (${f.departmentHead})` : '');
  const ofLabel = f => (f.ofNo ? `документ „${f.ofTitle || ''}“ № ${f.ofNo}${f.ofDate ? ` от ${fmt(f.ofDate)}` : ''}` : 'посочените по-долу документи');
  const choice = (label, val, opts) => `${label}:   ${opts.map(o => `[${val === o ? ' X ' : '   '}] ${o}`).join('     ')}`;
  /* попълненият отговор излиза като текст, а непопълненият като редове за ръчно попълване */
  const answer = (label, val, lines) => [{ text: `${label}:`, margin: [0, 0, 0, 4] },
    ...(val ? paragraphs(val).map(t => P(t)) : Array.from({ length: lines || 1 }, () => ({ text: FILL, margin: [0, 0, 0, 6] })))];
  const FILL = '......................................................................................................................................';

  const BUILD = {
    forwardBody: p => letter(p, {
      to: { margin: [0, 0, 0, 12], stack: [{ text: 'ДО', bold: true }, { text: p.f.body, bold: true }, { text: p.f.bodyAddress }] },
      subject: `${DEFS.forwardBody.subject}, рег. № ${p.case.regNo} от ${fmt(p.case.regDate)}`, salute: 'Уважаеми дами и господа,', body: [
        `В ${p.org.name} е постъпило ${reqRef(p.case)}. ${reqAbout(p.case)}`,
        'Не разполагаме с исканата информация, но имаме данни, че тя се намира при Вас. На основание чл. 32, ал. 1 от Закона за достъп до обществена информация (ЗДОИ) Ви препращаме заявлението за разглеждане и произнасяне.',
        'Срокът по чл. 28, ал. 1 ЗДОИ започва да тече от получаването на препратеното заявление (чл. 32, ал. 2 ЗДОИ).',
        p.f.notice ? `Заявителят е уведомен за препращането с писмо ${p.f.notice} (чл. 32, ал. 1 ЗДОИ).` : 'Заявителят се уведомява за препращането едновременно с настоящото писмо (чл. 32, ал. 1 ЗДОИ).'
      ]
    }),
    cover: p => letter(p, {
      to: { margin: [0, 0, 0, 12], stack: [{ text: 'ДО', bold: true }, { text: p.f.toName, bold: true }, { text: p.f.toAddress || '' }] },
      subject: `изпращане на ${ofLabel(p.f)}${p.case ? `, ${caseRef(p.case)}` : ''}`,
      salute: p.case && p.f.toName === p.case.applicantName ? salute(p.case) : 'Уважаеми дами и господа,',
      body: [
        `Приложено Ви изпращаме ${ofLabel(p.f)}.`,
        ...(p.f.note ? [p.f.note] : [])
      ]
    }),
    internalRequest: p => [
      ...internalHead(p, 'ВЪТРЕШНО ИСКАНЕ', [['ДО:', deptTo(p.f)], ['ОТ:', `${p.f.signer || p.org.headName}, ${p.f.signerPosition || p.org.headPosition}`], ['ОТНОСНО:', caseRef(p.case)]]),
      P(`Постъпило е ${reqRef(p.case)}. Искана информация: ${p.case.subject}`),
      P(`Моля в срок до ${fmt(p.f.by)} да предоставите: ${p.f.what}`),
      P('Моля да посочите дали отделът разполага с информацията и къде се намира, дали съдържа класифицирана информация, защитена тайна или лични данни и дали засяга трето лице (чл. 31 ЗДОИ).'),
      ...extraText(p),
      signature(p)
    ],
    internalReply: p => [
      ...internalHead(p, 'ОТГОВОР НА ОТДЕЛ', [['ДО:', p.org.unitName], ['ОТ:', deptTo(p.f)], ['ОТНОСНО:', `${caseRef(p.case)}${p.f.requestNo ? `, вътрешно искане № ${p.f.requestNo}` : ''}`]]),
      P(`Искана информация: ${p.case.subject}`),
      { text: choice('Отделът разполага с исканата информация', p.f.hasInfo, ['да', 'частично', 'не']), margin: [0, 6, 0, 10] },
      ...answer('Местонахождение на информацията, ако не е в отдела', p.f.location),
      { text: choice('Съдържа защитена информация (класифицирана, тайна, лични данни)', p.f.protectedInfo, ['да', 'не']), margin: [0, 0, 0, 4] },
      ...answer('Вид и основание', p.f.protectedBasis),
      { text: choice('Засяга трето лице (чл. 31 ЗДОИ)', p.f.thirdAffected, ['да', 'не']), margin: [0, 0, 0, 4] },
      ...answer('Кое лице и данни за контакт', p.f.thirdWho),
      ...answer('Становище', p.f.opinion, 3),
      ...extraText(p),
      { text: `Дата: ${p.f.replyDate ? fmt(p.f.replyDate) : '............................'}`, margin: [0, 6, 0, 0] },
      signBlock(p, p.f.respondent || p.f.departmentHead, p.f.respondentPosition || (p.f.respondent ? '' : p.f.departmentPosition || `Ръководител, ${p.f.department || ''}`)),
      ...attachmentsBlock(p)
    ],
    internalNote: p => [
      ...internalHead(p, 'ДОКЛАДНА ЗАПИСКА', [['ДО:', `${p.org.headName}, ${p.org.headPosition}`], ['ОТ:', [p.f.fromName, p.f.fromPosition].filter(Boolean).join(', ')], ['ОТНОСНО:', p.f.subjectLine]]),
      ...paragraphs(p.f.text).map(t => P(t)),
      ...extraText(p),
      signBlock(p, p.f.fromName, p.f.fromPosition)
    ],
    clarify: p => letter(p, { subject: `${DEFS.clarify.subject} по ${reqRef(p.case)}`, body: [
      `На основание чл. 29, ал. 1 от Закона за достъп до обществена информация (ЗДОИ) Ви уведомяваме, че от заявлението Ви не е ясно точно каква информация се иска или тя е формулирана много общо.`,
      `Моля да уточните следното: ${p.f.what}`,
      'Срокът по чл. 28, ал. 1 ЗДОИ започва да тече от датата на уточняването. Ако не уточните предмета на исканата информация до 30 дни, заявлението ще бъде оставено без разглеждане (чл. 29, ал. 2 ЗДОИ).'
    ] }),
    extend30: p => letter(p, { subject: `${DEFS.extend30.subject} на ${reqRef(p.case)}`, body: [
      `На основание чл. 30, ал. 1 от ЗДОИ срокът по чл. 28, ал. 1 за разглеждане на заявлението Ви се удължава с ${p.f.days} дни.`,
      `Причини за удължаването: ${p.f.reason}`
    ] }),
    extend31: p => letter(p, { subject: `${DEFS.extend31.subject} по ${reqRef(p.case)}`, body: [
      `Исканата информация се отнася до трето лице (${p.f.third}) и е необходимо неговото съгласие за предоставянето ѝ. На основание чл. 31, ал. 1 от ЗДОИ срокът по чл. 28, ал. 1 се удължава с ${p.f.days} дни.`,
      'При изрично несъгласие на третото лице информацията се предоставя в обем и по начин, които не разкриват засягащите го данни (чл. 31, ал. 4 ЗДОИ). Съгласие не е необходимо, когато третото лице е задължен субект и информацията е обществена, както и при надделяващ обществен интерес (чл. 31, ал. 5 ЗДОИ).'
    ] }),
    thirdparty: p => letter(p, {
      to: { margin: [0, 0, 0, 12], stack: [{ text: 'ДО', bold: true }, { text: p.f.third, bold: true }, { text: p.f.thirdAddress }] },
      subject: DEFS.thirdparty.subject, salute: 'Уважаеми дами и господа,', body: [
        `Постъпило е ${reqRef(p.case)}, с което се иска информация, отнасяща се до Вас: ${p.f.info}`,
        `На основание чл. 31, ал. 2 от ЗДОИ Ви молим да изразите изричното си писмено съгласие или несъгласие за предоставянето на тази информация в срок до ${fmt(p.f.by)}. Може да посочите и условията, при които давате съгласие (чл. 31, ал. 3 ЗДОИ).`,
        'При изрично несъгласие информацията ще бъде предоставена в обем и по начин, които не разкриват засягащите Ви данни (чл. 31, ал. 4 ЗДОИ), освен при надделяващ обществен интерес (чл. 31, ал. 5 ЗДОИ).'
      ]
    }),
    forward: p => letter(p, { subject: `${DEFS.forward.subject} с рег. № ${p.case.regNo} от ${fmt(p.case.regDate)}`, body: [
      'Уведомяваме Ви, че не разполагаме с исканата информация, но имаме данни за нейното местонахождение.',
      `На основание чл. 32, ал. 1 от ЗДОИ препращаме заявлението Ви до: ${p.f.body}, адрес: ${p.f.bodyAddress}.`,
      'Срокът по чл. 28, ал. 1 ЗДОИ започва да тече от получаването на препратеното заявление (чл. 32, ал. 2 ЗДОИ).'
    ] }),
    noinfo: p => letter(p, { subject: `${DEFS.noinfo.subject} по ${reqRef(p.case)}`, body: [
      'На основание чл. 33 от ЗДОИ Ви уведомяваме, че не разполагаме с исканата информация и нямаме данни за нейното местонахождение.',
      ...(p.f.note ? [p.f.note] : [])
    ] }),
    dismiss: p => letter(p, { subject: `${DEFS.dismiss.subject} с рег. № ${p.case.regNo} от ${fmt(p.case.regDate)}`, body: [
      `Уведомяваме Ви, че заявлението се оставя без разглеждане на основание ${p.f.ground}.`,
      ...(p.f.note ? [p.f.note] : [])
    ] }),
    letter: p => letter(p, { subject: p.f.subjectLine, body: [p.f.text] }),
    grant: p => [
      ...decisionHead(p, 'за предоставяне на достъп до обществена информация'),
      ...(p.f.groundText ? [P(`Допълнителни правни основания: ${p.f.groundText}.`)] : []),
      ...motives(p),
      P('На основание чл. 28, ал. 2 във връзка с чл. 34 от Закона за достъп до обществена информация'),
      { text: 'РЕШИХ:', bold: true, alignment: 'center', margin: [0, 6, 0, 8] },
      P('ПРЕДОСТАВЯМ достъп до исканата обществена информация при следните условия:'),
      accessPoints(p), ...accessNotes(p), ...extraText(p),
      P(appealClause(p)), signature(p)
    ],
    partial: p => [
      ...decisionHead(p, 'за предоставяне на частичен достъп до обществена информация'),
      P(`Правно основание за ограничаването: ${p.f.groundText}, във връзка с чл. 37, ал. 2 ЗДОИ.`),
      P(`Фактическо основание: ${p.f.factual}`),
      ...motives(p),
      P('На основание чл. 28, ал. 2, чл. 34 и чл. 37, ал. 2 от Закона за достъп до обществена информация'),
      { text: 'РЕШИХ:', bold: true, alignment: 'center', margin: [0, 6, 0, 8] },
      P(`ОТКАЗВАМ достъп до следната част от информацията: ${p.f.withheld}`),
      P('ПРЕДОСТАВЯМ достъп до останалата част при следните условия:'),
      accessPoints(p), ...accessNotes(p), ...extraText(p),
      P(appealClause(p)), signature(p)
    ],
    refuse: p => [
      ...decisionHead(p, 'за отказ за предоставяне на достъп до обществена информация'),
      P(`Правно основание за отказа: ${p.f.groundText}.`),
      P(`Фактическо основание за отказа: ${p.f.factual}`),
      ...motives(p),
      P('На основание чл. 28, ал. 2 и чл. 38 от Закона за достъп до обществена информация'),
      { text: 'РЕШИХ:', bold: true, alignment: 'center', margin: [0, 6, 0, 8] },
      P('ОТКАЗВАМ да предоставя достъп до исканата обществена информация.'),
      P('Решението се връчва срещу подпис, изпраща се по пощата с обратна разписка или на посочения профил в системата за сигурно електронно връчване (чл. 39 ЗДОИ).'),
      ...extraText(p),
      P(appealClause(p)), signature(p)
    ],
    protocol: p => {
      const c = p.case;
      return [
        ...letterhead(p.org),
        { text: `ПРОТОКОЛ № ${p.no}`, bold: true, fontSize: 14, alignment: 'center', margin: [0, 6, 0, 2] },
        { text: `от ${fmt(p.date)}`, alignment: 'center' },
        { text: 'за предоставяне на достъп до обществена информация (чл. 35, ал. 2 ЗДОИ)', alignment: 'center', bold: true, margin: [0, 2, 0, 14] },
        P(`Преписка: рег. № ${c.regNo} от ${fmt(c.regDate)}${c.decisionNo ? `; решение № ${c.decisionNo} от ${fmt(c.decisionDate)}` : ''}.`),
        P(`Заявител: ${applicantLine(c)}.`),
        P(`Предоставена информация: ${p.f.given}`),
        P(`Форма на достъп: ${p.f.accessForm}.`),
        ...(p.f.paid ? [P(`Платени разходи и платежен документ: ${p.f.paid}`)] : []),
        ...extraText(p),
        { margin: [0, 34, 0, 0], columns: [
          { stack: [{ text: 'Заявител:', bold: true }, { text: '\n.............................' }, { text: c.applicantName }] },
          { stack: [{ text: 'Служител:', bold: true }, isElectronic(p) ? { text: ELECTRONIC_NOTE, fontSize: 9, color: '#44546A', margin: [0, 4, 0, 8] } : { text: '\n.............................' }, { text: p.f.employee || '' }] }
        ] }
      ];
    },
    report: p => {
      const s = p.stats, o = p.org;
      const table = (title, obj) => [
        { text: title, bold: true, margin: [0, 10, 0, 4], color: '#0E3A6E' },
        { table: { headerRows: 1, widths: ['*', 60], body: [[{ text: 'Показател', bold: true }, { text: 'Брой', bold: true, alignment: 'right' }]].concat(Object.keys(obj).map(k => [k, { text: String(obj[k]), alignment: 'right' }])) }, layout: 'lightHorizontalLines' }
      ];
      return [
        ...letterhead(o),
        { text: `ГОДИШЕН ОТЧЕТ ЗА ${s.year} г.`, bold: true, fontSize: 14, alignment: 'center', margin: [0, 6, 0, 2] },
        { text: 'за постъпилите заявления за достъп до обществена информация и за повторно използване на информация от обществения сектор', alignment: 'center', bold: true },
        { text: `(чл. 15, ал. 2 ЗДОИ) · № ${p.no} от ${fmt(p.date)}`, alignment: 'center', margin: [0, 2, 0, 12] },
        ...table('Общи данни', {
          'Общо постъпили заявления': s.total, 'За достъп до обществена информация': s.access, 'За повторно използване на информация': s.reuse,
          'Направени откази (пълни и частични)': s.refusals, 'Обжалвани': s.appealed, 'С решение или в процес след изтичане на срока': s.late, 'Публикувани на платформата по чл. 15в': s.published
        }),
        ...table('По вид заявител', s.byApplicant),
        ...table('По начин на подаване', s.byChannel),
        ...table('По резултат', s.byOutcome),
        ...table('Откази и причини', s.grounds),
        ...(p.f.note ? [{ text: 'Допълнителна информация', bold: true, margin: [0, 10, 0, 4], color: '#0E3A6E' }, P(p.f.note)] : []),
        signature(p)
      ];
    },
    art15: p => {
      const map = {};
      (p.items || []).forEach(i => { map[i.item] = i; });
      const al3 = p.org.basis !== 'чл. 3, ал. 1';
      return [
        ...letterhead(p.org),
        { text: 'ИНФОРМАЦИЯ ПО ЧЛ. 15 ЗДОИ', bold: true, fontSize: 14, alignment: 'center', margin: [0, 6, 0, 2] },
        { text: `${al3 ? 'чл. 15, ал. 3' : 'чл. 15, ал. 1'} · към ${fmt(p.date)} · № ${p.no}`, alignment: 'center', margin: [0, 0, 0, 12] },
        { text: 'Звено за приемане на заявления', bold: true, color: '#0E3A6E', margin: [0, 0, 0, 4] },
        P(`${p.org.unitName}, ${p.org.unitAddress}; имейл: ${p.org.unitEmail}; тел. ${p.org.unitPhone}; работно време: ${p.org.unitHours}.`),
        ...art15Items(p.org.basis).flatMap(([n, label]) => {
          const it = map[String(n)];
          return [
            { text: `т. ${n}. ${label}`, bold: true, margin: [0, 8, 0, 3], color: '#0E3A6E' },
            P(it && it.text ? it.text : 'Няма въведена информация.', it && it.text ? {} : { color: '#8A5A00' }),
            ...(it && it.url ? [{ text: it.url, link: it.url, color: '#0B5FA0', margin: [0, 0, 0, 3] }] : []),
            ...(it && it.updated ? [{ text: `Обновено на ${fmt(it.updated)}`, fontSize: 8.5, color: '#5A6B85' }] : [])
          ];
        }),
        ...(isElectronic(p) ? [signature(p)] : [])
      ];
    }
  };

  function buildContent(payload) {
    const build = BUILD[payload.type];
    if (!build) throw new Error('Непознат документ: ' + payload.type);
    let edits = {};
    try { edits = JSON.parse((payload.f && payload.f.edits) || '{}') || {}; } catch (e) { edits = {}; }
    Object.assign(track, { edits, list: [], i: 0 });
    return build(payload);
  }

  /* абзаците на документа за прегледа преди PDF, без вече нанесените промени */
  function editableParagraphs(payload) {
    buildContent(Object.assign({}, payload, { f: Object.assign({}, payload.f, { edits: '{}' }) }));
    return track.list.slice();
  }

  function pdfDefinition(payload, logo) {
    const content = buildContent(payload);
    return {
      pageSize: 'A4',
      pageMargins: [50, 40, 50, 54],
      info: { title: `${DEFS[payload.type].title} ${payload.no}`, author: payload.org.name, creator: 'ЗДОИ4You Платформа' },
      images: { logo: logo },
      defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.22, color: '#111827' },
      content,
      footer: (page, count) => ({
        margin: [50, 14, 50, 0], fontSize: 8, color: '#5A6B85',
        columns: [{ text: 'Генерирано чрез платформата ЗДОИ4You · platform.zdoi4you.eu' }, { text: `стр. ${page} от ${count}`, alignment: 'right', width: 70 }]
      })
    };
  }

  const fileName = p => `${p.no}.pdf`.replace(/[^\p{L}\p{N}._-]+/gu, '_');

  /* ---------- досие на преписка ---------- */

  const stampText = t => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(t || ''); return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]} ч.` : (t || ''); };
  const sizeText = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const heading = text => ({ text, bold: true, fontSize: 12, color: '#0E3A6E', margin: [0, 14, 0, 6], tocItem: true });
  const kv = rows => {
    const body = rows.filter(r => r[1] !== '' && r[1] !== null && r[1] !== undefined).map(([k, v]) => [{ text: k, color: '#44546A' }, { text: String(v) }]);
    return body.length ? { table: { widths: [165, '*'], body, dontBreakRows: true }, layout: { hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => '#D8E2EF', paddingLeft: () => 0 } } : { text: 'Няма данни.', color: '#5A6B85' };
  };
  const grid = (head, rows, widths, size) => (rows.length
    ? { table: { headerRows: 1, dontBreakRows: true, widths, body: [head.map(t => ({ text: t, bold: true, fontSize: size || 9 }))].concat(rows.map(r => r.map(c => ({ text: String(c === undefined || c === null || c === '' ? '—' : c), fontSize: size || 9 })))) }, layout: 'lightHorizontalLines' }
    : { text: 'Няма.', color: '#5A6B85' });
  const docTitle = d => (d.type === 'cover' ? d.title : (DEFS[d.type] || {}).title || d.title);

  function dossierContent(data, opts) {
    const c = data.case, o = opts || {}, signP = { f: { signMode: o.signMode }, org: data.org };
    const withText = (data.docs || []).filter(d => d.payload && BUILD[d.payload.type]);
    const content = [
      ...letterhead(data.org),
      { text: 'ДОСИЕ НА ПРЕПИСКА', bold: true, fontSize: 15, alignment: 'center', margin: [0, 6, 0, 2] },
      { text: `рег. № ${c.regNo} от ${fmt(c.regDate)}`, bold: true, alignment: 'center' },
      { text: `Генерирано на ${stampText(data.generatedAt)} от ${data.generatedBy}`, alignment: 'center', margin: [0, 2, 0, 10] },
      { text: 'Досието е извлечение от данните в платформата към посочения момент. Контролните суми SHA-256 позволяват да се провери дали приложените отделно файлове съвпадат с качените.', fontSize: 9, color: '#44546A', margin: [0, 0, 0, 10] },
      { toc: { title: { text: 'Съдържание', bold: true, fontSize: 12, color: '#0E3A6E', margin: [0, 0, 0, 6] }, numberStyle: { fontSize: 9.5 }, textStyle: { fontSize: 9.5 } }, margin: [0, 0, 0, 6] },
      heading('Данни за преписката'),
      kv([['Вид заявление', c.kind], ['Дата на регистриране', c.regDate && fmt(c.regDate)], ['Начин на подаване', c.channel], ['Предпочитана форма', c.form], ['Отказ от публикуване', c.noPublish], ['Статус', c.status], ['Резултат', c.outcome], ['Отговорник', c.owner], ['Решение №', c.decisionNo && `${c.decisionNo} от ${fmt(c.decisionDate)}`], ['Връчено на', c.served && fmt(c.served)], ['Начин на връчване', c.servedHow], ['Публикувано (чл. 15в)', c.published15c && fmt(c.published15c)], ['Обжалвано', c.appealed], ['Бележка за обжалването', c.appealNote], ['Въведена', stampText(c.createdAt)], ['Въвел', c.createdBy]]),
      heading('Заявител'),
      kv([['Име или наименование', c.applicantName], ['Вид', c.applicantType], ['ЕИК/БУЛСТАТ', c.applicantEik], ['Седалище', c.applicantSeat], ['Адрес', c.applicantAddress], ['Имейл', c.applicantEmail], ['Телефон', c.applicantPhone]]),
      heading('Искана информация'),
      { text: c.subject || '', alignment: 'justify' },
      heading('Срокове'),
      kv([['Текущ срок', c.due && `${fmt(c.due)}${c.dueLabel ? ` (${c.dueLabel})` : ''}`], ['Поискано уточняване', c.clarifyAsked && fmt(c.clarifyAsked)], ['Получено уточняване', c.clarifyGot && fmt(c.clarifyGot)], ['Удължаване по чл. 30 (дни)', c.ext30], ['Удължаване по чл. 31 (дни)', c.ext31], ['Искане до трето лице: срок', c.thirdInvolved && c.thirdBy && fmt(c.thirdBy)], ['Искане до трето лице: изпратено', c.thirdAsked && fmt(c.thirdAsked)], ['Отговор на трето лице: срок', c.thirdInvolved && c.thirdReplyBy && fmt(c.thirdReplyBy)], ['Отговор на трето лице: получен', c.thirdGot && fmt(c.thirdGot)]].map(([k, v]) => [k, v || ''])),
      heading('Издадени документи'),
      grid(['Номер', 'Дата', 'Документ', 'Издал'], (data.docs || []).map(d => [d.no, fmt(d.date), docTitle(d), d.author]), [85, 62, '*', 70]),
      heading('Съдебни дела'),
      grid(['Дело', 'Съд', 'Вид', 'Статус', 'Заседание', 'Бележки'], (data.courts || []).map(x => [`${x.caseNo}/${x.year}`, x.court, x.kind, x.status, x.nextHearing ? fmt(x.nextHearing) : '', x.note]), [55, '*', 70, 55, 58, 80]),
      heading('Качени файлове'),
      grid(['Файл', 'Към', 'Размер', 'Качен', 'SHA-256'], (data.files || []).map(f => [f.name, f.courtNo ? `дело ${f.courtNo}` : 'преписка', sizeText(f.size), `${stampText(f.at)}, ${f.by}`, f.sha256]), ['*', 48, 40, 78, 150], 7.5),
      heading('История на преписката'),
      grid(['Време', 'Потребител', 'Вид', 'Текст'], (data.events || []).map(e => [stampText(e.at), e.user, e.kind, e.text]), [76, 60, 58, '*'], 8.5),
      { margin: [0, 26, 0, 0], unbreakable: true, stack: [{ text: 'Изготвил досието:', bold: true, margin: [0, 0, 0, 10] }, signLine(signP), { text: data.generatedBy || '', bold: true, margin: [0, 2, 0, 0] }, { text: data.generatedPosition || '' }] }
    ];
    withText.forEach((d, i) => {
      content.push({ text: `Приложение ${i + 1}: ${docTitle(d)}${d.type === 'cover' ? ', изх.' : ''} № ${d.no} от ${fmt(d.date)}`, fontSize: 9, color: '#44546A', margin: [0, 0, 0, 8], tocItem: true, pageBreak: 'before' });
      content.push(...buildContent(d.payload));
    });
    return content;
  }

  function dossierDefinition(data, logo, opts) {
    return {
      pageSize: 'A4',
      pageMargins: [50, 40, 50, 54],
      info: { title: `Досие на преписка ${data.case.regNo}`, author: data.org.name, creator: 'ЗДОИ4You Платформа' },
      images: { logo },
      defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.22, color: '#111827' },
      content: dossierContent(data, opts),
      footer: (page, count) => ({
        margin: [50, 14, 50, 0], fontSize: 8, color: '#5A6B85',
        columns: [{ text: `Досие на преписка ${data.case.regNo} · генерирано на ${stampText(data.generatedAt)}` }, { text: `стр. ${page} от ${count}`, alignment: 'right', width: 70 }]
      })
    };
  }
  const dossierFileName = data => `Досие-${data.case.regNo}.pdf`.replace(/[^\p{L}\p{N}._-]+/gu, '_');

  const PERMS = [
    ['casesAll', 'Вижда всички преписки и адресати', 'Без това право вижда само възложените на него и въведените от него.'],
    ['casesEdit', 'Създава и променя преписки, адресати, дела и файлове, пише коментари', ''],
    ['letters', 'Издава писма и протоколи', ''],
    ['decisions', 'Издава решения', ''],
    ['reports', 'Годишни отчети', ''],
    ['art15', 'Информация по чл. 15', 'Промяна и генериране на PDF.'],
    ['signers', 'Управлява упълномощените лица', ''],
    ['grounds', 'Управлява собствените правни основания', ''],
    ['departments', 'Управлява отделите на организацията', ''],
    ['changes', 'Изпраща заявки за промяна на данните на организацията', ''],
    ['log', 'Вижда дневника', '']
  ];
  const STAFF_PERMS = ['casesAll', 'casesEdit', 'letters', 'decisions', 'reports', 'art15'];
  const defaultPerms = role => (role === 'Администратор' ? PERMS.map(p => p[0]) : STAFF_PERMS);

  const api = { COST_NORMS, NO_COST_FORM, costsOf, dossierDefinition, dossierFileName, signModeField, PERMS, STAFF_PERMS, defaultPerms, orgAddress, DEFS, ART15, ART15_AL3, art15Items, ACCESS_FORMS, REFUSAL, GROUNDS, GROUND_SCOPE_LABELS, groundsText, OBLASTS, courtForOblast, oblastOf, pdfDefinition, editableParagraphs, fileName, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Docs = api;
})(typeof window !== 'undefined' ? window : globalThis);
