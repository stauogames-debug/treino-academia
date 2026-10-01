# Testes do Treino da Semana

Rodam no computador (Node.js 18 ou mais novo), sem abrir navegador. Carregam o app de verdade
(`index.html` + `js/*.js`) dentro do jsdom, com um storage falso em memória, então **não mexem nos seus dados**.

## Como rodar

```
cd tests
npm install        # só na primeira vez (baixa o jsdom)
npm test           # roda tudo
node rodar.js arraste   # só os testes cujo nome contém "arraste"
```

## O que cobre

| Arquivo | O quê |
| --- | --- |
| `1-unit.test.js` | Funções puras: ids, histórico (`upsertEntry`, `lastEntryBefore`, migração), `moveItem`/`dropIndex`, validação e montagem do backup |
| `2-app.test.js` | Fluxos com a tela: registrar carga, migração, editor (renomear, adicionar, remover, copiar, resetar, trocar exercício, reordenar por arraste), segurança de dados e backup exportar/importar |
| `4-visual.test.js` | Tema escuro/claro, tokens de cor e contraste, ícones SVG, cores de carga x reps, contrato do markup |
| `3-goals.test.js` | Meta por exercício (dupla progressão): regra pura (`suggestGoal`, `formatGoal`) e a linha `Meta hoje` na tela |
| `5-backup-extra.test.js` | Lembrete de "último backup" (`describeLastBackup`, `treino:lastBackup`) e botões Copiar / Colar backup (área de transferência, contingência por caixa de texto, importação por texto) |
| `6-copiar-ultima.test.js` | Copiar cargas da última sessão para a data exibida (`Treino.copyLastLoads` + botão `#copyLast`): só carga, só o que está vazio, só datas anteriores |
| `harness.js` | Infra: abre o app, storage falso, helpers (`typeLoad`, `openEditor`, `drag`, `importFile`…) |

## O que NÃO cobre (teste à mão no celular)

O jsdom **não tem layout nem toque de verdade**. No arraste, as posições dos cartões são simuladas.
Confira no aparelho: arrastar com o dedo, rolar a página durante o arraste, o modo compacto, tamanho da alça,
e o download/upload de arquivo de backup no navegador real.

## Regra ao mexer no app

1. Escreva/ajuste o teste primeiro (ou junto) e veja falhar quando o comportamento estiver errado.
2. `npm test` precisa terminar com **0 falharam** antes de considerar a mudança pronta.
3. Bug encontrado → vira um teste novo antes da correção.

## Visual (Fase A)

`4-visual.test.js` confere o que dá para provar sem ver a tela: tokens de cor idênticos nos dois temas, contraste
WCAG dos pares texto/fundo, matiz diferente entre campo de carga (âmbar) e de reps (azul), ícones SVG, tema salvo,
e o contrato do markup (aria-label, sem emoji em botão). A aparência final (espaçamento, alinhamento) continua
sendo conferida olhando a tela.
