/*
 * Създава site/data/postcodes.json от пощенските кодове на GeoNames и селищата от site/data/places.json.
 * Източник: https://download.geonames.org/export/zip/BG.zip, лиценз CC BY 4.0.
 * Стартиране: node tools/build-postcodes.js <BG.txt>
 */
const fs = require('fs'), path = require('path');

const bare = s => String(s).split(' / ')[0].trim().toLowerCase().replace(/^(гр|с|ман)\.\s*/, '').replace(/ё/g, 'е').replace(/\s+/g, ' ');
const OBLAST = { 'софия-град': 'софия (столица)', 'софия град': 'софия (столица)', 'град софия': 'софия (столица)', 'софийска': 'софия', 'софия-област': 'софия', 'софия област': 'софия' };
const oblastKey = s => { const b = bare(s); return OBLAST[b] || b; };

function build(geoFile, placesFile) {
  const rows = fs.readFileSync(geoFile, 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'))
    .map(c => ({ code: c[1], name: bare(c[2]), oblast: oblastKey(c[3]), muni: bare(c[5]), comm: bare(c[7] || '') }))
    .filter(r => /^\d{4}$/.test(r.code));
  const places = JSON.parse(fs.readFileSync(placesFile, 'utf8'));
  const byOblastName = new Map();
  rows.forEach(r => {
    const k = r.oblast + '|' + r.name;
    if (!byOblastName.has(k)) byOblastName.set(k, []);
    byOblastName.get(k).push(r);
  });
  const codes = {}, multi = [], missing = [], ambiguous = [];
  let total = 0;
  places.oblasts.forEach(o => o.m.forEach(m => m.s.forEach(s => {
    total++;
    let list = byOblastName.get(bare(o.n) + '|' + bare(s.n)) || [];
    // едно и също име в една област: важи само съвпадение и по община
    const sameMuni = list.filter(r => r.muni === bare(m.n));
    if (sameMuni.length) list = sameMuni;
    else if (new Set(list.map(r => r.muni)).size > 1) { ambiguous.push(o.n + '/' + m.n + '/' + s.n); return; }
    if (!list.length) { missing.push(o.n + '/' + m.n + '/' + s.n); return; }
    const uniq = [...new Set(list.map(r => r.code))].sort();
    codes[s.e] = uniq[0];
    if (uniq.length > 1) multi.push(s.e);
  })));
  return { out: { source: 'GeoNames, CC BY 4.0', codes, multi: multi.sort() }, stats: { total, found: Object.keys(codes).length, multi: multi.length, missing, ambiguous } };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const { out, stats } = build(process.argv[2], path.join(root, 'site/data/places.json'));
  fs.writeFileSync(path.join(root, 'site/data/postcodes.json'), JSON.stringify(out));
  console.log(`селища: ${stats.total}, с код: ${stats.found}, с няколко кода: ${stats.multi}, без код: ${stats.missing.length}, неясни: ${stats.ambiguous.length}`);
  console.log('без код (пример):', stats.missing.slice(0, 15).join('; '));
  console.log('неясни (пример):', stats.ambiguous.slice(0, 5).join('; '));
}
module.exports = { build };
