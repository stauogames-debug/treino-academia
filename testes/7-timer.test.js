// Temporizador de descanso entre séries (js/timer.js + 2 ganchos em app.js).
// Regras: barra fixa fora do #app, só no modo normal; inicia ao salvar uma
// série de HOJE (carga > 0 ou reps feitas); preferência em "treino:timer"
// (fora do backup); nunca grava treino/histórico; nunca atrapalha o app.
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { test, withApp, makeStore, waitFor, ROOT } = require("./harness");

const KEY = "treino:timer";
const CSS = fs.readFileSync(path.join(ROOT, "css/styles.css"), "utf8");
const SRC = fs.readFileSync(path.join(ROOT, "js/timer.js"), "utf8");

// Relógio e vibração controlados (o jsdom não tem nenhum dos dois de verdade).
function fake(c) {
  let t = 1700000000000;
  c.w.Date.now = () => t;
  c.vibrations = 0;
  c.w.navigator.vibrate = () => { c.vibrations++; return true; };
  c.advance = (ms) => { t += ms; c.w.Treino.timerTick(); };
  return c;
}
const wrap = (c) => c.$("#restTimer");
const st = (c) => c.w.Treino.timerState();
const time = (c) => c.$(".rt-time").textContent;
const btn = (c, act, v) => c.$('#restTimer [data-act="' + act + '"]' + (v ? '[data-v="' + v + '"]' : ""));
const open = (c) => c.click(btn(c, "open"));

// ---------- funções puras ----------
test("timer (unit): clampSeconds, formatMMSS, remainingMs, normalizeTimerPrefs", () =>
  withApp(async (c) => {
    const T = c.T;
    assert.equal(T.clampSeconds(90), 90);
    assert.equal(T.clampSeconds(1), 5);
    assert.equal(T.clampSeconds(99999), 900);
    assert.equal(T.clampSeconds("abc"), 90);
    assert.equal(T.clampSeconds(null), 90);
    assert.equal(T.clampSeconds("120"), 120);
    assert.equal(T.formatMMSS(90), "01:30");
    assert.equal(T.formatMMSS(0), "00:00");
    assert.equal(T.formatMMSS(0.2), "00:01");
    assert.equal(T.formatMMSS(900), "15:00");
    assert.equal(T.formatMMSS(-5), "00:00");
    assert.equal(T.remainingMs(1000, 400), 600);
    assert.equal(T.remainingMs(1000, 5000), 0);
    // (JSON.stringify: os objetos vêm de outra "janela" do jsdom)
    const n = (v) => JSON.stringify(T.normalizeTimerPrefs(v));
    assert.equal(n('{"seconds":120,"auto":false}'), '{"seconds":120,"auto":false,"sound":true}');
    assert.equal(n("lixo{"), '{"seconds":90,"auto":true,"sound":true}');
    assert.equal(n(null), '{"seconds":90,"auto":true,"sound":true}');
  }));

// ---------- barra ----------
test("timer: começa como botão flutuante; abrir mostra a barra com a duração escolhida", () =>
  withApp(async (c) => {
    assert.equal(wrap(c).getAttribute("data-view"), "fab");
    assert.equal(wrap(c).parentNode, c.d.body, "fica fora do #app (render() não a apaga)");
    open(c);
    assert.equal(wrap(c).getAttribute("data-view"), "bar");
    assert.equal(time(c), "01:30");
  }));

test("timer: iniciar, contar, pausar, continuar, zerar", () =>
  withApp(async (c) => {
    fake(c); open(c);
    c.click(btn(c, "toggle"));
    assert.equal(st(c).mode, "running");
    c.advance(30000);
    assert.equal(time(c), "01:00");
    c.click(btn(c, "toggle")); // pausa
    assert.equal(st(c).mode, "paused");
    c.advance(60000);
    assert.equal(time(c), "01:00", "pausado não anda");
    c.click(btn(c, "toggle")); // continua
    c.advance(10000);
    assert.equal(time(c), "00:50");
    c.click(btn(c, "reset"));
    assert.equal(st(c).mode, "idle");
    assert.equal(time(c), "01:30");
  }));

test("timer: fim do tempo vira 'done', vibra e não quebra sem AudioContext", () =>
  withApp(async (c) => {
    fake(c); open(c);
    c.click(btn(c, "toggle"));
    c.advance(90000);
    assert.equal(st(c).mode, "done");
    assert.equal(time(c), "00:00");
    assert.equal(c.vibrations, 1);
    assert.equal(wrap(c).getAttribute("data-mode"), "done");
  }));

test("timer: aviso percebido muito depois (aba em segundo plano) não vibra, mas mostra que acabou", () =>
  withApp(async (c) => {
    fake(c); open(c);
    c.click(btn(c, "toggle"));
    c.advance(90000 + 5 * 60000);
    assert.equal(st(c).mode, "done");
    assert.equal(c.vibrations, 0);
  }));

test("timer: voltar para a aba (visibilitychange) recalcula na hora", () =>
  withApp(async (c) => {
    fake(c); open(c);
    c.click(btn(c, "toggle"));
    c.advance(20000);
    c.d.dispatchEvent(new c.w.Event("visibilitychange"));
    assert.equal(time(c), "01:10");
  }));

test("timer: ±15 s e atalhos 60/90/120, com limites de 5 s a 15 min", () =>
  withApp(async (c) => {
    fake(c); open(c);
    c.click(btn(c, "preset", "120"));
    assert.equal(time(c), "02:00");
    c.click(btn(c, "adj", "15"));
    assert.equal(time(c), "02:15");
    c.click(btn(c, "adj", "-15")); c.click(btn(c, "adj", "-15"));
    assert.equal(time(c), "01:45");
    c.click(btn(c, "toggle"));
    c.advance(20000);
    c.click(btn(c, "adj", "15")); // contando: mexe no que falta (105 - 20 + 15 = 100 s)
    assert.equal(time(c), "01:40");
    c.click(btn(c, "preset", "60")); // contando: reinicia com 60
    assert.equal(st(c).mode, "running");
    assert.equal(time(c), "01:00");
    c.click(btn(c, "reset"));
    for (let i = 0; i < 20; i++) c.click(btn(c, "adj", "-15"));
    assert.equal(st(c).seconds, 5);
    for (let i = 0; i < 100; i++) c.click(btn(c, "adj", "15"));
    assert.equal(st(c).seconds, 900);
  }));

// ---------- início automático ----------
test("timer: salvar carga válida de hoje inicia o descanso e abre a barra", () =>
  withApp(async (c) => {
    fake(c);
    await c.typeLoad("seg_ex0_s0", "20");
    assert.equal(st(c).mode, "running");
    assert.equal(wrap(c).getAttribute("data-view"), "bar");
  }));

test("timer: reps feitas também contam como série concluída", () =>
  withApp(async (c) => {
    fake(c);
    await c.typeLoad("seg_ex0_s0", "12", "repsDone");
    assert.equal(st(c).mode, "running");
  }));

test("timer: carga inválida, zero ou campo apagado NÃO iniciam", () =>
  withApp(async (c) => {
    fake(c);
    await c.typeLoad("seg_ex0_s0", "abc");
    assert.equal(st(c).mode, "idle");
    assert.equal(c.input("seg_ex0_s0", "weight").value, "");
    await c.typeLoad("seg_ex0_s0", "-5");
    assert.equal(st(c).mode, "idle");
    await c.typeLoad("seg_ex0_s0", "0");
    assert.equal(st(c).mode, "idle");
    await c.typeLoad("seg_ex0_s0", "20");
    c.click(btn(c, "reset"));
    await c.typeLoad("seg_ex0_s0", "");
    assert.equal(st(c).mode, "idle");
  }));

test("timer: o 2º campo da MESMA série não reinicia; outra série reinicia", () =>
  withApp(async (c) => {
    fake(c);
    await c.typeLoad("seg_ex0_s0", "20");
    c.advance(40000);
    await c.typeLoad("seg_ex0_s0", "12", "repsDone");
    assert.equal(st(c).remainingMs, 50000, "seguiu contando");
    await c.typeLoad("seg_ex0_s1", "22");
    assert.equal(st(c).remainingMs, 90000, "série nova: recomeçou");
  }));

test("timer: interruptor 'Iniciar ao salvar série' desligado não inicia (e é lembrado)", () =>
  withApp(async (c) => {
    fake(c); open(c);
    c.click(btn(c, "auto"));
    assert.equal(st(c).auto, false);
    await c.typeLoad("seg_ex0_s0", "20");
    assert.equal(st(c).mode, "idle");
    assert.equal(c.store.json(KEY).auto, false);
  }));

test("timer: data passada escolhida na mão não inicia", () =>
  withApp(async (c) => {
    fake(c);
    await c.setDate("2020-01-10");
    await c.typeLoad("seg_ex0_s0", "20");
    assert.equal(st(c).mode, "idle");
    assert.equal(c.store.json("treino:seg").seg_ex0_s0[0].weight, 20, "a carga foi salva normalmente");
  }));

test("timer: histórico ilegível (salvamento bloqueado) não inicia e nada é sobrescrito", () => {
  const store = makeStore({ "treino:seg": "isto não é json" });
  return withApp({ store }, async (c) => {
    fake(c);
    assert.ok(c.$(".daywarn"));
    await c.typeLoad("seg_ex0_s0", "20");
    assert.equal(st(c).mode, "idle");
    assert.equal(store.map.get("treino:seg"), "isto não é json");
  });
});

test("timer: falha ao salvar a carga ('Erro ao salvar') não inicia", () => {
  const store = makeStore();
  return withApp({ store }, async (c) => {
    fake(c);
    store.failWrite.add("treino:seg");
    await c.typeLoad("seg_ex0_s0", "20");
    assert.equal(c.$("#toast").textContent, "Erro ao salvar");
    assert.equal(st(c).mode, "idle");
  });
});

// ---------- convivência com o resto do app ----------
test("timer: trocar de aba (dia) não reseta nem esconde a contagem", () =>
  withApp(async (c) => {
    fake(c);
    await c.typeLoad("seg_ex0_s0", "20");
    c.advance(10000);
    await c.tab(1);
    assert.equal(st(c).mode, "running");
    assert.equal(wrap(c).hidden, false);
    assert.equal(st(c).remainingMs, 80000);
  }));

test("timer: no editor a barra some; ao fechar volta, ainda contando", () =>
  withApp(async (c) => {
    fake(c);
    await c.typeLoad("seg_ex0_s0", "20");
    await c.openEditor();
    assert.equal(wrap(c).hidden, true);
    assert.equal(c.d.body.classList.contains("rt-pad-bar"), false);
    c.click(c.$("#editToggle")); // fecha sem alterações
    await c.readyNormal();
    await waitFor(() => wrap(c).hidden === false, "barra de volta");
    assert.equal(st(c).mode, "running");
  }));

test("timer: não altera treino nem histórico — só cria a chave da preferência", () =>
  withApp(async (c) => {
    fake(c);
    await c.typeLoad("seg_ex0_s0", "20");
    open(c); c.click(btn(c, "preset", "120"));
    await c.idle();
    assert.deepEqual([...c.store.map.keys()].sort(), ["treino:seg", "treino:timer"]);
    const hist = c.store.json("treino:seg");
    assert.deepEqual(Object.keys(hist), ["seg_ex0_s0"]);
  }));

test("timer: o app com o treino editado/migrado continua igual (histórico antigo intacto)", () =>
  withApp({ seed: { "treino:seg": { "0_0": [{ date: "2020-01-10", weight: 20, repsDone: "10" }] } } }, async (c) => {
    fake(c);
    await c.typeLoad("seg_ex0_s0", "22");
    const h = c.store.json("treino:seg");
    assert.equal(h.seg_ex0_s0.length, 2);
    assert.equal(h.seg_ex0_s0[0].weight, 20);
  }));

// ---------- preferência do aparelho ----------
test("timer: preferência guardada é lida ao abrir", () =>
  withApp({ seed: { [KEY]: { seconds: 120, auto: false, sound: false } } }, async (c) => {
    await waitFor(() => st(c).seconds === 120, "preferência lida");
    assert.equal(st(c).auto, false);
    assert.equal(st(c).sound, false);
    open(c);
    assert.equal(time(c), "02:00");
    assert.equal(btn(c, "auto").getAttribute("aria-pressed"), "false");
    assert.equal(btn(c, "sound").getAttribute("aria-pressed"), "false");
  }));

test("timer: preferência corrompida ou inválida cai no padrão sem quebrar nada", async () => {
  await withApp({ seed: { [KEY]: "{{{ lixo" } }, async (c) => {
    await c.idle(80);
    assert.equal(st(c).seconds, 90);
    assert.equal(st(c).auto, true);
    assert.equal(c.log.alerts.length, 0);
  });
  await withApp({ seed: { [KEY]: { seconds: 99999, auto: "talvez" } } }, async (c) => {
    await waitFor(() => st(c).seconds === 900, "valor limitado a 15 min");
    assert.equal(st(c).auto, true);
  });
});

test("timer: falha ao ler ou gravar a preferência não atrapalha nem mostra alerta", async () => {
  const s1 = makeStore({ [KEY]: { seconds: 120 } });
  s1.failRead.add(KEY);
  await withApp({ store: s1 }, async (c) => {
    await c.idle(100);
    assert.equal(st(c).seconds, 90);
    await c.typeLoad("seg_ex0_s0", "20");
    assert.equal(c.store.json("treino:seg").seg_ex0_s0[0].weight, 20);
    assert.equal(c.log.alerts.length, 0);
  });
  const s2 = makeStore();
  s2.failWrite.add(KEY);
  await withApp({ store: s2 }, async (c) => {
    open(c);
    c.click(btn(c, "preset", "120"));
    await c.idle(100);
    assert.equal(st(c).seconds, 120);
    assert.equal(c.log.alerts.length, 0);
  });
});

test("timer: leitura lenta da preferência não desfaz a escolha feita antes dela terminar", () => {
  const store = makeStore({ [KEY]: { seconds: 60, auto: true, sound: true } });
  store.delay.set(KEY, 250);
  return withApp({ store }, async (c) => {
    open(c);
    c.click(btn(c, "preset", "120"));
    await c.idle(500);
    assert.equal(st(c).seconds, 120);
    assert.equal(c.store.json(KEY).seconds, 120);
  });
});

test("timer: é preferência do aparelho — não entra no backup e importar não a altera", async () => {
  let texto;
  const prefs = JSON.stringify({ seconds: 120, auto: false, sound: true });
  await withApp({ seed: { [KEY]: prefs, "treino:seg": { seg_ex0_s0: [{ date: "2020-01-10", weight: 20 }] } } }, async (c) => {
    c.click(c.$("#exportBackup"));
    await waitFor(() => c.log.downloads.length, "download");
    texto = c.log.downloads[0].text;
    assert.doesNotMatch(texto, /timer|seconds|"auto"|"sound"/i);
  });
  const outra = JSON.stringify({ seconds: 60, auto: true, sound: false });
  await withApp({ seed: { [KEY]: outra } }, async (c) => {
    await c.importFile(texto);
    await waitFor(() => c.$("#toast").textContent === "Backup importado", "importado");
    assert.equal(c.store.map.get(KEY), outra);
  });
});

// ---------- visual / markup ----------
test("timer (visual): botões só de ícone têm rótulo acessível e SVG; alvos de toque >= 40px", () =>
  withApp(async (c) => {
    for (const a of ["open", "toggle", "reset", "close"]) {
      const b = btn(c, a);
      assert.ok(b.getAttribute("aria-label"), a + " sem aria-label");
      assert.ok(b.querySelector("svg"), a + " sem ícone");
    }
    const alvo = (re, prop, min) => {
      const m = re.exec(CSS);
      assert.ok(m, "regra não encontrada: " + re);
      const v = new RegExp(prop + ":\\s*(\\d+)px").exec(m[1]);
      assert.ok(v && +v[1] >= min, re + " " + prop + " < " + min);
    };
    alvo(/\.rt-btn\s*\{([^}]*)\}/, "width", 40);
    alvo(/\.rt-btn\s*\{([^}]*)\}/, "height", 40);
    alvo(/\.rt-fab\s*\{([^}]*)\}/, "width", 40);
    alvo(/\.rt-fab\s*\{([^}]*)\}/, "height", 40);
    alvo(/\.rt-chip\s*\{([^}]*)\}/, "min-height", 40);
    alvo(/\.rt-toggle\s*\{([^}]*)\}/, "min-height", 40);
  }));

test("timer (visual): sem emoji/glifos nos botões; ícones novos existem e herdam a cor", () =>
  withApp(async (c) => {
    const glifo = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\u2800-\u28FF\u2190-\u21FF]/u;
    open(c);
    const texto = [...c.$$("#restTimer button")].map((b) => b.textContent).join("|");
    assert.doesNotMatch(texto, glifo);
    assert.doesNotMatch(SRC.replace(/\u2212/g, ""), glifo, "sem glifos no código do timer");
    for (const n of ["play", "pause", "rotate-ccw", "clock", "volume", "volume-off"]) {
      const s = c.T.icon(n);
      assert.match(s, /^<svg /, n);
      assert.match(s, /currentColor/, n);
      assert.match(s, /aria-hidden="true"/, n);
    }
  }));

test("timer (visual): cada token --timer-* existe nos dois temas e o CSS não usa cor fixa nele", () => {
  const usados = new Set();
  CSS.replace(/var\(--(timer-[a-z-]+)/g, (_, k) => { usados.add(k); return ""; });
  assert.ok(usados.size >= 8);
  const escuro = /:root\s*\{([^}]*)\}/.exec(CSS)[1];
  const claro = /:root\[data-theme="light"\]\s*\{([^}]*)\}/.exec(CSS)[1];
  for (const k of usados) {
    assert.ok(escuro.includes("--" + k + ":"), "falta no escuro: --" + k);
    assert.ok(claro.includes("--" + k + ":"), "falta no claro: --" + k);
  }
});
