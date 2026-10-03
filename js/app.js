(function(){
  var DAYS = Treino.DAYS;
  var state = {
    day: 0,
    date: todayStr(),
    dateManual: false,   // true quando o usuário escolheu uma data diferente de hoje na mão
    history: {},
    historyFailed: {},  // slug -> true se a leitura do histórico falhou (bloqueia gravação)
    editFailed: {},     // slug -> true se a leitura da edição salva falhou
    editData: {},      // slug -> dados editados salvos (ou null)
    effective: {},      // slug -> dia efetivo atual (editado ou padrão), com ids
    editMode: false,
    entering: false,     // true enquanto carrega todos os dias para abrir o editor
    draft: null          // slug -> cópia editável de CADA dia, em uso enquanto editMode = true
  };
  var app = document.getElementById("app");

  // Data de hoje no fuso LOCAL (toISOString usa UTC e, no Brasil, viraria
  // "amanhã" depois das 21h).
  function todayStr(){
    var d = new Date();
    var p = function(n){ return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

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

  var toastTimer = null;
  function showSavedToast(msg){
    var toast = document.getElementById("toast");
    if(!toast) return;
    toast.textContent = msg || "Salvo";
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.classList.remove("show"); }, 1200);
  }

  function currentOriginalDay(){ return DAYS[state.day]; }

  // Carrega (se preciso) os dados de edição do dia, calcula o dia efetivo
  // (com ids estáveis) e só então carrega + migra o histórico, porque a
  // migração das chaves antigas precisa saber quais ids estão em cada
  // posição hoje.
  function ensureEffective(slug, cb){
    if(state.effective[slug]){ cb(state.effective[slug]); return; }
    Treino.loadDayEdit(slug, function(editData, failed){
      var orig = DAYS.filter(function(d){ return d.slug === slug; })[0];
      var eff = Treino.effectiveDay(orig, editData);
      state.editData[slug] = editData;
      state.editFailed[slug] = !!failed;
      // Se a leitura falhou, mostra o treino padrão mas NÃO guarda em cache:
      // a próxima renderização tenta ler de novo.
      if(!failed) state.effective[slug] = eff;
      cb(eff);
    });
  }

  function loadHistoryMigrated(slug, eff, cb){
    Treino.loadDayHistory(slug, function(hist, failed){
      state.historyFailed[slug] = !!failed;
      if(failed){
        state.history[slug] = {};
        cb({});
        return;
      }
      var result = Treino.migrateHistoryKeys(eff, hist);
      state.history[slug] = result.hist;
      if(result.changed){
        Treino.storageSet("treino:" + slug, JSON.stringify(result.hist)).catch(function(){});
      }
      cb(result.hist);
    });
  }

  // Conteúdo do botão de editar: ícone SVG + rótulo (não usar textContent, apagaria o ícone).
  function editBtnHtml(editing){
    return Treino.icon(editing ? "x" : "edit") + "<span>" + (editing ? "Fechar edição" : "Editar treino") + "</span>";
  }

  function render(){
    var origDay = currentOriginalDay();
    var slug = origDay.slug;
    var html = "";
    html += '<div class="hdr"><div class="hdr-text"><h1>Treino da semana</h1><p id="dayTitle">' + escapeHtml(origDay.full) + "</p></div>" +
      '<button class="themebtn" id="themeToggle" type="button"></button></div>';
    html += '<div class="tabs">';
    DAYS.forEach(function(d, i){
      html += '<button class="tab' + (i===state.day?" active":"") + (state.editMode && isDirty(d.slug) ? " dirty" : "") + '" data-day="'+i+'">' + d.label + "</button>";
    });
    html += "</div>";
    html += '<div class="datebar"><label for="dt">Data do treino</label><div class="datebar-controls"><input type="date" id="dt" value="'+state.date+'">' + (state.dateManual ? '<button class="todaybtn" id="goToday">Hoje</button>' : "") + "</div></div>";
    html += '<div class="editbar"><button class="editbtn" id="editToggle" type="button">' + editBtnHtml(state.editMode) + "</button></div>";
    html += '<div class="body" id="body"></div>';
    html += '<div class="toast" id="toast">Salvo</div>';
    app.innerHTML = html;

    var themeBtn = document.getElementById("themeToggle");
    Treino.refreshThemeButton();
    if(themeBtn) themeBtn.addEventListener("click", function(){ Treino.toggleTheme(); });

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
      (edited ? "Treino editado" : "Treino padrão") + "</div>";
  }

  // ---------- Modo normal (registrar cargas) ----------

  function renderBody(){
    // O temporizador de descanso some no editor e volta no modo normal.
    try { if(Treino.timerSetEditing) Treino.timerSetEditing(state.editMode); } catch(e){}
    if(state.editMode){ renderEditBody(); return; }
    var origDay = currentOriginalDay();
    var slug = origDay.slug;
    var eff = state.effective[slug];
    if(!eff) return;
    // O título do cabeçalho mostra o nome do dia EFETIVO (editado, se houver).
    var titleEl = document.getElementById("dayTitle");
    if(titleEl) titleEl.textContent = eff.full;
    var hist = state.history[slug] || {};
    var body = document.getElementById("body");
    if(!body) return;
    var html = dayStatusHtml(slug);
    if(state.historyFailed[slug]){
      html += '<div class="daywarn">⚠ Não foi possível ler o histórico deste dia. Por segurança, o salvamento das cargas está bloqueado para não sobrescrever nada. Recarregue a página.</div>';
    }
    html += '<div class="hint">Toque no campo amarelo e anote a carga (kg) de cada série.</div>';
    if(!state.historyFailed[slug]){
      html += '<button class="addbtn copylast-btn" id="copyLast" type="button">' + Treino.icon("copy") + "Copiar cargas da última sessão</button>";
    }
    eff.exercises.forEach(function(ex){
      html += '<div class="exercise">';
      // Meta sugerida (só leitura; nunca deve impedir a tela de abrir).
      var goalHtml = "";
      try {
        var g = Treino.suggestGoal(ex, hist, state.date, Treino.STEP_KG[slug] || Treino.DEFAULT_STEP_KG);
        if(g){
          var fg = Treino.formatGoal(g);
          goalHtml = '<div class="ex-goal">' + escapeHtml(fg.text) + (fg.note ? ' <small>· ' + escapeHtml(fg.note) + "</small>" : "") + "</div>";
        }
      } catch(e){}
      html += '<div class="ex-head">' + escapeHtml(ex.name) + (ex.ref ? '<div class="ex-ref">' + escapeHtml(ex.ref) + "</div>" : "") + goalHtml + "</div>";
      ex.sets.forEach(function(set, setIdx){
        var key = ex.id + "_" + set.id;
        var arr = hist[key] || [];
        var current = Treino.entryForDate(arr, state.date);
        var prev = Treino.lastEntryBefore(arr, state.date);
        // Só o número: o "kg" já aparece fixo ao lado do campo (.set-unit).
        var weightPlaceholder = (prev && prev.weight) ? String(prev.weight) : "—";
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
        html += '<div class="reps-input-wrap"><input class="reps-input" inputmode="numeric" data-key="' + escapeHtml(key) + '" data-field="repsDone" placeholder="' + escapeHtml(repsPlaceholder) + '" value="' + escapeHtml(repsVal) + '"></div>';
        html += '<div class="set-input-wrap"><input class="set-input" inputmode="decimal" data-key="' + escapeHtml(key) + '" data-field="weight" placeholder="' + escapeHtml(weightPlaceholder) + '" value="' + escapeHtml(weightVal) + '"><span class="set-unit">kg</span></div>';
        html += "</div>";
      });
      html += "</div>";
    });
    html += '<div class="backup-box"><label>Backup (treino + histórico)</label>' +
      '<div class="backup-last" id="backupLast"></div>' +
      '<div class="backup-row"><button class="addbtn backup-btn" id="exportBackup" type="button">' + Treino.icon("download") + 'Exportar</button>' +
      '<button class="addbtn backup-btn" id="importBackup" type="button">' + Treino.icon("upload") + 'Importar</button></div>' +
      '<div class="backup-row"><button class="addbtn backup-btn" id="copyBackup" type="button">' + Treino.icon("copy") + 'Copiar</button>' +
      '<button class="addbtn backup-btn" id="pasteBackup" type="button">' + Treino.icon("clipboard") + 'Colar</button></div>' +
      '<div class="backup-textbox" id="copyBox" hidden>' +
        '<div class="hint">Não foi possível copiar automaticamente. Toque no texto, selecione tudo, copie e guarde onde quiser (notas, WhatsApp, e-mail).</div>' +
        '<textarea class="backup-text" id="copyText" readonly spellcheck="false" aria-label="Texto do backup para copiar"></textarea></div>' +
      '<div class="backup-textbox" id="pasteBox" hidden>' +
        '<div class="hint">Cole aqui o texto do backup copiado antes.</div>' +
        '<textarea class="backup-text" id="pasteText" spellcheck="false" autocomplete="off" aria-label="Colar o texto do backup" placeholder="Cole o backup aqui"></textarea>' +
        '<div class="backup-row"><button class="addbtn backup-btn" id="pasteImport" type="button">' + Treino.icon("upload") + 'Importar texto</button>' +
        '<button class="addbtn backup-btn" id="pasteCancel" type="button">' + Treino.icon("x") + 'Cancelar</button></div></div>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '<div class="hint">Guarde o arquivo em local seguro (nuvem, e-mail, WhatsApp). Importar substitui os dias que estiverem no arquivo.</div></div>';
    body.innerHTML = html;

    document.querySelectorAll(".set-input, .reps-input").forEach(function(inp){
      inp.addEventListener("change", function(){
        var key = this.getAttribute("data-key");
        var field = this.getAttribute("data-field"); // "weight" ou "repsDone"
        var raw = this.value.trim();
        var slug2 = currentOriginalDay().slug;
        var hist2 = state.history[slug2] || {};
        var saved = Treino.entryForDate(hist2[key], state.date);

        // Restaura o valor que estava salvo (usado quando a entrada é inválida).
        var restore = function(el){
          var v = saved ? saved[field] : "";
          el.value = (v === undefined || v === null) ? "" : v;
        };

        if(state.historyFailed[slug2]){
          restore(this);
          showSavedToast("Leitura falhou: recarregue");
          return;
        }

        var patch = {};
        if(field === "weight"){
          raw = raw.replace(",", ".");
          if(raw === ""){
            patch.weight = undefined;
          } else {
            var w = parseFloat(raw);
            if(isNaN(w) || w < 0){
              restore(this);
              showSavedToast("Carga inválida");
              return;
            }
            patch.weight = w;
          }
        } else {
          patch.repsDone = raw === "" ? undefined : raw;
        }
        hist2[key] = Treino.upsertEntry(hist2[key], state.date, patch);
        if(hist2[key] && hist2[key].length === 0) delete hist2[key];
        state.history[slug2] = hist2;
        // Série concluída = carga (> 0) ou reps feitas salvas. Só conta no dia
        // de hoje (corrigir um treino antigo não dispara o descanso).
        var savedSet = (field === "weight") ? (patch.weight > 0) : !!patch.repsDone;
        var saveDate = state.date;
        Treino.storageSet("treino:" + slug2, JSON.stringify(hist2)).then(function(){
          showSavedToast("Salvo");
          try {
            if(savedSet && saveDate === todayStr() && Treino.timerOnSetSaved){
              Treino.timerOnSetSaved(key + "@" + saveDate);
            }
          } catch(e){}
        }, function(){
          showSavedToast("Erro ao salvar");
        });
      });
    });

    var copyLastBtn = document.getElementById("copyLast");
    if(copyLastBtn) copyLastBtn.addEventListener("click", copyLastLoads);

    bindBackupEvents();
  }

  // Preenche com a carga da última sessão as séries que ainda estão sem carga
  // na data exibida (não sobrescreve nada; reps feitas não são copiadas).
  function copyLastLoads(){
    var slug = currentOriginalDay().slug;
    var eff = state.effective[slug];
    if(!eff || state.historyFailed[slug]) return;
    var res = Treino.copyLastLoads(eff, state.history[slug] || {}, state.date);
    if(res.copied === 0){ showSavedToast("Nada para copiar"); return; }
    // Só atualiza a tela depois que gravou: se falhar, nada fica "como se salvo".
    Treino.storageSet("treino:" + slug, JSON.stringify(res.hist)).then(function(){
      state.history[slug] = res.hist;
      renderBody();
      showSavedToast(res.copied + (res.copied === 1 ? " carga copiada" : " cargas copiadas"));
    }, function(){
      showSavedToast("Erro ao salvar");
    });
  }

  // ---------- Backup (exportar / importar) ----------

  function slugList(){ return DAYS.map(function(d){ return d.slug; }); }

  function bindBackupEvents(){
    document.getElementById("exportBackup").addEventListener("click", exportBackup);
    document.getElementById("importBackup").addEventListener("click", function(){
      document.getElementById("importFile").click();
    });
    document.getElementById("importFile").addEventListener("change", function(){
      var file = this.files && this.files[0];
      this.value = ""; // permite escolher o mesmo arquivo de novo depois
      handleImportFile(file);
    });
    document.getElementById("copyBackup").addEventListener("click", copyBackup);
    document.getElementById("pasteBackup").addEventListener("click", function(){
      document.getElementById("copyBox").hidden = true;
      var box = document.getElementById("pasteBox");
      box.hidden = false;
      try { document.getElementById("pasteText").focus(); } catch(e){}
    });
    document.getElementById("pasteCancel").addEventListener("click", function(){
      document.getElementById("pasteText").value = "";
      document.getElementById("pasteBox").hidden = true;
    });
    document.getElementById("pasteImport").addEventListener("click", function(){
      handleImportText(document.getElementById("pasteText").value, "texto");
    });
    refreshLastBackup();
  }

  // ---- Lembrete do último backup (preferência do aparelho; nunca atrapalha o app) ----

  function refreshLastBackup(){
    if(!document.getElementById("backupLast")) return;
    Treino.storageGet(Treino.LASTBACKUP_KEY).then(function(res){
      return (res && res.value) ? String(res.value) : "";
    }, function(){ return null; }).then(function(v){
      var el = document.getElementById("backupLast");
      if(!el) return;                      // a tela mudou enquanto lia
      if(v === null){ el.textContent = ""; el.classList.remove("stale"); return; } // leitura falhou: não mostra nada
      var d = Treino.describeLastBackup(v);
      el.textContent = d.text;
      el.classList.toggle("stale", d.stale);
    });
  }

  function markBackupDone(){
    Treino.storageSet(Treino.LASTBACKUP_KEY, new Date().toISOString()).catch(function(){}).then(refreshLastBackup);
  }

  // ---- Copiar backup para a área de transferência ----

  function writeClipboard(text){
    try {
      if(navigator.clipboard && typeof navigator.clipboard.writeText === "function"){
        return Promise.resolve(navigator.clipboard.writeText(text));
      }
    } catch(e){}
    return Promise.reject(new Error("sem área de transferência"));
  }

  function showCopyFallback(text){
    var box = document.getElementById("copyBox");
    var ta = document.getElementById("copyText");
    if(!box || !ta) return;
    ta.value = text;
    box.hidden = false;
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); } catch(e){}
  }

  function copyBackup(){
    readAllFresh(function(cur){
      if(cur.failed.length){
        alert("Não foi possível ler os dados de: " + failedLabels(cur.failed) +
          ".\nO backup não foi copiado para não sair incompleto. Recarregue a página e tente de novo.");
        return;
      }
      var text = JSON.stringify(Treino.buildBackup(slugList(), cur.edits, cur.hists));
      var box = document.getElementById("copyBox");
      if(box) box.hidden = true;
      writeClipboard(text).then(function(){
        markBackupDone();
        showSavedToast("Backup copiado");
      }, function(){
        // Sem permissão ou sem API: mostra o texto para copiar à mão.
        // Não conta como backup feito (não dá para saber se o usuário copiou).
        showCopyFallback(text);
      });
    });
  }

  // Lê o estado ATUAL de todos os dias direto do storage (sem usar o cache
  // da tela). Dias que não puderam ser lidos vão em "failed" e ficam fora de
  // edits/hists, para nunca exportar um dia como se estivesse vazio.
  function readAllFresh(cb){
    var edits = {}, hists = {}, failed = [];
    var pending = DAYS.length;
    DAYS.forEach(function(d){
      Treino.loadDayEdit(d.slug, function(editData, editFailed){
        var eff = Treino.effectiveDay(d, editData);
        Treino.loadDayHistory(d.slug, function(hist, histFailed){
          if(editFailed || histFailed){
            failed.push(d);
          } else {
            var hasEdit = !!(editData && editData.exercises && editData.exercises.length);
            edits[d.slug] = hasEdit ? eff : null;
            hists[d.slug] = Treino.migrateHistoryKeys(eff, hist).hist || {};
          }
          pending--;
          if(pending === 0) cb({ edits: edits, hists: hists, failed: failed });
        });
      });
    });
  }

  function stamp(){
    var d = new Date();
    var p = function(n){ return (n < 10 ? "0" : "") + n; };
    return todayStr() + "-" + p(d.getHours()) + p(d.getMinutes());
  }

  function downloadJson(filename, text){
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  function failedLabels(list){
    return list.map(function(d){ return d.label; }).join(", ");
  }

  function exportBackup(){
    readAllFresh(function(cur){
      if(cur.failed.length){
        alert("Não foi possível ler os dados de: " + failedLabels(cur.failed) +
          ".\nO backup não foi gerado para não sair incompleto. Recarregue a página e tente de novo.");
        return;
      }
      var backup = Treino.buildBackup(slugList(), cur.edits, cur.hists);
      downloadJson("treino-backup-" + stamp() + ".json", JSON.stringify(backup, null, 2));
      markBackupDone();
      showSavedToast("Backup exportado");
    });
  }

  function handleImportFile(file){
    if(!file) return;
    if(state.editMode){ alert("Feche a edição do treino antes de importar."); return; }
    if(file.size > Treino.BACKUP_MAX_BYTES){
      alert("Arquivo grande demais para ser um backup do Treino da Semana.");
      return;
    }
    var reader = new FileReader();
    reader.onerror = function(){ alert("Não foi possível ler o arquivo."); };
    reader.onload = function(){ handleImportText(String(reader.result), "arquivo"); };
    reader.readAsText(file);
  }

  // Valida o texto de um backup (vindo de arquivo ou colado) e segue para a
  // confirmação. "origem" só muda a palavra usada nas mensagens.
  function handleImportText(text, origem){
    if(state.editMode){ alert("Feche a edição do treino antes de importar."); return; }
    if(!text || !text.trim()){
      alert("Cole o texto do backup no campo antes de importar.");
      return;
    }
    if(text.length > Treino.BACKUP_MAX_BYTES){
      alert("Texto grande demais para ser um backup do Treino da Semana.");
      return;
    }
    var obj;
    try { obj = JSON.parse(text); }
    catch(e){ alert("Importação cancelada: " + (origem === "texto" ? "o texto" : "o arquivo") + " não é um JSON válido."); return; }
    var res = Treino.validateBackup(obj, slugList());
    if(!res.ok){ alert("Importação cancelada: " + res.error); return; }
    confirmAndImport(res);
  }

  function resetCaches(){
    state.effective = {};
    state.editData = {};
    state.history = {};
    state.historyFailed = {};
    state.editFailed = {};
  }

  function confirmAndImport(res){
    var labels = DAYS.filter(function(d){ return res.days[d.slug]; })
      .map(function(d){ return d.label; }).join(", ");
    var when = "";
    if(res.exportedAt){
      var dt = new Date(res.exportedAt);
      if(!isNaN(dt.getTime())) when = dt.toLocaleString("pt-BR");
    }
    var msg = "Importar este backup?\n\n" +
      (when ? "Gerado em: " + when + "\n" : "") +
      "Dias no arquivo: " + labels + "\n" +
      "Treinos editados: " + res.stats.edits + "\n" +
      "Registros de carga: " + res.stats.records +
      (res.stats.dropped ? "\nItens inválidos ignorados: " + res.stats.dropped : "") +
      "\n\nIsso SUBSTITUI o treino e o histórico desses dias neste aparelho. " +
      "Antes, um backup do estado atual será baixado automaticamente.";
    if(!confirm(msg)) return;

    readAllFresh(function(cur){
      if(cur.failed.length &&
         !confirm("Não foi possível ler os dados atuais de: " + failedLabels(cur.failed) +
           ".\nEles ficarão FORA do backup automático e serão substituídos. Importar mesmo assim?")){
        return;
      }
      // Backup automático do que deu para ler (só se houver algo a guardar).
      var hasData = Object.keys(cur.edits).some(function(k){
        return cur.edits[k] || Object.keys(cur.hists[k] || {}).length;
      });
      if(hasData){
        var prev = Treino.buildBackup(slugList(), cur.edits, cur.hists);
        downloadJson("treino-backup-antes-da-importacao-" + stamp() + ".json", JSON.stringify(prev, null, 2));
      }

      var writes = [];
      DAYS.forEach(function(d){
        var day = res.days[d.slug];
        if(!day) return;
        writes.push(Treino.storageSet("treino:" + d.slug, JSON.stringify(day.history)));
        writes.push(day.edit ? Treino.saveDayEdit(d.slug, day.edit) : Treino.clearDayEdit(d.slug));
      });
      Promise.all(writes).then(function(){
        resetCaches();
        render();
        showSavedToast("Backup importado");
      }, function(){
        resetCaches();
        render();
        alert("Falha ao gravar parte dos dados. Recarregue a página. O backup do estado anterior foi baixado" +
          (hasData ? "." : " (não havia nada para guardar)."));
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
          if(pending === 0) abortOrFinishEnterEdit();
        });
      });
    });
  }

  function abortOrFinishEnterEdit(){
    var bad = DAYS.filter(function(d){ return state.editFailed[d.slug]; });
    if(bad.length){
      state.entering = false;
      var btn = document.getElementById("editToggle");
      if(btn) btn.innerHTML = editBtnHtml(false);
      alert("Não foi possível ler o treino salvo de: " + bad.map(function(d){ return d.label; }).join(", ") +
        ".\nPor segurança, o editor não foi aberto (salvar agora poderia sobrescrever sua edição). Recarregue a página e tente de novo.");
      return;
    }
    finishEnterEdit();
  }

  function finishEnterEdit(){
    state.draft = {};
    DAYS.forEach(function(d){
      state.draft[d.slug] = Treino.cloneForEdit(state.effective[d.slug]);
    });
    state.entering = false;
    state.editMode = true;
    var btn = document.getElementById("editToggle");
    if(btn) btn.innerHTML = editBtnHtml(true);
    renderBody();
  }

  function exitEditMode(){
    state.editMode = false;
    state.entering = false;
    state.draft = null;
    var btn = document.getElementById("editToggle");
    if(btn) btn.innerHTML = editBtnHtml(false);
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
      html += '<div class="drag-handle drag-ex" data-exidx="' + exIdx + '" title="Arraste para reordenar o exercício" aria-label="Arrastar para reordenar o exercício">' + Treino.icon("grip") + "</div>";
      html += '<input type="text" class="edit-input ex-name-input" data-exidx="' + exIdx + '" value="' + escapeHtml(ex.name) + '" placeholder="Nome do exercício">';
      html += '<button class="icon-btn swap-ex" data-exidx="' + exIdx + '" title="Trocar exercício" aria-label="Trocar exercício">' + Treino.icon("repeat") + "</button>";
      html += '<button class="icon-btn remove-ex" data-exidx="' + exIdx + '" title="Remover exercício" aria-label="Remover exercício">' + Treino.icon("trash") + "</button>";
      html += "</div>";

      html += '<div class="edit-field"><label>Referência (opcional)</label>';
      html += '<input type="text" class="edit-input ex-ref-input" data-exidx="' + exIdx + '" value="' + escapeHtml(ex.ref) + '" placeholder="Ex.: Referência: 10-15-17kg"></div>';

      html += '<div class="sets-edit-label">Séries (reps)</div>';
      ex.sets.forEach(function(set, setIdx){
        html += '<div class="set-row edit-set-row">';
        html += '<div class="drag-handle drag-set" data-exidx="' + exIdx + '" data-setidx="' + setIdx + '" title="Arraste para reordenar a série" aria-label="Arrastar para reordenar a série">' + Treino.icon("grip") + "</div>";
        html += '<div class="set-tag">S' + (setIdx+1) + "</div>";
        html += '<input type="text" class="edit-input set-edit-input" data-exidx="' + exIdx + '" data-setidx="' + setIdx + '" value="' + escapeHtml(set.reps) + '">';
        html += '<button class="icon-btn remove-set" data-exidx="' + exIdx + '" data-setidx="' + setIdx + '" title="Remover série" aria-label="Remover série">' + Treino.icon("x") + "</button>";
        html += "</div>";
      });
      html += '<button class="addbtn add-set" data-exidx="' + exIdx + '" type="button">' + Treino.icon("plus") + "Adicionar série</button>";
      html += "</div>";
    });

    html += '<button class="addbtn add-ex" id="addExercise" type="button">' + Treino.icon("plus") + "Adicionar exercício</button>";

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

    // Reordenar por arraste (alça ⠿). Só mexe no rascunho; os ids seguem com
    // cada exercício/série, então o histórico continua no lugar certo.
    document.querySelectorAll(".drag-ex").forEach(function(h){
      h.addEventListener("pointerdown", function(e){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        var items = Array.prototype.slice.call(document.querySelectorAll(".edit-exercise"));
        Treino.startDrag(e, {
          handle: this,
          item: items[i],
          items: items,
          container: document.getElementById("body"),
          compactClass: "sorting-ex",
          onFinish: function(from, to, committed){
            var changed = committed && Treino.moveItem(draft.exercises, from, to);
            if(changed) renderEditBody();
            // A lista compacta muda a altura da página: recentra o exercício.
            var moved = document.querySelectorAll(".edit-exercise")[changed ? to : from];
            if(moved && moved.scrollIntoView) moved.scrollIntoView({ block: "center" });
          }
        });
      });
    });

    document.querySelectorAll(".drag-set").forEach(function(h){
      h.addEventListener("pointerdown", function(e){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        var card = this.closest(".edit-exercise");
        var items = Array.prototype.slice.call(card.querySelectorAll(".edit-set-row"));
        Treino.startDrag(e, {
          handle: this,
          item: this.closest(".edit-set-row"),
          items: items,
          onFinish: function(from, to, committed){
            if(committed && Treino.moveItem(draft.exercises[i].sets, from, to)) renderEditBody();
          }
        });
      });
    });

    // Trocar exercício: mantém a posição e a quantidade de séries (reps), mas
    // o exercício e as séries ganham ids NOVOS. Assim o histórico do exercício
    // antigo não vira "carga" do novo (renomear no campo de nome mantém o id,
    // ou seja, mantém o histórico; trocar começa do zero).
    document.querySelectorAll(".swap-ex").forEach(function(btn){
      btn.addEventListener("click", function(){
        var i = parseInt(this.getAttribute("data-exidx"),10);
        var old = draft.exercises[i];
        var input = prompt('Trocar "' + old.name + '" por qual exercício?\n\nO novo exercício começa sem histórico de cargas (as do antigo ficam guardadas, desassociadas).', "");
        if(input === null) return;
        var name = input.trim();
        if(!name) return;
        if(name.toLowerCase() === (old.name || "").trim().toLowerCase()){
          alert("O novo exercício tem o mesmo nome. Para só corrigir o nome, edite o campo de nome.");
          return;
        }
        draft.exercises[i] = {
          id: Treino.makeId("ex"),
          name: name,
          ref: "",
          sets: old.sets.map(function(st){ return { id: Treino.makeId("s"), reps: st.reps }; })
        };
        renderEditBody();
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
  Treino.loadTheme();
})();
