(function(){
  var DAYS = Treino.DAYS;
  var state = { day: 0, date: new Date().toISOString().slice(0,10), history: {} };
  var app = document.getElementById("app");

  function todayStr(){ return new Date().toISOString().slice(0,10); }

  function showSavedToast(){
    var toast = document.getElementById("toast");
    if(!toast) return;
    toast.classList.add("show");
    setTimeout(function(){ toast.classList.remove("show"); }, 1200);
  }

  function render(){
    var day = DAYS[state.day];
    var html = "";
    html += '<div class="hdr"><h1>Treino da semana</h1><p>' + day.full + "</p></div>";
    html += '<div class="tabs">';
    DAYS.forEach(function(d, i){
      html += '<button class="tab' + (i===state.day?" active":"") + '" data-day="'+i+'">' + d.label + "</button>";
    });
    html += "</div>";
    html += '<div class="datebar"><label for="dt">Data do treino</label><input type="date" id="dt" value="'+state.date+'"></div>';
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
      state.date = this.value || todayStr();
      renderBody();
    });

    Treino.loadDayHistory(day.slug, function(hist){
      state.history[day.slug] = hist;
      renderBody();
    });
  }

  function renderBody(){
    var day = DAYS[state.day];
    var hist = state.history[day.slug] || {};
    var body = document.getElementById("body");
    if(!body) return;
    var html = '<div class="hint">Toque no campo amarelo e anote a carga (kg) de cada série.</div>';
    day.exercises.forEach(function(ex, exIdx){
      html += '<div class="exercise">';
      html += '<div class="ex-head">' + ex.name + (ex.ref ? '<div class="ex-ref">' + ex.ref + "</div>" : "") + "</div>";
      ex.sets.forEach(function(reps, setIdx){
        var key = exIdx + "_" + setIdx;
        var arr = hist[key] || [];
        var current = Treino.entryForDate(arr, state.date);
        var prev = Treino.lastEntryBefore(arr, state.date);
        var placeholder = prev ? (prev.weight + " kg") : "—";
        var val = current ? current.weight : "";
        html += '<div class="set-row">';
        html += '<div class="set-tag">S' + (setIdx+1) + "</div>";
        html += '<div class="set-reps">' + reps + " reps" + (prev ? "<small>última: " + prev.weight + "kg (" + prev.date.slice(5) + ")</small>" : "") + "</div>";
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
        var day2 = DAYS[state.day];
        var hist2 = state.history[day2.slug] || {};
        if(raw === ""){
          if(hist2[key]){
            hist2[key] = hist2[key].filter(function(e){ return e.date !== state.date; });
          }
        } else {
          var w = parseFloat(raw);
          if(isNaN(w)) return;
          hist2[key] = Treino.upsertEntry(hist2[key], state.date, w);
        }
        state.history[day2.slug] = hist2;
        Treino.storageSet("treino:" + day2.slug, JSON.stringify(hist2)).then(function(){
          showSavedToast();
        }).catch(function(){});
      });
    });
  }

  render();
})();
