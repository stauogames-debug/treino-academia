window.Treino = window.Treino || {};

// ---- Tema escuro / claro ----
// O tema é uma PREFERÊNCIA DO APARELHO: fica em "treino:theme" ("dark" ou
// "light"), não entra no backup e a importação não mexe nele. As cores vêm
// dos tokens do CSS (:root = escuro, :root[data-theme="light"] = claro);
// aqui só trocamos o atributo data-theme.
//
// Padrão = escuro. Falha ao ler/gravar a preferência nunca atrapalha o app.

Treino.THEME_KEY = "treino:theme";
Treino.THEMES = ["dark", "light"];
Treino.DEFAULT_THEME = "dark";
Treino.theme = Treino.DEFAULT_THEME;

// Cor da barra do navegador no celular (meta theme-color), por tema.
Treino.THEME_COLOR = { dark: "#0B1219", light: "#12314F" };

var themeTouched = false; // o usuário já escolheu nesta sessão: leitura tardia não sobrescreve

Treino.normalizeTheme = function(v){
  v = typeof v === "string" ? v.trim() : v;
  return Treino.THEMES.indexOf(v) !== -1 ? v : Treino.DEFAULT_THEME;
};

// Ícone e rótulo mostram a AÇÃO (para onde o botão leva), não o estado atual.
Treino.refreshThemeButton = function(){
  var b = document.getElementById("themeToggle");
  if(!b) return;
  var toLight = Treino.theme === "dark";
  var label = toLight ? "Mudar para o tema claro" : "Mudar para o tema escuro";
  b.innerHTML = Treino.icon(toLight ? "sun" : "moon");
  b.setAttribute("aria-label", label);
  b.setAttribute("title", label);
};

Treino.applyTheme = function(t){
  t = Treino.normalizeTheme(t);
  Treino.theme = t;
  document.documentElement.setAttribute("data-theme", t);
  var meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", Treino.THEME_COLOR[t]);
  Treino.refreshThemeButton();
};

Treino.toggleTheme = function(){
  themeTouched = true;
  var next = Treino.theme === "dark" ? "light" : "dark";
  Treino.applyTheme(next);
  return Treino.storageSet(Treino.THEME_KEY, next).catch(function(){});
};

// Lê a preferência guardada (assíncrono). Erro de leitura → mantém o padrão.
Treino.loadTheme = function(){
  return Treino.storageGet(Treino.THEME_KEY).then(function(res){
    if(themeTouched) return;
    if(res && res.value) Treino.applyTheme(res.value);
  }, function(){});
};

Treino.applyTheme(Treino.DEFAULT_THEME);
