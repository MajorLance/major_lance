# Major Lance — Estado atual e retomada

Atualizado em 02/09/2026. Este documento descreve o estado do projeto publicado e não contém Client ID, Client Secret, token de webhook ou qualquer arquivo `.env`.

## Projeto publicado

URL pública: https://majorsyncpay-2h3tet3f.manus.space

Endpoint público do webhook: `POST https://majorsyncpay-2h3tet3f.manus.space/api/syncpay/webhook`

Checkpoint atual: `acccd2c7`.

A URL inicial carrega a interface Major Lance em HTTPS. Um teste sem segredo no endpoint retornou `HTTP 401` com `{"error":"Webhook não autorizado"}`, confirmando que chamadas não autenticadas são rejeitadas.

## Alterações realizadas

A interface existente foi migrada para o projeto WebDev fullstack, preservando o tema escuro com detalhes dourados e as áreas de rodada, lances, carteira e saque. O botão “ENVIAR MEU LANCE” valida o valor digitado, cria uma cobrança Cash-in Pix no backend e abre um modal com QR Code e código copia-e-cola.

O lance não é salvo no momento da criação do Pix. Ele só é inserido depois que o webhook reconhece um status de pagamento confirmado, como `paid`, `completed`, `approved` ou `confirmed`.

Foram adicionadas persistência de cobranças Pix e lances, chave de requisição para idempotência antes da chamada externa, índice único por cobrança, proteção contra webhook repetido, validação de valor e rejeição de status desconhecido. O endpoint foi registrado no Express antes do fallback da aplicação.

As credenciais ficam apenas no ambiente do servidor. Os nomes usados são `SYNCPAY_API_URL`, `SYNCPAY_CLIENT_ID`, `SYNCPAY_CLIENT_SECRET` e `SYNCPAY_WEBHOOK_SECRET`. Nunca colocar esses valores em `VITE_*`, no React ou em arquivos versionados.

## Arquivos principais

| Arquivo | Função |
|---|---|
| `client/src/pages/Home.tsx` | Fluxo do lance, modal Pix, QR Code e cópia do código. |
| `client/src/lib/pixUi.ts` | Handler testável de cópia do código Pix. |
| `server/syncpay.ts` | Autenticação e criação do Cash-in Pix na SyncPay. |
| `server/syncpayWebhook.ts` | Validação do webhook e aplicação da confirmação. |
| `server/routers.ts` | Rotas tRPC para criar cobrança e consultar status. |
| `server/db.ts` | Reservas, persistência e confirmação idempotente. |
| `drizzle/schema.ts` | Tabelas de cobranças Pix e lances. |
| `server/syncpay.test.ts` | Status, payload e autenticação do webhook. |
| `server/syncpayWebhook.flow.test.ts` | Pagamento pendente, pago e webhook repetido. |
| `server/pixUi.test.ts` | Cópia integral do código Pix. |
| `server/syncpay.credentials.test.ts` | Autenticação leve da SyncPay sem criar cobrança. |
| `server/syncpay.webhook.secret.test.ts` | Validação do segredo contra o endpoint publicado. |

## Validação concluída

A checagem TypeScript passou. O build de produção passou. A suíte Vitest passou com 18 testes. A Home, a carteira, o saque e o modal Pix foram revisados em desktop e mobile. O QR Code foi confirmado no DOM como SVG de 208 x 208 px; o modal usa `overflow-y: auto`; o handler de cópia foi validado por teste automatizado; e o botão de fechar foi verificado no preview `/?demo=pix`.

## Pendência atual do webhook

Na SyncPay, criar o webhook em **Recebimento Cash-in** com esta URL:

`https://majorsyncpay-2h3tet3f.manus.space/api/syncpay/webhook`

Depois, guardar o segredo retornado pela SyncPay como `SYNCPAY_WEBHOOK_SECRET` no cartão seguro de Secrets do projeto. O último teste de segredo retornou `401`, o que indica que o token ainda não foi salvo, está incorreto ou não é o segredo de assinatura usado no header da SyncPay. Não colar esse valor no chat.

## Observação sobre cobrança

O log registrou `Cashin exceeds max_cashin_without_fee`. Isso é uma rejeição da configuração/limite da conta SyncPay, não um erro de compilação do projeto. Se aparecer ao testar, verificar no painel da SyncPay o limite Cash-in sem tarifa ou a configuração de tarifas e usar o ambiente de testes apropriado.

## Retomada rápida

1. Abrir o cartão de Secrets e preencher `SYNCPAY_WEBHOOK_SECRET` com o segredo correto da SyncPay.
2. Confirmar que o webhook está em **Recebimento Cash-in** e usa a URL acima.
3. Testar primeiro um valor pequeno no sandbox.
4. Se o teste de autenticação continuar em 401, confirmar com o suporte/documentação SyncPay o nome exato do header de assinatura; o backend atualmente aceita `Authorization: Bearer`, `x-webhook-token` e `x-syncpay-token`.

## Como executar localmente

```bash
pnpm install
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

O banco deve ser configurado com `DATABASE_URL`. As migrações Drizzle já foram geradas e aplicadas no ambiente hospedado.

## Referências

[1]: https://syncpay.apidog.io/ "Documentação oficial da SyncPay"
[2]: https://syncpay.apidog.io/solicita%C3%A7%C3%A3o-de-dep%C3%B3sito-via-pix-18075879e0 "SyncPay — Solicitação de depósito via Pix"
[3]: https://syncpay.apidog.io/cash-in-atualizado-mudan%C3%A7a-de-status-41858733e0 "SyncPay — Cash-in atualizado"

## Diagnóstico adicional do HTTP 401

Em 02/09/2026, foram testados os três formatos aceitos pelo backend (`Authorization: Bearer`, `x-webhook-token` e `x-syncpay-token`) usando apenas códigos HTTP. Todos retornaram 401. O ambiente local confirmou que possui uma variável preenchida, mas o valor não foi revelado nem comparado em texto; portanto, o deploy está rejeitando o segredo apresentado. A documentação oficial do Cash-in confirma que o header correto é `Authorization: Bearer <token do webhook>`, sem assinatura HMAC. Não há indicação de erro na URL ou no header do projeto. O token precisa ser o `token` de assinatura do webhook Cash-in específico que aponta para a URL publicada, e não Client Secret, token de API ou token de outro webhook.

## Otimização de geração do Pix

O serviço agora mantém o token da API em cache por até uma hora e compartilha uma única requisição de autenticação quando dois Cash-ins chegam ao mesmo tempo. Isso evita chamadas duplicadas ao endpoint `auth-token`. O backend também registra somente os tempos de `auth-token` e `cash-in`, sem registrar token, Client Secret, QR Code ou payload sensível.

O primeiro Cash-in de uma instância fria ainda pode demorar por causa do cold start da hospedagem Autoscale e da chamada externa da SyncPay. As solicitações seguintes na mesma instância reutilizam o token e devem ser mais rápidas. O erro `Cashin exceeds max_cashin_without_fee` é uma rejeição de limite/tarifa da conta e não uma latência do código.

## Medição pública após a otimização

Em 02/09/2026, o payload artificial do webhook publicado respondeu `HTTP 200` em aproximadamente 4,43 segundos. Essa primeira chamada inclui o cold start da instância Autoscale; o fluxo de Cash-in real também depende da latência externa da SyncPay. O token da SyncPay permanece em cache enquanto a instância estiver aquecida, evitando autenticação repetida.
