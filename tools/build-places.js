/*
 * Създава site/data/places.json от ЕКАТТЕ на НСИ (https://www.nsi.bg/nrnm/ekatte/archive, JSON архив).
 * Употреба: node tools/build-places.js <папка с разархивираните ek_*.json>
 */
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const load = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const byName = (a, b) => a.n.localeCompare(b.n, 'bg');

const oblasts = load('ek_obl.json').filter(o => o.oblast);
const munis = load('ek_obst.json').filter(o => o.obshtina);
const places = load('ek_atte.json').filter(p => p.ekatte && p.ekatte !== '00000' && p.oblast);

const out = {
  source: 'НСИ, ЕКАТТЕ, архив 2025',
  oblasts: oblasts.map(o => ({
    n: o.name, c: o.oblast,
    m: munis.filter(m => m.obshtina.startsWith(o.oblast)).map(m => ({
      n: m.name,
      s: places.filter(p => p.obshtina === m.obshtina).map(p => ({ e: p.ekatte, n: `${p.t_v_m} ${p.name}` })).sort(byName)
    })).sort(byName)
  })).sort(byName),
  raions: {}
};
load('ek_raion.json').filter(r => r.raion).forEach(r => {
  const code = String(r.raion).split('-')[0];
  (out.raions[code] = out.raions[code] || []).push(r.name);
});
Object.values(out.raions).forEach(l => l.sort((a, b) => a.localeCompare(b, 'bg')));

const target = path.join(__dirname, '..', 'site', 'data');
fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(path.join(target, 'places.json'), JSON.stringify(out));
const count = out.oblasts.reduce((a, o) => a + o.m.reduce((b, m) => b + m.s.length, 0), 0);
console.log(`области ${out.oblasts.length}, общини ${out.oblasts.reduce((a, o) => a + o.m.length, 0)}, селища ${count}, райони:`, Object.entries(out.raions).map(([k, v]) => `${k}=${v.length}`).join(' '));
