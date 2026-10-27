# Prompt para continuar o APP Treino da Semana

Copie o bloco abaixo e cole em um chat novo no Cursor, na pasta `APP-Treino`.

---

## Prompt

Você está trabalhando no app **Treino da Semana**, pasta:

`C:\Users\Davi Lucca\OneDrive\Documentos\APP-Treino`

É um app web simples (HTML + CSS + JS), em português, para anotar a carga (kg) e as reps feitas de cada série do treino. Não use framework. Não transforme em React/Vue. Mantenha o visual atual (azul escuro, campos amarelos, mobile-first, max-width 480px). Preserve o salvamento no `localStorage` (chave `treino:{slug}`) e o fallback `window.storage` (usado no celular). Não quebre o histórico já salvo.

### O que o app já faz hoje

- Abas Seg / Ter / Qua / Qui / Sex com o treino da semana, mais a aba **Evolução** (`#tabEvo`, classe `.tab-evo`) à direita, só no modo normal (some no editor)
- Campo de data do treino
- Lista de exercícios e séries (reps-alvo) com:
  - Campo de carga em kg (âmbar/amarelo) e campo de reps feitas (azul) — cores de matizes bem diferentes nos dois temas, via tokens `--load-*` e `--reps-*`
  - Campo pequeno de **reps feitas**, à esquerda do campo de kg, para anotar quantas repetições o usuário realmente conseguiu fazer naquela série
- Mostra a última carga e as últimas reps feitas registradas em data ANTERIOR à data exibida (placeholder em cada campo — no campo de carga é **só o número**, sem "kg", porque o "kg" já aparece fixo ao lado (`.set-unit`) — + texto "última: Xkg × Y reps (data)"); datas posteriores nunca são usadas como "última"
- Carga e reps feitas salvam de forma independente: preencher/limpar um não apaga o outro. O registro daquele dia só é removido do histórico quando os dois campos ficam vazios
- Salva ao sair do campo (evento `change`)
- Toast "Salvo"
- Histórico limitado a 30 registros por série (mantém os 30 mais recentes **por data**, não por ordem de inserção)
- Carga inválida (texto que não é número, ou negativo) não é salva: o campo volta ao valor anterior e o toast mostra "Carga inválida". Falha ao gravar mostra "Erro ao salvar"
- **"Hoje" é sempre a data no fuso LOCAL** (`todayStr()` monta a data com `getFullYear/getMonth/getDate`; **não usar `toISOString()`**, que é UTC e no Brasil vira "amanhã" depois das 21h).
- **Data do treino se auto-atualiza para "hoje"** mesmo se o app ficar aberto (aba ou atalho) por vários dias sem recarregar, evitando que uma carga nova sobrescreva por engano o registro de uma data antiga. Sincroniza ao voltar pra aba (`visibilitychange`), ao dar foco na janela e a cada 30 min. Se o usuário escolher uma data no passado na mão (pra revisar/editar treino antigo), a auto-sincronização é pausada (`dateManual = true`) e aparece um botão **"Hoje"** ao lado do campo de data para voltar rápido. **Não redesenha o treino se a tela de Evolução estiver aberta:** `if(!state.editMode && state.view !== "evolucao") renderBody()` — senão o `syncToday` cobriria o gráfico com a lista de séries.
- **Editor de treino pelo próprio app, para TODOS os dias de uma vez** (botão "✏️ Editar treino"). Ao abrir, carrega e migra o histórico de todos os dias e cria um rascunho por dia (`state.draft[slug]`); trocar de aba dentro do editor muda o dia sendo editado sem perder os rascunhos dos outros; abas com alteração não salva mostram "●"; "Salvar treino" grava de uma vez só os dias que mudaram (`treino:edit:{slug}`); fechar com alterações pendentes pede confirmação. Permite:
  - Copiar o treino de outro dia (select + "Substituir este dia" / "Adicionar ao final"); usa o rascunho do dia de origem (inclui edições não salvas) e gera ids NOVOS para tudo, então as cargas nunca se misturam entre os dias
  - Editar o nome do dia (`full`); o título do cabeçalho (`#dayTitle`) mostra o nome do dia **efetivo** (editado, se houver), atualizado em `renderBody`
  - Editar o nome de cada exercício (**só corrige o nome: mantém o mesmo id e, portanto, o histórico de cargas**)
  - **Trocar exercício** (botão 🔄 ao lado da lixeira, classe `.swap-ex`): pergunta o nome do novo exercício via `prompt`, mantém a posição e a quantidade/reps das séries, mas gera ids NOVOS (`Treino.makeId("ex")` para o exercício e `Treino.makeId("s")` para cada série) e limpa a `ref`. O novo exercício começa sem histórico; o do antigo continua no storage, desassociado (igual ao remover), e entra no backup. Cancelar ou nome vazio não muda nada; nome igual ao atual (sem diferenciar maiúsculas) é recusado com aviso. Só altera o rascunho: vale depois de "Salvar treino"
  - Adicionar / remover exercício do dia
  - **Reordenar por arraste** (alça ⠿ à esquerda de cada exercício e de cada série, classes `.drag-handle`, `.drag-ex`, `.drag-set`): usa Pointer Events (funciona com dedo e mouse; não usar o drag nativo do HTML5, que não funciona em toque) via `Treino.startDrag` (`js/sortable.js`). Exercícios só se movem dentro do dia e séries só dentro do próprio exercício. Durante o arraste de exercícios, os cartões ficam compactos (classe `.sorting-ex` no `#body`, só a linha do nome), o item segue o dedo, uma linha amarela (`.drop-before` / `.drop-after`) mostra onde vai cair e a página rola sozinha perto das bordas. Esc ou `pointercancel` cancelam. Só altera o rascunho (marca "●" e vale depois de "Salvar treino"); os ids acompanham cada exercício/série, então o histórico continua associado ao item certo. Os rótulos S1, S2… das séries são pela posição atual
  - Editar o texto de cada série (ex.: "6 a 8" → "8 a 10")
  - Adicionar / remover série de um exercício
  - Editar o texto de referência (`ref`, ex.: "Referência: 21-27-33-39kg")
  - Salvar a edição (persistente, mesma via `storageSet`)
  - Resetar o dia visível para o treino padrão de `workouts.js` (imediato, só daquele dia, sem sair do editor; apaga só a edição de estrutura; as cargas continuam), mostrando antes um preview (lista de exercícios e nº de séries) do que vai ser apagado
  - Confirmação antes de remover exercício, avisando que cargas já anotadas para ele podem ficar desassociadas
  - Indicador visual ("● Treino padrão" / "✎ Treino editado") no topo do corpo, mostrando se o dia atual está usando o treino padrão de `workouts.js` ou uma edição salva
- **Visual (Fase A): tema escuro/claro, ícones SVG e botões padronizados.** Tema **escuro é o padrão**; botão sol/lua no cabeçalho (`#themeToggle`, rótulo acessível mostra a AÇÃO: "Mudar para o tema claro/escuro") alterna e grava a preferência em `treino:theme` (`"dark"`/`"light"`). É preferência do **aparelho**: não entra no backup e a importação não a altera; falha ao ler/gravar nunca atrapalha o app; se o usuário trocar antes de a leitura lenta terminar, a leitura tardia não sobrescreve a escolha. Trocar de tema só muda o atributo `data-theme` (não re-renderiza o corpo, então não perde rascunho do editor). Ícones são SVG embutidos em `js/icons.js` (estilo Feather, licença MIT), herdam `currentColor`; **não usar emoji/glifos (✏ 🗑 🔄 ⠿ ⬇ ⬆ ✖) em botões**. Botão só de ícone precisa de `aria-label`; alvos de toque ≥ 40px. Nenhum comportamento mudou (mesmos ids, classes e `data-*`).
- **Meta por exercício (dupla progressão, fase 1)** — no modo normal, uma linha discreta abaixo do nome/referência de cada exercício (`.ex-goal`), ex.: `Meta hoje: 27 kg × 6 · subir a carga`. É só sugestão de leitura: não grava nada, não muda histórico nem estrutura, não aparece no editor e um erro no cálculo nunca impede a tela de abrir (`try/catch` em `renderBody`). Regra completa em "Meta por exercício — como funciona" (abaixo). Código em `js/goals.js` (`Treino.suggestGoal`, `Treino.formatGoal`, `Treino.STEP_KG`).
- **Backup: exportar / importar (JSON)** — painel "Backup (treino + histórico)" no fim da tela do modo normal (não aparece no editor), com dois botões:
  - **⬇ Exportar**: lê o estado atual de TODOS os dias direto do storage (sem cache), migra chaves antigas do histórico e baixa `treino-backup-AAAA-MM-DD-HHMM.json`. Se algum dia não puder ser lido, o backup **não é gerado** (nunca sai um dia como se estivesse vazio).
  - **⬆ Importar**: escolhe um `.json`; o arquivo é validado por inteiro (`Treino.validateBackup`) antes de qualquer gravação. Mostra um resumo (data do backup, dias, treinos editados, registros, itens inválidos ignorados) e pede confirmação. Depois de confirmar, **baixa automaticamente um backup do estado atual** (`treino-backup-antes-da-importacao-...json`, só se houver algo a guardar) e então **substitui** treino e histórico dos dias presentes no arquivo (dias ausentes no arquivo não são tocados; `edit: null` no arquivo apaga a edição local, voltando ao treino padrão). Se algum dia atual estiver ilegível, pede uma 2ª confirmação (permite reparar dados corrompidos por importação). Limite de 5 MB por arquivo. Ao terminar, limpa os caches e re-renderiza.
- **Backup: Copiar / Colar + lembrete do último backup** — no mesmo painel, para ambientes em que baixar arquivo é bloqueado:
  - **Copiar** (`#copyBackup`): monta o mesmo backup do Exportar (lendo tudo do storage; se algum dia estiver ilegível, **não copia**) e manda para a área de transferência. Se o navegador negar ou não tiver `navigator.clipboard`, mostra o texto numa caixa só de leitura (`#copyBox`/`#copyText`) para copiar à mão; nesse caso **não conta** como backup feito.
  - **Colar** (`#pasteBackup`): abre uma caixa (`#pasteBox`/`#pasteText`) com "Importar texto" / "Cancelar". O texto passa por `handleImportText`, o **mesmo caminho** do arquivo (limite de 5 MB, `validateBackup`, confirmação, backup automático do estado atual antes de substituir). Cancelar a confirmação mantém o texto na caixa.
  - **Lembrete** (`#backupLast`): "Último backup: nunca feito / hoje às HH:MM / ontem / há N dias" (`Treino.describeLastBackup(iso, now)`); em destaque (`.stale`) quando nunca feito ou com 7+ dias (`BACKUP_STALE_DAYS`). A data fica em `treino:lastBackup` (ISO), gravada só por Exportar e Copiar bem-sucedidos. É preferência do aparelho: **fora do arquivo de backup**, e importar **não** a altera nem conta como backup. Falha ao ler/gravar essa chave nunca atrapalha nem mostra alerta.
- **Copiar cargas da última sessão** (botão `#copyLast`, só no modo normal e só se o histórico do dia foi lido): `Treino.copyLastLoads(diaEfetivo, historico, data)` (função pura, em `js/history.js`) preenche, para cada série **sem carga** na data exibida, a última carga anotada em data **estritamente anterior** (a mesma do placeholder). Copia **só a carga** (reps feitas são desempenho real e nunca são copiadas); não sobrescreve nada já anotado e preserva as reps já anotadas na data; só mexe nas chaves da estrutura atual (por id). Só atualiza a tela depois de gravar; falha → "Erro ao salvar". Toast "N cargas copiadas" / "Nada para copiar". Carga copiada não vira "sessão" para a meta (sem reps feitas, não conta).
- **Temporizador de descanso entre séries (fase 1)** — barra fixa no rodapé (`#restTimer`, criada por `js/timer.js` **fora do `#app`**, para o `render()` não apagá-la). Regra completa em "Temporizador de descanso — como funciona" (abaixo).
- **Modo descanso / dia sem treino (FEITO)** — marca uma data ISO específica, independente da aba semanal. A tela mostra o cartão "Dia de descanso" no lugar dos exercícios; a marcação é dado de treino, entra no backup e sincroniza via exportar/importar/copiar/colar. Regra completa abaixo.
- **PWA (instalável e offline)** — manifest + service worker + ícones; abre em tela cheia pelo ícone na tela inicial e funciona sem internet. Regra completa em "PWA — como funciona" (abaixo). Não muda nenhum comportamento do app nem toca nos dados.
- **Gráfico de evolução da carga (FEITO)** — aba "Evolução" depois de Sex. Só leitura: lista os exercícios de todos os dias; toque abre um SVG (sem biblioteca) com a carga de cada **série de trabalho** (faixa) nas datas anotadas. Regra completa em "Gráfico de evolução — como funciona" (abaixo). Código em `js/evolucao.js` (`Treino.evolucaoDados`, `Treino.svgEvolucao`, `Treino.mountEvolucao`).
- **Ids estáveis por exercício e por série** (não mais por posição/índice): cada exercício tem um `id` (ex.: `seg_ex0`) e cada série tem um `id` único dentro do exercício (ex.: `s2`). O histórico é salvo com a chave `idExercicio_idSerie` em vez de `exIdx_setIdx`. Isso significa que **reordenar ou remover um exercício/série no meio da lista não troca mais a carga de lugar** — a carga continua associada ao exercício/série certo pelo id, não pela posição.
  - Dados antigos (histórico salvo com chave `exIdx_setIdx`, e edições de dia salvas sem ids) são **migrados automaticamente e silenciosamente** na primeira vez que o dia é aberto depois da atualização: o app gera os ids batendo com a posição que cada exercício/série ocupava naquele momento, converte as chaves do histórico e resalva tudo já no formato novo. Nada é perdido nesse processo; se por algum motivo uma posição antiga não existir mais na estrutura atual, a chave antiga é mantida como está (não é apagada).

### Segurança dos dados (não quebrar)

Todo o histórico e as edições moram só no storage do navegador, então o app nunca deve gravar por cima de algo que não conseguiu ler:

- `Treino.storageGet` **resolve `null` quando a chave não existe e REJEITA em erro real de leitura**. Com `window.storage`, se `get` rejeitar, confirma pela listagem (`list`) se a chave existe; se a listagem não confirmar (ou não estiver disponível), trata como "não existe".
- `Treino.loadDayHistory(slug, cb)` chama `cb(hist, failed)`. Se `failed` (erro de storage, JSON inválido ou formato inesperado), o histórico do dia vem `{}` mas `state.historyFailed[slug] = true`: aparece o aviso `.daywarn`, **o salvamento de cargas daquele dia fica bloqueado** (o campo volta ao valor anterior) e a migração de chaves não roda. A próxima renderização tenta ler de novo.
- `Treino.loadDayEdit(slug, cb)` chama `cb(editData, failed)`. Se `failed`, o dia é mostrado com o treino padrão, **sem ir para o cache** (`state.effective`), e `state.editFailed[slug] = true`. Nesse caso o **editor não abre** (alerta explicando), para não sobrescrever a edição salva com o padrão.
- `Treino.storageDelete(key)` apaga a chave e **não trata "já não existe" como erro** (usado por `clearDayEdit`, ou seja, resetar um dia sem edição salva não dá erro).
- O histórico é **relido do storage a cada renderização** (troca de aba/data) de propósito, sem cache: com o app aberto em duas abas/atalhos, um cache faria uma sobrescrever a outra.
- Todo valor vindo de dados (ex.: `data-key` das séries) passa por `escapeHtml` ao montar HTML.
- **O service worker (`sw.js`) e o `js/pwa.js` nunca leem nem gravam `localStorage`/`window.storage`**: só guardam arquivos do app. O teste `8-pwa` confere isso.
- **Preferências do aparelho** (`treino:theme`, `treino:lastBackup`, `treino:timer`): ficam **fora do backup**, a importação nunca as altera, falha de leitura/gravação nunca atrapalha o app nem mostra alerta, e uma leitura lenta que termina depois de o usuário já ter escolhido **não** sobrescreve a escolha dele.
- **Importação = entrada não confiável.** `validateBackup` copia campo a campo (nada do arquivo vai direto ao storage/HTML): ids só `[A-Za-z0-9_-]` (máx. 120, sem começar por `_`, e nunca `constructor`, `prototype`, `hasOwnProperty`, `toString`, `valueOf`, `__proto__`); ids de exercício/série não podem repetir; nomes, reps e referência têm limite de tamanho; datas precisam ser reais (`AAAA-MM-DD`); `weight` numérico entre 0 e 1000; `repsDone` texto de até 20 caracteres; máx. 30 registros por série (mantém os mais recentes; data repetida vale a última). **Edição inválida derruba o arquivo inteiro** (para não apagar o treino do usuário); registro/chave de histórico inválido é só descartado e contado.

### Como o código foi separado (estrutura atual)

O app saiu de um único arquivo (`index.html.html` com HTML + CSS + JS juntos) para esta estrutura:

| Arquivo               | Responsabilidade                                                                  |
| --------------------- | --------------------------------------------------------------------------------- |
| `index.html`          | Página principal. Só estrutura + links. **Usar este arquivo.**                    |
| `index.html.html`     | Mesmo conteúdo do `index.html` (atalho antigo). Manter os dois iguais se existir. |
| `css/styles.css`      | Visual, **100% por tokens de cor**: `:root` = tema escuro, `:root[data-theme="light"]` = claro (mesmos tokens nos dois; nenhuma cor fixa fora desses blocos). Contém (inclui estilos do editor: `.editbar`, `.edit-field`, `.edit-input`, `.icon-btn`, `.icon-btn.swap-ex`, `.drag-handle`, `.dragging`, `.drop-before`, `.drop-after`, `.sorting-ex`, da meta: `.ex-goal`, `.addbtn`, `.savebtn`, `.resetbtn`, da barra de data: `.datebar-controls`, `.todaybtn`, do indicador padrão/editado: `.daystatus`, e do campo de reps feitas: `.reps-input-wrap`, `.reps-input`, do aviso de leitura falha: `.daywarn`, e do painel de backup: `.backup-box`, `.backup-row`, `.backup-btn`, `.backup-last`, `.backup-text`, do botão de copiar cargas: `.copylast-btn`, e do temporizador: `.rt-wrap`, `.rt-fab`, `.rt-bar`, `.rt-time`, `.rt-btn`, `.rt-chip`, `.rt-toggle`, tokens `--timer-*`, classes `rt-pad-fab`/`rt-pad-bar` no `body`, e da aba Evolução: `.tab-evo`, `.evo-day`, `.evo-day-title`, `.evo-card`, `.evo-ex`, `.evo-detail`, `.evo-legend`, `.evo-key`, `.evo-sw`, `.evo-s0`–`.evo-s4`, `.evo-chart`, `.evo-grid`, `.evo-axis`, `.evo-line`, `.evo-dot`, `.evo-warn`) |
| `js/data/workouts.js` | Dados padrão do treino (`Treino.DAYS`: slug, label, full, exercises, sets, ref opcional) — usado como fallback quando não há edição salva. Também define `Treino.ensureIds` (gera/normaliza ids de exercício e série) e `Treino.makeId` (gera id novo e único para itens criados no editor) |
| `js/storage.js`       | `storageGet` (null = não existe; rejeita em erro real), `storageSet`, `storageDelete`, `loadDayHistory` (`cb(hist, failed)`) |
| `js/history.js`       | `lastEntryBefore` (último registro estritamente anterior à data), `entryForDate`, `upsertEntry` (grava carga e/ou reps feitas de forma independente via patch `{weight}` / `{repsDone}`; ordena por data e mantém os 30 mais recentes), `mergeHistoryArrays`, `migrateHistoryKeys` (converte chaves antigas `exIdx_setIdx` para `idExercicio_idSerie`) e `copyLastLoads` (copia a última carga anterior para as séries sem carga da data; função pura) |
| `js/descanso.js`      | Funções puras `isDescanso`, `addDescanso`, `removeDescanso` e normalização de datas ISO, sem mutar a lista recebida |
| `js/goals.js`         | Meta por exercício: `suggestGoal(exercicioEfetivo, historicoDoDia, dataExibida, stepKg)` → `{weight, reps, kind}` ou `null` (função pura), `formatGoal(g)` → `{text, note}`, constantes `STEP_KG` (por dia), `DEFAULT_STEP_KG`, `DELOAD_HEAVY_WEEKS` e `DELOAD_REDUCTION` |
| `js/evolucao.js`      | Gráfico de evolução (só leitura). Funções puras: `evolucaoDados(exercicio, hist, hojeISO)` → `{sets, datas}` e `svgEvolucao(dados)` → HTML do SVG (ou `""`). Tela: `mountEvolucao(root)` lê todos os dias, nunca grava. Constantes `EVO_MAX_DATAS` (12) e `EVO_CLASSES` (5) |
| `js/xp.js`            | Livro de XP por data, cálculo de séries/exercícios/metas/bônus semanais, migração única, níveis e progresso. |
| `js/backup.js`        | `buildBackup(slugs, edits, hists, descanso, xp)` e `validateBackup(obj, slugs)` (formato v3; aceita v1/v2 antigos; sem acesso a storage nem DOM). Constantes `BACKUP_APP`, `BACKUP_VERSION = 3`, `BACKUP_MAX_BYTES`; lembrete do último backup: `describeLastBackup(iso, now)`, `LASTBACKUP_KEY = "treino:lastBackup"`, `BACKUP_STALE_DAYS = 7` |
| `js/edit.js`          | Persistência da edição de treino por dia (`treino:edit:{slug}`), migração de edições antigas sem id (`loadDayEdit`, `cb(editData, failed)`), merge com o padrão (`effectiveDay`), clone editável (`cloneForEdit`), reset (`clearDayEdit`, via `storageDelete`) |
| `js/icons.js`         | `Treino.icon(nome)` → `<svg>` decorativo (`aria-hidden`) que herda `currentColor`. Nomes: `edit`, `x`, `trash`, `repeat`, `plus`, `download`, `upload`, `sun`, `moon`, `copy`, `clipboard`, `play`, `pause`, `rotate-ccw`, `clock`, `volume`, `volume-off`, `grip`. Nome desconhecido → `""` |
| `js/theme.js`         | Tema: `applyTheme`, `toggleTheme`, `loadTheme`, `refreshThemeButton`, `THEME_KEY = "treino:theme"`, `THEME_COLOR` (meta `theme-color`). Aplica o escuro ao carregar; `app.js` chama `loadTheme()` no fim |
| `js/timer.js`         | Temporizador de descanso. Funções puras: `clampSeconds`, `formatMMSS`, `remainingMs`, `normalizeTimerPrefs`; constantes `TIMER_KEY = "treino:timer"`, `TIMER_MIN_S` (5), `TIMER_MAX_S` (900), `TIMER_DEFAULT_S` (90), `TIMER_PRESETS`, `TIMER_STEP_S`. Cria a barra no `document.body`; ganchos usados pelo `app.js`: `Treino.timerOnSetSaved(key)` e `Treino.timerSetEditing(bool)`; para testes: `Treino.timerState()` e `Treino.timerTick()`. Não grava treino nem histórico |
| `js/sortable.js`      | Reordenar por arraste: `moveItem(arr, from, to)` e `dropIndex(centers, y)` (funções puras) e `startDrag(e, opts)` (Pointer Events, auto-rolagem, modo compacto, `onFinish(from, to, committed)`). Não altera dados: quem chama (`app.js`) move no rascunho e re-renderiza |
| `test/`               | Testes automatizados (Node + jsdom, sem navegador, storage falso em memória — não mexem nos dados reais). Inclui `11-xp.test.js` para XP/níveis e fluxo de tela/backup. Rodar: `cd test && npm install && npm test` |
| `manifest.webmanifest`| Nome, `display: standalone`, `start_url`/`scope` relativos (`./`), cores (`#0B1219`) e ícones (`any` 192/512 e `maskable` 512) |
| `sw.js`               | Service worker: lista `ASSETS` (todos os arquivos do app, em caminhos **relativos**) e `VERSION` **gerada** por `tools/atualizar-sw.js`. Cache primeiro; instala com `cache: "reload"`; ativa apagando só caches `treino-*` antigos; ignora POST e outros sites |
| `js/pwa.js`           | Registra `sw.js` só em HTTPS ou localhost, depois do `load`; qualquer falha é ignorada. Carregado **por último** |
| `icons/`              | `icon-192.png`, `icon-512.png` (cantos transparentes), `icon-maskable-512.png` e `apple-touch-icon.png` (180, sangrados, sem transparência), `favicon-32.png`. Gerados a partir da imagem enviada pelo usuário |
| `tools/atualizar-sw.js` | `node tools/atualizar-sw.js` recalcula `VERSION` pelo conteúdo dos arquivos de `ASSETS` (sem dependências). Exporta `lerAssets`, `calcularVersao`, `versaoAtual` (usados pelo teste) |
| `js/app.js`           | Estado (`state.view`: `"treino"` / `"evolucao"`), render das abas (incluindo `#tabEvo`), render do modo normal (campos de kg + reps feitas), da tela de evolução (`Treino.mountEvolucao`) e do modo de edição, sincronização automática da data (`syncToday`, `dateManual`; **não chama `renderBody` se `state.view === "evolucao"`**), carregamento + migração do histórico (`loadHistoryMigrated`, com `state.historyFailed`/`state.editFailed`), backup (`readAllFresh`, `exportBackup`, `copyBackup`, `handleImportFile`, `handleImportText`, `confirmAndImport`, `bindBackupEvents`, `refreshLastBackup`), `copyLastLoads` (botão), os **2 ganchos do temporizador** (`renderBody` chama `Treino.timerSetEditing(state.editMode)`; o `change` dos campos chama `Treino.timerOnSetSaved(key + "@" + data)` depois de gravar com sucesso), indicador padrão/editado (`dayStatusHtml`), `todayStr()` em fuso local, eventos. **`refreshDirty` só marca `.tab[data-day]`** (a aba Evolução tem classe `.tab` mas não é um dia — tratar todos os `.tab` quebra em `DAYS[NaN].slug`). Ao entrar no editor, remove `#tabEvo` na hora (`finishEnterEdit`), porque o `render()` completo só roda ao sair |

Scripts carregam nesta ordem, sem módulos ES (para abrir como arquivo local). **Arquivo novo em `js/` = linha `<script>` no `index.html` (e no `index.html.html`, se existir).** O `harness.js` abre o `index.html` de verdade, então um script que faltar ali faz os testes falharem:

1. `js/data/workouts.js`
2. `js/storage.js`
3. `js/history.js`
4. `js/descanso.js`
5. `js/goals.js`
6. `js/edit.js`
7. `js/backup.js`
8. `js/sortable.js`
9. `js/icons.js`
10. `js/theme.js`
11. `js/timer.js`
12. `js/evolucao.js`
13. `js/xp.js`
14. `js/app.js`
15. `js/pwa.js`

Namespace global: `window.Treino`.

Formato de um dia em `workouts.js` (padrão/fallback, antes de `ensureIds` rodar — os `sets` podem ser só texto; `ensureIds` normaliza para `{id, reps}` e preenche os `id` de exercício/série que faltarem):

```js
{ slug: "seg", label: "Seg", full: "Segunda - Push", exercises: [
  { name: "Nome do exercício", sets: ["15","10","8","6 a 8"], ref: "Referência: opcional" }
]}
```

Formato salvo em `treino:edit:{slug}` (quando o usuário edita pelo app — já com ids):

```json
{ "full": "Segunda - Push", "exercises": [
  { "id": "seg_ex0", "name": "Nome do exercício", "ref": "", "sets": [
    { "id": "s0", "reps": "15" },
    { "id": "s1", "reps": "10" },
    { "id": "s2", "reps": "8" }
  ] }
]}
```

A chave de cada série no histórico é `idExercicio + "_" + idSerie` (ex.: `seg_ex0_s2`), calculada sobre a lista **efetiva** (editada ou padrão). Reordenar, adicionar no meio ou remover exercícios/séries **não desalinha mais o histórico**, porque a chave depende do id, não da posição. Chaves antigas (`exIdx_setIdx`) são migradas automaticamente na primeira leitura de cada dia.

Formato atual do arquivo de backup (`version: 2`; `descanso` é uma lista raiz de datas ISO; `edit: null` = dia usa o treino padrão):

```json
{ "app": "treino-da-semana", "version": 2, "exportedAt": "2026-09-28T23:10:00.000Z", "descanso": ["2026-10-14"],
  "days": {
    "seg": { "edit": null, "history": { "seg_ex0_s0": [ { "date": "2026-09-22", "weight": 23, "repsDone": "15" } ] } },
    "ter": { "edit": { "full": "Terça - Pull", "exercises": [ { "id": "ter_ex0", "name": "…", "ref": "", "sets": [ { "id": "s0", "reps": "10" } ] } ] }, "history": {} }
  } }
```

Backups `version: 1` sem `descanso` continuam importáveis e restauram a lista vazia. Datas inválidas no campo `descanso` são descartadas e contadas, sem rejeitar o backup. Aumente `BACKUP_VERSION` em futuras mudanças e mantenha a leitura de versões antigas em `validateBackup`.

Formato de um registro dentro do histórico (`treino:{slug}`), por chave de série — `weight` e `repsDone` são independentes, cada um pode existir sem o outro:

```json
{ "date": "2026-09-22", "weight": 23, "repsDone": "15" }
```

### Atualizações futuras (não fazer agora, só ter em mente para não fechar o caminho)

Ordem combinada das próximas (cada uma só quando o usuário mandar):

1. Fases seguintes de metas/progressão (pontos, níveis, XP e metas semanais) — meta por exercício e semana leve/deload estão prontas; o gráfico de **carga** da aba Evolução já está pronto (gráfico das **reps feitas** ainda não)
2. Fase B do visual (observações, grupo muscular, foto, treinos livres) — adiada

Possível, só se o usuário pedir: aviso do fim do descanso com o app fechado (exige push com servidor); botão "Instalar app" próprio no Android (`beforeinstallprompt`).

Já feitos (não refazer): dark mode, copiar cargas da última sessão, temporizador de descanso entre séries, modo descanso por data, backup Copiar/Colar + lembrete, PWA, gráfico de evolução da carga, semana leve/deload automática.

### Pendências conhecidas (fazer antes das metas, só quando o usuário pedir)

- **Renomear um exercício no campo de nome mantém o mesmo id** (de propósito: serve para corrigir erro de digitação sem perder o histórico). Para trocar por um exercício diferente, usar o botão 🔄 "Trocar exercício" (já feito, gera id novo). Assim a meta, que usa o histórico por id, não recebe cargas de outro exercício.
- Já feitos, na ordem: exportar/importar, "trocar exercício" com id novo, reordenar por arraste, testes automatizados, `goals.js`, tema escuro/claro + ícones SVG, backup Copiar/Colar + lembrete do último backup, copiar cargas da última sessão, temporizador de descanso, PWA, gráfico de evolução da carga, modo descanso por data e semana leve/deload automática.

### Meta por exercício — como funciona (fase 1, FEITA)

Pontos, níveis, XP, metas semanais e gráficos de reps feitas continuam como fases posteriores. A semana leve/deload automática já está implementada como extensão desta meta.

**Objetivo:** abaixo de cada exercício do modo normal, uma linha com a meta sugerida para a data exibida, ex.: `Meta hoje: 25 kg × 8`. Só leitura.

**Definições (decisões tomadas na implementação — ajuste em `js/goals.js` + testes se mudar):**

- **Série de trabalho** = série cujo reps-alvo é uma faixa (`"6 a 8"`, `"6 a 10"`; também aceita `"6-8"`). Séries só numéricas (`"15"`, `"10"`, `"8"`) são aquecimento/adaptação e são ignoradas. Sem nenhuma série com faixa (ex.: só `["8"]`) → **sem meta**.
- **Sessão** = data (estritamente anterior à data exibida) em que **TODAS** as séries de trabalho do exercício têm carga numérica > 0 **e** reps feitas numéricas. Sessão incompleta é ignorada. Com menos de 2 sessões completas → **sem meta** (melhor nada do que meta ruim). Consequência: se o usuário adiciona uma série de trabalho nova, as sessões antigas deixam de contar e a meta só volta depois de 2 sessões novas.
- **Base** = carga e faixa da **última série de trabalho** (na ordem do treino) da sessão mais recente.
- **"Mesma carga"** = cada série de trabalho tem a mesma carga nas duas sessões (compara série a série).

**Regra (ordem de avaliação, s1 = sessão mais recente, s2 = anterior, s3 = a anterior a s2):**

1. Mesma carga em s1 e s2 e TODAS as séries de trabalho com reps ≥ topo da faixa nas duas → **`up`**: carga da base + 1 degrau, reps = piso da faixa da última série (ex.: `27 kg × 6`).
2. Existe s3, mesma carga em s1/s2/s3 e a soma de reps caiu duas vezes seguidas (s3 > s2 > s1), e reduzir um degrau não zera a carga → **`down`**: carga − 1 degrau, reps = piso.
3. Duas sessões seguidas com alguma série abaixo do piso, **ou** mesma carga e a soma de reps caiu de s2 para s1 → **`hold`**: mesma carga, reps = as da última série da s1 limitadas à faixa (repetir o último desempenho, pelo menos o piso). Nunca sugere aumento.
4. Caso contrário (dentro da faixa, sem bater o topo em todas; ou a carga mudou entre as sessões) → **`reps`**: mesma carga, +1 rep na série mais longe do topo (nunca passa do topo nem fica abaixo do piso).

- **Degrau:** `Treino.STEP_KG = { seg: 2, ter: 2, qui: 2, qua: 5, sex: 5 }` (padrão `DEFAULT_STEP_KG = 2`); nunca mais de um degrau por vez.
- **Semana leve/deload automática:** ciclo individual por exercício (id), contado desde a data mais antiga encontrada em qualquer série/campo do histórico daquele exercício até a data exibida. `Treino.DELOAD_HEAVY_WEEKS = 4` define quatro semanas pesadas; o ciclo tem cinco semanas e as semanas 4, 9, 14… são leves. Exige as mesmas duas sessões completas da meta normal. Quando a semana é leve, tem prioridade sobre `up`/`down`/`hold`/`reps`: sugere 10% menos que a carga-base da última série de trabalho e o piso da faixa, com `kind: "deload"`; `Treino.DELOAD_REDUCTION = 0.1`. Cargas-base de até 2 kg são mantidas para evitar sugerir uma carga muito pequena; o resultado nunca fica zerado ou negativo. Usa a data exibida e não grava chave nem estado do ciclo.
- **Usa a data exibida**, não a real: ao ver um treino antigo, só entram sessões anteriores àquela data (igual à "última carga").
- Tudo por **ids** (`idExercicio_idSerie`): reordenar/editar o treino mantém a meta no exercício certo; exercício trocado (id novo) começa sem meta.
- **Texto** (`formatGoal`): `Meta hoje: 27 kg × 6` + nota discreta: `subir a carga` / `+1 rep` / `manter a carga` / `reduzir um degrau` / `semana leve`. Sem tom de punição. Peso com ponto decimal (como no resto do app).
- Não cria chaves de armazenamento e não muda o formato de `treino:{slug}` nem de `treino:edit:{slug}`.
- Testes em `test/3-goals.test.js` (regra pura + tela); os casos do deload foram escritos antes do código.

### Gráfico de evolução — como funciona (FEITO)

**Objetivo:** ver a carga de cada série de trabalho ao longo das datas, sem sair do app. **Não faz parte desta fase:** gráfico das reps feitas, pontos/nível, comparar exercícios, filtrar período.

- **Onde mora:** `js/evolucao.js`. Funções puras (`evolucaoDados`, `svgEvolucao`) + `mountEvolucao(root)` que monta a tela no `#body`. **Só leitura:** não grava `treino:{slug}`, `treino:edit:{slug}` nem preferências. Teste de tela confirma que abrir a aba e os gráficos não muda o storage.
- **Aba:** `#tabEvo` (texto "Evolução", classes `.tab.tab-evo`) depois de Sex, **só no modo normal**. Título do cabeçalho vira "Evolução das cargas". Sem barra de data, sem editor, sem toast, sem backup, sem copiar cargas. Clicar num dia (Seg–Sex) volta ao modo normal (`state.view = "treino"`) e **não** dispara o temporizador. No editor a aba **não existe**; se `render()` rodar com editor + evolução ao mesmo tempo, força `state.view = "treino"`.
- **`state.view`:** `"evolucao"` ou treino (qualquer outro valor). `syncToday` atualiza `state.date` / `#dt` mas **não chama `renderBody`** com a Evolução aberta (não há `#dt` nessa tela, e redesenhar o corpo cobriria a lista).
- **Lista:** lê **todos** os dias em paralelo (`loadDayEdit` + `loadDayHistory` + `effectiveDay` + `migrateHistoryKeys` **só em memória** — a migração da tela de evolução **não resalva**). Agrupa por dia (título = `full` efetivo). Toque num exercício abre o detalhe e fecha os outros (`aria-expanded`). Sem cargas nas séries de trabalho → texto "Ainda não há cargas anotadas…", sem SVG.
- **Leitura falha:** se edição **ou** histórico de um dia falhar, aquele dia mostra `.daywarn.evo-warn` e **não lista exercícios**; os outros dias seguem. Recarregar a página tenta de novo. Não abre o editor a partir daqui.
- **O que entra no gráfico:** só **séries de trabalho** (reps-alvo em faixa `"6 a 8"` / `"6-8"`, a mesma ideia da meta); aquecimento numérico (`"15"`, `"10"`) fica de fora. Só pontos com **carga numérica > 0**; registro só com reps feitas não vira ponto nem data no eixo. Datas **posteriores a hoje** (fuso local, mesmo critério de `todayStr`) são ignoradas. No máximo as **12 datas mais recentes** (`EVO_MAX_DATAS`) em que alguma série de trabalho tem carga. Tudo por **id** (`idExercicio_idSerie`): reordenar não mistura linhas.
- **SVG:** desenhado à mão (sem biblioteca). Sem pontos → string vazia. Uma polilinha por série com 2+ pontos; uma bolinha por ponto. Cores por classe cíclica `.evo-s0` … `.evo-s4` (tokens já existentes: `--accent`, `--warn-text`, `--info-text`, `--danger-text`, `--text-muted` — **nenhum hex no SVG**). Uma só data / carga constante não gera `NaN`. Legenda: `S3 · 6 a 8` (rótulo pela posição atual no treino).
- **CSS:** bloco no fim de `css/styles.css` (ver tabela). `.tab-evo { margin-left: auto; }` empurra a aba para a direita.
- **Editor / `refreshDirty`:** a aba Evolução tem classe `.tab` mas **não tem `data-day`**. `refreshDirty` e os cliques de dia usam **`.tab[data-day]`**; índice inválido é ignorado. Ao terminar de entrar no editor (`finishEnterEdit`), `#tabEvo` é removido do DOM (o `render()` completo ainda não rodou). Sem isso: `DAYS[NaN].slug` derruba a suíte ao abrir o editor.
- **Testes:** `test/9-evolucao.test.js` (escritos antes do código): regra pura (faixa vs aquecimento, ordem, futuro, teto de 12 datas, ids, vazio), SVG (polilinha/bolinha, classes, sem hex, sem NaN) e tela (aba depois de Sex, 32 exercícios, sem campos de carga/data, abrir gráfico, vazio, futuro, dia ilegível só naquele dia, só leitura, voltar ao dia, aba some no editor).
- **Teste manual no celular:** abrir Evolução, expandir um exercício com histórico, conferir legenda e gráfico no tema claro e escuro; dia sem carga mostra a mensagem; voltar a Seg continua salvando; com o app aberto na Evolução por virar a meia-noite, a tela **não** deve virar a lista de séries sozinha.

### Temporizador de descanso — como funciona (fase 1, FEITO)

**Objetivo:** descanso entre séries sem sair da tela de registro. Não faz parte: aviso com o app fechado ou a tela bloqueada (o navegador pausa o JavaScript; isso exigiria notificação push com servidor — **o PWA sozinho não resolve**, e fica fora do app simples), histórico de descansos, tempo por exercício.

- **Onde mora:** `js/timer.js` cria o `#restTimer` direto no `document.body` (**fora do `#app`**, senão o `render()` o apagaria). Estrutura estática criada uma vez; `paint()` só atualiza atributos/texto (não recria, para não perder o foco do teclado). Cliques por delegação com `data-act` (`open`, `toggle`, `reset`, `close`, `adj`, `preset`, `auto`, `sound`).
- **Visual:** parado = botão flutuante redondo (relógio) no canto; aberto/contando = barra com `MM:SS`, estado ("Descanso / Descansando / Pausado / Descanso acabou"), iniciar-pausar, zerar, fechar, atalhos `−15` · `60s` · `90s` · `120s` · `+15` e, quando não está contando, os interruptores "Iniciar ao salvar série" e "Som". Botões só de ícone têm `aria-label`; alvos ≥ 40px. Ao acabar, a barra muda de cor/pulsa 3 vezes (sem tom de alarme/punição; respeita `prefers-reduced-motion`). O `body` ganha `rt-pad-fab`/`rt-pad-bar` para a barra não cobrir o fim da página.
- **Modos:** `idle`, `running`, `paused`, `done`. Estado de contagem fica **só em memória** (recarregar a página zera).
- **Precisão:** guarda `endAt = Date.now() + ms` e calcula o que falta a partir dele (não conta "ticks"; `setInterval` só repinta, a cada 250 ms). Recalcula em `visibilitychange` e `focus`. Se o fim só for percebido **mais de 10 s depois** (aba em segundo plano), mostra "acabou" **sem** vibrar/apitar de susto.
- **Duração:** padrão 90 s; limites 5 s a 15 min (`clampSeconds`). Atalho com o parado só seleciona; contando/pausado **reinicia** com a nova duração. `±15`: contando/pausado mexe no que falta (nunca passa de 15 min); parado muda a duração escolhida.
- **Início automático:** depois que uma série foi **salva com sucesso** — carga > 0 **ou** reps feitas não vazias — `app.js` chama `Treino.timerOnSetSaved(chaveDaSerie + "@" + data)`. Só vale para **hoje** (`state.date === todayStr()`; corrigir treino antigo escolhido na mão não dispara). **Não** inicia com: carga inválida (campo volta ao valor anterior), carga 0, campo apagado, histórico ilegível (salvamento bloqueado), "Erro ao salvar", interruptor desligado, editor aberto. Salvar o **2º campo da mesma série** (mesma chave+data) **não reinicia** a contagem; outra série reinicia. `reset`/`close` limpam essa chave. *(Decisão: dispara tanto na carga quanto nas reps; se o usuário preferir só nas reps, mudar a condição `savedSet` em `app.js` e ajustar `7-timer.test.js`.)*
- **Fim do tempo:** `navigator.vibrate([250,120,250,120,500])` e 3 bipes via WebAudio (se o interruptor "Som" estiver ligado). O `AudioContext` é criado/retomado no primeiro toque/tecla em qualquer lugar da página (navegadores só liberam áudio após um gesto). **Tudo em `try/catch`**: sem vibração, sem áudio ou erro → o app segue normal.
- **Editor:** `renderBody()` chama `Treino.timerSetEditing(state.editMode)`; no editor a barra fica **escondida** (`hidden`) e a contagem continua em memória; ao sair volta. Trocar de aba (dia) ou de data **não reseta** nem re-renderiza a barra.
- **Armazenamento:** só a preferência `treino:timer` = `{"seconds":90,"auto":true,"sound":true}` (via `storageGet`/`storageSet`, como o tema). **Fora do backup**; importar não a altera; valor corrompido/inválido → padrão (segundos limitados a 5–900, `auto`/`sound` só ficam falsos se forem `false`); leitura lenta não sobrescreve uma escolha já feita. **Não cria nem altera** `treino:{slug}` nem `treino:edit:{slug}`.
- **Testes:** `test/7-timer.test.js` (27 testes, escritos com relógio e vibração simulados via `c.w.Date.now` e `c.w.navigator.vibrate`). Cobre contagem, pausa, ±15 s, atalhos, limites, início automático e cada caso em que **não** inicia, 2º campo da mesma série, editor, troca de aba, preferência (corrompida, falha de leitura/gravação, leitura lenta), backup/importação, rótulos, alvos de toque, ícones e tokens. `4-visual.test.js` confere o contraste dos pares `--timer-*`.
- **Teste manual no celular (o jsdom não cobre):** som e vibração no fim; tela bloqueada e aba em segundo plano; se a barra fixa cobre algo; comportamento com o teclado numérico aberto; botão flutuante não atrapalhando o toque nos campos do último exercício.

### PWA — como funciona (FEITO)

**Objetivo:** instalar o app na tela inicial e abrir sem internet. **Não faz parte:** push/notificação, sincronização entre aparelhos, trocar a arquitetura (continua HTML + CSS + JS puro, sem framework e sem build).

- **Hospedagem:** o service worker **só funciona em HTTPS (ou localhost)** — não em arquivo aberto direto (`file://`); nesse caso o app funciona normal, só sem instalação/offline. Todos os caminhos são **relativos** (`./`, `index.html`, `icons/...`), então funciona em subpasta (ex.: `usuario.github.io/APP-Treino/`).
- **⚠ O `localStorage` é preso ao endereço (origem).** Mudar o app de lugar (arquivo local → link publicado, ou trocar o domínio) **não leva o histórico junto**. Antes de mudar: **Exportar backup** no endereço antigo e **Importar** no novo. **No iPhone o app instalado na tela inicial tem armazenamento SEPARADO do Safari**: ele começa vazio, mesmo no mesmo endereço. Antes de instalar, **Exportar/Copiar backup no Safari** e **Importar/Colar no app instalado** (vale também para o Prompt de uso diário: depois de instalar, use só o app instalado). Sem instalar, o Safari pode apagar os dados do site após ~7 dias sem uso; o app instalado não tem esse limite. No Android o app instalado continua vendo os mesmos dados do navegador.
- **Arquivos:** `manifest.webmanifest`, `sw.js`, `js/pwa.js`, `icons/*`, `tools/atualizar-sw.js` (ver tabela). No `index.html`: `<link rel="manifest">`, `<link rel="icon">`, `<link rel="apple-touch-icon">`, metas `mobile-web-app-capable` / `apple-mobile-web-app-capable` / `apple-mobile-web-app-title` e `<script src="js/pwa.js">` **por último**.
- **Estratégia do cache:** *cache primeiro* (abre na hora, mesmo com sinal ruim na academia). Na instalação baixa tudo de `ASSETS` ignorando o cache HTTP (`cache: "reload"`); navegação desconhecida cai no `index.html`; o que não está no cache vai para a rede. `skipWaiting` + `clients.claim`: a versão nova assume sozinha e vale na **próxima abertura** (a tela aberta continua com o JS que já carregou). Só mexe em arquivos do app: **não toca nos dados**.
- **Versão automática (regra de ouro):** `VERSION` em `sw.js` é um código do **conteúdo** dos arquivos de `ASSETS`. **Mudou qualquer arquivo do app (JS, CSS, HTML, manifest, ícone) → rode `node tools/atualizar-sw.js` antes de publicar e de rodar o `npm test`.** Sem isso o celular continuaria com os arquivos antigos; o teste `8-pwa` **falha** se a versão estiver desatualizada, se um arquivo de `js/` ou `css/` não estiver em `ASSETS`, ou se algum item da lista não existir. **Arquivo novo = adicionar em `ASSETS` (`sw.js`) e rodar a ferramenta.** Se os arquivos mudarem de formato de linha (CRLF/LF) ao copiar entre computadores, rode a ferramenta de novo.
- **Ícones:** feitos a partir da imagem do usuário (halter branco com dois traços vermelhos sobre fundo preto arredondado). `icon-192/512`: cantos transparentes (`purpose: any`). `icon-maskable-512` e `apple-touch-icon`: **sem transparência** (o iPhone pinta transparência de preto; o Android recorta em círculo/quadrado), com a arte dentro da zona segura. Trocar o visual = gerar de novo os 5 PNGs, manter nomes e tamanhos, e rodar a ferramenta de versão.
- **Instalar:** Android (Chrome): menu ⋮ → "Instalar app"/"Adicionar à tela inicial". iPhone (Safari): Compartilhar → "Adicionar à Tela de Início". Abre em tela cheia, sem barra do navegador.
- **Limite conhecido:** o aviso do fim do descanso continua só com o app aberto (ver temporizador). O PWA não muda isso.
- **Testes:** `test/8-pwa.test.js` (17 testes): manifest (campos, cores iguais ao `theme-color`, caminhos relativos), ícones (existem, tamanho certo, maskable/Apple sem transparência), `index.html` (links, `pwa.js` por último, ordem dos scripts preservada), `ASSETS` completo e existente, `VERSION` em dia (e que muda só quando um arquivo muda), `sw.js` num ambiente simulado (instala tudo com `reload`, ativa apagando só `treino-*`, abre do cache, cai no `index.html`, ignora POST e outros sites), `pwa.js` (HTTPS/localhost registra; `file://`, HTTP comum e sem suporte não; falhas ignoradas), nenhum acesso a storage, e o app abre normal sem erro.
- **Teste manual no celular (o jsdom não cobre service worker de verdade):** abrir o link publicado, instalar, abrir pelo ícone (tela cheia, ícone certo, sem recorte estranho); **modo avião → abrir o app** (carrega e salva carga normalmente); atualizar o app (publicar versão nova, abrir, fechar e abrir de novo → mudança aparece); tema escuro e claro em tela cheia; no **iPhone**, confirmar que o app instalado começa sem histórico, importar o backup feito no Safari e conferir cargas, treino editado, tema e preferência do temporizador (a preferência `treino:timer`, o tema e a data do último backup também não vêm do Safari).

### Modo descanso / dia sem treino — como funciona (FEITO)

**Objetivo:** marcar uma data específica em que não houve treino; a marcação não pertence a uma aba/dia fixo da semana.

- **Armazenamento:** `treino:descanso` é uma lista JSON ordenada, sem duplicatas, de datas ISO (`AAAA-MM-DD`). É dado de treino e entra no backup; não é preferência local. `js/descanso.js` oferece `Treino.isDescanso(lista, data)`, `addDescanso` e `removeDescanso`, sem mutar a entrada.
- **Interface:** o botão na barra da data alterna entre “Marcar descanso” e “Remover descanso”. No dia marcado, o corpo mostra somente o cartão “Dia de descanso”; a lista, a meta, os campos e “Copiar cargas da última sessão” somem. O painel de backup continua disponível.
- **Registro acidental/intencional:** se um evento de edição de carga/reps chegar para uma data marcada (por exemplo, um campo que ainda estava ativo durante a troca de data), o app pede confirmação. Confirmar remove a marca e salva a alteração normalmente; cancelar restaura o campo e não grava nem inicia `timerOnSetSaved`.
- **Segurança:** leitura ausente significa lista vazia; JSON/formato inválido ou falha de leitura impede gravar sobre a chave. Falha de escrita mantém a tela/estado atual e mostra o toast de erro já existente; não há alerta novo. `goals.js` e `evolucao.js` não precisam de regra adicional porque descanso não cria registros numéricos.
- **Backup v2:** `descanso` fica na raiz do JSON. `validateBackup` valida datas reais e descarta itens inválidos com contagem; backup v1 sem o campo restaura lista vazia. Exportar, copiar, importar e o backup automático anterior à importação incluem a chave.
- **Arquivos:** `js/descanso.js`, `js/app.js`, `js/backup.js`, `css/styles.css`, `index.html`, `sw.js`, `test/10-descanso.test.js` e este documento.
- **Testes:** `test/10-descanso.test.js` cobre as funções puras, UI, confirmação/cancelamento e temporizador, backup v1/v2, validação e falhas de storage.

### Visual — regras ao mexer no CSS/markup

- **Token novo de texto/fundo entra também na lista `PARES` de `test/4-visual.test.js`** (foi o que se fez com os `--timer-*`).
- **Só tokens:** toda cor nova entra como `--token` **nos dois** temas; usar `var(--token)` nas regras. `test/4-visual.test.js` falha se faltar token em um tema, se houver cor fixa fora dos blocos de tema, se algum par texto/fundo ficar abaixo de contraste WCAG (4.5:1 texto; 3:1 placeholder), se carga e reps deixarem de ter matizes diferentes (≥ 60°) ou se o `.icon-btn` ficar menor que 40px.
- **Botão com ícone:** montar com `Treino.icon("nome")` + texto num `<span>`/nó de texto. **Nunca** `btn.textContent = ...` num botão que tem ícone (apaga o SVG): usar `innerHTML` (ver `editBtnHtml` em `app.js`). `#saveEdit` continua só texto (o `refreshDirty` usa `textContent`).
- **Contraste do botão primário:** no escuro é texto escuro (`--on-accent`) sobre verde claro (`--accent-bg`); branco sobre esse verde não passa no contraste.

### Regras de implementação

- **PWA:** mudou qualquer arquivo listado em `ASSETS` (`sw.js`) → `node tools/atualizar-sw.js`, depois `npm test`. Arquivo novo em `js/`, `css/` ou `icons/` → entra em `ASSETS` e no `index.html` (se for script/CSS).
- **Testes:** antes de dar uma mudança como pronta, rode `cd test && npm test` (pasta **`test`**, não `tests`; precisa terminar com 0 falharam; hoje são **218** testes). Mudou comportamento → ajuste/crie o teste junto; achou bug → primeiro um teste que falha, depois a correção. Faça os testes cobrirem o que o usuário realmente espera (ex.: "a carga continua no exercício certo depois de reordenar"), não só que o código roda. O jsdom não tem layout nem toque: arraste, rolagem, modo compacto e download/upload de arquivo continuam exigindo teste manual no celular.
- Continue em arquivos separados (não volte tudo para um HTML só).
- Altere o mínimo necessário; não refatore o que já funciona.
- Interface em português, fácil de usar no celular (dedo grande, poucos toques).
- Nunca use `toISOString()` para a data do treino (UTC); use `todayStr()`.
- Nunca grave por cima de dados que não foram lidos com sucesso (veja "Segurança dos dados").
- Depois de mudar UI, teste no navegador: trocar de aba (incluindo Evolução e voltar), editar um nome, trocar um exercício pelo 🔄 (o novo aparece sem histórico e o antigo não volta), arrastar exercício e série pela alça ⠿ (com dedo no celular, inclusive rolando a página; cancelar não muda nada; sem salvar, a ordem não persiste), recarregar a página, conferir se a carga antiga ainda aparece no exercício certo, e testar reordenar/remover para confirmar que o histórico não se perde. Se mexer em storage/histórico, teste também: JSON corrompido em `treino:{slug}` (aviso visível, nada é sobrescrito), edição corrompida em `treino:edit:{slug}` (editor não abre) e reset de um dia sem edição salva (sem erro). Se mexer no temporizador, teste no celular: salvar uma série inicia a contagem; segundo campo da mesma série não reinicia; pausar/continuar; fim com vibração e som (com o som desligado, só vibra); bloquear a tela e voltar (mostra "acabou" sem apitar se já passou muito tempo); abrir o editor (a barra some) e fechar (volta); trocar de aba/dia (continua contando); trocar para tema claro e conferir legibilidade; recarregar (preferência de duração e interruptores continuam). Se mexer no backup, teste: exportar → apagar os dados do site → importar (tudo volta, inclusive edições); importar por cima de dados existentes (baixa o backup automático antes); cancelar a confirmação (nada muda); JSON inválido, arquivo de outro app e `id` malicioso (recusados sem gravar nada); exportar com um dia ilegível (bloqueado). Se mexer na Evolução: abrir um exercício com carga, um sem carga, um dia com histórico ilegível, o editor (aba some, não crasha) e o `syncToday` com a Evolução aberta.

Quando terminar, descreva o que mudou, em quais arquivos, e como o usuário edita o treino no app.

---
