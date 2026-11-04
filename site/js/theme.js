/* Прилага избраната тема преди рисуване, за да няма премигване. */
(function () {
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) { document.documentElement.hidden = true; } }
  var t = null;
  try { t = localStorage.getItem('theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark' && t !== 'blue') {
    t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();
