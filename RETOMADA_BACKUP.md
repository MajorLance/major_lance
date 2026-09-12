# Major Lance — Documento de retomada

## Estado atual

O projeto é uma aplicação fullstack React + Express + tRPC + Drizzle/MySQL publicada no Manus WebDev. A URL pública atual é:

**https://majorsyncpay-2h3tet3f.manus.space**

O último checkpoint publicado antes deste backup é **23cc36d4**.

## Funcionalidades implementadas

A aplicação mantém o tema escuro com detalhes dourados e possui rodadas de leilão com duração de 10 minutos. O estado da rodada, o maior lance, o cronômetro, os últimos lances, os vencedores e a próxima rodada são obtidos do backend; não há fallback de dados fictícios na página pública.

A integração Pix é feita no servidor com a SyncPay. Ao enviar um lance, é criada uma cobrança Cash-in Pix. O lance somente aparece publicamente depois que o webhook confirma o pagamento. O webhook público é `POST /api/syncpay/webhook`, com validação de autenticação e idempotência para evitar duplicação.

Existe um painel administrativo protegido em `/admin`. A conta administradora pode inserir manualmente o nome e o valor de um lance; esses lances aparecem junto dos lances Pix aprovados. A sequência de prêmios configurada é **R$ 3.000 → R$ 5.000 → R$ 1.000 → R$ 3.000**.

A interface pública inclui aviso deslizante para novos lances, entrada animada do novo primeiro item, deslize lateral no card “Maior lance atual” e um efeito sonoro curto via Web Audio. O áudio é desbloqueado após interação do usuário para respeitar o bloqueio de autoplay. As animações não essenciais respeitam `prefers-reduced-motion`.

O modal Pix foi otimizado para celular: não exibe QR Code, mostra instruções de Pix Copia e Cola e possui o botão “Copiar código Pix” com confirmação animada. O título do modal é “Pague seu Pix”. O botão “Sacar” no cabeçalho mostra somente o texto, com fundo dourado e alinhamento centralizado.

## Rotas principais

| Rota | Finalidade |
|---|---|
| `/` | Rodada pública ao vivo |
| `/admin` | Painel protegido para inserção manual de lances |
| `/saque` | Formulário de solicitação de saque |
| `/vencedores` | Histórico de vencedores reais |
| `/proximas-rodadas` | Agenda de rodadas seguintes |
| `/historico` | Histórico de lances |
| `/conta` | Área de conta |
| `/api/syncpay/webhook` | Webhook de confirmação da SyncPay |

## Arquivos importantes

- `client/src/pages/Home.tsx`: rodada pública, envio de lance, modal Pix, animações e som.
- `client/src/pages/AdminPage.tsx`: painel administrativo.
- `client/src/pages/InternalPages.tsx`: conta, saque, histórico e páginas internas.
- `client/src/components/MajorLanceShell.tsx`: cabeçalho e navegação.
- `client/src/components/header-refinements.css`: estilos do cabeçalho e botão “Sacar”.
- `server/syncpay.ts`: autenticação e criação de Cash-in Pix.
- `server/syncpayWebhook.ts`: recebimento e validação do webhook.
- `server/db.ts`: regras de rodadas, lances pagos/manuais e vencedores.
- `server/routers.ts`: rotas tRPC públicas e administrativas.
- `drizzle/schema.ts`: schema das tabelas.
- `server/auction.test.ts`: testes das regras de leilão e proteção administrativa.
- `server/pixUi.test.ts`: testes do helper de cópia Pix.
- `todo.md`: histórico e checklist de alterações.

## Validação técnica

A última validação executou com sucesso:

```text
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

A suíte possui 27 testes aprovados no estado documentado.

## Variáveis de ambiente

As credenciais não fazem parte deste backup. Para executar o projeto em outro ambiente, configure as variáveis fornecidas pelo Manus WebDev e as credenciais SyncPay no ambiente do servidor, especialmente `SYNCPAY_API_URL`, `SYNCPAY_CLIENT_ID`, `SYNCPAY_CLIENT_SECRET` e `SYNCPAY_WEBHOOK_SECRET`.

Nunca coloque Client ID, Client Secret, segredo de webhook ou arquivos `.env` no Git, em ZIP público ou no código do navegador.

## Pendência de segurança

O checklist registra que um Client Secret antigo foi compartilhado anteriormente e deve ser revogado no painel da SyncPay, gerando um novo. Essa rotação é uma ação externa à aplicação e não altera a geração normal de cobranças quando as variáveis de ambiente estão corretas.

## Como retomar

1. Extraia o arquivo ZIP.
2. Leia este documento e `PROJECT_STATUS.md`.
3. Instale as dependências com `pnpm install`.
4. Configure as variáveis de ambiente no servidor, sem criar um `.env` dentro do pacote público.
5. Execute `pnpm test`, `pnpm exec tsc --noEmit` e `pnpm build`.
6. Use o painel de gerenciamento do Manus WebDev para continuar a publicação ou restaurar um checkpoint.

Este documento não contém credenciais, tokens, cookies ou dados privados de usuários.
