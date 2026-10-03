window.Treino = window.Treino || {};

// ---- Arrastar para reordenar (exercícios e séries no editor) ----
//
// Usa Pointer Events (funciona com dedo e mouse; o drag nativo do HTML5 não
// funciona em tela de toque). Só existe no modo de edição e só mexe no
// RASCUNHO: a ordem nova vale depois de "Salvar treino". Como o histórico é
// guardado por id (idExercicio_idSerie), reordenar nunca troca uma carga de
// lugar.

// Move arr[from] para a posição "to" (in-place). Devolve true se mudou algo.
Treino.moveItem = function(arr, from, to){
  if(!arr || from === to) return false;
  if(from < 0 || from >= arr.length || to < 0 || to >= arr.length) return false;
  var it = arr.splice(from, 1)[0];
  arr.splice(to, 0, it);
  return true;
};

// "centers" = centros (eixo Y, em ordem crescente) dos itens SEM o que está
// sendo arrastado; "y" = centro do item arrastado. Devolve a posição final
// do item arrastado na lista completa (= quantos dos outros ficam acima dele).
Treino.dropIndex = function(centers, y){
  var n = 0;
  for(var i = 0; i < centers.length; i++){ if(centers[i] < y) n++; }
  return n;
};

// opts:
//   handle        elemento que recebeu o pointerdown (a "alça")
//   item          elemento que será movido
//   items         array com TODOS os itens irmãos, em ordem (inclui "item")
//   container     (opcional) elemento que recebe opts.compactClass durante o
//                 arraste, para os itens ficarem baixos e caberem na tela
//   compactClass  (opcional)
//   onFinish(from, to, committed)  chamado ao soltar (committed=false se
//                 cancelou com Esc/pointercancel). O chamador é quem altera
//                 o rascunho e re-renderiza.
Treino.startDrag = function(e, opts){
  if(e.pointerType === "mouse" && e.button !== 0) return;
  var items = opts.items, item = opts.item;
  var from = items.indexOf(item);
  if(from === -1 || items.length < 2) return;
  e.preventDefault();

  var handle = opts.handle;
  try { handle.setPointerCapture(e.pointerId); } catch(err){}

  if(opts.container && opts.compactClass) opts.container.classList.add(opts.compactClass);
  item.classList.add("dragging");

  // Medidas em coordenadas de PÁGINA, feitas depois de compactar. Só o item
  // arrastado recebe transform (não altera o layout), então os centros dos
  // outros continuam valendo mesmo com rolagem.
  var scrollY = function(){ return window.pageYOffset || document.documentElement.scrollTop || 0; };
  var r = item.getBoundingClientRect();
  var baseTop = r.top + scrollY();
  var h = r.height;
  var others = items.filter(function(x){ return x !== item; });
  var centers = others.map(function(o){
    var b = o.getBoundingClientRect();
    return b.top + scrollY() + b.height / 2;
  });

  var lastY = e.clientY;
  var cur = from;
  var done = false;
  var raf = null;

  function clearMarks(){
    others.forEach(function(o){ o.classList.remove("drop-before", "drop-after"); });
  }

  function update(){
    var y = lastY + scrollY();
    item.style.transform = "translateY(" + (y - baseTop - h / 2) + "px)";
    cur = Treino.dropIndex(centers, y);
    clearMarks();
    if(cur < others.length) others[cur].classList.add("drop-before");
    else others[others.length - 1].classList.add("drop-after");
  }

  // Rola a página quando o dedo chega perto da borda de cima/baixo.
  function tick(){
    if(done) return;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if(vh){
      if(lastY < 70) window.scrollBy(0, -12);
      else if(lastY > vh - 70) window.scrollBy(0, 12);
    }
    update();
    raf = window.requestAnimationFrame(tick);
  }

  function onMove(ev){ lastY = ev.clientY; }
  function onUp(){ finish(true); }
  function onCancel(){ finish(false); }
  function onKey(ev){ if(ev.key === "Escape") finish(false); }
  function onCtx(ev){ ev.preventDefault(); }

  function finish(commit){
    if(done) return;
    done = true;
    if(raf) window.cancelAnimationFrame(raf);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onCancel);
    handle.removeEventListener("contextmenu", onCtx);
    document.removeEventListener("keydown", onKey);
    try { handle.releasePointerCapture(e.pointerId); } catch(err){}
    clearMarks();
    item.classList.remove("dragging");
    item.style.transform = "";
    if(opts.container && opts.compactClass) opts.container.classList.remove(opts.compactClass);
    if(opts.onFinish) opts.onFinish(from, commit ? cur : from, commit);
  }

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onCancel);
  handle.addEventListener("contextmenu", onCtx);
  document.addEventListener("keydown", onKey);
  update();
  raf = window.requestAnimationFrame(tick);
};
