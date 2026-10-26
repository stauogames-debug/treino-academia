window.Treino = window.Treino || {};

(function(){
  function validDate(s){
    if(typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
  }
  function normalize(list){
    return (Array.isArray(list) ? list : []).filter(validDate).filter(function(d, i, a){ return a.indexOf(d) === i; }).sort();
  }
  Treino.isDescanso = function(lista, data){ return normalize(lista).indexOf(data) !== -1; };
  Treino.addDescanso = function(lista, data){
    var out = normalize(lista);
    if(validDate(data) && out.indexOf(data) === -1) out.push(data);
    return out.sort();
  };
  Treino.removeDescanso = function(lista, data){ return normalize(lista).filter(function(d){ return d !== data; }); };
  Treino.normalizeDescanso = normalize;
})();
