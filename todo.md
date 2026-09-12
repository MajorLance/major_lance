# Project TODO

- [x] Migrar a Home do Major Lance com tema escuro, detalhes dourados e experiência responsiva elegante.
- [x] Migrar as rotas públicas de rodada, lances, carteira, saque, histórico, vencedores, próximas rodadas, conta e dúvidas.
- [x] Exibir os 10 vencedores autorizados sem avatares, círculos ou horários.
- [x] Exibir nome, mesma data corrente compartilhada sem horário, valor do prêmio e o rótulo “Lance vencedor”.
- [x] Atualizar automaticamente a data compartilhada quando o dia mudar.
- [x] Restaurar criação de cobrança Pix no envio de lance.
- [x] Registrar lance somente após confirmação de pagamento pelo webhook.
- [x] Preservar idempotência de cobrança e confirmação de webhook.
- [x] Preservar estados de pagamento pendente, pago, expirado e falho.
- [x] Manter integrações SyncPay inativas até os secrets serem configurados no novo projeto.
- [x] Manter credenciais somente em secrets do servidor, sem valores no código ou em VITE_*.
- [x] Migrar autenticação e manter o painel administrativo protegido por role admin.
- [x] Impedir alterações administrativas por usuários não autorizados.
- [x] Criar esquema Drizzle/MySQL para rodadas, lances, cobranças Pix e vencedores.
- [x] Aplicar migrações do banco com ordem e validação seguras.
- [x] Adicionar testes Vitest para regras de lance, Pix, webhook, idempotência, datas e permissões.
- [x] Executar pnpm test.
- [x] Executar pnpm exec tsc --noEmit.
- [x] Executar pnpm build.
- [x] Validar a prévia visual em desktop e mobile.
- [x] Exibir a prévia visual após cada alteração relevante.
- [x] Salvar checkpoint final antes de qualquer publicação.
- [x] Publicar somente após validação e confirmação do usuário.

- [x] Garantir que os nomes completos dos 10 vencedores permaneçam visíveis sem truncamento na Home e na rota de vencedores.

- [x] Substituir o ícone de presente pelo ícone de sino na interface do Major Lance e validar a prévia visual.

- [x] Confirmar explicitamente no CSS da Home que os nomes dos vencedores podem quebrar linha e não usam truncamento.
- [x] Validar novamente a Home após esse ajuste.

- [x] Aplicar no banco novo as tabelas baseline auction_rounds, bids, manual_bids e pix_charges, além de users e winners, para eliminar estados de carregamento das rotas.

## Verificações adicionais antes do checkpoint

- [x] Verificar no novo projeto os 10 vencedores autorizados exatos em mockData.ts.
- [x] Atualizar a data corrente automaticamente na virada do dia sem exigir recarregamento.
- [x] Adicionar teste da data compartilhada e da atualização diária.
- [x] Confirmar e testar guard de admin no painel e nas mutations administrativas.
- [x] Gerar e aplicar migrações Drizzle consistentes para todas as tabelas baseline.
- [x] Adicionar teste específico de permissão administrativa.

## Pendências finais antes do checkpoint

- [x] Demonstrar e testar o guard frontend da rota /admin, com bloqueio ou redirecionamento para usuários sem role admin.
- [x] Reconciliar o histórico __drizzle_migrations com as tabelas baseline já aplicadas, sem apagar ou recriar dados.

## Ajustes financeiros de interface — nova solicitação

- [x] Ajustar o cabeçalho para manter Saldo e Sacar dentro do mesmo enquadramento, sem corte em desktop ou mobile.
- [x] Exibir o valor do lance dado por cada vencedor com destaque e fundo verde.
- [x] Remover a opção Meu saldo do menu de Minha Conta.
- [x] Reduzir o tamanho do valor Disponível para saque para uma escala profissional.
- [x] Remover valores demonstrativos não reais do histórico de saques, mantendo o estado vazio informativo.
- [x] Validar a prévia visual após cada alteração relevante e executar testes, TypeScript e build.

- [x] Validar o cabeçalho ajustado também em viewport desktop e confirmar que Saldo e Sacar permanecem dentro do mesmo enquadramento sem corte.

## Restauração solicitada — versão anterior à demonstração

- [x] Restaurar o checkpoint c7ba15af, anterior à configuração DEMONSTRAÇÃO.
- [x] Confirmar na prévia a seção Últimos vencedores e o badge verde do lance vencedor.
- [x] Executar testes, TypeScript e build após a restauração.
- [x] Publicar somente após confirmação explícita do usuário.

## Pacote reutilizável solicitado

- [x] Criar ZIP da versão restaurada sem credenciais, dependências geradas, build ou histórico Git.
- [x] Auditar o conteúdo do ZIP e entregar o arquivo ao usuário.

## Cadastro único de clientes — solicitação atual

- [x] Criar formulário de cadastro exibido ao clicar em “ENVIAR MEU LANCE”.
- [x] Salvar o cadastro no banco e manter o cliente conectado neste navegador via localStorage.
- [x] Permitir seleção de CPF, CNPJ, e-mail, celular ou chave aleatória para o Pix.
- [x] Exibir os cadastros no Painel Administrador.
- [x] Aplicar migração, executar testes, TypeScript e build, e validar a prévia.

## Carteira de prêmios — solicitação atual

- [x] Criar carteira persistente e histórico de transações.
- [x] Creditar automaticamente o prêmio integral ao vencedor pago da rodada.
- [x] Garantir idempotência para não duplicar créditos.
- [x] Vincular o saldo real ao cabeçalho, à página Meu saldo e ao botão Sacar.
- [x] Validar com testes, TypeScript e build.

## Rodada e saque interno — solicitação atual

- [x] Reduzir a duração das rodadas para cinco minutos.
- [x] Criar saque interno idempotente que debita o saldo sem enviar Pix real.
- [x] Atualizar o saldo imediatamente após solicitar saque.
- [x] Registrar o saque no histórico da carteira.
- [x] Exibir pop-up verde com V e a mensagem “Saque realizado com sucesso”.
- [x] Validar com 36 testes, TypeScript e build.

## Encerramento e próxima rodada — solicitação atual

- [x] Criar estado de encerramento com aviso do vencedor por 10 segundos.
- [x] Bloquear a criação/início da próxima rodada durante o aviso.
- [x] Iniciar a nova rodada somente depois do intervalo, com cronômetro completo de 5 minutos.
- [x] Mostrar o nome do vencedor sem adicionar novo registro em Últimos vencedores.
- [x] Validar com 36 testes, TypeScript e build.

## Webhook Pix — correção atual

- [x] Confirmar que o endpoint público `/api/syncpay/webhook` responde 200 ao teste oficial do SyncPay.
- [x] Atualizar o callback para o domínio público estável do site.
- [x] Aceitar o Bearer gerado pelo painel do SyncPay quando não houver segredo local configurado.
- [x] Reconhecer o payload oficial com `id`, `amount` e `status: completed`.
- [x] Adicionar fallback de consulta `GET /api/partner/v1/transaction/{identifier}` durante o polling.
- [x] Registrar automaticamente o lance quando o status consultado for pago.
- [x] Validar com 39 testes, TypeScript e build.

## Banco local de desenvolvimento — solicitação atual

- [x] Configurar MySQL local em Docker para desenvolvimento.
- [x] Criar variáveis de ambiente locais para `DATABASE_URL`.
- [x] Aplicar migrations Drizzle no banco local.
- [x] Validar testes, TypeScript e build.
- [x] Validar testes, TypeScript e build.
