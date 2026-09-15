(function(){
  var DAYS = Treino.DAYS;
  var state = {
    day: 0,
    date: new Date().toISOString().slice(0,10),
    history: {},
    editData: {},      // slug -> dados editados salvos (ou null)
    effective: {},      // slug -> dia efetivo atual (editado ou padrão)
    editMode: false,
    draft: null          // cópia editável em uso enquanto editMode = true
  };
  var app = document.getElementById("app");

  function todayStr(){ return new Date().toISOString().slice(0,10); }

  function showSavedToast(msg){
    var toast = document.getElementById("toast");
    if(!toast) return;
    if(msg) toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(function(){ toast.classList.remove("show"); }, 1200);
  }

  function currentOriginalDay(){ return DAYS[state.day]; }

  function ensureEffective(slug, cb){
    if(state.effective[slug]){ cb(state.effective[slug]); return; }
    Treino.loadDayEdit(slug, function(editData){
      state.editData[slug] = editData;
      var orig = DAYS.filter(function(d){ return d.slug === slug; })[0];
      state.effective[slug] = Treino.effectiveDay(orig, editData);
      cb(state.effective[slug]);
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
    html += '<div class="datebar"><label for="dt">Data do treino</label><input type="date" id="dt" value="'+state.date+'"></div>';
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
      state.date = this.value || todayStr();
      renderBody();
    });
    document.getElementById("editToggle").addEventListener("click", function(){
      if(state.editMode){ exitEditMode(); render(); }
      else { enterEditMode(); }
    });

    Treino.loadDayHistory(slug, function(hist){
      state.history[slug] = hist;
      ensureEffective(slug, function(){
        renderBody();
      });
    });
  }

  function escapeHtml(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
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
    var html = '<div class="hint">Toque no campo amarelo e anote a carga (kg) de cada série.</div>';
    eff.exercises.forEach(function(ex, exIdx){
      html += '<div class="exercise">';
      html += '<div class="ex-head">' + escapeHtml(ex.name) + (ex.ref ? '<div class="ex-ref">' + escapeHtml(ex.ref) + "</div>" : "") + "</div>";
      ex.sets.forEach(function(reps, setIdx){
        var key = exIdx + "_" + setIdx;
        var arr = hist[key] || [];
        var current = Treino.entryForDate(arr, state.date);
        var prev = Treino.lastEntryBefore(arr, state.date);
        var placeholder = prev ? (prev.weight + " kg") : "—";
        var val = current ? current.weight : "";
        html += '<div class="set-row">';
        html += '<div class="set-tag">S' + (setIdx+1) + "</div>";
        html += '<div class="set-reps">' + escapeHtml(reps) + " reps" + (prev ? "<small>última: " + prev.weight + "kg (" + prev.date.slice(5) + ")</small>" : "") + "</div>";
        html += '<div class="set-input-wrap"><input class="set-input" inputmode="decimal" data-key="' + key + '" placeholder="' + placeholder + '" value="' + val + '"><span class="set-unit">kg</span></div>';
        html += "</div>";
      });
      html += "</div>";
    });
    body.innerHTML = html;

    document.querySelectorAll(".set-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var key = this.getAttribute("data-key");
        var raw = this.value.replace(",", ".").trim();
        var slug2 = currentOriginalDay().slug;
        var hist2 = state.history[slug2] || {};
        if(raw === ""){
          if(hist2[key]){
            hist2[key] = hist2[key].filter(function(e){ return e.date !== state.date; });
          }
        } else {
          var w = parseFloat(raw);
          if(isNaN(w)) return;
          hist2[key] = Treino.upsertEntry(hist2[key], state.date, w);
        }
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
    if(btn) btn.textContent = " ✏️ Editar treino";
  }

  function renderEditBody(){
    var body = document.getElementById("body");
    if(!body) return;
    var draft = state.draft;
    var html = '<div class="hint">Edite nomes, séries e referência. Toque em "Salvar treino" ao terminar.</div>';

    html += '<div class="edit-field"><label>Nome do dia</label>';
    html += '<input type="text" id="editFull" class="edit-input" value="' + escapeHtml(draft.full) + '"></div>';

    draft.exercises.forEach(function(ex, exIdx){
      html += '<div class="exercise edit-exercise" data-exidx="' + exIdx + '">';
      html += '<div class="ex-edit-row">';
      html += '<input type="text" class="edit-input ex-name-input" data-exidx="' + exIdx + '" value="' + escapeHtml(ex.name) + '" placeholder="Nome do exercício">';
      html += '<button class="icon-btn remove-ex" data-exidx="' + exIdx + '" title="Remover exercício"> 🗑 </button>';
      html += "</div>";

      html += '<div class="edit-field"><label>Referência (opcional)</label>';
      html += '<input type="text" class="edit-input ex-ref-input" data-exidx="' + exIdx + '" value="' + escapeHtml(ex.ref) + '" placeholder="Ex.: Referência: 10-15-17kg"></div>';

      html += '<div class="sets-edit-label">Séries (reps)</div>';
      ex.sets.forEach(function(reps, setIdx){
        html += '<div class="set-row edit-set-row">';
        html += '<div class="set-tag">S' + (setIdx+1) + "</div>";
        html += '<input type="text" class="edit-input set-edit-input" data-exidx="' + exIdx + '" data-setidx="' + setIdx + '" value="' + escapeHtml(reps) + '">';
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
        draft.exercises[i].sets[j] = this.value.trim() || draft.exercises[i].sets[j];
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
        draft.exercises[i].sets.push("8");
        renderEditBody();
      });
    });

    document.getElementById("addExercise").addEventListener("click", function(){
      draft.exercises.push({ name: "Novo exercício", sets: ["10"], ref: "" });
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
              name: ex.name.trim(),
              ref: (ex.ref || "").trim(),
              sets: ex.sets.map(function(s){ return String(s).trim() || "8"; })
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
      if(!confirm("Resetar este dia para o treino padrão? Suas edições de nomes/séries serão apagadas (as cargas anotadas continuam salvas).")) return;
      var slug = currentOriginalDay().slug;
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
