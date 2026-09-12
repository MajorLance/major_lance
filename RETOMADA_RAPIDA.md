# Retomada rápida do Major Lance

## Comando para usar no próximo chat

> Abra o projeto WebDev existente **major-lance-syncpay** a partir do estado anexado deste projeto. Não reconstrua a aplicação, não leia a pasta inteira e não reinstale dependências. Primeiro leia apenas este arquivo `RETOMADA_RAPIDA.md` e `PROJECT_STATUS.md`; depois aguarde minha próxima instrução de edição.

## Estado preservado

O projeto é uma aplicação fullstack React + Express + tRPC + Drizzle/MySQL, com tema escuro e detalhes dourados. A versão publicada de referência é `3cf6996f` e a URL pública é:

https://majorsyncpay-2h3tet3f.manus.space

O estado deste pacote inclui o código atual após a restauração da lista Últimos vencedores para uma lista vertical estática e a correção resiliente da conversão de datas, que evita `RangeError: Invalid time value`.

## Funcionalidades existentes

A aplicação possui geração de cobrança Pix pela SyncPay ao enviar um lance, confirmação de pagamento por webhook antes de registrar o lance, idempotência, painel administrativo protegido, rodadas de 10 minutos, sequência de prêmios, datas atuais, histórico de vencedores reais, aviso visual de novos lances, som curto após interação, destaque do líder, botão Sacar e lista estática de Últimos vencedores.

Na Home, a lista de vencedores exibe nome, data sem horário, valor do prêmio e o rótulo “Lance vencedor”. O carrossel foi removido conforme a última solicitação.

## Arquivos importantes

- `client/src/pages/Home.tsx`: página pública, lista de vencedores e estado da rodada.
- `client/src/pages/home.css`: estilos da Home e da lista estática.
- `client/src/pages/AdminPage.tsx`: painel de inserção manual de lances.
- `server/db.ts`: consultas, rodadas, lances e vencedores.
- `server/routers.ts`: rotas tRPC e regras do fluxo Pix.
- `server/syncpayWebhook.ts`: confirmação segura de pagamentos.
- `drizzle/schema.ts`: tabelas do banco.
- `server/*.test.ts`: testes Vitest.

## Regras para continuar

Não criar vencedores, avaliações, depoimentos ou pagamentos fictícios como se fossem reais. Não alterar credenciais. Não remover a proteção do painel admin sem confirmação explícita. Antes de qualquer nova edição, registrar o pedido em `todo.md`, testar com `pnpm test`, `pnpm exec tsc --noEmit` e `pnpm build`, e salvar um checkpoint somente quando eu pedir para publicar.

## Segurança

O ZIP não contém `.env`, tokens, Client Secret, dependências geradas, `dist` ou `.git`. As credenciais devem continuar sendo configuradas somente pelos segredos do projeto. O Client Secret SyncPay antigo deve ser revogado no painel da SyncPay porque foi exposto anteriormente.

## Restauração local opcional

Se for necessário trabalhar fora do WebDev, extraia o ZIP, entre na pasta e use o ambiente do projeto. Não copie credenciais para dentro do pacote. Para alterações no projeto WebDev, prefira abrir o projeto existente a reconstruir a aplicação a partir do ZIP.
