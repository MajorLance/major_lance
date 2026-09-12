# SyncPay — notas verificadas em 2026-09-02

Documentação consultada: https://syncpay.apidog.io/

## Autenticação
- POST `/api/partner/v1/auth-token`
- Body JSON: `client_id` (UUID), `client_secret` (UUID)
- Retorna `access_token`, `token_type`, `expires_in`, `expires_at`
- Token indicado com `Authorization: Bearer <token>` e validade de 1 hora.

## Criação de cobrança Pix (Cash-in)
- POST `/api/partner/v1/cash-in`
- Headers: `Accept: application/json`, `Authorization: Bearer <token>`, `Content-Type: application/json`
- Body obrigatório: `amount` number >= 0
- Body opcional: `description`, `webhook_url`, `client` (name, cpf 11 dígitos, email, phone 10–11 dígitos), `split`
- Resposta 200: `message`, `pix_code` (copia e cola/QR Code), `identifier` (UUID para transação/webhook)
- A documentação informa que webhooks de criação/atualização serão enviados para a callback URL fornecida.

## Implicações para o projeto Major Lance
- `client/src/pages/Home.tsx` atualmente simula `handleBid` com `setTimeout` e não chama backend.
- `server/routers.ts` atualmente só possui `auth`; não há rota de carteira/lance/Pix.
- `drizzle/schema.ts` só possui `users`.
- Para cobrar no clique e creditar o lance somente após pagamento: backend cria o cash-in, frontend exibe `pix_code`, webhook persiste/atualiza status idempotentemente e só então registra o lance.
- Segredos SyncPay devem ficar no servidor, nunca em variáveis `VITE_*` ou no React.

## Status
A página oficial `https://syncpay.apidog.io/chargestatus-15883842d0` confirma: `pending` = aguardando pagamento; `paid` = confirmado; `expired` = expirado sem pagamento; `failed` = falha ao gerar cobrança.

A tentativa de abrir a página oficial de criação de webhook retornou indisponibilidade temporária do navegador; a implementação deve tratar o payload de forma tolerante e validar o status/identifier conforme a resposta real do provedor em sandbox.

## Webhook novo
Documentação oficial: `https://syncpay.apidog.io/criar-webhook-41858912e0`.

- POST `/webhooks` para cadastrar webhook, autenticado por Bearer.
- Campos: `title`, `url`, `event`, `trigger_all_products`, opcionalmente `product_reference_ids`.
- O evento `transaction` cobre PIX e cartão no contrato novo e recebe `transaction.created` / `transaction.updated`.
- A resposta inclui `token`, segredo de assinatura exibido uma única vez; a documentação informa rotação por `POST /webhooks/{webhook}/rotate-secret`.
- O evento antigo `cashin.updated` envia payload com `id`, `end_to_end`, `pix_code`, `amount`, `final_amount`, `currency`, `status`, `payment_method`, `created_at` e `updated_at`; exemplo com `status: completed` e `payment_method: PIX`.
- Para o MVP, cadastrar/usar `webhook_url` do cash-in e aceitar os campos de status de forma tolerante. Para produção, armazenar e validar o segredo de assinatura conforme os headers reais enviados pela conta SyncPay.

## Validação local
- `pnpm build` concluído com sucesso.
- `pnpm exec tsc --noEmit` concluído sem erros.
- Servidor local iniciou em `http://localhost:3000/`.
- A Home carregou com input de valor e botão `ENVIAR MEU LANCE`.
- Sem credenciais SyncPay, o teste real da cobrança não foi executado; o backend retorna erro controlado e não simula pagamento.

## QA do modal Pix
- Preview `/?demo=pix` exibiu QR Code, valor de R$ 148,00, código copia-e-cola e botão de copiar.
- O botão `Fechar pagamento Pix` foi acionado e o modal desapareceu, retornando à Home.
- A captura mobile confirmou que o modal cabe na largura estreita e o código longo permanece contido com quebra/overflow controlado.
- O modo `?demo=pix` é somente de desenvolvimento e não cria cobrança real.

## Inspeção DOM do modal Pix
- `/?demo=pix` contém um SVG de QR Code renderizado com 208 x 208 px.
- O botão `pix-copy-button` está presente e o código exibido tem 146 caracteres.
- O modal usa `overflow-y: auto`; no viewport desktop inspecionado, `clientHeight` e `scrollHeight` foram 532 px, sem conteúdo cortado.
- A leitura da área de transferência foi bloqueada pela permissão do navegador de sandbox; o handler foi validado pelo teste automatizado `server/pixUi.test.ts`, que confirma que o código completo é enviado a `writeText`.

## Documentação fornecida pelo usuário

O material informa que o Cash-in Pix aceita uma `callbackUrl` na própria solicitação e que IP e chave de API precisam estar autorizados. Também informa timeout de webhook de 5 segundos, além de endpoints separados de Cash-in OnCreate e OnUpdate. A integração deve confirmar qual versão do webhook está sendo usada e responder rapidamente.
