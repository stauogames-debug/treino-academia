window.Treino = window.Treino || {};

// ---- Gráfico de evolução das cargas (aba "Evolução") ----
// SÓ LEITURA: não grava nada. Para cada exercício mostra a carga de cada SÉRIE
// DE TRABALHO (faixa, tipo "6 a 8") nas datas anotadas. Séries só numéricas
// (aquecimento) ficam de fora, como na meta. Tudo por id ("idEx_idSerie").

Treino.EVO_MAX_DATAS = 12;
Treino.EVO_CLASSES = 5; // classes de cor cíclicas: evo-s0 .. evo-s4

function evoTodayISO(){
  var d = new Date(), p = function(n){ return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function evoEscape(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function evoIsWork(reps){
  return /^\s*\d+\s*(?:a|-|–)\s*\d+\s*$/i.test(String(reps == null ? "" : reps));
}
function evoValidWeight(w){ return typeof w === "number" && isFinite(w) && w > 0; }

// exercicio: { id, sets:[{id, reps}] } (dia efetivo) · hist: histórico do dia
// hojeISO: só datas até hoje entram (futuras são ignoradas)
Treino.evolucaoDados = function(exercicio, hist, hojeISO){
  var hoje = hojeISO || evoTodayISO();
  if(!exercicio || !exercicio.sets) return { sets: [], datas: [] };
  var sets = [];
  exercicio.sets.forEach(function(s, i){
    if(evoIsWork(s.reps)){
      sets.push({ id: s.id, label: "S" + (i + 1), reps: String(s.reps).trim(), points: [] });
    }
  });
  var seen = {};
  sets.forEach(function(s){
    ((hist && hist[exercicio.id + "_" + s.id]) || []).forEach(function(e){
      if(!e || typeof e.date !== "string" || e.date > hoje || !evoValidWeight(e.weight)) return;
      s.points.push({ date: e.date, weight: e.weight });
      seen[e.date] = true;
    });
    s.points.sort(function(a, b){ return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  });
  var todas = Object.keys(seen).sort();
  var datas = todas.slice(Math.max(0, todas.length - Treino.EVO_MAX_DATAS));
  sets.forEach(function(s){
    s.points = s.points.filter(function(p){ return datas.indexOf(p.date) !== -1; });
  });
  return { sets: sets, datas: datas };
};

// SVG desenhado à mão (sem biblioteca). Cores vêm das classes evo-s* (tokens do
// tema). Devolve "" quando não há nenhuma carga para mostrar.
Treino.svgEvolucao = function(dados){
  if(!dados || !dados.datas || !dados.datas.length) return "";
  var pesos = [];
  dados.sets.forEach(function(s){ s.points.forEach(function(p){ pesos.push(p.weight); }); });
  if(!pesos.length) return "";

  var W = 320, H = 180, L = 40, R = 12, T = 14, B = 26;
  var realMin = Math.min.apply(null, pesos), realMax = Math.max.apply(null, pesos);
  var min = realMin, max = realMax;
  if(min === max){ min -= 1; max += 1; }   // evita divisão por zero
  var n = dados.datas.length;
  var xOf = function(i){ return n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1); };
  var yOf = function(w){ return T + (max - w) * (H - T - B) / (max - min); };
  var fmt = function(v){ return String(Math.round(v * 10) / 10); };
  var dd = function(iso){ return iso.slice(8, 10) + "/" + iso.slice(5, 7); };

  var out = [];
  out.push('<line class="evo-grid" x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B) + '"/>');
  out.push('<line class="evo-grid" x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '"/>');
  out.push('<text class="evo-axis" x="' + (L - 6) + '" y="' + (T + 4) + '" text-anchor="end">' + fmt(realMax) + ' kg</text>');
  out.push('<text class="evo-axis" x="' + (L - 6) + '" y="' + (H - B) + '" text-anchor="end">' + fmt(realMin) + '</text>');
  if(n === 1){
    out.push('<text class="evo-axis" x="' + xOf(0) + '" y="' + (H - 6) + '" text-anchor="middle">' + dd(dados.datas[0]) + '</text>');
  } else {
    out.push('<text class="evo-axis" x="' + xOf(0) + '" y="' + (H - 6) + '" text-anchor="start">' + dd(dados.datas[0]) + '</text>');
    out.push('<text class="evo-axis" x="' + xOf(n - 1) + '" y="' + (H - 6) + '" text-anchor="end">' + dd(dados.datas[n - 1]) + '</text>');
  }

  dados.sets.forEach(function(s, si){
    var cls = "evo-s" + (si % Treino.EVO_CLASSES);
    var pts = s.points.map(function(p){
      return { x: xOf(dados.datas.indexOf(p.date)), y: yOf(p.weight) };
    });
    if(pts.length >= 2){
      out.push('<polyline class="evo-line ' + cls + '" points="' +
        pts.map(function(p){ return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ") + '"/>');
    }
    pts.forEach(function(p){
      out.push('<circle class="evo-dot ' + cls + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3"/>');
    });
  });

  return '<svg class="evo-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
    'aria-label="Gráfico da carga de cada série de trabalho ao longo das datas" ' +
    'xmlns="http://www.w3.org/2000/svg">' + out.join("") + "</svg>";
};

// ---- Tela ----

function evoLerDia(d){
  return new Promise(function(resolve){
    Treino.loadDayEdit(d.slug, function(editData, editFailed){
      Treino.loadDayHistory(d.slug, function(hist, histFailed){
        var eff = Treino.effectiveDay(d, editData);
        var failed = !!(editFailed || histFailed);
        resolve({
          day: d,
          eff: eff,
          failed: failed,
          hist: failed ? {} : Treino.migrateHistoryKeys(eff, hist).hist
        });
      });
    });
  });
}

function evoDetailHtml(ex, hist){
  var dados = Treino.evolucaoDados(ex, hist);
  var svg = Treino.svgEvolucao(dados);
  if(!svg){
    return '<div class="hint">Ainda não há cargas anotadas nas séries de trabalho deste exercício.</div>';
  }
  var legenda = dados.sets.map(function(s, i){
    return '<span class="evo-key evo-s' + (i % Treino.EVO_CLASSES) + '"><span class="evo-sw"></span>' +
      evoEscape(s.label + " · " + s.reps) + "</span>";
  }).join("");
  return '<div class="evo-legend">' + legenda + "</div>" + svg;
}

// Monta a aba dentro de "root" (o #body). Só lê o storage; nunca grava.
Treino.mountEvolucao = function(root){
  if(!root) return;
  root.innerHTML = '<div class="hint">Toque em um exercício para ver a carga de cada série de trabalho ao longo das datas.</div><div id="evoList"></div>';
  var list = root.querySelector("#evoList");
  Promise.all(Treino.DAYS.map(evoLerDia)).then(function(dias){
    if(!root.isConnected) return; // o usuário já saiu desta tela
    var html = "";
    dias.forEach(function(dia){
      html += '<div class="evo-day"><div class="evo-day-title">' + evoEscape(dia.eff.full) + "</div>";
      if(dia.failed){
        html += '<div class="daywarn evo-warn">Não foi possível ler este dia. Recarregue a página.</div></div>';
        return;
      }
      dia.eff.exercises.forEach(function(ex, i){
        html += '<div class="evo-card"><button type="button" class="evo-ex" aria-expanded="false" data-slug="' +
          evoEscape(dia.day.slug) + '" data-exidx="' + i + '">' + evoEscape(ex.name) +
          (ex.ref ? '<span class="ex-ref">' + evoEscape(ex.ref) + "</span>" : "") +
          '</button><div class="evo-detail" hidden></div></div>';
      });
      html += "</div>";
    });
    list.innerHTML = html;

    list.addEventListener("click", function(ev){
      var b = ev.target && ev.target.closest ? ev.target.closest(".evo-ex") : null;
      if(!b || !list.contains(b)) return;
      var det = b.parentNode.querySelector(".evo-detail");
      var abrir = det.hidden;
      list.querySelectorAll(".evo-detail").forEach(function(x){ x.hidden = true; });
      list.querySelectorAll(".evo-ex").forEach(function(x){ x.setAttribute("aria-expanded", "false"); });
      if(!abrir) return;
      var slug = b.getAttribute("data-slug");
      var idx = parseInt(b.getAttribute("data-exidx"), 10);
      var dia = dias.filter(function(x){ return x.day.slug === slug; })[0];
      det.innerHTML = evoDetailHtml(dia.eff.exercises[idx], dia.hist);
      det.hidden = false;
      b.setAttribute("aria-expanded", "true");
    });
  });
};