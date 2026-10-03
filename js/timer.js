window.Treino = window.Treino || {};

// ---- Temporizador de descanso entre séries ----
//
// Barra fixa no rodapé (fora do #app, então render() não a apaga). Só existe
// no modo normal: no editor ela fica escondida (app.js avisa via
// Treino.timerSetEditing). Não grava nada de treino/histórico; a única coisa
// que persiste é a PREFERÊNCIA do aparelho em "treino:timer"
// ({ seconds, auto, sound }), igual ao tema: fora do backup, a importação não
// mexe nela e falha de leitura/gravação nunca atrapalha o app.
//
// Precisão: guarda o instante de término (endAt) e calcula o restante a
// partir dele, em vez de contar "ticks" (o navegador atrasa timers com a aba
// em segundo plano). Ao voltar para a aba/janela, recalcula na hora.

Treino.TIMER_KEY = "treino:timer";
Treino.TIMER_MIN_S = 5;
Treino.TIMER_MAX_S = 15 * 60;
Treino.TIMER_DEFAULT_S = 90;
Treino.TIMER_PRESETS = [60, 90, 120];
Treino.TIMER_STEP_S = 15;

// ---- funções puras (testáveis sem tela) ----

// Qualquer valor -> segundos inteiros entre MIN e MAX (inválido -> padrão).
Treino.clampSeconds = function(n){
  var x = (typeof n === "number") ? n : parseFloat(n);
  if(!isFinite(x)) return Treino.TIMER_DEFAULT_S;
  x = Math.round(x);
  return Math.min(Treino.TIMER_MAX_S, Math.max(Treino.TIMER_MIN_S, x));
};

// 90 -> "01:30". Arredonda para cima: o contador só mostra 00:00 no fim.
Treino.formatMMSS = function(sec){
  var s = Math.max(0, Math.ceil(Number(sec) || 0));
  var p = function(n){ return (n < 10 ? "0" : "") + n; };
  return p(Math.floor(s / 60)) + ":" + p(s % 60);
};

Treino.remainingMs = function(endAt, now){
  return Math.max(0, endAt - now);
};

// Preferência guardada (objeto ou texto JSON) -> { seconds, auto, sound }.
Treino.normalizeTimerPrefs = function(v){
  if(typeof v === "string"){ try { v = JSON.parse(v); } catch(e){ v = null; } }
  if(!v || typeof v !== "object" || Array.isArray(v)) v = {};
  return {
    seconds: Treino.clampSeconds(v.seconds),
    auto: v.auto !== false,
    sound: v.sound !== false
  };
};

(function(){
  // Se o aviso só for percebido muito depois (aba em segundo plano), não
  // vibra/apita no susto: só mostra que acabou.
  var OVERDUE_SILENT_MS = 10000;

  var st = {
    mode: "idle",            // idle | running | paused | done
    seconds: Treino.TIMER_DEFAULT_S,
    auto: true,
    sound: true,
    endAt: 0,
    leftMs: 0,
    lastKey: "",             // série que iniciou a contagem (evita reiniciar ao salvar o 2º campo)
    opened: false,           // painel aberto sem estar contando
    editing: false
  };
  var prefsTouched = false;  // o usuário já mexeu nesta sessão: leitura tardia não sobrescreve
  var ticker = null;
  var audio = null;
  var el = null;

  function now(){ return Date.now(); }

  // ---- preferência do aparelho ----

  function savePrefs(){
    prefsTouched = true;
    try {
      Promise.resolve(Treino.storageSet(Treino.TIMER_KEY, JSON.stringify({
        seconds: st.seconds, auto: st.auto, sound: st.sound
      }))).catch(function(){});
    } catch(e){}
  }

  function loadPrefs(){
    try {
      Treino.storageGet(Treino.TIMER_KEY).then(function(res){
        if(prefsTouched) return;
        if(res && res.value){
          var p = Treino.normalizeTimerPrefs(res.value);
          st.auto = p.auto;
          st.sound = p.sound;
          if(st.mode === "idle" || st.mode === "done") st.seconds = p.seconds;
          paint();
        }
      }, function(){});
    } catch(e){}
  }

  // ---- aviso sonoro / vibração (tudo em try/catch: nunca atrapalha o app) ----

  // Navegadores só liberam áudio depois de um toque. Qualquer toque no app
  // prepara o áudio, então o apito do fim da contagem pode tocar.
  function unlockAudio(){
    try {
      if(audio){
        if(audio.state === "suspended" && audio.resume) audio.resume();
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      audio = new AC();
      if(audio.state === "suspended" && audio.resume) audio.resume();
    } catch(e){ audio = null; }
  }

  function beep(){
    try {
      if(!audio) return;
      if(audio.state === "suspended" && audio.resume) audio.resume();
      var t0 = audio.currentTime;
      [0, 0.35, 0.7].forEach(function(off, i){
        var o = audio.createOscillator();
        var g = audio.createGain();
        o.type = "sine";
        o.frequency.value = (i === 2) ? 1100 : 880;
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.25);
        o.connect(g);
        g.connect(audio.destination);
        o.start(t0 + off);
        o.stop(t0 + off + 0.3);
      });
    } catch(e){}
  }

  function alarm(){
    try { if(navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 500]); } catch(e){}
    if(st.sound) beep();
  }

  // ---- contagem ----

  function startTicker(){
    if(ticker) return;
    ticker = window.setInterval(tick, 250);
  }
  function stopTicker(){
    if(ticker){ window.clearInterval(ticker); ticker = null; }
  }

  function tick(){
    if(st.mode !== "running") return;
    var t = now();
    if(Treino.remainingMs(st.endAt, t) <= 0){ finish(t - st.endAt); return; }
    paintTime();
  }

  function finish(overdueMs){
    st.mode = "done";
    st.leftMs = 0;
    stopTicker();
    if(overdueMs < OVERDUE_SILENT_MS) alarm();
    paint();
  }

  function start(sec){
    sec = Treino.clampSeconds(sec);
    st.mode = "running";
    st.leftMs = sec * 1000;
    st.endAt = now() + st.leftMs;
    startTicker();
    paint();
  }

  function pause(){
    if(st.mode !== "running") return;
    st.leftMs = Treino.remainingMs(st.endAt, now());
    st.mode = "paused";
    stopTicker();
    paint();
  }

  function resume(){
    if(st.mode !== "paused") return;
    st.endAt = now() + st.leftMs;
    st.mode = "running";
    startTicker();
    paint();
  }

  function toggle(){
    if(st.mode === "running") pause();
    else if(st.mode === "paused") resume();
    else start(st.seconds);
  }

  function reset(){
    stopTicker();
    st.mode = "idle";
    st.leftMs = 0;
    st.lastKey = "";
    paint();
  }

  function closeBar(){
    st.opened = false;
    reset();
  }

  // ±15 s: com a contagem em andamento/pausada mexe no tempo que falta;
  // parado, muda a duração escolhida.
  function adjust(deltaS){
    var maxMs = Treino.TIMER_MAX_S * 1000;
    if(st.mode === "running"){
      var left = Math.min(maxMs, Treino.remainingMs(st.endAt, now()) + deltaS * 1000);
      if(left <= 0){ finish(0); return; }
      st.endAt = now() + left;
      paint();
    } else if(st.mode === "paused"){
      st.leftMs = Math.min(maxMs, Math.max(1000, st.leftMs + deltaS * 1000));
      paint();
    } else {
      st.mode = "idle";
      st.seconds = Treino.clampSeconds(st.seconds + deltaS);
      savePrefs();
      paint();
    }
  }

  // Atalho de duração: contando/pausado reinicia com a nova duração; parado só seleciona.
  function preset(sec){
    st.seconds = Treino.clampSeconds(sec);
    savePrefs();
    if(st.mode === "running" || st.mode === "paused") start(st.seconds);
    else { st.mode = "idle"; paint(); }
  }

  // ---- tela ----

  var STATUS = { idle: "Descanso", running: "Descansando", paused: "Pausado", done: "Descanso acabou" };
  var PLAY_LABEL = { idle: "Iniciar descanso", running: "Pausar", paused: "Continuar", done: "Iniciar de novo" };

  function msShown(){
    if(st.mode === "running") return Treino.remainingMs(st.endAt, now());
    if(st.mode === "paused") return st.leftMs;
    if(st.mode === "done") return 0;
    return st.seconds * 1000;
  }

  function paintTime(){
    if(!el) return;
    var t = el.querySelector(".rt-time");
    if(t) t.textContent = Treino.formatMMSS(msShown() / 1000);
  }

  function paint(){
    if(!el) return;
    var view = (st.mode === "idle" && !st.opened) ? "fab" : "bar";
    el.hidden = st.editing;
    el.setAttribute("data-mode", st.mode);
    el.setAttribute("data-view", view);
    document.body.classList.toggle("rt-pad-fab", !st.editing && view === "fab");
    document.body.classList.toggle("rt-pad-bar", !st.editing && view === "bar");
    paintTime();

    var status = el.querySelector(".rt-status");
    if(status && status.textContent !== STATUS[st.mode]) status.textContent = STATUS[st.mode];

    var play = el.querySelector('[data-act="toggle"]');
    if(play){
      play.innerHTML = Treino.icon(st.mode === "running" ? "pause" : "play");
      play.setAttribute("aria-label", PLAY_LABEL[st.mode]);
      play.setAttribute("title", PLAY_LABEL[st.mode]);
    }
    el.querySelectorAll('[data-act="preset"]').forEach(function(b){
      b.setAttribute("aria-pressed", String(parseInt(b.getAttribute("data-v"), 10) === st.seconds));
    });
    var auto = el.querySelector('[data-act="auto"]');
    if(auto) auto.setAttribute("aria-pressed", String(st.auto));
    var snd = el.querySelector('[data-act="sound"]');
    if(snd){
      snd.setAttribute("aria-pressed", String(st.sound));
      snd.querySelector(".rt-ico").innerHTML = Treino.icon(st.sound ? "volume" : "volume-off");
    }
  }

  function build(){
    el = document.createElement("div");
    el.className = "rt-wrap";
    el.id = "restTimer";
    el.setAttribute("data-mode", "idle");
    el.setAttribute("data-view", "fab");
    el.innerHTML =
      '<div class="rt-inner">' +
        '<button type="button" class="rt-fab" data-act="open" aria-label="Abrir temporizador de descanso" title="Temporizador de descanso">' + Treino.icon("clock") + "</button>" +
        '<div class="rt-bar" role="group" aria-label="Temporizador de descanso">' +
          '<div class="rt-row rt-main">' +
            '<div class="rt-time" role="timer" aria-live="off">00:00</div>' +
            '<div class="rt-status" aria-live="polite"></div>' +
            '<button type="button" class="rt-btn rt-play" data-act="toggle"></button>' +
            '<button type="button" class="rt-btn rt-reset" data-act="reset" aria-label="Zerar" title="Zerar">' + Treino.icon("rotate-ccw") + "</button>" +
            '<button type="button" class="rt-btn rt-close" data-act="close" aria-label="Fechar temporizador" title="Fechar">' + Treino.icon("x") + "</button>" +
          "</div>" +
          '<div class="rt-row rt-chips">' +
            '<button type="button" class="rt-chip" data-act="adj" data-v="-' + Treino.TIMER_STEP_S + '" aria-label="Menos ' + Treino.TIMER_STEP_S + ' segundos">−' + Treino.TIMER_STEP_S + "</button>" +
            Treino.TIMER_PRESETS.map(function(s){
              return '<button type="button" class="rt-chip" data-act="preset" data-v="' + s + '" aria-pressed="false">' + s + "s</button>";
            }).join("") +
            '<button type="button" class="rt-chip" data-act="adj" data-v="' + Treino.TIMER_STEP_S + '" aria-label="Mais ' + Treino.TIMER_STEP_S + ' segundos">+' + Treino.TIMER_STEP_S + "</button>" +
          "</div>" +
          '<div class="rt-row rt-settings">' +
            '<button type="button" class="rt-toggle" data-act="auto" aria-pressed="true">Iniciar ao salvar série</button>' +
            '<button type="button" class="rt-toggle" data-act="sound" aria-pressed="true"><span class="rt-ico"></span>Som</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    document.body.appendChild(el);

    el.addEventListener("click", function(ev){
      var b = ev.target && ev.target.closest ? ev.target.closest("[data-act]") : null;
      if(!b || !el.contains(b)) return;
      unlockAudio();
      var act = b.getAttribute("data-act");
      var v = parseInt(b.getAttribute("data-v"), 10);
      if(act === "open"){ st.opened = true; paint(); }
      else if(act === "toggle") toggle();
      else if(act === "reset") reset();
      else if(act === "close") closeBar();
      else if(act === "adj") adjust(v);
      else if(act === "preset") preset(v);
      else if(act === "auto"){ st.auto = !st.auto; savePrefs(); paint(); }
      else if(act === "sound"){ st.sound = !st.sound; savePrefs(); paint(); }
    });

    paint();
  }

  function init(){
    if(el || !document.body) return;
    build();
    loadPrefs();
    document.addEventListener("pointerdown", unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);
    document.addEventListener("visibilitychange", function(){
      if(document.visibilityState === "visible") tick();
    });
    window.addEventListener("focus", tick);
  }

  // ---- ganchos usados pelo app.js ----

  // Chamado depois que uma série foi SALVA com sucesso (carga > 0 ou reps
  // feitas). "key" identifica a série+data: salvar o 2º campo da mesma série
  // não reinicia a contagem. Devolve true se iniciou.
  Treino.timerOnSetSaved = function(key){
    if(!st.auto || st.editing) return false;
    if(key && key === st.lastKey) return false;
    st.lastKey = key || "";
    start(st.seconds);
    return true;
  };

  // No editor de treino a barra fica escondida (a contagem continua em memória).
  Treino.timerSetEditing = function(editing){
    editing = !!editing;
    if(st.editing === editing) return;
    st.editing = editing;
    paint();
  };

  // Para testes e depuração.
  Treino.timerState = function(){
    return {
      mode: st.mode, seconds: st.seconds, auto: st.auto, sound: st.sound,
      remainingMs: msShown(), lastKey: st.lastKey, editing: st.editing
    };
  };
  Treino.timerTick = tick;

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
