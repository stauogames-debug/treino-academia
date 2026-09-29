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
| `3-goals.test.js` | Meta por exercício (dupla progressão): regra pura (`suggestGoal`, `formatGoal`) e a linha `Meta hoje` na tela |
| `harness.js` | Infra: abre o app, storage falso, helpers (`typeLoad`, `openEditor`, `drag`, `importFile`…) |

## O que NÃO cobre (teste à mão no celular)

O jsdom **não tem layout nem toque de verdade**. No arraste, as posições dos cartões são simuladas.
Confira no aparelho: arrastar com o dedo, rolar a página durante o arraste, o modo compacto, tamanho da alça,
e o download/upload de arquivo de backup no navegador real.

## Regra ao mexer no app

1. Escreva/ajuste o teste primeiro (ou junto) e veja falhar quando o comportamento estiver errado.
2. `npm test` precisa terminar com **0 falharam** antes de considerar a mudança pronta.
3. Bug encontrado → vira um teste novo antes da correção.
