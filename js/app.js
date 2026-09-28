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
    entering: false,     // true enquanto carrega todos os dias para abrir o editor
    draft: null          // slug -> cópia editável de CADA dia, em uso enquanto editMode = true
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
      html += '<button class="tab' + (i===state.day?" active":"") + (state.editMode && isDirty(d.slug) ? " dirty" : "") + '" data-day="'+i+'">' + d.label + "</button>";
    });
    html += "</div>";
    html += '<div class="datebar"><label for="dt">Data do treino</label><div class="datebar-controls"><input type="date" id="dt" value="'+state.date+'">' + (state.dateManual ? '<button class="todaybtn" id="goToday">Hoje</button>' : "") + "</div></div>";
    html += '<div class="editbar"><button class="editbtn" id="editToggle">' + (state.editMode ? "✖ Fechar edição" : "✏️ Editar treino") + "</button></div>";
    html += '<div class="body" id="body"></div>';
    html += '<div class="toast" id="toast">Salvo</div>';
    app.innerHTML = html;

    document.querySelectorAll(".tab").forEach(function(btn){
      btn.addEventListener("click", function(){
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
      if(state.editMode){
        if(anyDirty() && !confirm("Há alterações não salvas. Fechar a edição mesmo assim?")) return;
        exitEditMode(); render();
      } else { enterEditMode(); }
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

  // Limpa um dia do rascunho (mesmo formato salvo em treino:edit:{slug}).
  function cleanDay(d, fallbackFull){
    return {
      full: (d.full || "").trim() || fallbackFull,
      exercises: d.exercises
        .filter(function(ex){ return (ex.name || "").trim() !== ""; })
        .map(function(ex){
          return {
            id: ex.id || Treino.makeId("ex"),
            name: ex.name.trim(),
            ref: (ex.ref || "").trim(),
            sets: ex.sets.map(function(s){
              return { id: s.id || Treino.makeId("s"), reps: String(s.reps).trim() || "8" };
            })
          };
        })
    };
  }

  // O dia tem alteração ainda não salva?
  function isDirty(slug){
    if(!state.draft || !state.draft[slug] || !state.effective[slug]) return false;
    var eff = state.effective[slug];
    return JSON.stringify(cleanDay(state.draft[slug], eff.full)) !== JSON.stringify(eff);
  }

  function dirtySlugs(){
    return DAYS.filter(function(d){ return isDirty(d.slug); }).map(function(d){ return d.slug; });
  }

  function anyDirty(){ return dirtySlugs().length > 0; }

  // Atualiza o marcador "●" nas abas e o texto do botão de salvar.
  function refreshDirty(){
    if(!state.editMode) return;
    var dirty = dirtySlugs();
    document.querySelectorAll(".tab").forEach(function(btn){
      var d = DAYS[parseInt(btn.getAttribute("data-day"),10)];
      btn.classList.toggle("dirty", dirty.indexOf(d.slug) !== -1);
    });
    var save = document.getElementById("saveEdit");
    if(save){
      save.textContent = dirty.length
        ? "Salvar treino (" + dirty.length + (dirty.length === 1 ? " dia alterado)" : " dias alterados)")
        : "Salvar treino";
    }
  }

  // Abre o editor para TODOS os dias de uma vez. Antes de montar os
  // rascunhos, carrega e migra o histórico de cada dia (não só o aberto):
  // se um dia nunca aberto ainda tivesse chaves antigas "exIdx_setIdx" e o
  // usuário reordenasse exercícios aqui, a migração posterior mapearia
  // as cargas para os exercícios errados.
  function enterEditMode(){
    if(state.editMode || state.entering) return;
    state.entering = true;
    var btn = document.getElementById("editToggle");
    if(btn) btn.textContent = "Carregando…";
    var pending = DAYS.length;
    DAYS.forEach(function(d){
      ensureEffective(d.slug, function(eff){
        loadHistoryMigrated(d.slug, eff, function(){
          pending--;
          if(pending === 0) finishEnterEdit();
        });
      });
    });
  }

  function finishEnterEdit(){
    state.draft = {};
    DAYS.forEach(function(d){
      state.draft[d.slug] = Treino.cloneForEdit(state.effective[d.slug]);
    });
    state.entering = false;
    state.editMode = true;
    var btn = document.getElementById("editToggle");
    if(btn) btn.textContent = "✖ Fechar edição";
    renderBody();
  }

  function exitEditMode(){
    state.editMode = false;
    state.entering = false;
    state.draft = null;
    var btn = document.getElementById("editToggle");
    if(btn) btn.textContent = "✏️ Editar treino";
  }

  function renderEditBody(){
    var body = document.getElementById("body");
    if(!body) return;
    var slug = currentOriginalDay().slug;
    var draft = state.draft[slug];
    var html = dayStatusHtml(slug);
    html += '<div class="hint">Editando todos os dias: troque de aba para editar outro dia (● = alterado). "Salvar treino" grava todos de uma vez.</div>';

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

    html += '<div class="dup-box"><label for="dupSrc">Copiar treino de outro dia</label>';
    html += '<select id="dupSrc" class="edit-input">';
    DAYS.forEach(function(d){
      if(d.slug === slug) return;
      html += '<option value="' + d.slug + '">' + escapeHtml(state.draft[d.slug].full) + "</option>";
    });
    html += "</select>";
    html += '<div class="dup-row"><button class="addbtn dup-btn" id="dupReplace">Substituir este dia</button>';
    html += '<button class="addbtn dup-btn" id="dupAppend">Adicionar ao final</button></div></div>';

    html += '<div class="edit-actions">';
    html += '<button class="savebtn" id="saveEdit">Salvar treino</button>';
    html += '<button class="resetbtn" id="resetDay">Resetar este dia para o padrão</button>';
    html += "</div>";

    body.innerHTML = html;
    bindEditEvents();
    refreshDirty();
  }

  function bindEditEvents(){
    var draft = state.draft[currentOriginalDay().slug];

    document.getElementById("editFull").addEventListener("change", function(){
      draft.full = this.value.trim() || draft.full;
      refreshDirty();
    });

    document.querySelectorAll(".ex-name-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        draft.exercises[i].name = this.value.trim() || draft.exercises[i].name;
        refreshDirty();
      });
    });

    document.querySelectorAll(".ex-ref-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        draft.exercises[i].ref = this.value.trim();
        refreshDirty();
      });
    });

    document.querySelectorAll(".set-edit-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        var j = parseInt(this.getAttribute("data-setidx"),10);
        draft.exercises[i].sets[j].reps = this.value.trim() || draft.exercises[i].sets[j].reps;
        refreshDirty();
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

    // Duplicar: copia os exercícios de outro dia (incluindo edições ainda não
    // salvas) para este. Tudo recebe ids NOVOS, para que as cargas do dia de
    // origem nunca se misturem com as deste dia.
    function copyFromDay(mode){
      var srcSlug = document.getElementById("dupSrc").value;
      var src = state.draft[srcSlug];
      if(!src) return;
      var copies = src.exercises.map(function(ex){
        return {
          id: Treino.makeId("ex"),
          name: ex.name,
          ref: ex.ref || "",
          sets: ex.sets.map(function(st){ return { id: Treino.makeId("s"), reps: st.reps }; })
        };
      });
      if(mode === "replace"){
        if(!confirm('Substituir os ' + draft.exercises.length + ' exercícios deste dia pelos de "' + src.full + '"?\n\nSe salvar, as cargas já anotadas nos exercícios substituídos ficarão desassociadas.')) return;
        draft.exercises = copies;
      } else {
        draft.exercises = draft.exercises.concat(copies);
      }
      renderEditBody();
    }
    document.getElementById("dupReplace").addEventListener("click", function(){ copyFromDay("replace"); });
    document.getElementById("dupAppend").addEventListener("click", function(){ copyFromDay("append"); });

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
      var toSave = [];
      for(var k=0; k<DAYS.length; k++){
        var d = DAYS[k];
        var eff = state.effective[d.slug];
        var cleaned = cleanDay(state.draft[d.slug], eff.full);
        if(cleaned.exercises.length === 0){
          alert("O dia \"" + eff.full + "\" precisa ter pelo menos 1 exercício antes de salvar.");
          if(state.day !== k){ state.day = k; render(); }
          return;
        }
        if(JSON.stringify(cleaned) !== JSON.stringify(eff)){
          toSave.push({ slug: d.slug, cleaned: cleaned });
        }
      }
      if(toSave.length === 0){
        exitEditMode();
        render();
        showSavedToast("Nenhuma alteração");
        return;
      }
      Promise.all(toSave.map(function(item){
        return Treino.saveDayEdit(item.slug, item.cleaned);
      })).then(function(){
        toSave.forEach(function(item){
          var orig = DAYS.filter(function(d){ return d.slug === item.slug; })[0];
          state.editData[item.slug] = item.cleaned;
          state.effective[item.slug] = Treino.effectiveDay(orig, item.cleaned);
        });
        exitEditMode();
        render();
        showSavedToast(toSave.length === 1 ? "Treino salvo" : toSave.length + " dias salvos");
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
        "\n\nAs cargas já anotadas continuam salvas. Os outros dias não são afetados.";
      if(!confirm(msg)) return;
      Treino.clearDayEdit(slug).then(function(){
        state.editData[slug] = null;
        var orig = DAYS.filter(function(d){ return d.slug === slug; })[0];
        state.effective[slug] = Treino.effectiveDay(orig, null);
        state.draft[slug] = Treino.cloneForEdit(state.effective[slug]);
        renderEditBody();
        showSavedToast("Dia resetado");
      }).catch(function(){
        alert("Não foi possível resetar. Tente novamente.");
      });
    });
  }

  render();
})();
