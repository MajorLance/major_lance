export type Bidder = {
  id: string;
  name: string;
  initials: string;
  avatarTone: "blue" | "rose" | "green" | "violet" | "amber";
};

export type Bid = Bidder & {
  amount: number;
  relativeTime: string;
};

export type Round = {
  id: string;
  prize: number;
  startsAt: string;
  prizeLabel: string;
};

export const currentRound = {
  id: "round-1024",
  prize: 3000,
  currentBid: 147,
  leader: { id: "lucas-m", name: "Lucas M.", initials: "LM", avatarTone: "blue" } satisfies Bidder,
  onlineUsers: 124,
  remainingSeconds: 462,
};

export const recentBids: Bid[] = [
  { id: "bid-1", name: "Lucas M.", initials: "LM", avatarTone: "blue", amount: 147, relativeTime: "há 12 segundos" },
  { id: "bid-2", name: "Mariana S.", initials: "MS", avatarTone: "rose", amount: 135, relativeTime: "há 28 segundos" },
  { id: "bid-3", name: "Rafael C.", initials: "RC", avatarTone: "green", amount: 120, relativeTime: "há 1 minuto" },
  { id: "bid-4", name: "João P.", initials: "JP", avatarTone: "violet", amount: 100, relativeTime: "há 2 minutos" },
  { id: "bid-5", name: "Carla A.", initials: "CA", avatarTone: "amber", amount: 80, relativeTime: "há 3 minutos" },
];

export const upcomingRound: Round = {
  id: "round-1025",
  prize: 5000,
  prizeLabel: "R$ 5.000,00",
  startsAt: "12:34",
};

export const winners = [
  { id: "winner-1", name: "Carlos Henrique", initials: "CH", avatarTone: "blue" as const, wonAt: new Date().toISOString(), prize: 5000, bid: 78, status: "Prêmio pago" },
  { id: "winner-2", name: "Mariana Oliveira", initials: "MO", avatarTone: "rose" as const, wonAt: new Date().toISOString(), prize: 3000, bid: 46, status: "Prêmio pago" },
  { id: "winner-3", name: "João Victor Santos", initials: "JVS", avatarTone: "green" as const, wonAt: new Date().toISOString(), prize: 1000, bid: 63, status: "Prêmio pago" },
  { id: "winner-4", name: "Fernanda Alves", initials: "FA", avatarTone: "violet" as const, wonAt: new Date().toISOString(), prize: 5000, bid: 35, status: "Prêmio pago" },
  { id: "winner-5", name: "Rafael Martins", initials: "RM", avatarTone: "amber" as const, wonAt: new Date().toISOString(), prize: 3000, bid: 72, status: "Prêmio pago" },
  { id: "winner-6", name: "Camila Ferreira", initials: "CF", avatarTone: "blue" as const, wonAt: new Date().toISOString(), prize: 1000, bid: 28, status: "Prêmio pago" },
  { id: "winner-7", name: "Lucas Gabriel", initials: "LG", avatarTone: "rose" as const, wonAt: new Date().toISOString(), prize: 5000, bid: 54, status: "Prêmio pago" },
  { id: "winner-8", name: "Juliana Costa", initials: "JC", avatarTone: "green" as const, wonAt: new Date().toISOString(), prize: 3000, bid: 39, status: "Prêmio pago" },
  { id: "winner-9", name: "André Souza", initials: "AS", avatarTone: "violet" as const, wonAt: new Date().toISOString(), prize: 1000, bid: 67, status: "Prêmio pago" },
  { id: "winner-10", name: "Beatriz Rodrigues", initials: "BR", avatarTone: "amber" as const, wonAt: new Date().toISOString(), prize: 5000, bid: 23, status: "Prêmio pago" },
];

export const faqItems = [
  { question: "Como funciona o lance?", answer: "Você escolhe um valor maior que o lance atual e confirma com pagamento via Pix. O maior lance válido ao fim da rodada leva o prêmio." },
  { question: "O pagamento é seguro?", answer: "Sim. Cada ação de pagamento terá confirmação clara e rastreável na sua conta assim que o backend for conectado." },
  { question: "Quando recebo o prêmio?", answer: "Após a validação da rodada, o prêmio é processado para o saldo da conta vencedora conforme as regras da plataforma." },
];

export const walletMovements = [
  { id: "mov-1", title: "Recarga via Pix", date: "Hoje, 18:22", amount: 250, kind: "credit" as const },
  { id: "mov-2", title: "Lance na rodada #1024", date: "Hoje, 18:19", amount: -147, kind: "debit" as const },
  { id: "mov-3", title: "Prêmio da rodada #1018", date: "28 ago, 22:18", amount: 2000, kind: "credit" as const },
];

export const accountProfile = {
  name: "Visitante",
  status: "Entre para salvar sua atividade",
  menu: [
    { href: "/saque", label: "Saque", detail: "Chave Pix e solicitações", icon: "landmark" },
    { href: "/historico", label: "Meus lances", detail: "Atividade nas rodadas", icon: "receipt" },
    { href: "/vencedores", label: "Vencedores", detail: "Histórico de prêmios", icon: "trophy" },
    { href: "/duvidas", label: "Ajuda e dúvidas", detail: "Como podemos ajudar?", icon: "help" },
  ] as const,
};

export const withdrawalHistory: Array<{ id: string; date: string; amount: number; status: string }> = [];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
