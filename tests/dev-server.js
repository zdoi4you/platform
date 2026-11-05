/*
 * Локален сървър за преглед и тестове: сервира site/ и изпълнява apps-script/*.gs с макетите на Google.
 * Данните са в паметта. Стартиране: node tests/dev-server.js [порт]
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { load } = require('./mock-google');

function start(port) {
  const g = load();
  const link = g.setup();
  const root = path.join(__dirname, '..', 'site');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__api') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        const out = g.ctx.doPost({ postData: { contents: body } });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(out.text);
      });
      return;
    }
    if (url.pathname === '/__mails') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(g.mails)); return; }
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'Content-Type': types['.html'] }); res.end(fs.readFileSync(path.join(root, '404.html'))); return; }
    let data = fs.readFileSync(file);
    if (rel === 'js/config.js') data = Buffer.from("window.PLATFORM_API = '/__api';\n");
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({ server, g, operatorLink: link, base: `http://127.0.0.1:${server.address().port}/` })));
}

if (require.main === module) {
  start(Number(process.argv[2]) || 8787).then(s => {
    console.log(s.base);
    console.log('Активиране на оператора: ' + s.operatorLink.replace('https://platform.zdoi4you.eu/', s.base));
  });
}
module.exports = { start };
