# Prompt para continuar o APP Treino da Semana

Copie o bloco abaixo e cole em um chat novo no Cursor, na pasta `APP-Treino`.

---

## Prompt

Você está trabalhando no app **Treino da Semana**, pasta:

`C:\Users\Davi Lucca\Downloads\APP-Treino`

É um app web simples (HTML + CSS + JS), em português, para anotar a carga (kg) e as reps feitas de cada série do treino. Não use framework. Não transforme em React/Vue. Mantenha o visual atual (azul escuro, campos amarelos, mobile-first, max-width 480px). Preserve o salvamento no `localStorage` (chave `treino:{slug}`) e o fallback `window.storage` (usado no celular). Não quebre o histórico já salvo.

### O que o app já faz hoje

- Abas Seg / Ter / Qua / Qui / Sex com o treino da semana
- Campo de data do treino
- Lista de exercícios e séries (reps-alvo) com:
  - Campo de carga em kg (amarelo)
  - Campo pequeno de **reps feitas**, à esquerda do campo de kg, para anotar quantas repetições o usuário realmente conseguiu fazer naquela série
- Mostra a última carga e as últimas reps feitas registradas em data ANTERIOR à data exibida (placeholder em cada campo + texto "última: Xkg × Y reps (data)"); datas posteriores nunca são usadas como "última"
- Carga e reps feitas salvam de forma independente: preencher/limpar um não apaga o outro. O registro daquele dia só é removido do histórico quando os dois campos ficam vazios
- Salva ao sair do campo (evento `change`)
- Toast "Salvo"
- Histórico limitado a 30 registros por série (mantém os 30 mais recentes **por data**, não por ordem de inserção)
- Carga inválida (texto que não é número, ou negativo) não é salva: o campo volta ao valor anterior e o toast mostra "Carga inválida". Falha ao gravar mostra "Erro ao salvar"
- **"Hoje" é sempre a data no fuso LOCAL** (`todayStr()` monta a data com `getFullYear/getMonth/getDate`; **não usar `toISOString()`**, que é UTC e no Brasil vira "amanhã" depois das 21h).
- **Data do treino se auto-atualiza para "hoje"** mesmo se o app ficar aberto (aba ou atalho) por vários dias sem recarregar, evitando que uma carga nova sobrescreva por engano o registro de uma data antiga. Sincroniza ao voltar pra aba (`visibilitychange`), ao dar foco na janela e a cada 30 min. Se o usuário escolher uma data no passado na mão (pra revisar/editar treino antigo), a auto-sincronização é pausada (`dateManual = true`) e aparece um botão **"Hoje"** ao lado do campo de data para voltar rápido.
- **Editor de treino pelo próprio app, para TODOS os dias de uma vez** (botão "✏️ Editar treino"). Ao abrir, carrega e migra o histórico de todos os dias e cria um rascunho por dia (`state.draft[slug]`); trocar de aba dentro do editor muda o dia sendo editado sem perder os rascunhos dos outros; abas com alteração não salva mostram "●"; "Salvar treino" grava de uma vez só os dias que mudaram (`treino:edit:{slug}`); fechar com alterações pendentes pede confirmação. Permite:
  - Copiar o treino de outro dia (select + "Substituir este dia" / "Adicionar ao final"); usa o rascunho do dia de origem (inclui edições não salvas) e gera ids NOVOS para tudo, então as cargas nunca se misturam entre os dias
  - Editar o nome do dia (`full`)
  - Editar o nome de cada exercício
  - Adicionar / remover exercício do dia
  - Editar o texto de cada série (ex.: "6 a 8" → "8 a 10")
  - Adicionar / remover série de um exercício
  - Editar o texto de referência (`ref`, ex.: "Referência: 21-27-33-39kg")
  - Salvar a edição (persistente, mesma via `storageSet`)
  - Resetar o dia visível para o treino padrão de `workouts.js` (imediato, só daquele dia, sem sair do editor; apaga só a edição de estrutura; as cargas continuam), mostrando antes um preview (lista de exercícios e nº de séries) do que vai ser apagado
  - Confirmação antes de remover exercício, avisando que cargas já anotadas para ele podem ficar desassociadas
  - Indicador visual ("● Treino padrão" / "✎ Treino editado") no topo do corpo, mostrando se o dia atual está usando o treino padrão de `workouts.js` ou uma edição salva
- **Backup: exportar / importar (JSON)** — painel "Backup (treino + histórico)" no fim da tela do modo normal (não aparece no editor), com dois botões:
  - **⬇ Exportar**: lê o estado atual de TODOS os dias direto do storage (sem cache), migra chaves antigas do histórico e baixa `treino-backup-AAAA-MM-DD-HHMM.json`. Se algum dia não puder ser lido, o backup **não é gerado** (nunca sai um dia como se estivesse vazio).
  - **⬆ Importar**: escolhe um `.json`; o arquivo é validado por inteiro (`Treino.validateBackup`) antes de qualquer gravação. Mostra um resumo (data do backup, dias, treinos editados, registros, itens inválidos ignorados) e pede confirmação. Depois de confirmar, **baixa automaticamente um backup do estado atual** (`treino-backup-antes-da-importacao-...json`, só se houver algo a guardar) e então **substitui** treino e histórico dos dias presentes no arquivo (dias ausentes no arquivo não são tocados; `edit: null` no arquivo apaga a edição local, voltando ao treino padrão). Se algum dia atual estiver ilegível, pede uma 2ª confirmação (permite reparar dados corrompidos por importação). Limite de 5 MB por arquivo. Ao terminar, limpa os caches e re-renderiza.
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
- **Importação = entrada não confiável.** `validateBackup` copia campo a campo (nada do arquivo vai direto ao storage/HTML): ids só `[A-Za-z0-9_-]` (máx. 120, sem começar por `_`, e nunca `constructor`, `prototype`, `hasOwnProperty`, `toString`, `valueOf`, `__proto__`); ids de exercício/série não podem repetir; nomes, reps e referência têm limite de tamanho; datas precisam ser reais (`AAAA-MM-DD`); `weight` numérico entre 0 e 1000; `repsDone` texto de até 20 caracteres; máx. 30 registros por série (mantém os mais recentes; data repetida vale a última). **Edição inválida derruba o arquivo inteiro** (para não apagar o treino do usuário); registro/chave de histórico inválido é só descartado e contado.

### Como o código foi separado (estrutura atual)

O app saiu de um único arquivo (`index.html.html` com HTML + CSS + JS juntos) para esta estrutura:

| Arquivo               | Responsabilidade                                                                  |
| --------------------- | --------------------------------------------------------------------------------- |
| `index.html`          | Página principal. Só estrutura + links. **Usar este arquivo.**                    |
| `index.html.html`     | Mesmo conteúdo do `index.html` (atalho antigo). Manter os dois iguais se existir. |
| `css/styles.css`      | Visual (inclui estilos do editor: `.editbar`, `.edit-field`, `.edit-input`, `.icon-btn`, `.addbtn`, `.savebtn`, `.resetbtn`, da barra de data: `.datebar-controls`, `.todaybtn`, do indicador padrão/editado: `.daystatus`, e do campo de reps feitas: `.reps-input-wrap`, `.reps-input`, do aviso de leitura falha: `.daywarn`, e do painel de backup: `.backup-box`, `.backup-row`, `.backup-btn`) |
| `js/data/workouts.js` | Dados padrão do treino (`Treino.DAYS`: slug, label, full, exercises, sets, ref opcional) — usado como fallback quando não há edição salva. Também define `Treino.ensureIds` (gera/normaliza ids de exercício e série) e `Treino.makeId` (gera id novo e único para itens criados no editor) |
| `js/storage.js`       | `storageGet` (null = não existe; rejeita em erro real), `storageSet`, `storageDelete`, `loadDayHistory` (`cb(hist, failed)`) |
| `js/history.js`       | `lastEntryBefore` (último registro estritamente anterior à data), `entryForDate`, `upsertEntry` (grava carga e/ou reps feitas de forma independente via patch `{weight}` / `{repsDone}`; ordena por data e mantém os 30 mais recentes), `mergeHistoryArrays`, e `migrateHistoryKeys` (converte chaves antigas `exIdx_setIdx` para `idExercicio_idSerie`) |
| `js/backup.js`        | `buildBackup(slugs, edits, hists)` e `validateBackup(obj, slugs)` (validação/limpeza do arquivo importado; sem acesso a storage nem DOM). Constantes `BACKUP_APP`, `BACKUP_VERSION`, `BACKUP_MAX_BYTES` |
| `js/edit.js`          | Persistência da edição de treino por dia (`treino:edit:{slug}`), migração de edições antigas sem id (`loadDayEdit`, `cb(editData, failed)`), merge com o padrão (`effectiveDay`), clone editável (`cloneForEdit`), reset (`clearDayEdit`, via `storageDelete`) |
| `js/app.js`           | Estado, render das abas, render do modo normal (campos de kg + reps feitas) e do modo de edição, sincronização automática da data (`syncToday`, `dateManual`), carregamento + migração do histórico (`loadHistoryMigrated`, com `state.historyFailed`/`state.editFailed`), backup (`readAllFresh`, `exportBackup`, `handleImportFile`, `confirmAndImport`, `bindBackupEvents`), indicador padrão/editado (`dayStatusHtml`), `todayStr()` em fuso local, eventos |

Scripts carregam nesta ordem, sem módulos ES (para abrir como arquivo local):

1. `js/data/workouts.js`
2. `js/storage.js`
3. `js/history.js`
4. `js/edit.js`
5. `js/backup.js`
6. `js/app.js`

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

Formato do arquivo de backup (`version: 1`; `edit: null` = dia usa o treino padrão):

```json
{ "app": "treino-da-semana", "version": 1, "exportedAt": "2026-09-28T23:10:00.000Z",
  "days": {
    "seg": { "edit": null, "history": { "seg_ex0_s0": [ { "date": "2026-09-22", "weight": 23, "repsDone": "15" } ] } },
    "ter": { "edit": { "full": "Terça - Pull", "exercises": [ { "id": "ter_ex0", "name": "…", "ref": "", "sets": [ { "id": "s0", "reps": "10" } ] } ] }, "history": {} }
  } }
```

Se o formato mudar no futuro, aumente `BACKUP_VERSION` e mantenha a leitura de versões antigas em `validateBackup`.

Formato de um registro dentro do histórico (`treino:{slug}`), por chave de série — `weight` e `repsDone` são independentes, cada um pode existir sem o outro:

```json
{ "date": "2026-09-22", "weight": 23, "repsDone": "15" }
```

### Atualizações futuras (não fazer agora, só ter em mente para não fechar o caminho)

- UI de arrastar para trocar a ordem dos exercícios/séries — agora é segura de implementar, já que os ids estáveis preservam a associação com o histórico independentemente da ordem
- Gráfico de evolução da carga (e, agora que existe, também das reps feitas)
- Meta por exercício com dupla progressão (**PRIORIDADE MÍNIMA — fase 1 de metas/progressão, especificada na seção abaixo; não fazer agora**)
- Modo descanso / dia sem treino
- Temporizador de descanso entre séries
- Copiar cargas (e reps feitas) da última sessão para hoje
- Dark mode
- PWA / atalho na tela inicial

### Pendências conhecidas (fazer antes das metas, só quando o usuário pedir)

- **Renomear um exercício no editor mantém o mesmo id**, então as cargas antigas passam a valer para o "novo" exercício. Como a meta usa o histórico por id, isso geraria sugestões erradas. Ideia: ação "trocar por exercício diferente" que gera id novo (`Treino.makeId("ex")`) mantendo o nome antigo fora do histórico.
- Sugestão de ordem: "trocar exercício" com id novo → `goals.js`. (Exportar/importar já está feito.)
- Possível melhoria do backup: botão "Copiar backup" / "Colar backup" para ambientes em que baixar arquivo é bloqueado (ex.: visualizadores em iframe), e lembrete de "último backup feito em ...".

### Ideia futura — Meta por exercício (fase 1) — PRIORIDADE MÍNIMA, NÃO FAZER AGORA

Só implementar quando o usuário pedir explicitamente. Está registrada aqui para não fechar o caminho. Pontos, níveis, XP, metas semanais, semana leve (deload) e gráficos são fases posteriores e **não** fazem parte desta.

**Objetivo:** abaixo de cada exercício do modo normal, uma linha discreta com a meta sugerida para hoje, ex.: `Meta hoje: 25 kg × 8`. É só uma sugestão de leitura: não grava nada, não altera histórico nem estrutura.

**Regra (dupla progressão), calculada sobre as SÉRIES DE TRABALHO:**

- Série de trabalho = série cujo reps-alvo é uma faixa ("6 a 8", "6 a 10"). Séries só numéricas ("15", "10", "8") são aquecimento/adaptação e são ignoradas. Se o exercício não tem nenhuma série com faixa (ex.: só `["8"]`), **não mostrar meta**.
- Usar as 2 últimas sessões (datas) anteriores a hoje que tenham carga e reps feitas nas séries de trabalho desse exercício, lidas do histórico pela chave `idExercicio_idSerie`. Com menos de 2 sessões com dados completos, **não mostrar meta** (melhor nada do que meta ruim).
- Se em AMBAS as sessões todas as séries de trabalho atingiram o topo da faixa (ex.: 8 reps em "6 a 8") com a mesma carga → meta: subir a carga em **um** degrau e voltar ao piso da faixa (ex.: `27 kg × 6`).
- Se está dentro da faixa mas ainda não bateu o topo em todas → meta: mesma carga, +1 rep na série mais fraca (ex.: `25 kg × 7`).
- Se em 2 sessões seguidas ficou abaixo do piso da faixa, ou as reps caíram de uma sessão para a outra → meta: **manter** a carga (ou reduzir um degrau se caiu duas vezes); nunca sugerir aumento nesse caso. Sem tom de punição.
- Degrau inicial de carga: +2 kg em Push/Pull/Upper (`seg`, `ter`, `qui`) e +5 kg em Legs/Lower (`qua`, `sex`); manter como constante fácil de ajustar (ex.: `Treino.STEP_KG`). Nunca sugerir mais de um degrau de uma vez.
- Usar a carga e as reps da série de trabalho mais recente como base; ignorar séries sem `weight` numérico.

**Onde mexer (mínimo, sem refatorar o que funciona):**

- Novo arquivo `js/goals.js`, carregado em `index.html` depois de `js/history.js` e antes de `js/app.js` (sem módulos ES; namespace `Treino`). Contém uma função pura, ex. `Treino.suggestGoal(exercicioEfetivo, historicoDoDia, dataDeHoje)`, que devolve `{ weight, reps, kind: "up" | "reps" | "hold" }` ou `null`.
- `js/app.js`: no render do modo normal, chamar a função por exercício e, se vier resultado, mostrar a linha de meta perto de `.ex-ref`. Estilo novo pequeno em `css/styles.css` (ex.: `.ex-goal`), no visual atual (azul/amarelo, mobile-first). Não aparece no modo de edição.
- Não criar chaves novas no armazenamento e não mudar o formato de `treino:{slug}` nem de `treino:edit:{slug}`.

**Como testar quando for feito:** exercício sem faixa (sem meta); só 1 sessão (sem meta); 2 sessões batendo o topo (sobe um degrau); dentro da faixa (+1 rep); reps caindo (mantém); exercício reordenado/editado (a meta continua no exercício certo, pois usa ids); dia sem nenhum histórico (nada aparece, sem erro).

### Regras de implementação

- Continue em arquivos separados (não volte tudo para um HTML só).
- Altere o mínimo necessário; não refatore o que já funciona.
- Interface em português, fácil de usar no celular (dedo grande, poucos toques).
- Nunca use `toISOString()` para a data do treino (UTC); use `todayStr()`.
- Nunca grave por cima de dados que não foram lidos com sucesso (veja "Segurança dos dados").
- Depois de mudar UI, teste no navegador: trocar de aba, editar um nome, recarregar a página, conferir se a carga antiga ainda aparece no exercício certo, e testar reordenar/remover para confirmar que o histórico não se perde. Se mexer em storage/histórico, teste também: JSON corrompido em `treino:{slug}` (aviso visível, nada é sobrescrito), edição corrompida em `treino:edit:{slug}` (editor não abre) e reset de um dia sem edição salva (sem erro). Se mexer no backup, teste: exportar → apagar os dados do site → importar (tudo volta, inclusive edições); importar por cima de dados existentes (baixa o backup automático antes); cancelar a confirmação (nada muda); JSON inválido, arquivo de outro app e `id` malicioso (recusados sem gravar nada); exportar com um dia ilegível (bloqueado).

Quando terminar, descreva o que mudou, em quais arquivos, e como o usuário edita o treino no app.

---
