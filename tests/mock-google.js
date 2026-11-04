/* Макети на услугите на Google и зареждане на apps-script/*.gs в изолиран контекст. Само за тестове. */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push((this.sheet.cells[this.r - 1 + i] || [])[this.c - 1 + j] ?? '');
      out.push(row);
    }
    return out;
  }
  setValues(v) {
    v.forEach((row, i) => row.forEach((x, j) => {
      const R = this.r - 1 + i;
      while (this.sheet.cells.length <= R) this.sheet.cells.push([]);
      this.sheet.cells[R][this.c - 1 + j] = x;
    }));
    return this;
  }
  setNumberFormat() { return this; }
}
/* същите ограничения като при Google: 1000 реда и 26 колони, извън тях getRange дава грешка */
class Sheet {
  constructor(name) { this.name = name; this.cells = []; this.maxRows = 1000; this.maxCols = 26; }
  getName() { return this.name; }
  getLastRow() { return this.cells.length; }
  getLastColumn() { return (this.cells[0] || []).length; }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  insertColumnsAfter(after, n) { this.maxCols += n; }
  getRange(r, c, nr = 1, nc = 1) {
    if (r + nr - 1 > this.maxRows || c + nc - 1 > this.maxCols) throw new Error(`Those rows/columns are out of bounds: ${this.name} ${r},${c},${nr},${nc}`);
    return new Range(this, r, c, nr, nc);
  }
  setFrozenRows() {}
}
class Book {
  constructor(id, name) { this.id = id; this.name = name; this.sheets = [new Sheet('Лист1')]; }
  getId() { return this.id; }
  getUrl() { return 'https://sheets.mock/' + this.id; }
  getSheets() { return this.sheets; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

function load() {
  const books = new Map(), mails = [], cache = new Map(), props = new Map();
  let seq = 0, clockOffset = 0;
  const now = () => Date.now() + clockOffset;
  const signed = buf => Array.from(buf).map(b => (b > 127 ? b - 256 : b));

  const globals = {
    console: { log() {}, error() {} },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (a, s) => signed(crypto.createHash(a).update(String(s), 'utf8').digest()),
      computeHmacSha256Signature: (v, k) => signed(crypto.createHmac('sha256', k).update(v, 'utf8').digest()),
      base64Encode: a => Buffer.from(a.map(b => b & 255)).toString('base64'),
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, f) => {
        const iso = new Date(d.getTime()).toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T');
        return f === 'yyyy-MM-dd' ? iso.slice(0, 10) : iso;
      }
    },
    CacheService: {
      getScriptCache: () => ({
        get: k => { const e = cache.get(k); if (!e || e.exp < now()) return null; return e.v; },
        put: (k, v, ttl) => { cache.set(k, { v: String(v), exp: now() + ttl * 1000 }); },
        remove: k => { cache.delete(k); }
      })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    SpreadsheetApp: {
      create: name => { const id = 'book' + (++seq); const b = new Book(id, name); books.set(id, b); return b; },
      openById: id => { const b = books.get(id); if (!b) throw new Error('no book ' + id); return b; }
    },
    DriveApp: {
      createFolder: () => ({ getId: () => 'folder1' }),
      getFolderById: id => ({ id }),
      getFileById: id => ({ moveTo(folder) { books.get(id).folder = folder.id; } })
    },
    MailApp: { sendEmail: m => { mails.push(m); } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.org' }) }
  };
  globals.__nowOffset = () => clockOffset;
  const ctx = vm.createContext(globals);
  // часовник, който тестовете могат да местят
  vm.runInContext(`(() => { const R = Date;
    Date = class extends R {
      constructor(...a) { if (a.length) super(...a); else super(R.now() + __nowOffset()); }
      static now() { return R.now() + __nowOffset(); }
      static UTC(...a) { return R.UTC(...a); }
    };
  })();`, ctx);
  const dir = path.join(__dirname, '..', 'apps-script');
  const src = fs.readdirSync(dir).filter(f => f.endsWith('.gs')).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  vm.runInContext(src + '\nthis.resetHeaders = () => { Object.keys(HEADERS_CHECKED_).forEach(k => delete HEADERS_CHECKED_[k]); };\nthis.__perms = { all: PERMS, staff: STAFF_PERMS };\nthis.__t = { term_, validEik_, safeCell_, readCell_, luhn_, holidays_, DOC_TYPES, REFUSAL, GROUNDS };', ctx, { filename: 'apps-script.js' });
  return {
    ctx, books, mails, props,
    setup: () => ctx.setup(),
    call: (action, data, token) => JSON.parse(JSON.stringify(ctx.dispatch_({ action, data, token }))),
    advance: ms => { clockOffset += ms; },
    t: ctx.__t
  };
}

module.exports = { load };
