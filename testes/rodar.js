// Uso:  node rodar.js            (roda tudo)
//       node rodar.js arraste    (só testes cujo nome contém "arraste")
const fs = require("fs");
const path = require("path");
const { registry } = require("./harness");

fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort().forEach((f) => require(path.join(__dirname, f)));

const filtro = (process.argv[2] || "").toLowerCase();
(async () => {
  let ok = 0, falhas = [];
  const lista = registry.filter((t) => t.name.toLowerCase().includes(filtro));
  for (const t of lista) {
    const t0 = Date.now();
    try {
      await t.fn();
      ok++;
      console.log("  ✔ " + t.name + "  (" + (Date.now() - t0) + " ms)");
    } catch (e) {
      falhas.push({ name: t.name, e });
      console.log("  ✘ " + t.name + "\n      " + String(e && e.message || e).split("\n").join("\n      "));
    }
  }
  console.log("\n" + ok + " passaram, " + falhas.length + " falharam, de " + lista.length + ".");
  process.exit(falhas.length ? 1 : 0);
})();
