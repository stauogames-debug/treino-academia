(function(){
  var DAYS = Treino.DAYS;
  var state = {
    day: 0,
    date: new Date().toISOString().slice(0,10),
    dateManual: false,   // true quando o usuário escolheu uma data diferente de hoje na mão
    history: {},
    editData: {},      // slug -> dados editados salvos (ou null)
    effective: {},      // slug -> dia efetivo atual (editado ou padrão), com ids
    editMode: false,
    draft: null          // cópia editável em uso enquanto editMode = true
  };
  var app = document.getElementById("app");

  function todayStr(){ return new Date().toISOString().slice(0,10); }

  // Se o app ficar aberto (aba/atalho) por vários dias sem recarregar, a data
  // ficaria travada no dia em que foi aberto e as cargas novas acabariam
  // sobrescrevendo o registro do dia antigo. Isso mantém a data em dia
  // sozinha, a menos que o usuário tenha escolhido uma data no passado
  // de propósito (para revisar/editar um treino antigo).
  function syncToday(){
    if(state.dateManual) return;
    var t = todayStr();
    if(t !== state.date){
      state.date = t;
      var dt = document.getElementById("dt");
      if(dt) dt.value = t;
      if(!state.editMode) renderBody();
    }
  }
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible") syncToday();
  });
  window.addEventListener("focus", syncToday);
  window.setInterval(syncToday, 30 * 60 * 1000);

  function showSavedToast(msg){
    var toast = document.getElementById("toast");
    if(!toast) return;
    if(msg) toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(function(){ toast.classList.remove("show"); }, 1200);
  }

  function currentOriginalDay(){ return DAYS[state.day]; }

  // Carrega (se preciso) os dados de edição do dia, calcula o dia efetivo
  // (com ids estáveis) e só então carrega + migra o histórico, porque a
  // migração das chaves antigas precisa saber quais ids estão em cada
  // posição hoje.
  function ensureEffective(slug, cb){
    if(state.effective[slug]){ cb(state.effective[slug]); return; }
    Treino.loadDayEdit(slug, function(editData){
      state.editData[slug] = editData;
      var orig = DAYS.filter(function(d){ return d.slug === slug; })[0];
      state.effective[slug] = Treino.effectiveDay(orig, editData);
      cb(state.effective[slug]);
    });
  }

  function loadHistoryMigrated(slug, eff, cb){
    Treino.loadDayHistory(slug, function(hist){
      var result = Treino.migrateHistoryKeys(eff, hist);
      state.history[slug] = result.hist;
      if(result.changed){
        Treino.storageSet("treino:" + slug, JSON.stringify(result.hist)).catch(function(){});
      }
      cb(result.hist);
    });
  }

  function render(){
    var origDay = currentOriginalDay();
    var slug = origDay.slug;
    var html = "";
    html += '<div class="hdr"><h1>Treino da semana</h1><p id="dayTitle">' + escapeHtml(origDay.full) + "</p></div>";
    html += '<div class="tabs">';
    DAYS.forEach(function(d, i){
      html += '<button class="tab' + (i===state.day?" active":"") + '" data-day="'+i+'">' + d.label + "</button>";
    });
    html += "</div>";
    html += '<div class="datebar"><label for="dt">Data do treino</label><div class="datebar-controls"><input type="date" id="dt" value="'+state.date+'">' + (state.dateManual ? '<button class="todaybtn" id="goToday">Hoje</button>' : "") + "</div></div>";
    html += '<div class="editbar"><button class="editbtn" id="editToggle">✏️ Editar treino</button></div>';
    html += '<div class="body" id="body"></div>';
    html += '<div class="toast" id="toast">Salvo</div>';
    app.innerHTML = html;

    document.querySelectorAll(".tab").forEach(function(btn){
      btn.addEventListener("click", function(){
        if(state.editMode){ exitEditMode(); }
        state.day = parseInt(this.getAttribute("data-day"), 10);
        render();
      });
    });
    document.getElementById("dt").addEventListener("change", function(){
      var v = this.value || todayStr();
      state.date = v;
      state.dateManual = (v !== todayStr());
      render();
    });
    var goTodayBtn = document.getElementById("goToday");
    if(goTodayBtn){
      goTodayBtn.addEventListener("click", function(){
        state.date = todayStr();
        state.dateManual = false;
        render();
      });
    }
    document.getElementById("editToggle").addEventListener("click", function(){
      if(state.editMode){ exitEditMode(); render(); }
      else { enterEditMode(); }
    });

    ensureEffective(slug, function(eff){
      loadHistoryMigrated(slug, eff, function(){
        renderBody();
      });
    });
  }

  function escapeHtml(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function dayStatusHtml(slug){
    var edited = !!state.editData[slug];
    return '<div class="daystatus ' + (edited ? "edited" : "default") + '">' +
      (edited ? "✎ Treino editado" : "● Treino padrão") + "</div>";
  }

  // ---------- Modo normal (registrar cargas) ----------

  function renderBody(){
    if(state.editMode){ renderEditBody(); return; }
    var origDay = currentOriginalDay();
    var slug = origDay.slug;
    var eff = state.effective[slug];
    if(!eff) return;
    var hist = state.history[slug] || {};
    var body = document.getElementById("body");
    if(!body) return;
    var html = dayStatusHtml(slug);
    html += '<div class="hint">Toque no campo amarelo e anote a carga (kg) de cada série.</div>';
    eff.exercises.forEach(function(ex){
      html += '<div class="exercise">';
      html += '<div class="ex-head">' + escapeHtml(ex.name) + (ex.ref ? '<div class="ex-ref">' + escapeHtml(ex.ref) + "</div>" : "") + "</div>";
      ex.sets.forEach(function(set, setIdx){
        var key = ex.id + "_" + set.id;
        var arr = hist[key] || [];
        var current = Treino.entryForDate(arr, state.date);
        var prev = Treino.lastEntryBefore(arr, state.date);
        var weightPlaceholder = (prev && prev.weight) ? (prev.weight + " kg") : "—";
        var repsPlaceholder = (prev && prev.repsDone) ? prev.repsDone : "reps";
        var weightVal = (current && current.weight) ? current.weight : "";
        var repsVal = (current && current.repsDone) ? current.repsDone : "";
        var prevHint = "";
        if(prev && (prev.weight || prev.repsDone)){
          prevHint = "última: ";
          if(prev.weight) prevHint += prev.weight + "kg";
          if(prev.repsDone) prevHint += (prev.weight ? " × " : "") + prev.repsDone + " reps";
          prevHint += " (" + prev.date.slice(5) + ")";
        }
        html += '<div class="set-row">';
        html += '<div class="set-tag">S' + (setIdx+1) + "</div>";
        html += '<div class="set-reps">' + escapeHtml(set.reps) + " reps" + (prevHint ? "<small>" + escapeHtml(prevHint) + "</small>" : "") + "</div>";
        html += '<div class="reps-input-wrap"><input class="reps-input" inputmode="numeric" data-key="' + key + '" data-field="repsDone" placeholder="' + escapeHtml(repsPlaceholder) + '" value="' + escapeHtml(repsVal) + '"></div>';
        html += '<div class="set-input-wrap"><input class="set-input" inputmode="decimal" data-key="' + key + '" data-field="weight" placeholder="' + escapeHtml(weightPlaceholder) + '" value="' + escapeHtml(weightVal) + '"><span class="set-unit">kg</span></div>';
        html += "</div>";
      });
      html += "</div>";
    });
    body.innerHTML = html;

    document.querySelectorAll(".set-input, .reps-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var key = this.getAttribute("data-key");
        var field = this.getAttribute("data-field"); // "weight" ou "repsDone"
        var raw = this.value.trim();
        var slug2 = currentOriginalDay().slug;
        var hist2 = state.history[slug2] || {};
        var patch = {};
        if(field === "weight"){
          raw = raw.replace(",", ".");
          if(raw === ""){
            patch.weight = undefined;
          } else {
            var w = parseFloat(raw);
            if(isNaN(w)) return;
            patch.weight = w;
          }
        } else {
          patch.repsDone = raw === "" ? undefined : raw;
        }
        hist2[key] = Treino.upsertEntry(hist2[key], state.date, patch);
        if(hist2[key] && hist2[key].length === 0) delete hist2[key];
        state.history[slug2] = hist2;
        Treino.storageSet("treino:" + slug2, JSON.stringify(hist2)).then(function(){
          showSavedToast("Salvo");
        }).catch(function(){});
      });
    });
  }

  // ---------- Modo de edição do treino ----------

  function enterEditMode(){
    var slug = currentOriginalDay().slug;
    var eff = state.effective[slug];
    if(!eff) return; // ainda carregando
    state.draft = Treino.cloneForEdit(eff);
    state.editMode = true;
    document.getElementById("editToggle").textContent = "✖ Fechar edição";
    renderBody();
  }

  function exitEditMode(){
    state.editMode = false;
    state.draft = null;
    var btn = document.getElementById("editToggle");
    if(btn) btn.textContent = "✏️ Editar treino";
  }

  function renderEditBody(){
    var body = document.getElementById("body");
    if(!body) return;
    var slug = currentOriginalDay().slug;
    var draft = state.draft;
    var html = dayStatusHtml(slug);
    html += '<div class="hint">Edite nomes, séries e referência. Toque em "Salvar treino" ao terminar.</div>';

    html += '<div class="edit-field"><label>Nome do dia</label>';
    html += '<input type="text" id="editFull" class="edit-input" value="' + escapeHtml(draft.full) + '"></div>';

    draft.exercises.forEach(function(ex, exIdx){
      html += '<div class="exercise edit-exercise" data-exidx="' + exIdx + '">';
      html += '<div class="ex-edit-row">';
      html += '<input type="text" class="edit-input ex-name-input" data-exidx="' + exIdx + '" value="' + escapeHtml(ex.name) + '" placeholder="Nome do exercício">';
      html += '<button class="icon-btn remove-ex" data-exidx="' + exIdx + '" title="Remover exercício">🗑</button>';
      html += "</div>";

      html += '<div class="edit-field"><label>Referência (opcional)</label>';
      html += '<input type="text" class="edit-input ex-ref-input" data-exidx="' + exIdx + '" value="' + escapeHtml(ex.ref) + '" placeholder="Ex.: Referência: 10-15-17kg"></div>';

      html += '<div class="sets-edit-label">Séries (reps)</div>';
      ex.sets.forEach(function(set, setIdx){
        html += '<div class="set-row edit-set-row">';
        html += '<div class="set-tag">S' + (setIdx+1) + "</div>";
        html += '<input type="text" class="edit-input set-edit-input" data-exidx="' + exIdx + '" data-setidx="' + setIdx + '" value="' + escapeHtml(set.reps) + '">';
        html += '<button class="icon-btn remove-set" data-exidx="' + exIdx + '" data-setidx="' + setIdx + '" title="Remover série">✕</button>';
        html += "</div>";
      });
      html += '<button class="addbtn add-set" data-exidx="' + exIdx + '">+ Adicionar série</button>';
      html += "</div>";
    });

    html += '<button class="addbtn add-ex" id="addExercise">+ Adicionar exercício</button>';

    html += '<div class="edit-actions">';
    html += '<button class="savebtn" id="saveEdit">Salvar treino</button>';
    html += '<button class="resetbtn" id="resetDay">Resetar dia para o padrão</button>';
    html += "</div>";

    body.innerHTML = html;
    bindEditEvents();
  }

  function bindEditEvents(){
    var draft = state.draft;

    document.getElementById("editFull").addEventListener("change", function(){
      draft.full = this.value.trim() || draft.full;
    });

    document.querySelectorAll(".ex-name-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        draft.exercises[i].name = this.value.trim() || draft.exercises[i].name;
      });
    });

    document.querySelectorAll(".ex-ref-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        draft.exercises[i].ref = this.value.trim();
      });
    });

    document.querySelectorAll(".set-edit-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        var j = parseInt(this.getAttribute("data-setidx"),10);
        draft.exercises[i].sets[j].reps = this.value.trim() || draft.exercises[i].sets[j].reps;
      });
    });

    document.querySelectorAll(".remove-ex").forEach(function(btn){
      btn.addEventListener("click", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        if(draft.exercises.length <= 1){
          alert("O dia precisa ter ao menos 1 exercício.");
          return;
        }
        if(!confirm('Remover "' + draft.exercises[i].name + '"? As cargas já anotadas para ele ficarão desassociadas.')) return;
        draft.exercises.splice(i,1);
        renderEditBody();
      });
    });

    document.querySelectorAll(".remove-set").forEach(function(btn){
      btn.addEventListener("click", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        var j = parseInt(this.getAttribute("data-setidx"),10);
        if(draft.exercises[i].sets.length <= 1){
          alert("O exercício precisa ter ao menos 1 série.");
          return;
        }
        draft.exercises[i].sets.splice(j,1);
        renderEditBody();
      });
    });

    document.querySelectorAll(".add-set").forEach(function(btn){
      btn.addEventListener("click", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        draft.exercises[i].sets.push({ id: Treino.makeId("s"), reps: "8" });
        renderEditBody();
      });
    });

    document.getElementById("addExercise").addEventListener("click", function(){
      draft.exercises.push({
        id: Treino.makeId("ex"),
        name: "Novo exercício",
        ref: "",
        sets: [{ id: Treino.makeId("s"), reps: "10" }]
      });
      renderEditBody();
    });

    document.getElementById("saveEdit").addEventListener("click", function(){
      var slug = currentOriginalDay().slug;
      var cleaned = {
        full: draft.full.trim(),
        exercises: draft.exercises
          .filter(function(ex){ return ex.name.trim() !== ""; })
          .map(function(ex){
            return {
              id: ex.id || Treino.makeId("ex"),
              name: ex.name.trim(),
              ref: (ex.ref || "").trim(),
              sets: ex.sets.map(function(s){
                return {
                  id: s.id || Treino.makeId("s"),
                  reps: String(s.reps).trim() || "8"
                };
              })
            };
          })
      };
      if(cleaned.exercises.length === 0){
        alert("Adicione pelo menos 1 exercício antes de salvar.");
        return;
      }
      Treino.saveDayEdit(slug, cleaned).then(function(){
        state.editData[slug] = cleaned;
        var orig = DAYS.filter(function(d){ return d.slug === slug; })[0];
        state.effective[slug] = Treino.effectiveDay(orig, cleaned);
        exitEditMode();
        render();
        showSavedToast("Treino salvo");
      }).catch(function(){
        alert("Não foi possível salvar. Tente novamente.");
      });
    });

    document.getElementById("resetDay").addEventListener("click", function(){
      var slug = currentOriginalDay().slug;
      var eff = state.effective[slug];
      var preview = eff ? eff.exercises.map(function(ex){
        return "• " + ex.name + " (" + ex.sets.length + (ex.sets.length === 1 ? " série" : " séries") + ")";
      }).join("\n") : "";
      var msg = "Resetar este dia para o treino padrão?\n\n" +
        "A edição atual será apagada:\n" + preview +
        "\n\nAs cargas já anotadas continuam salvas.";
      if(!confirm(msg)) return;
      Treino.clearDayEdit(slug).then(function(){
        state.editData[slug] = null;
        var orig = DAYS.filter(function(d){ return d.slug === slug; })[0];
        state.effective[slug] = Treino.effectiveDay(orig, null);
        exitEditMode();
        render();
        showSavedToast("Dia resetado");
      }).catch(function(){
        alert("Não foi possível resetar. Tente novamente.");
      });
    });
  }

  render();
})();
