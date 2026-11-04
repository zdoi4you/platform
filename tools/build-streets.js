/*
 * Сваля улици и квартали от OpenStreetMap (Overpass) в site/data/streets/<ЕКАТТЕ>.json.
 * Данните са © OpenStreetMap contributors, лиценз ODbL.
 * Заявките са една по една с пауза, за да не се натоварва общественият сървър. Готовите файлове се прескачат.
 * Употреба: node tools/build-streets.js <ek_obl.json> <ek_atte.json> [допълнителни ЕКАТТЕ кодове...]
 */
const fs = require('fs'), path = require('path');
const [oblFile, atteFile, ...extra] = process.argv.slice(2);
const OP = 'https://overpass-api.de/api/interpreter';
const OUT = path.join(__dirname, '..', 'site', 'data', 'streets');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const atte = JSON.parse(fs.readFileSync(atteFile, 'utf8'));
const centers = JSON.parse(fs.readFileSync(oblFile, 'utf8')).filter(o => o.oblast).map(o => String(o.ekatte));
const codes = [...new Set([...centers, ...extra])];
const HW = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian';

async function query(area) {
  const q = `[out:json][timeout:90];${area}->.a;(way(area.a)["highway"~"^(${HW})$"]["name"];nwr(area.a)["place"~"^(suburb|neighbourhood|quarter)$"]["name"];);out tags;`;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const r = await fetch(OP, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'zdoi-platform-build' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(120000) });
      if (r.ok) return (await r.json()).elements;
      console.log(`  http ${r.status}, ново опитване`);
    } catch (e) { console.log('  ' + (e.cause || e.name)); }
    await sleep(Math.min(300000, 60000 * (attempt + 1)));
  }
  return null;
}
const clean = list => [...new Set(list.map(s => s.trim()).filter(s => /[А-Яа-я0-9]/.test(s) && s.length < 80))].sort((a, b) => a.localeCompare(b, 'bg', { numeric: true }));

(async () => {
  for (const code of codes) {
    const file = path.join(OUT, code + '.json');
    const p = atte.find(x => x.ekatte === code);
    if (!p) { console.log('няма', code); continue; }
    if (fs.existsSync(file)) continue;
    let els = await query(`area["ekatte"="${code}"]["boundary"="administrative"]`);
    if (els && !els.length) {
      await sleep(15000);
      els = await query(`area["name"="${p.name}"]["boundary"="administrative"]["admin_level"~"^(7|8|9)$"]`);
    }
    if (!els) { console.log(`${code} ${p.name}: неуспех`); continue; }
    const streets = clean(els.filter(e => e.tags.highway).map(e => e.tags.name));
    const quarters = clean(els.filter(e => e.tags.place).map(e => e.tags.name));
    if (streets.length < 5) { console.log(`${code} ${p.name}: твърде малко данни (${streets.length}), пропускам`); await sleep(15000); continue; }
    fs.writeFileSync(file, JSON.stringify({ streets, quarters }));
    console.log(`${code} ${p.name}: улици ${streets.length}, квартали ${quarters.length}`);
    await sleep(15000);
  }
  const done = fs.readdirSync(OUT).filter(f => /^\d+\.json$/.test(f)).map(f => f.slice(0, -5)).sort();
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(done));
  console.log('готови:', done.length);
})();
