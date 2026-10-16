// ---- PWA: registra o service worker (uso offline + instalação) ----
//
// Só registra em HTTPS (ou localhost): em arquivo aberto direto (file://) o
// navegador não permite service worker, e o app continua funcionando normal.
// Qualquer falha aqui é ignorada: o app nunca depende do service worker.
// O service worker só guarda ARQUIVOS DO APP; não lê nem grava o localStorage.
(function(){
  try {
    if(!("serviceWorker" in navigator)) return;
    var host = location.hostname;
    var seguro = location.protocol === "https:" || host === "localhost" || host === "127.0.0.1";
    if(!seguro) return;
    window.addEventListener("load", function(){
      try { navigator.serviceWorker.register("sw.js").catch(function(){}); } catch(e){}
    });
  } catch(e){}
})();
