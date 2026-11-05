/* Начална страница с жива демонстрация на панелите. Данните в демонстрацията са примерни и не идват от сървъра. */
(function () {
  'use strict';

  const ICONS = {
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    pen: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
    scale: 'M12 4v16M7 20h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z',
    pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    chart: 'M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3',
    sign: 'M3 17c3-5 5-8 6-8 2 0-1 8 1 8s3-4 5-4 1 3 3 3 2-1 3-2M3 21h18',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c2 .7 3.2 2.6 3.5 5.5',
    court: 'M4 9l8-5 8 5M5 9h14M6 9v8M10 9v8M14 9v8M18 9v8M4 20h16M4 17h16',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
    key: 'M15 8a4 4 0 1 1-3.5 6L5 20H3v-3l6.5-6.5A4 4 0 0 1 15 8zM16 7.5h.01',
    mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
  };
  const SVG = 'http://www.w3.org/2000/svg';
  function icon(name) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ico');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', ICONS[name]);
    s.append(p);
    return s;
  }

  const FEATURES = [
    ['folder', 'Преписки и срокове', 'Регистър на заявленията със сроковете по чл. 28–31 ЗДОИ, включително за трети лица. Срок, който изтича в неработен ден, се мести на следващия работен.'],
    ['doc', 'Писма и решения в PDF', 'Уточняване, удължаване, препращане и писмо до другия задължен субект, решения, протокол и отделно съпроводително писмо към всеки документ. Подписват се ръчно или с електронен подпис.'],
    ['pen', 'Мотиви и преглед', 'Решенията имат поле за мотиви. Преди генериране всеки абзац може да се промени или изтрие и да се добави текст.'],
    ['scale', 'Правни основания и съд', 'Основания от ЗДОИ и собствени на организацията. Съдът в решението се предлага по адреса на адресата.'],
    ['pin', 'Адресати и адреси', 'Запазени адресати с ЕИК или БУЛСТАТ и пълни адреси от списък: област, община, населено място, район, улица и пощенски код.'],
    ['list', 'Вътрешни бланки и отдели', 'Отделите на организацията и готови бланки: вътрешно искане, отговор на отдел и докладна записка по преписка.'],
    ['court', 'Дела и файлове', 'Съдебните дела със следващото заседание и файловете към всяка преписка и дело на едно място. Цялото досие на преписката излиза в един PDF.'],
    ['chart', 'Отчети и чл. 15', 'Годишен отчет по чл. 15, ал. 2 със статистика по заявител, резултат и причини за отказ, и информацията по чл. 15.'],
    ['sign', 'Упълномощени лица', 'Лицата по чл. 28, ал. 2 се въвеждат с акта за определяне и срока му и се избират при издаване на документ.'],
    ['users', 'Потребители и права', 'Администратори и служители с настройваеми права: всички или само своите преписки, писма, решения, отчети, дневник.']
  ];
  const SECURITY = [
    ['folder', 'Отделни данни', 'Всяка организация има собствена Google таблица и папка за файлове, които не се споделят с други организации.'],
    ['key', 'Пароли', 'Паролата се избира от потребителя и се обработва в браузъра. Не се изпраща към сървъра и по имейл.'],
    ['mail', 'Достъп по имейл', 'Номерът на организацията и еднократната връзка за парола отиват само на имейла на съответния потребител.'],
    ['shield', 'Ограничение при грешни опити', 'След 5 грешни опита входът се спира за 15 минути и потребителят получава известие по имейл.'],
    ['eye', 'Входове по IP адрес', 'Администраторите виждат успешните и неуспешните входове с IP адрес и новите адреси се отбелязват.']
  ];

  /* ---------- демонстрация ---------- */

  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const DURATION = 9000;

  function animator(stage) {
    const timers = [];
    const later = (fn, ms) => {
      if (reduced()) { fn(); return; }
      timers.push(setTimeout(() => { if (stage.isConnected) fn(); }, ms));
    };
    return {
      later,
      clear: () => { timers.forEach(clearTimeout); timers.length = 0; },
      type: (el, text, start, speed) => {
        if (reduced()) { el.textContent = text; return; }
        [...text].forEach((_, i) => later(() => { el.textContent = text.slice(0, i + 1); }, start + i * (speed || 28)));
      },
      count: (el, to, start) => {
        if (reduced()) { el.textContent = to; return; }
        el.textContent = '0';
        for (let i = 1; i <= 14; i++) later(() => { el.textContent = Math.round(to * i / 14); }, start + i * 45);
      },
      show: (el, ms) => { later(() => el.classList.add('on'), ms); return el; }
    };
  }

  const pill = (text, cls) => h('span', { class: 'pill ' + (cls || '') }, text);

  function panelDash(a) {
    const nums = [[24, 'Активни преписки', ''], [1, 'С изтекъл срок', 'bad'], [3, 'Изтичат до 3 дни', 'warn'], [187, 'Заявления през годината', '']];
    const rows = [
      ['ЗДОИ-2026-0142', 'Сдружение „Пример“', 'Договори за ремонт', 'просрочена с 2 дни', 'bad', 100],
      ['ЗДОИ-2026-0147', 'Иван Примеров', 'Бюджет за 2026 г.', 'изтича днес', 'warn', 96],
      ['ЗДОИ-2026-0151', 'Вестник „Пример“', 'Обществени поръчки', 'остават 3 дни', 'warn', 78],
      ['ЗДОИ-2026-0158', 'Фирма Пример ООД', 'Протоколи от заседания', 'остават 11 дни', 'info', 22]
    ];
    const tiles = nums.map(([n, label, cls], i) => {
      const b = h('b', null, '0');
      a.count(b, n, 150 + i * 120);
      return h('div', { class: 'card tile demo-tile ' + cls }, b, h('span', { class: 'muted small' }, label));
    });
    return h('div', { class: 'demo-col' },
      h('div', { class: 'demo-tiles' }, tiles),
      h('div', { class: 'card demo-list' }, h('h3', null, 'Най-близки срокове'),
        rows.map(([no, who, what, due, cls, fill], i) => {
          const bar = h('i', { class: 'demo-fill ' + cls });
          a.later(() => { bar.style.width = fill + '%'; }, 500 + i * 180);
          return a.show(h('div', { class: 'demo-row step' },
            h('div', { class: 'demo-row-main' }, h('b', { class: 'mono' }, no), h('span', { class: 'small muted' }, who + ' · ' + what), h('span', { class: 'demo-bar' }, bar)),
            pill(due, cls)), 350 + i * 180);
        })));
  }

  function panelCase(a) {
    const steps = [
      ['02.11.2026', 'Регистрирано заявление', 'Сроковете започват да текат.'],
      ['09.11.2026', 'Искане до третото лице', 'Чл. 31, ал. 2: до 7 дни от регистрирането.'],
      ['16.11.2026', 'Решение по заявлението', 'Чл. 28, ал. 1: 14 дни от регистрирането.'],
      ['30.11.2026', 'Отговор на третото лице', 'Чл. 31, ал. 1: при удължаване с 14 дни.']
    ];
    return h('div', { class: 'demo-split' },
      h('div', { class: 'card' }, h('h3', null, 'Преписка ЗДОИ-2026-0142'), h('p', { class: 'small muted' }, 'Срокове, които платформата изчислява сама'),
        h('ol', { class: 'demo-timeline' }, steps.map(([d, t, n], i) => a.show(h('li', { class: 'step' }, h('span', { class: 'demo-dot' }), h('div', null, h('div', { class: 'small muted mono' }, d), h('b', null, t), h('div', { class: 'small muted' }, n))), 250 + i * 650)))),
      h('div', { class: 'demo-col' },
        a.show(h('div', { class: 'card step' }, h('h3', null, 'Срок за решение'), h('p', { class: 'bigdue' }, '16.11.2026'), pill('остават 9 дни', 'info')), 700),
        a.show(h('div', { class: 'card step' }, h('h3', null, 'История'), h('ul', { class: 'timeline' },
          h('li', null, h('div', { class: 'small muted' }, 'М. Петрова · Документ'), 'Искане за съгласие от трето лице'),
          h('li', null, h('div', { class: 'small muted' }, 'М. Петрова · Създаване'), 'Преписката е въведена.'))), 1700)));
  }

  function panelDecision(a) {
    const motive = 'Исканата информация е обществена и засяга дейността на органа. Не са налице основания за ограничаване на достъпа.';
    const typed = h('span', { class: 'demo-caret' }), paper = h('p', null);
    const court = h('b', null), box = h('input', { type: 'checkbox', tabindex: '-1', 'aria-hidden': 'true' }), box2 = h('input', { type: 'checkbox', checked: true, disabled: true, tabindex: '-1', 'aria-hidden': 'true' });
    a.type(typed, motive, 900, 22);
    a.type(paper, motive, 900, 22);
    a.later(() => { box.checked = true; }, 500);
    a.type(court, 'Административен съд – Варна', 4200, 26);
    return h('div', { class: 'demo-split' },
      h('div', { class: 'card demo-col' }, h('h3', null, 'Решение за предоставяне на достъп'),
        h('div', { class: 'field' }, h('span', null, 'Адресат'), h('div', { class: 'demo-input' }, 'Фирма Пример ООД, ЕИК 831902088')),
        h('div', { class: 'field' }, h('span', null, 'Адрес'), h('div', { class: 'demo-input small' }, 'п.к. 9000, обл. Варна, общ. Варна, гр. Варна, ул. Морска 5')),
        h('label', { class: 'check small' }, box2, h('span', null, 'чл. 34, ал. 1 – предоставяне на достъп')),
        h('label', { class: 'check small' }, box, h('span', null, 'чл. 31 – съгласие на третото лице')),
        h('div', { class: 'field' }, h('span', null, 'Мотиви'), h('div', { class: 'demo-input demo-area small' }, typed))),
      h('div', { class: 'demo-paper' },
        h('img', { src: 'assets/logo-site.png', alt: '' }),
        h('p', { class: 'demo-paper-org' }, 'ОБЩИНА ПРИМЕРНО'),
        h('h4', null, 'РЕШЕНИЕ № 42'), h('p', { class: 'demo-paper-sub' }, 'за предоставяне на достъп до обществена информация'),
        h('p', { class: 'demo-paper-lbl' }, 'Мотиви:'), paper,
        h('p', { class: 'demo-paper-lbl' }, 'Решението може да се обжалва пред:'), h('p', null, court)));
  }

  function panelAddressees(a) {
    const rows = [
      ['Фирма Морска ООД', 'ЕИК 831902088', 'гр. Варна, ул. Морска 5'],
      ['Сдружение „Пример“', 'БУЛСТАТ 121758615', 'гр. София, бул. Витоша 10'],
      ['Морска агенция', 'БУЛСТАТ 000696327', 'гр. Бургас, ул. Приморска 1'],
      ['Иван Примеров', 'Гражданин', 'гр. Пловдив, ул. Главна 3']
    ].map(r => h('tr', { class: 'demo-fade' }, h('td', null, h('b', null, r[0])), h('td', { class: 'small mono' }, r[1]), h('td', { class: 'small muted' }, r[2])));
    const search = h('span', { class: 'demo-caret' });
    const needle = 'морск';
    a.type(search, needle, 800, 170);
    a.later(() => { rows.forEach((tr, i) => tr.classList.toggle('off', i === 1 || i === 3)); }, 800 + needle.length * 170);
    return h('div', { class: 'demo-col' },
      h('div', { class: 'demo-input demo-search' }, h('span', { class: 'muted' }, 'Търсене: '), search),
      h('div', { class: 'card table-wrap' }, h('table', null, h('thead', null, h('tr', null, ['Име или наименование', 'ЕИК/БУЛСТАТ', 'Адрес'].map(t => h('th', null, t)))), h('tbody', null, rows))),
      h('p', { class: 'small muted' }, 'Адресатите се въвеждат и редактират и извън преписките. За фирмите и сдруженията има справка в Търговския регистър и в регистър БУЛСТАТ.'));
  }

  function panelCourts(a) {
    const files = [['Жалба.pdf', '1,2 MB', 92], ['Решение № 42.pdf', '180 KB', 100], ['Становище.docx', '64 KB', 100]];
    return h('div', { class: 'demo-split' },
      h('div', { class: 'card demo-col' }, h('h3', null, 'Съдебни дела'),
        [['Адм. дело № 1234/2026', 'Административен съд – Варна', 'Насрочено', 'warn', 'заседание на 10.12.2026'], ['Адм. дело № 876/2026', 'Върховен административен съд', 'Решено', 'ok', 'преписка ЗДОИ-2026-0098']].map(([t, c, s, cls, n], i) => a.show(h('div', { class: 'demo-row step' },
          h('div', { class: 'demo-row-main' }, h('b', null, t), h('span', { class: 'small muted' }, c), h('span', { class: 'small muted' }, n)), pill(s, cls)), 250 + i * 350))),
      h('div', { class: 'card demo-col' }, h('h3', null, 'Файлове по делото'),
        files.map(([n, size, fill], i) => {
          const bar = h('i', { class: 'demo-fill info' });
          a.later(() => { bar.style.width = fill + '%'; }, 600 + i * 500);
          return a.show(h('div', { class: 'demo-file step' }, icon('doc'), h('div', { class: 'demo-row-main' }, h('b', { class: 'small' }, n), h('span', { class: 'demo-bar' }, bar)), h('span', { class: 'small muted' }, size)), 350 + i * 500);
        }),
        h('p', { class: 'small muted' }, 'Всеки файл е в отделната папка на организацията.')));
  }

  function panelSecurity(a) {
    const perm = (label, on, flip) => {
      const c = h('input', { type: 'checkbox', tabindex: '-1', 'aria-hidden': 'true' });
      c.checked = on;
      if (flip) a.later(() => { c.checked = !on; }, flip);
      return h('label', { class: 'check small' }, c, h('span', null, label));
    };
    const rows = [
      ['10:42', 'mpetrova', '203.0.113.24', 'Успешен', 'ok', ''],
      ['09:15', 'gstoyanov', '198.51.100.7', 'Успешен', 'ok', 'Нов адрес'],
      ['08:58', 'gstoyanov', '192.0.2.61', 'Грешна парола', 'warn', ''],
      ['08:57', 'gstoyanov', '192.0.2.61', 'Заключен за 15 минути', 'bad', '']
    ];
    return h('div', { class: 'demo-split demo-split-rev' },
      h('div', { class: 'card demo-col' }, h('h3', null, 'Права на служител'),
        perm('Вижда всички преписки', true, 1500), perm('Издава писма и протоколи', true), perm('Издава решения', false, 2300), perm('Годишни отчети', true), perm('Дневник', false)),
      h('div', { class: 'card demo-col' }, h('h3', null, 'Входове по IP адрес'),
        h('div', { class: 'table-wrap' }, h('table', null, h('tbody', null, rows.map(([t, u, ip, res, cls, flag], i) => a.show(h('tr', { class: 'step' },
          h('td', { class: 'small mono' }, t), h('td', { class: 'small' }, u), h('td', { class: 'small mono' }, ip),
          h('td', null, pill(res, cls), flag ? [' ', pill(flag, 'info')] : null)), 300 + i * 400)))))));
  }

  const PANELS = [
    ['Табло', 'chart', panelDash],
    ['Срокове', 'clock', panelCase],
    ['Решение и PDF', 'doc', panelDecision],
    ['Адресати', 'pin', panelAddressees],
    ['Дела и файлове', 'court', panelCourts],
    ['Права и входове', 'shield', panelSecurity]
  ];

  function demoWindow() {
    const stage = h('div', { class: 'demo-stage', role: 'tabpanel', id: 'demo-panel' });
    const anim = animator(stage);
    let current = -1, elapsed = 0, auto = !reduced(), hovering = false, visible = true;
    const tabs = PANELS.map(([label, ic], i) => h('button', { class: 'demo-tab', type: 'button', role: 'tab', 'aria-controls': 'demo-panel', onclick: () => { auto = false; select(i); bars.forEach(b => { b.style.width = '0'; }); } }, icon(ic), h('span', null, label), h('i', { class: 'demo-progress' })));
    const bars = tabs.map(t => t.querySelector('.demo-progress'));
    const list = h('div', { class: 'demo-tabs', role: 'tablist', 'aria-label': 'Панели на платформата' }, tabs);
    list.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      auto = false;
      const n = (current + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : PANELS.length - 1)) % PANELS.length;
      select(n);
      tabs[n].focus();
      bars.forEach(b => { b.style.width = '0'; });
    });
    function select(i) {
      if (i === current) return;
      current = i; elapsed = 0;
      anim.clear();
      tabs.forEach((t, n) => { t.classList.toggle('on', n === i); t.setAttribute('aria-selected', n === i ? 'true' : 'false'); t.tabIndex = n === i ? 0 : -1; });
      bars.forEach(b => { b.style.width = '0'; });
      list.scrollLeft = tabs[i].offsetLeft - 16;
      stage.replaceChildren(h('div', { class: 'demo-enter' }, PANELS[i][2](anim)));
    }
    const win = h('div', { class: 'demo-window' },
      h('div', { class: 'demo-chrome' }, h('span', { class: 'demo-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), h('span', { class: 'demo-url' }, 'platform.zdoi4you.eu'), h('span', { class: 'pill info' }, 'Примерни данни')),
      h('div', { class: 'demo-body' }, list, stage));
    win.addEventListener('mouseenter', () => { hovering = true; });
    win.addEventListener('mouseleave', () => { hovering = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.2 }).observe(win);
    select(0);
    const clock = setInterval(() => {
      if (!win.isConnected) { clearInterval(clock); anim.clear(); return; }
      if (!auto || hovering || !visible || document.hidden) return;
      elapsed += 100;
      bars[current].style.width = Math.min(100, elapsed / DURATION * 100) + '%';
      if (elapsed >= DURATION) select((current + 1) % PANELS.length);
    }, 100);
    return win;
  }

  /* ---------- страница ---------- */

  function revealOnScroll(root) {
    const items = root.querySelectorAll('.reveal');
    if (reduced() || !('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    items.forEach(el => io.observe(el));
  }

  const cards = rows => h('div', { class: 'home-grid' }, rows.map(([ic, t, d]) => h('div', { class: 'card home-card reveal' }, h('span', { class: 'home-ico' }, icon(ic)), h('h3', null, t), h('p', { class: 'small muted' }, d))));

  window.viewHome = function viewHome() {
    const applyBtn = h('a', { class: 'btn', href: '#/apply' }, 'Заявка за регистрация');
    const closedNote = h('p', { class: 'small muted', hidden: true }, 'В момента не приемаме нови заявки за регистрация.');
    if (!session) api('public.config').then(c => { if (!c.applyOpen) { applyBtn.remove(); closedNote.hidden = false; } }).catch(() => {});
    const target = session ? (session.me.operator ? '#/op/apps' : '#/') : '#/login', label = session ? 'Към платформата' : 'Вход';
    const page = h('div', { class: 'home' },
      h('header', { class: 'home-top' }, h('div', { class: 'home-wrap home-bar' }, logoEl(true), h('div', { class: 'actions' }, themePicker(), h('a', { class: 'btn primary', href: target }, label)))),
      h('div', { class: 'hero-bg' }, h('section', { class: 'hero home-wrap' },
        h('p', { class: 'hero-kicker' }, 'За общини, администрации и юридически лица'),
        h('h1', null, 'Работата по ЗДОИ на едно място'),
        h('p', { class: 'hero-sub' }, 'Водите преписките и делата, следите сроковете, включително за трети лица, и издавате писма и решения в PDF. Всяка организация работи в собствено пространство.'),
        h('div', { class: 'actions' }, h('a', { class: 'btn primary hero-btn', href: target }, label), session ? null : applyBtn, h('a', { class: 'btn hero-btn', href: '#demo' }, 'Вижте панелите')),
        closedNote)),
      h('main', { class: 'home-wrap home-main' },
        h('section', { id: 'demo', class: 'demo-section', 'aria-label': 'Демонстрация на панелите' }, demoWindow()),
        h('section', { 'aria-labelledby': 'home-features' }, h('h2', { id: 'home-features' }, 'Какво можете да правите'), cards(FEATURES)),
        h('section', { 'aria-labelledby': 'home-steps' }, h('h2', { id: 'home-steps' }, 'Как започвате'),
          h('ol', { class: 'home-steps' },
            h('li', { class: 'reveal' }, h('b', null, 'Подавате заявка'), h('span', { class: 'small muted' }, 'Въвеждате данните на организацията, определяте администратор на профила и избирате парола.')),
            h('li', { class: 'reveal' }, h('b', null, 'Екипът я проверява'), h('span', { class: 'small muted' }, 'След одобрение администраторът получава по имейл номера на организацията.')),
            h('li', { class: 'reveal' }, h('b', null, 'Влизате и работите'), h('span', { class: 'small muted' }, 'Входът е с номер, потребителско име и парола. Служителите получават връзка за парола на своя имейл.')))),
        h('section', { 'aria-labelledby': 'home-security' }, h('h2', { id: 'home-security' }, 'Данни и сигурност'), cards(SECURITY)),
        h('p', { class: 'note' }, 'Шаблоните на документите са сверени с текста на ЗДОИ, но не заменят преценката на юрист.')),
      h('footer', { class: 'home-wrap home-foot small muted' },
        h('span', null, MAINTAINER, ' Поддръжка: ', supportLink()),
        h('a', { href: 'https://zdoi4you.eu', rel: 'noopener' }, 'zdoi4you.eu')));
    $app().replaceChildren(page);
    // #demo не е маршрут: връзката само превърта до панелите
    page.querySelector('a[href="#demo"]').addEventListener('click', e => { e.preventDefault(); document.getElementById('demo').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); });
    revealOnScroll(page);
    window.scrollTo(0, 0);
  };
})();
