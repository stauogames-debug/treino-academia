// Uso (na pasta do app):  node tools/atualizar-sw.js
// Calcula um código a partir do CONTEÚDO de todos os arquivos listados em ASSETS
// (sw.js) e grava como VERSION. Assim o celular só baixa de novo quando algo mudou.
// Sem dependências. O teste tests/8-pwa.test.js usa a mesma função.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SW = path.join(ROOT, "sw.js");

function lerAssets(swTexto) {
  const m = /const ASSETS = \[([\s\S]*?)\];/.exec(swTexto);
  if (!m) throw new Error("lista ASSETS não encontrada em sw.js");
  return m[1].split("\n").map((l) => /"([^"]+)"/.exec(l)).filter(Boolean).map((x) => x[1]);
}

function calcularVersao(swTexto) {
  const h = crypto.createHash("sha256");
  lerAssets(swTexto).slice().sort().forEach((a) => {
    const arq = a === "./" ? "index.html" : a;
    h.update(a + "\0");
    h.update(fs.readFileSync(path.join(ROOT, arq)));
    h.update("\0");
  });
  return "treino-" + h.digest("hex").slice(0, 12);
}

function versaoAtual(swTexto) {
  const m = /const VERSION = "([^"]+)";/.exec(swTexto);
  return m ? m[1] : null;
}

module.exports = { lerAssets, calcularVersao, versaoAtual };

if (require.main === module) {
  const sw = fs.readFileSync(SW, "utf8");
  const nova = calcularVersao(sw);
  const antiga = versaoAtual(sw);
  if (nova === antiga) { console.log("sw.js já está na versão " + nova + " (nada mudou)."); process.exit(0); }
  fs.writeFileSync(SW, sw.replace(/const VERSION = "[^"]+";/, 'const VERSION = "' + nova + '";'));
  console.log("sw.js atualizado: " + antiga + " -> " + nova);
}
