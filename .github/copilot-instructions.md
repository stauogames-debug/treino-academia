# Instruções do projeto APP-Treino

## Objetivo
Manter e evoluir o aplicativo de treino existente, preservando suas funcionalidades, sua interface e sua compatibilidade com o GitHub Pages.

## Antes de qualquer tarefa
- Confirme que a raiz ativa é `C:\Users\Davi Lucca\OneDrive\Documentos\APP-Treino` (ou confirme com o usuário se o projeto mudou de local).
- Consulte `git status --short` e, quando necessário, os diffs antes de editar. Preserve todas as alterações preexistentes, inclusive arquivos não rastreados.
- Se houver alterações inesperadas, conflito com o escopo pedido ou risco de sobrescrever trabalho, pare e informe o estado; não restaure, descarte ou contorne as alterações.
- Leia os arquivos relevantes para a tarefa, incluindo testes e documentação aplicáveis. Consulte `Prompt-Treino.md` e as notas do Obsidian quando forem pertinentes.
- Defina os arquivos e ações dentro do escopo autorizado. Não altere arquivos adjacentes ou amplie a tarefa sem autorização.
- Para tarefas grandes, apresente um plano antes de implementar.

## Implementação e segurança
- Não reescreva o projeto inteiro para resolver um problema localizado.
- Preserve o funcionamento do aplicativo e os dados existentes no localStorage.
- Não remova funcionalidades sem autorização.
- Não exponha senhas, tokens ou dados pessoais.
- Peça autorização específica antes de instalar dependências, alterar configurações do Git/GitHub, executar operações destrutivas ou de escrita no Git (`git add`, commit, push, restore, checkout, clean), atualizar `sw.js` com `node tools/atualizar-sw.js`, ou publicar/fazer deploy.
- Antes de executar testes, inspecione seus efeitos colaterais. Não rode testes que escrevam em arquivos do projeto sem autorização explícita ou isolamento seguro; preserve e confira arquivos afetados.
- Ao mudar qualquer arquivo listado em `ASSETS` no `sw.js`, informe que a versão do service worker pode precisar ser atualizada. Só execute a ferramenta de atualização com autorização específica.

## Testes
- Inspecione os testes existentes na pasta test e os scripts disponíveis.
- Execute os testes adequados às alterações realizadas.
- Se os testes falharem, investigue a causa e corrija os problemas relacionados à tarefa.
- Nunca afirme que um teste passou sem executá-lo.
- Se não houver testes automatizados adequados, informe a limitação.

## Documentação no Obsidian
A pasta APP-Treino-Notas está aberta nesta área de trabalho.

Use as notas:
- Contexto do Projeto.md
- Decisões Técnicas.md
- Tarefas e bugs.md
- Histórico de testes.md

As notas são contexto histórico e podem estar desatualizadas ou divergir do código, dos testes ou do pedido atual. Leia as notas pertinentes; confronte afirmações relevantes com as fontes atuais e não as trate como especificação automaticamente vigente. Se uma divergência envolver decisão de produto ou afetar dados/comportamento, informe e peça confirmação antes de decidir.

Atualize somente as notas pertinentes e autorizadas para a tarefa. Preserve o conteúdo e a cronologia; não substitua decisões históricas silenciosamente. Diferencie fatos verificados, informações declaradas, pendências e pontos não confirmados. Registre apenas mudanças e testes realmente realizados, com resultados observados; não invente conclusões nem marque como concluído algo sem evidência.

## Revisão e encerramento
- Revise o diff completo e execute `git status --short` ao final; confirme que somente os arquivos dentro do escopo mudaram e que alterações preexistentes foram preservadas.
- Se surgir alteração inesperada ou não for possível confirmar a integridade dos arquivos, pare, preserve evidências e informe; não faça restauração automática.

## Resumo obrigatório ao terminar
Informe:
1. O que mudou e quais arquivos foram modificados.
2. Quais testes/comandos foram realmente executados e seus resultados; informe explicitamente se não houve execução.
3. Quais pendências ou limitações permanecem.
4. Quais notas do Obsidian foram atualizadas, ou informe que nenhuma foi.
5. O resultado da revisão de diff/status e se há alterações não commitadas ou não publicadas.