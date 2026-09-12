import {
  BottomNavigation,
  MajorLanceHeader,
} from "@/components/MajorLanceShell";
import {
  accountProfile,
  faqItems,
  formatCurrency,
  recentBids,
  upcomingRound,
  withdrawalHistory,
} from "@/lib/mockData";
import { useAuth } from "@/_core/hooks/useAuth";
import { isValidWithdrawal, parseBrazilianAmount } from "@/lib/bidRules";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  Copy,
  CreditCard,
  Gift,
  Landmark,
  LockKeyhole,
  LogIn,
  Menu,
  ReceiptText,
  Send,
  ShieldCheck,
  Trophy,
  UserRound,
  WalletCards,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import "./internal-pages.css";
import "./withdrawal-history.css";
import "./question-badge.css";

const avatarClass = (tone: string) => `avatar avatar-${tone}`;

function AppPage({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-canvas">
      <MajorLanceHeader />
      <main className="app-content internal-content">
        <Link className="back-link" href="/">
          <ArrowLeft size={19} /> Voltar para início
        </Link>
        <header className="internal-page-heading">
          {eyebrow && <span>{eyebrow}</span>}
          <h1>{title}</h1>
        </header>
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}

const CUSTOMER_STORAGE_KEY = "major-lance-customer-profile";

function readStoredCustomer() {
  try {
    const stored = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    return stored
      ? (JSON.parse(stored) as { id?: number; pixKey?: string })
      : null;
  } catch {
    return null;
  }
}

export function WalletPage() {
  const [customer] = useState(readStoredCustomer);
  const customerId = typeof customer?.id === "number" ? customer.id : null;
  const wallet = trpc.wallet.balance.useQuery(
    { customerId: customerId ?? 0 },
    { enabled: customerId !== null, refetchInterval: 10000 },
  );
  const transactions = trpc.wallet.transactions.useQuery(
    { customerId: customerId ?? 0 },
    { enabled: customerId !== null, refetchInterval: 10000 },
  );
  const balance = wallet.data?.balance ?? 0;
  return (
    <AppPage eyebrow="CARTEIRA" title="Meu saldo">
      <section className="wallet-hero">
        <span>Saldo disponível</span>
        <strong>{formatCurrency(balance)}</strong>
        <p>Prêmios ganhos nas rodadas ficam disponíveis para saque.</p>
        <div className="wallet-actions">
          <Link className="dark-action" href="/saque">
            <Landmark size={18} /> Sacar
          </Link>
        </div>
      </section>
      <section className="surface-card section-card internal-section">
        <div className="section-heading">
          <h2>
            <ReceiptText /> Movimentações
          </h2>
        </div>
        {customerId === null ? (
          <EmptyState
            icon={<ReceiptText />}
            title="Conta não cadastrada"
            text="Cadastre sua conta para acompanhar seus prêmios."
          />
        ) : transactions.isLoading ? (
          <EmptyState
            icon={<Clock3 />}
            title="Carregando movimentações"
            text="Consultando sua carteira."
          />
        ) : transactions.data?.length ? (
          <div className="movement-list">
            {transactions.data.map((movement) => {
              const movementAmount = Number(movement.amount);
              return (
                <div className="movement-row" key={movement.id}>
                  <div
                    className={`movement-icon ${movement.kind === "prize" ? "credit" : "debit"}`}
                  >
                    <WalletCards size={17} />
                  </div>
                  <div>
                    <strong>{movement.description}</strong>
                    <span>
                      {new Date(movement.createdAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <b className={movement.kind === "prize" ? "credit" : "debit"}>
                    {movementAmount > 0 ? "+" : ""}
                    {formatCurrency(movementAmount)}
                  </b>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<ReceiptText />}
            title="Nenhuma movimentação"
            text="Quando você ganhar uma rodada, o prêmio aparecerá aqui."
          />
        )}
      </section>
    </AppPage>
  );
}

export function WithdrawalPage() {
  const [customer] = useState(readStoredCustomer);
  const customerId = typeof customer?.id === "number" ? customer.id : null;
  const wallet = trpc.wallet.balance.useQuery(
    { customerId: customerId ?? 0 },
    { enabled: customerId !== null, refetchInterval: 10000 },
  );
  const balance = wallet.data?.balance ?? 0;
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState(customer?.pixKey ?? "");
  const withdrawalDemo = new URLSearchParams(window.location.search).get(
    "demo",
  );
  const [status, setStatus] = useState<"idle" | "error" | "success">(
    withdrawalDemo === "success"
      ? "success"
      : withdrawalDemo === "error"
        ? "error"
        : "idle",
  );
  const requested = parseBrazilianAmount(amount);
  const withdrawal = trpc.wallet.requestWithdrawal.useMutation();
  const submit = () => {
    if (customerId === null || !isValidWithdrawal(amount, pixKey, balance)) {
      setStatus("error");
      return;
    }
    withdrawal.mutate(
      {
        customerId,
        amount: requested,
        requestKey: `withdrawal-${crypto.randomUUID()}`,
      },
      {
        onSuccess: () => {
          setStatus("success");
          setAmount("");
          void wallet.refetch();
        },
        onError: () => setStatus("error"),
      },
    );
  };
  return (
    <AppPage eyebrow="CARTEIRA" title="Solicitar saque">
      <section className="withdrawal-available">
        <span>Disponível para saque</span>
        <strong>{formatCurrency(balance)}</strong>
      </section>
      <section className="surface-card section-card form-card">
        <div className="form-label">Valor do saque</div>
        <div className="form-input">
          <span>R$</span>
          <input
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setStatus("idle");
            }}
            inputMode="decimal"
            placeholder="0,00"
          />
        </div>
        <div className="form-label">Chave Pix</div>
        <div className="form-input is-text">
          <Copy size={17} />
          <input
            value={pixKey}
            onChange={(event) => {
              setPixKey(event.target.value);
              setStatus("idle");
            }}
            placeholder="CPF, e-mail, celular ou chave aleatória"
          />
        </div>
        <p className="form-helper">
          <LockKeyhole size={15} /> O saque será registrado no saldo. Nenhuma
          transferência Pix será enviada nesta etapa.
        </p>
        <button
          className="wide-gold-button"
          onClick={submit}
          disabled={withdrawal.isPending}
        >
          <Landmark size={20} />{" "}
          {withdrawal.isPending ? "Registrando..." : "Solicitar saque"}
        </button>
        {status === "error" && (
          <p className="form-feedback is-error">
            <CircleAlert size={16} /> Informe uma chave Pix e um valor
            disponível.
          </p>
        )}
        {status === "success" && (
          <div className="withdrawal-success-toast" role="status">
            <CircleCheck size={22} />
            <span>Saque realizado com sucesso.</span>
          </div>
        )}
      </section>
      <section className="surface-card section-card internal-section withdrawal-history">
        <div className="section-heading">
          <h2>
            <ReceiptText /> Histórico de saques
          </h2>
        </div>
        {withdrawalHistory.length ? (
          withdrawalHistory.map((withdrawal) => (
            <div className="withdrawal-history-row" key={withdrawal.id}>
              <div>
                <strong>{withdrawal.date}</strong>
                <span>Pix enviado</span>
              </div>
              <b>{formatCurrency(withdrawal.amount)}</b>
              <span className="paid-badge">
                {withdrawal.status} <CircleCheck size={13} />
              </span>
            </div>
          ))
        ) : (
          <EmptyState
            icon={<ReceiptText />}
            title="Nenhum saque registrado"
            text="As solicitações de saque aparecerão aqui após serem processadas."
          />
        )}
      </section>
      <section className="surface-card info-banner">
        <Clock3 />
        <div>
          <strong>Processamento transparente</strong>
          <span>
            As solicitações futuras serão registradas neste histórico.
          </span>
        </div>
      </section>
    </AppPage>
  );
}

export function BidHistoryPage() {
  const [mode, setMode] = useState<"all" | "mine">("all");
  const [customerId] = useState<number | null>(() => {
    try {
      const stored = window.localStorage.getItem(
        "major-lance-customer-profile",
      );
      const profile = stored ? (JSON.parse(stored) as { id?: number }) : null;
      return typeof profile?.id === "number" ? profile.id : null;
    } catch {
      return null;
    }
  });
  const auction = trpc.auction.state.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const liveBids = auction.data?.recentBids ?? [];
  const visibleBids =
    mode === "all"
      ? liveBids
      : liveBids.filter(
          (bid) => customerId !== null && bid.ownerId === customerId,
        );
  const emptyMine = mode === "mine" && customerId === null;
  return (
    <AppPage eyebrow="ATIVIDADE" title="Últimos lances">
      <div className="segment-control">
        <button
          className={mode === "all" ? "active" : ""}
          onClick={() => setMode("all")}
        >
          Todos os lances
        </button>
        <button
          className={mode === "mine" ? "active" : ""}
          onClick={() => setMode("mine")}
        >
          Meus lances
        </button>
      </div>
      <section className="surface-card section-card internal-section">
        {mode === "all" ? (
          auction.isLoading ? (
            <EmptyState
              icon={<Clock3 />}
              title="Carregando lances"
              text="Consultando os registros da rodada atual."
            />
          ) : visibleBids.length ? (
            <div className="expanded-bid-list">
              {visibleBids.map((bid, index) => (
                <div className="history-bid-row" key={bid.id}>
                  <div
                    className={avatarClass(
                      ["blue", "rose", "green", "violet", "amber"][index % 5],
                    )}
                  >
                    {bid.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <strong>{bid.name}</strong>
                    <span>
                      {bid.source === "pix"
                        ? "Pix aprovado"
                        : "Inserido pelo administrador"}{" "}
                      ·{" "}
                      {new Date(bid.createdAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <b>{formatCurrency(bid.amount)}</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Zap />}
              title="Nenhum lance nesta rodada"
              text="Os lances pagos e manuais aparecerão aqui assim que forem registrados."
            />
          )
        ) : emptyMine ? (
          <EmptyState
            icon={<Zap />}
            title="Cadastre sua conta primeiro"
            text="Seu cadastro neste navegador será usado para identificar seus lances."
            action={
              <Link className="small-gold-link" href="/">
                Participar da rodada <ArrowRight size={16} />
              </Link>
            }
          />
        ) : visibleBids.length ? (
          <div className="expanded-bid-list">
            {visibleBids.map((bid, index) => (
              <div className="history-bid-row" key={bid.id}>
                <div
                  className={avatarClass(
                    ["blue", "rose", "green", "violet", "amber"][index % 5],
                  )}
                >
                  {bid.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <strong>{bid.name}</strong>
                  <span>
                    Meu lance ·{" "}
                    {bid.source === "pix"
                      ? "Pix aprovado"
                      : "Inserido pelo administrador"}{" "}
                    ·{" "}
                    {new Date(bid.createdAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <b>{formatCurrency(bid.amount)}</b>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Zap />}
            title="Você ainda não enviou lances"
            text="Após o pagamento do Pix, seus lances também aparecerão nesta aba."
            action={
              <Link className="small-gold-link" href="/">
                Ver rodada ao vivo <ArrowRight size={16} />
              </Link>
            }
          />
        )}
      </section>
    </AppPage>
  );
}

export function UpcomingRoundsPage() {
  const [notified, setNotified] = useState<string | null>(null);
  const auction = trpc.auction.state.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const liveUpcoming = auction.data?.upcomingRound;
  const rounds = useMemo(() => {
    if (!liveUpcoming) return [];
    const prizeSequence = [3000, 5000, 1000];
    return [0, 1, 2].map((offset) => {
      const sequenceIndex =
        (liveUpcoming.sequenceIndex + offset) % prizeSequence.length;
      const startsAt = new Date(
        new Date(liveUpcoming.startsAt).getTime() + offset * 10 * 60 * 1000,
      );
      return {
        id: `upcoming-${sequenceIndex}-${startsAt.getTime()}`,
        prize: prizeSequence[sequenceIndex],
        prizeLabel: formatCurrency(prizeSequence[sequenceIndex]),
        startsAt: startsAt.toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
      };
    });
  }, [liveUpcoming]);
  return (
    <AppPage eyebrow="AGENDA" title="Próximas rodadas">
      <p className="page-intro">
        As rodadas seguem automaticamente a sequência de prêmios e começam sem
        intervalo após o encerramento anterior.
      </p>
      {auction.isLoading ? (
        <EmptyState
          icon={<Clock3 />}
          title="Carregando agenda"
          text="Consultando os horários atuais."
        />
      ) : (
        <div className="upcoming-list">
          {rounds.map((round, index) => (
            <article
              className={`upcoming-card ${index === 0 ? "highlight" : ""}`}
              key={round.id}
            >
              <div className="upcoming-card-top">
                <span>
                  {index === 0 ? "PRÓXIMA RODADA" : "RODADA SEGUINTE"}
                </span>
                {index === 0 && <BadgeCheck size={18} />}
              </div>
              <strong>{round.prizeLabel}</strong>
              <p>
                Começa em <b>{round.startsAt}</b>
              </p>
              <button
                className={
                  notified === round.id
                    ? "notification-confirmed"
                    : "notification-button"
                }
                onClick={() => setNotified(round.id)}
              >
                {notified === round.id ? (
                  <>
                    <CircleCheck size={17} /> Aviso ativado
                  </>
                ) : (
                  <>
                    <Bell size={17} /> Avise-me
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
      )}
    </AppPage>
  );
}

export function WinnersPage() {
  const auction = trpc.auction.state.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const winners = auction.data?.winners ?? [];
  return (
    <AppPage eyebrow="CONQUISTAS" title="Últimos vencedores">
      <p className="page-intro">
        Resultados apresentados com nome, data da rodada, valor do prêmio e
        lance vencedor.
      </p>
      <section className="surface-card section-card internal-section winner-history">
        {auction.isLoading ? (
          <EmptyState
            icon={<Clock3 />}
            title="Carregando vencedores"
            text="Consultando o histórico real das rodadas."
          />
        ) : winners.length ? (
          <div className="winner-list">
            {winners.map((winner) => (
              <article
                className="winner-history-row winner-row-simple"
                key={winner.id}
              >
                <div className="winner-history-info">
                  <strong>{winner.name}</strong>
                  <span>
                    {new Date(winner.wonAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div>
                  <b>{formatCurrency(winner.prize)}</b>
                  <span className="winner-bid-badge">
                    <span>Lance vencedor</span>
                    <b>{formatCurrency(winner.bid)}</b>
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy />}
            title="Nenhum vencedor ainda"
            text="Os vencedores aparecerão aqui após o encerramento das rodadas."
          />
        )}
      </section>
      <section className="surface-card info-banner">
        <ShieldCheck />
        <div>
          <strong>Rodadas verificáveis</strong>
          <span>
            O histórico é formado por pagamentos confirmados e lances
            registrados no painel administrativo.
          </span>
        </div>
      </section>
    </AppPage>
  );
}

export function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <AppPage eyebrow="SUPORTE" title="Dúvidas frequentes">
      <section className="faq-page-list">
        {faqItems.map((item, index) => (
          <article
            className={`faq-item ${open === index ? "is-open" : ""}`}
            key={item.question}
          >
            <button onClick={() => setOpen(open === index ? null : index)}>
              <span className="faq-question">
                <span className="question-dot">?</span> {item.question}
              </span>
              <ChevronDown size={22} />
            </button>
            {open === index && <p>{item.answer}</p>}
          </article>
        ))}
      </section>
      <section className="surface-card support-card">
        <HeadsetIcon />
        <div>
          <strong>Precisa de ajuda?</strong>
          <span>Nosso atendimento estará disponível 24h por dia.</span>
        </div>
        <button>Falar com suporte</button>
      </section>
    </AppPage>
  );
}

export function AccountPage() {
  const { user } = useAuth();
  const [customerProfile, setCustomerProfile] = useState<{
    fullName: string;
  } | null>(() => {
    try {
      const stored = window.localStorage.getItem(
        "major-lance-customer-profile",
      );
      return stored ? (JSON.parse(stored) as { fullName: string }) : null;
    } catch {
      return null;
    }
  });
  const iconByName = {
    wallet: WalletCards,
    landmark: Landmark,
    receipt: ReceiptText,
    trophy: Trophy,
    help: CircleHelp,
  };
  const connected = Boolean(user || customerProfile);
  return (
    <AppPage eyebrow="CONTA" title="Minha conta">
      <section className="account-profile">
        <div className="account-avatar">
          <UserRound size={32} />
        </div>
        <div>
          <strong>
            {user?.name ?? customerProfile?.fullName ?? accountProfile.name}
          </strong>
          <span>{connected ? "Conta conectada" : accountProfile.status}</span>
        </div>
      </section>
      <section className="surface-card account-menu">
        {accountProfile.menu.map(({ href, icon, label, detail }) => {
          const Icon = iconByName[icon];
          return (
            <Link key={href} href={href} className="account-menu-link">
              <span>
                <Icon size={21} />
              </span>
              <div>
                <strong>{label}</strong>
                <small>{detail}</small>
              </div>
              <ArrowRight size={18} />
            </Link>
          );
        })}
      </section>
      <p className="legal-note">
        Ao continuar, você concorda com os termos de uso e a política de
        privacidade da plataforma.
      </p>
    </AppPage>
  );
}

function HeadsetIcon() {
  return (
    <div className="support-icon">
      <CircleHelp size={22} />
    </div>
  );
}
