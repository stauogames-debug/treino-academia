window.Treino = window.Treino || {};

Treino.lastEntryBefore = function(arr, dateExcl){
  if(!arr || !arr.length) return null;
  var sorted = arr.slice().sort(function(a,b){ return a.date < b.date ? 1 : -1; });
  for(var i=0;i<sorted.length;i++){
    if(sorted[i].date !== dateExcl) return sorted[i];
  }
  return sorted[0].date === dateExcl ? null : sorted[0];
};

Treino.entryForDate = function(arr, date){
  if(!arr) return null;
  for(var i=0;i<arr.length;i++){ if(arr[i].date === date) return arr[i]; }
  return null;
};

Treino.upsertEntry = function(arr, date, weight){
  arr = arr || [];
  for(var i=0;i<arr.length;i++){
    if(arr[i].date === date){ arr[i].weight = weight; return arr; }
  }
  arr.push({ date: date, weight: weight });
  if(arr.length > 30) arr = arr.slice(arr.length - 30);
  return arr;
};
