# Registro de validação visual

## Cabeçalho desktop — 03/09/2026

Foi verificada a prévia desktop em viewport 1280x720 nas rotas `/` e `/saque` após o ajuste de `header-refinements.css`. O bloco escuro com **Saldo** e o botão dourado **Sacar** aparecem dentro do mesmo enquadramento arredondado, sem corte horizontal, sobreposição ou saída do cabeçalho.

## Cabeçalho mobile — 03/09/2026

Foi verificada a prévia mobile em viewport 390x844 nas rotas `/` e `/saque`. O mesmo enquadramento permanece íntegro e os rótulos continuam legíveis.

## Conteúdo financeiro

A rota `/vencedores` exibe os nomes, a data corrente, o prêmio e o badge verde com o lance vencedor. A rota `/saque` exibe `R$ 0,00` em tamanho reduzido e o histórico em estado vazio, sem valores demonstrativos. A rota `/conta` não exibe mais o atalho **Meu saldo**.
