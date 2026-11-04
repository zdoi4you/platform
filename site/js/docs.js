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
    t2: 'чл. 37, ал. 1, т. 2 ЗДОИ – засягат се интересите на трето лице, което изрично е отказало предоставянето',
    t3: 'чл. 37, ал. 1, т. 3 ЗДОИ – информацията е предоставена на заявителя през предходните 6 месеца'
  };
  const decisionAccess = [
    { k: 'accessDays', label: 'Срок за достъп (дни от получаване на решението)', type: 'number', req: true, min: 30, value: '30', hint: 'Не по-малко от 30 дни (чл. 34, ал. 4).' },
    { k: 'place', label: 'Място за достъп', req: true, value: (c, o) => o.unitAddress },
    { k: 'accessForm', label: 'Форма на достъп', type: 'select', req: true, options: ACCESS_FORMS, value: c => (ACCESS_FORMS.includes(c.form) ? c.form : '') },
    { k: 'costs', label: 'Разходи', req: true, value: 'Няма дължими разходи.', hint: 'По нормативите на министъра на финансите (чл. 20, ал. 2). При достъп по имейл не се заплащат (чл. 35, ал. 3).' },
    { k: 'others', label: 'Други органи с по-пълна информация (по желание)', hint: 'чл. 34, ал. 2' }
  ];
  const groundField = { k: 'groundKey', label: 'Правно основание', type: 'select', req: true, options: [
    ['t1', 'чл. 37, ал. 1, т. 1 – класифицирана информация или друга защитена тайна; чл. 13, ал. 2'],
    ['t2', 'чл. 37, ал. 1, т. 2 – трето лице изрично е отказало'],
    ['t3', 'чл. 37, ал. 1, т. 3 – предоставена през предходните 6 месеца']
  ] };

  const DEFS = {
    clarify: { group: 'Писма до заявителя', title: 'Уведомление за уточняване (чл. 29)', subject: 'уточняване на предмета на исканата информация', effect: 'Статусът става „Чака уточняване“.', fields: [
      { k: 'what', label: 'Какво трябва да се уточни', type: 'textarea', req: true }
    ] },
    extend30: { group: 'Писма до заявителя', title: 'Удължаване на срока (чл. 30)', subject: 'удължаване на срока за разглеждане', effect: 'Срокът за решение се удължава.', fields: [
      { k: 'days', label: 'Удължаване (дни, до 10)', type: 'number', req: true, min: 1, max: 10, value: '10' },
      { k: 'reason', label: 'Причини за удължаването', type: 'textarea', req: true, value: 'Поисканата информация е в голямо количество и е необходимо допълнително време за нейната подготовка.' }
    ] },
    extend31: { group: 'Писма до заявителя', title: 'Удължаване заради трето лице (чл. 31)', subject: 'удължаване на срока поради необходимост от съгласие на трето лице', effect: 'Статусът става „Чака трето лице“ и срокът се удължава.', fields: [
      { k: 'days', label: 'Удължаване (дни, до 14)', type: 'number', req: true, min: 1, max: 14, value: '14' },
      { k: 'third', label: 'Трето лице', req: true }
    ] },
    forward: { group: 'Писма до заявителя', title: 'Препращане на заявлението (чл. 32)', subject: 'препращане на заявление за достъп до обществена информация', effect: 'Преписката се приключва с резултат „Препратено“.', fields: [
      { k: 'body', label: 'Орган или юридическо лице, към което се препраща', req: true },
      { k: 'bodyAddress', label: 'Адрес на органа', type: 'address', req: true }
    ] },
    noinfo: { group: 'Писма до заявителя', title: 'Няма исканата информация (чл. 33)', subject: 'липса на исканата информация', effect: 'Преписката се приключва с резултат „Няма информация“.', fields: [
      { k: 'note', label: 'Допълнително пояснение (по желание)', type: 'textarea' }
    ] },
    dismiss: { group: 'Писма до заявителя', title: 'Оставяне без разглеждане', subject: 'оставяне на заявление без разглеждане', effect: 'Преписката се приключва с резултат „Без разглеждане“.', fields: [
      { k: 'ground', label: 'Основание', type: 'select', req: true, options: [
        'чл. 25, ал. 2 ЗДОИ – заявлението не съдържа данните по чл. 25, ал. 1, т. 1, 2 и 4',
        'чл. 29, ал. 2 ЗДОИ – предметът на исканата информация не е уточнен до 30 дни'
      ] },
      { k: 'note', label: 'Фактически обстоятелства', type: 'textarea' }
    ] },
    letter: { group: 'Писма до заявителя', title: 'Свободно писмо', subject: f => f.subjectLine, fields: [
      { k: 'subjectLine', label: 'Относно', req: true },
      { k: 'text', label: 'Текст', type: 'textarea', req: true, rows: 8 }
    ] },
    thirdparty: { group: 'Писма до трети лица', title: 'Искане за съгласие от трето лице (чл. 31)', subject: 'искане за съгласие за предоставяне на информация', effect: 'Записва се датата на искането. Искането се прави в 7-дневен срок от регистрирането (чл. 31, ал. 2).', fields: [
      { k: 'third', label: 'Трето лице', req: true },
      { k: 'thirdAddress', label: 'Адрес на третото лице', type: 'address', req: true },
      { k: 'info', label: 'Информацията, която го засяга', type: 'textarea', req: true },
      { k: 'by', label: 'Отговор до', type: 'date', req: true, value: c => c.thirdReplyBy, hint: 'Изчислен по чл. 31, ал. 1: регистрация + 14 дни + удължаването (до 14 дни), с преместване от неработен ден.' }
    ] },
    grant: { group: 'Решения', title: 'Решение за предоставяне на достъп', decision: true, effect: 'Статусът става „Решение издадено“. Срокът по чл. 28 спира да се следи.', fields: [
      { k: 'scope', label: 'Степен на осигурения достъп', req: true, value: 'Пълен достъп до исканата обществена информация.' },
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
    const extra = DEFS[k].decision ? [] : [letterMotives];
    DEFS[k].fields = DEFS[k].fields.concat(extra, signerFields);
  });
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

  function signature(p) {
    const f = p.f, o = p.org;
    return { margin: [0, 26, 0, 0], unbreakable: true, stack: [
      { text: '....................................' },
      { text: f.signer || o.headName, bold: true, margin: [0, 2, 0, 0] },
      { text: f.signerPosition || o.headPosition },
      ...(f.signerAct ? [{ text: `Лице, определено по чл. 28, ал. 2 ЗДОИ: ${f.signerAct}`, fontSize: 9, color: '#44546A', margin: [0, 2, 0, 0] }] : [])
    ] };
  }

  const toApplicant = c => ({ margin: [0, 0, 0, 12], stack: [
    { text: 'ДО', bold: true },
    { text: c.applicantName, bold: true },
    ...(c.applicantSeat ? [{ text: `седалище: ${c.applicantSeat}` }] : []),
    { text: c.applicantAddress || '' },
    { text: c.applicantEmail || '' },
    ...(c.applicantPhone ? [{ text: `тел. ${c.applicantPhone}` }] : [])
  ] });
  const salute = c => (c.applicantType === 'Гражданин' || c.applicantType === 'Журналист или медия' ? `Уважаеми/а г-н/г-жо ${c.applicantName},` : 'Уважаеми дами и господа,');
  const reqRef = c => `заявление за достъп до обществена информация с рег. № ${c.regNo} от ${fmt(c.regDate)}`;
  const applicantLine = c => [c.applicantName, c.applicantSeat && `седалище: ${c.applicantSeat}`, c.applicantAddress && `адрес: ${c.applicantAddress}`, c.applicantEmail && `имейл: ${c.applicantEmail}`].filter(Boolean).join(', ');
  const reqAbout = c => `Заявител: ${applicantLine(c)}. Искана информация: ${c.subject}`;

  function letter(p, opts) {
    const c = p.case;
    return [
      ...letterhead(p.org),
      { text: `Изх. № ${p.no} / ${fmt(p.date)}`, margin: [0, 0, 0, 12] },
      opts.to || toApplicant(c),
      { text: [{ text: 'ОТНОСНО: ', bold: true }, opts.subject], margin: [0, 0, 0, 12] },
      P(opts.salute || salute(c)),
      ...opts.body.map(t => (typeof t === 'string' ? P(t) : t)),
      ...motives(p),
      ...extraText(p),
      { text: 'С уважение,', margin: [0, 8, 0, 0] },
      signature(p)
    ];
  }

  function appealClause(p) {
    const al = p.org.basis === 'чл. 3, ал. 1' ? 1 : 2;
    return `Решението може да бъде обжалвано пред ${p.f.court || p.org.court} по реда на Административнопроцесуалния кодекс (чл. 40, ал. ${al} ЗДОИ) в 14-дневен срок от съобщаването му (чл. 149, ал. 1 АПК).`;
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
    const out = [];
    if (p.f.others) out.push(P(`По-пълна информация могат да предоставят: ${p.f.others} (чл. 34, ал. 2 ЗДОИ).`));
    out.push(P('Достъпът се предоставя след заплащане на определените разходи и представяне на платежен документ, като за него се съставя протокол (чл. 35, ал. 1 и 2 ЗДОИ). Когато достъпът е поискан по електронен път на посочен имейл, информацията или интернет адресът се изпращат с решението, без протокол и без разходи (чл. 35, ал. 3 ЗДОИ). При неявяване в срока или неплащане на разходите е налице отказ на заявителя от достъп, освен за заявления, подадени по електронен път или чрез платформата (чл. 36 ЗДОИ).'));
    return out;
  };

  const BUILD = {
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
          { stack: [{ text: 'Служител:', bold: true }, { text: '\n.............................' }, { text: p.f.employee || '' }] }
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
        })
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

  const api = { orgAddress, DEFS, ART15, ART15_AL3, art15Items, ACCESS_FORMS, REFUSAL, OBLASTS, courtForOblast, oblastOf, pdfDefinition, editableParagraphs, fileName, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Docs = api;
})(typeof window !== 'undefined' ? window : globalThis);
