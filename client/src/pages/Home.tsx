import {
  MajorLanceFooter,
  MajorLanceShell,
} from "@/components/MajorLanceShell";
import CustomerRegistrationModal, {
  type CustomerRegistrationValues,
} from "@/components/CustomerRegistrationModal";
import {
  currentRound,
  formatCurrency,
  recentBids,
  upcomingRound,
} from "@/lib/mockData";
import { isValidBid, parseBrazilianAmount } from "@/lib/bidRules";
import { copyPixCode } from "@/lib/pixUi";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  ChevronDown,
  CircleCheck,
  CircleDot,
  Copy,
  Crown,
  Gem,
  Headphones,
  Landmark,
  Loader2,
  LockKeyhole,
  Medal,
  PartyPopper,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  UsersRound,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import "./home.css";
import "./home-refinements.css";
import "./question-badge.css";

const avatarClass = (tone: string) => `avatar avatar-${tone}`;
const onlineValues = ["124", "187", "246", "319", "392"];
const avatarTones = ["blue", "rose", "green", "violet", "amber"] as const;
const CUSTOMER_STORAGE_KEY = "major-lance-customer-profile";

type StoredCustomerProfile = CustomerRegistrationValues & { id: number };

function initialsForName(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "P"
  );
}

function formatHour(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseDateValue(value: Date | string) {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  const brazilian = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s*(?:às|as|at)?\s*(\d{2}):(\d{2}))?$/i,
  );
  if (brazilian) {
    const [, day, month, year, hour = "0", minute = "0"] = brazilian;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(value: Date | string) {
  const parsed = parseDateValue(value);
  return parsed
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(parsed)
    : "Data indisponível";
}

function formatRelativeTime(value: Date | string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return `há ${seconds} segundos`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return `há ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
}

function formatTimer(seconds: number) {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  const secs = Math.max(0, seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

type AudioContextWindow = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function playNewBidSound(context: AudioContext | null) {
  if (!context || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  gain.connect(context.destination);
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, now);
  oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.18);
  oscillator.connect(gain);
  oscillator.start(now);
  oscillator.stop(now + 0.3);
}

export default function Home() {
  const demoState = new URLSearchParams(window.location.search).get("demo");
  const auctionState = trpc.auction.state.useQuery(undefined, {
    refetchInterval: 5000,
    staleTime: 3000,
  });
  const liveRound = auctionState.data?.currentRound;
  const settlement = auctionState.data?.settlement;
  const roundView =
    liveRound ?? (demoState && import.meta.env.DEV ? currentRound : null);
  const [secondsLeft, setSecondsLeft] = useState(
    demoState === "closed" ? 0 : (roundView?.remainingSeconds ?? 0),
  );
  const [onlineIndex, setOnlineIndex] = useState(0);
  const [amount, setAmount] = useState(
    demoState === "success" ? "148" : demoState === "error" ? "147" : "",
  );
  const [bidStatus, setBidStatus] = useState<
    "idle" | "processing" | "pending" | "success" | "error"
  >(
    demoState === "success"
      ? "success"
      : demoState === "error"
        ? "error"
        : "idle",
  );
  const [pixCopied, setPixCopied] = useState(false);
  const [newBidNotice, setNewBidNotice] = useState<{
    name: string;
    amount: number;
  } | null>(null);
  const [animatedBidId, setAnimatedBidId] = useState<string | null>(null);
  const [leaderSlideKey, setLeaderSlideKey] = useState(0);
  const [winnerCarouselPaused, setWinnerCarouselPaused] = useState(false);
  const knownBidIds = useRef<Set<string>>(new Set());
  const previousLeaderBid = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const [bidErrorMessage, setBidErrorMessage] = useState(
    "Verifique o valor do lance ou tente novamente.",
  );
  const [customerProfile, setCustomerProfile] =
    useState<StoredCustomerProfile | null>(() => {
      try {
        const stored = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
        return stored ? (JSON.parse(stored) as StoredCustomerProfile) : null;
      } catch {
        return null;
      }
    });
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(
    null,
  );
  const [pendingBidAmount, setPendingBidAmount] = useState<number | null>(null);
  const [settlementSecondsLeft, setSettlementSecondsLeft] = useState(0);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    amount: number;
  } | null>(null);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [pixCharge, setPixCharge] = useState<{
    identifier: string;
    pixCode: string;
    amount: number;
    status: "pending" | "paid" | "expired" | "failed";
  } | null>(
    demoState === "pix" && import.meta.env.DEV
      ? {
          identifier: "preview-charge",
          pixCode:
            "00020101021226850014br.gov.bcb.pix2563preview-only-not-a-real-charge5204000053039865406148.005802BR5913MAJOR LANCE6008SAO PAULO62070503***6304ABCD",
          amount: 148,
          status: "pending",
        }
      : null,
  );
  const createPixCharge = trpc.wallet.createPixCharge.useMutation();
  const createCustomerProfile = trpc.customer.create.useMutation();
  const currentLeader = liveRound?.leader
    ? {
        ...liveRound.leader,
        initials: initialsForName(liveRound.leader.name),
        avatarTone: "blue" as const,
      }
    : null;
  const recentBidsView =
    auctionState.data?.recentBids.map((bid, index) => ({
      ...bid,
      initials: initialsForName(bid.name),
      avatarTone: avatarTones[index % avatarTones.length],
      relativeTime: formatRelativeTime(bid.createdAt),
    })) ?? [];
  const winnersView = (auctionState.data?.winners ?? []).map((winner) => ({
    ...winner,
    dateLabel: formatDateOnly(winner.wonAt),
  }));
  const carouselWinners =
    winnersView.length > 1 ? [...winnersView, ...winnersView] : winnersView;
  const upcomingRoundView = auctionState.data?.upcomingRound
    ? {
        ...auctionState.data.upcomingRound,
        prizeLabel: formatCurrency(auctionState.data.upcomingRound.prize),
        startsAt: formatHour(auctionState.data.upcomingRound.startsAt),
      }
    : null;
  const pixChargeStatus = trpc.wallet.pixChargeStatus.useQuery(
    {
      identifier: pixCharge?.identifier ?? "",
      customerId: customerProfile?.id ?? 0,
    },
    {
      enabled:
        Boolean(pixCharge && customerProfile) &&
        pixCharge?.identifier !== "preview-charge",
      refetchInterval: (query) =>
        query.state.data?.status === "pending" ? 1000 : false,
    },
  );
  const isClosed = secondsLeft === 0;
  const isSettling = Boolean(settlement && settlementSecondsLeft > 0);

  useEffect(() => {
    if (!liveRound) return;
    setSecondsLeft(liveRound.remainingSeconds);
    if (
      previousLeaderBid.current !== null &&
      previousLeaderBid.current !== liveRound.currentBid
    ) {
      setLeaderSlideKey((value) => value + 1);
    }
    previousLeaderBid.current = liveRound.currentBid;
  }, [liveRound?.id, liveRound?.remainingSeconds, liveRound?.currentBid]);

  useEffect(() => {
    setSettlementSecondsLeft(settlement?.remainingSeconds ?? 0);
  }, [settlement?.remainingSeconds]);

  useEffect(() => {
    if (settlementSecondsLeft <= 0) return;
    const timer = window.setInterval(
      () => setSettlementSecondsLeft((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [settlementSecondsLeft > 0]);

  useEffect(() => {
    if (isClosed) return;
    const timer = window.setInterval(
      () => setSecondsLeft((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [isClosed]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setOnlineIndex((value) => (value + 1) % onlineValues.length),
      4000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const AudioContextCtor =
      (window as AudioContextWindow).AudioContext ??
      (window as AudioContextWindow).webkitAudioContext;
    if (!AudioContextCtor) return;
    const unlockSound = () => {
      if (!audioContext.current) audioContext.current = new AudioContextCtor();
      if (audioContext.current.state === "suspended")
        void audioContext.current.resume();
    };
    window.addEventListener("pointerdown", unlockSound);
    return () => window.removeEventListener("pointerdown", unlockSound);
  }, []);

  useEffect(() => {
    const bids = auctionState.data?.recentBids ?? [];
    const nextIds = new Set(bids.map((bid) => bid.id));
    const hasLoadedBefore = knownBidIds.current.size > 0;
    const newBid = bids.find((bid) => !knownBidIds.current.has(bid.id));
    if (hasLoadedBefore && newBid) {
      playNewBidSound(audioContext.current);
      setNewBidNotice({ name: newBid.name, amount: newBid.amount });
      setAnimatedBidId(newBid.id);
    }
    knownBidIds.current = nextIds;
  }, [auctionState.data?.recentBids]);

  useEffect(() => {
    if (!newBidNotice) return;
    const timer = window.setTimeout(() => setNewBidNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [newBidNotice]);

  useEffect(() => {
    if (!animatedBidId) return;
    const timer = window.setTimeout(() => setAnimatedBidId(null), 1500);
    return () => window.clearTimeout(timer);
  }, [animatedBidId]);

  const inputHint = useMemo(
    () =>
      `Digite um valor maior que ${formatCurrency(roundView?.currentBid ?? 0)}`,
    [roundView?.currentBid],
  );

  const startPixCharge = (bidAmount: number, customerId: number) => {
    if (!roundView) return;
    setBidStatus("processing");
    setIsCelebrating(false);
    createPixCharge.mutate(
      {
        amount: bidAmount,
        roundId: roundView.id,
        requestKey: `${roundView.id}-${crypto.randomUUID()}`,
        customerId,
      },
      {
        onSuccess: (charge) => {
          if (charge.status === "paid") {
            setPixCharge(charge);
            setPixCopied(false);
            setPaymentSuccess({ amount: charge.amount });
            setIsCelebrating(true);
            setBidStatus("success");
            return;
          }
          setPixCharge(charge);
          setPixCopied(false);
          setBidStatus("pending");
        },
        onError: () => setBidStatus("error"),
      },
    );
  };

  const handleBid = () => {
    if (!roundView) return;
    if (!isValidBid(amount, roundView.currentBid, isClosed)) {
      const typedBid = parseBrazilianAmount(amount);
      setBidErrorMessage(
        typedBid > 0 && typedBid <= roundView.currentBid
          ? "Envie um valor maior que o maior lance atual."
          : "Verifique o valor do lance ou tente novamente.",
      );
      setBidStatus("error");
      return;
    }

    const bidAmount = Number(parseBrazilianAmount(amount).toFixed(2));
    if (!customerProfile) {
      setPendingBidAmount(bidAmount);
      setRegistrationError(null);
      setRegistrationOpen(true);
      return;
    }
    startPixCharge(bidAmount, customerProfile.id);
  };

  const handleRegistration = (values: CustomerRegistrationValues) => {
    setRegistrationError(null);
    createCustomerProfile.mutate(values, {
      onSuccess: (profile) => {
        const storedProfile: StoredCustomerProfile = {
          ...values,
          id: profile.id,
        };
        window.localStorage.setItem(
          CUSTOMER_STORAGE_KEY,
          JSON.stringify(storedProfile),
        );
        setCustomerProfile(storedProfile);
        setRegistrationOpen(false);
        if (pendingBidAmount !== null) {
          startPixCharge(pendingBidAmount, profile.id);
          setPendingBidAmount(null);
        }
      },
      onError: (error) =>
        setRegistrationError(
          error.message || "Não foi possível salvar seu cadastro.",
        ),
    });
  };

  useEffect(() => {
    if (!pixCopied) return;
    const timeout = window.setTimeout(() => setPixCopied(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [pixCopied]);

  const handleCopyPix = async () => {
    try {
      const copied = await copyPixCode(pixCharge?.pixCode ?? "");
      if (copied) setPixCopied(true);
    } catch {
      setPixCopied(false);
    }
  };

  useEffect(() => {
    const status = pixChargeStatus.data?.status;
    if (status === "paid" && !paymentSuccess) {
      const amt = pixChargeStatus.data?.amount ?? pixCharge?.amount ?? 0;
      setPaymentSuccess({ amount: amt });
      setIsCelebrating(true);
      setBidStatus("success");
    } else if (status === "expired" || status === "failed") {
      setBidStatus("error");
    }
  }, [pixChargeStatus.data?.status, paymentSuccess, pixCharge?.amount]);

  const utils = trpc.useUtils();
  useEffect(() => {
    if (!paymentSuccess) return;
    const closeTimer = window.setTimeout(() => {
      setPixCharge(null);
      setAmount("");
    }, 2200);
    const endTimer = window.setTimeout(() => {
      setPaymentSuccess(null);
      setIsCelebrating(false);
      setBidStatus("idle");
      void auctionState.refetch();
      void utils.auction.state.invalidate();
    }, 2600);
    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(endTimer);
    };
  }, [paymentSuccess]);

  if (!roundView) {
    return (
      <MajorLanceShell>
        <div className="round-loading-state">
          {auctionState.isError
            ? "Não foi possível carregar a rodada agora."
            : "Carregando a rodada atual..."}
        </div>
      </MajorLanceShell>
    );
  }

  return (
    <MajorLanceShell>
      <div className="home-stack">
        {newBidNotice && (
          <div className="bid-live-toast" role="status" aria-live="polite">
            <CircleCheck size={18} />
            <div>
              <strong>Novo lance publicado</strong>
              <span>
                {newBidNotice.name} — {formatCurrency(newBidNotice.amount)}
              </span>
            </div>
          </div>
        )}
        {isSettling && (
          <div
            className="round-settlement-overlay"
            role="alert"
            aria-live="assertive"
          >
            <div className="round-settlement-card">
              <CircleCheck size={36} />
              <span className="round-settlement-eyebrow">RODADA ENCERRADA</span>
              <strong>
                {settlement?.winner?.name
                  ? `${settlement.winner.name} venceu!`
                  : "Rodada encerrada"}
              </strong>
              <p>Prêmio creditado: {formatCurrency(settlement?.prize ?? 0)}</p>
              <small>Nova rodada começa em {settlementSecondsLeft}s</small>
            </div>
          </div>
        )}
        <section className="round-hero" aria-labelledby="round-title">
          <div className="round-atmosphere" aria-hidden="true">
            <Trophy />
            <Trophy />
          </div>
          <div className="round-topline">
            <span className="live-badge">
              <span className="live-pulse" /> RODADA AO VIVO
            </span>
            <span className="online-badge">
              <span className="online-live-dot" />
              <span
                className="online-copy"
                aria-label={`${onlineValues[onlineIndex]} pessoas online`}
              >
                {onlineValues[onlineIndex]} online
              </span>
              <UsersRound size={14} />
            </span>
          </div>
          <p className="round-kicker" id="round-title">
            PRÊMIO DA RODADA
          </p>
          <div
            className="prize-value prize-glow"
            aria-label={`Prêmio da rodada: ${formatCurrency(roundView.prize)}`}
          >
            <span className="prize-sheen" aria-hidden="true" />
            {formatCurrency(roundView.prize)}
          </div>

          <div className="round-stats">
            <article className="round-stat-card">
              <div className="stat-label">
                <Crown size={17} /> MAIOR LANCE ATUAL
              </div>
              <div
                className={`leader-stat-content ${leaderSlideKey > 0 ? "is-updated" : ""}`}
                key={leaderSlideKey}
              >
                <strong>{formatCurrency(roundView.currentBid)}</strong>
                <div className="leader-line">
                  {currentLeader ? (
                    <>
                      <span className={avatarClass(currentLeader.avatarTone)}>
                        {currentLeader.initials}
                      </span>{" "}
                      {currentLeader.name}
                    </>
                  ) : (
                    "Nenhum lance ainda"
                  )}
                </div>
              </div>
            </article>
            <article className="round-stat-card timer-card">
              <div className="stat-label">
                <Timer size={17} /> TEMPO RESTANTE
              </div>
              <strong className={isClosed ? "is-danger" : ""}>
                {isClosed ? "ENCERRADA" : formatTimer(secondsLeft)}
              </strong>
              <div className="timer-progress">
                <span
                  style={{
                    width: `${Math.max(5, Math.min(100, (secondsLeft / Math.max(1, roundView.remainingSeconds)) * 100))}%`,
                  }}
                />
              </div>
            </article>
          </div>

          {isClosed ? (
            <div className="round-closed-message">
              <CircleCheck size={18} /> Rodada encerrada. Confira a próxima
              rodada abaixo.
            </div>
          ) : (
            <div className="bid-form">
              <div
                className={`bid-input-wrap ${bidStatus === "error" ? "is-error" : ""}`}
              >
                <span className="currency-prefix">R$</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setBidStatus("idle");
                    setBidErrorMessage(
                      "Verifique o valor do lance ou tente novamente.",
                    );
                  }}
                  placeholder={inputHint}
                  aria-label="Valor do seu lance"
                />
              </div>
              <button
                type="button"
                className={`bid-submit ${bidStatus === "processing" ? "is-processing" : ""}`}
                onClick={handleBid}
                disabled={bidStatus === "processing"}
              >
                {bidStatus === "processing" ? (
                  <>
                    <Loader2 size={22} className="spin-slow" /> GERANDO PIX...
                  </>
                ) : (
                  <>
                    <Send size={23} fill="currentColor" /> ENVIAR MEU LANCE
                  </>
                )}
              </button>
              {bidStatus === "pending" && (
                <p className="bid-feedback is-success">
                  <CircleCheck size={16} /> Pix gerado. Pague para registrar o
                  lance.
                </p>
              )}
              {bidStatus === "success" && (
                <p className="bid-feedback is-success">
                  <CircleCheck size={16} /> Pagamento confirmado. Lance
                  registrado.
                </p>
              )}
              {bidStatus === "error" && (
                <p className="bid-feedback is-error">
                  <CircleDot size={16} /> {bidErrorMessage}
                </p>
              )}
            </div>
          )}
          <p className="payment-note">
            <LockKeyhole size={15} /> Pagamento via Pix ·{" "}
            <b>100% seguro e instantâneo</b>
          </p>
        </section>

        <section
          className="surface-card section-card bid-list-section"
          aria-labelledby="recent-bids-title"
        >
          <div className="section-heading">
            <h2 id="recent-bids-title">
              <Zap size={22} fill="currentColor" /> ÚLTIMOS LANCES
            </h2>
            <Link className="section-link" href="/historico">
              Ver todos <ArrowRight />
            </Link>
          </div>
          <div className="bid-list">
            {recentBidsView.map((bid) => {
              const isTopBid = bid.amount === roundView.currentBid;
              return (
                <div
                  className={`bid-row ${isTopBid ? "is-top-bid" : ""} ${animatedBidId === bid.id ? "is-new-bid" : ""}`}
                  key={bid.id}
                >
                  <div className={avatarClass(bid.avatarTone)}>
                    {bid.initials}
                  </div>
                  <span className="bidder-name">
                    {isTopBid && (
                      <Medal
                        className="top-bid-medal"
                        aria-label="Maior lance"
                      />
                    )}
                    {bid.name}
                  </span>
                  <strong className={isTopBid ? "is-latest" : ""}>
                    {formatCurrency(bid.amount)}
                  </strong>
                  <span className="bid-time">{bid.relativeTime}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section
          className="surface-card section-card how-section"
          aria-labelledby="how-title"
        >
          <div className="section-heading">
            <h2 id="how-title">
              <BookOpen size={21} fill="currentColor" /> COMO FUNCIONA?
            </h2>
            <span className="section-hint">Simples e rápido</span>
          </div>
          <div className="how-vertical-list">
            <HowStep
              number="1"
              icon={<UserRound />}
              title="Entre na rodada"
              text="Veja o prêmio e o lance atual."
            />
            <HowStep
              number="2"
              icon={<Gem />}
              title="Faça seu lance"
              text="Envie um valor via Pix maior que o atual."
            />
            <HowStep
              number="3"
              icon={<BarChart3 />}
              title="Acompanhe ao vivo"
              text="Os lances aparecem em tempo real."
            />
            <HowStep
              number="4"
              icon={<Trophy />}
              title="Maior lance ganha"
              text="Quando o tempo zerar, o maior lance leva."
            />
          </div>
        </section>

        {upcomingRoundView && !isSettling && (
          <section className="next-round-card" aria-labelledby="upcoming-title">
            <div className="section-heading">
              <h2 id="upcoming-title">
                <Timer size={20} /> PRÓXIMA RODADA
              </h2>
              <Link className="section-link" href="/proximas-rodadas">
                Ver agenda <ArrowRight />
              </Link>
            </div>
            <div className="next-round-body">
              <div>
                <span>Prêmio:</span>
                <strong>{upcomingRoundView.prizeLabel}</strong>
              </div>
              <span className="next-round-divider" aria-hidden="true" />
              <div>
                <span>Começa às:</span>
                <strong>{upcomingRoundView.startsAt}</strong>
              </div>
              <Link className="notify-button" href="/proximas-rodadas">
                <Bell size={15} /> AVISE-ME
              </Link>
            </div>
          </section>
        )}

        <section
          className="surface-card section-card winner-section"
          aria-labelledby="winner-title"
        >
          <div className="section-heading">
            <h2 id="winner-title">
              <Trophy size={22} fill="currentColor" /> ÚLTIMOS VENCEDORES
            </h2>
            <Link className="section-link" href="/vencedores">
              Ver histórico <ArrowRight />
            </Link>
          </div>
          {winnersView.length ? (
            <div className="winner-list" aria-label="Últimos vencedores">
              {winnersView.map((winner) => (
                <article
                  className="winner-row winner-row-simple"
                  key={winner.id}
                >
                  <div className="winner-identity">
                    <strong>{winner.name}</strong>
                    <span>{winner.dateLabel}</span>
                  </div>
                  <div className="winner-amount">
                    <strong>{formatCurrency(winner.prize)}</strong>
                    <span className="winner-bid-badge">
                      <span>Lance vencedor</span>
                      <b>{formatCurrency(winner.bid)}</b>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="winner-empty">
              <Trophy size={20} />
              <span>
                Os vencedores aparecerão aqui após o encerramento das rodadas.
              </span>
            </div>
          )}
        </section>

        <section className="faq-section" aria-labelledby="faq-title">
          <Link className="faq-item faq-home-link" href="/duvidas">
            <span className="faq-question" id="faq-title">
              <span className="question-dot">?</span> DÚVIDAS FREQUENTES
            </span>
            <ChevronDown size={22} />
          </Link>
        </section>

        <section className="trust-row" aria-label="Compromissos de confiança">
          <TrustItem
            icon={<ShieldCheck />}
            title="Ambiente Seguro"
            text="Seus dados protegidos"
          />
          <TrustItem
            icon={<Landmark />}
            title="Pagamentos via Pix"
            text="Rápido e confiável"
          />
          <TrustItem
            icon={<Headphones />}
            title="Suporte 24h"
            text="Sempre que precisar"
          />
          <TrustItem
            icon={<CircleCheck />}
            title="Transparência"
            text="Rodadas reais"
          />
        </section>
        <footer className="app-footer">
          <MajorLanceFooter />
          <span>© 2026 Major Lance. Todos os direitos reservados.</span>
        </footer>
      </div>

      {registrationOpen && (
        <CustomerRegistrationModal
          isSubmitting={createCustomerProfile.isPending}
          errorMessage={registrationError}
          onClose={() => {
            setRegistrationOpen(false);
            setPendingBidAmount(null);
          }}
          onSubmit={handleRegistration}
        />
      )}

      <AnimatePresence>
        {pixCharge && (
          <motion.div
            className="pix-modal-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <motion.section
              className={`pix-modal ${paymentSuccess ? "is-success" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pix-modal-title"
              initial={{ y: 18, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 12, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            >
              <AnimatePresence mode="wait">
                {paymentSuccess ? (
                  <motion.div
                    key="success"
                    className="pix-success-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="pix-success-confetti" aria-hidden="true">
                      {Array.from({ length: 14 }).map((_, i) => (
                        <span
                          key={i}
                          className={`confetti-dot c${(i % 6) + 1}`}
                          style={{
                            left: `${8 + i * 6.2}%`,
                            animationDelay: `${i * 0.07}s`,
                          }}
                        />
                      ))}
                    </div>
                    <motion.div
                      className="pix-success-icon-wrap"
                      initial={{ scale: 0.4, rotate: -12 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 18,
                        delay: 0.08,
                      }}
                    >
                      <span className="pix-success-ring" />
                      <span className="pix-success-ring is-2" />
                      <span className="pix-success-icon">
                        <CircleCheck size={42} strokeWidth={2.2} />
                      </span>
                    </motion.div>
                    <motion.div
                      className="pix-success-badge"
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.18 }}
                    >
                      <Sparkles size={14} /> PAGAMENTO CONFIRMADO{" "}
                      <PartyPopper size={14} />
                    </motion.div>
                    <motion.h2
                      initial={{ y: 6, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.22 }}
                    >
                      Lance registrado!
                    </motion.h2>
                    <motion.strong
                      className="pix-success-amount"
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.28,
                        type: "spring",
                        stiffness: 300,
                      }}
                    >
                      {formatCurrency(paymentSuccess.amount)}
                    </motion.strong>
                    <motion.p
                      className="pix-success-subtitle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.34 }}
                    >
                      Seu lance entrou na disputa ao vivo. Acompanhe a
                      atualização abaixo.
                    </motion.p>
                    <motion.div
                      className="pix-success-progress"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <span className="pix-success-progress-bar" />
                      <span className="pix-success-progress-label">
                        <Loader2 size={13} className="spin-slow" /> Atualizando
                        lances…
                      </span>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="pending"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <button
                      className="pix-modal-close"
                      type="button"
                      aria-label="Fechar pagamento Pix"
                      onClick={() => setPixCharge(null)}
                    >
                      <X size={20} />
                    </button>
                    <span className="pix-modal-eyebrow">QUASE LÁ...</span>
                    <h2 id="pix-modal-title">Pague seu Pix</h2>
                    <p className="pix-modal-intro">
                      Pague seu Pix para confirmar seu lance atual.
                    </p>
                    <strong className="pix-modal-amount">
                      {formatCurrency(pixCharge.amount)}
                    </strong>
                    <div className="pix-how-to">
                      <h3>Como pagar o Pix</h3>
                      <ol>
                        <li>
                          <span>1</span>
                          <div>
                            <strong>Copie o código</strong>
                            <small>Toque no botão abaixo.</small>
                          </div>
                        </li>
                        <li>
                          <span>2</span>
                          <div>
                            <strong>Abra o app do seu banco</strong>
                            <small>Entre na área de pagamentos.</small>
                          </div>
                        </li>
                        <li>
                          <span>3</span>
                          <div>
                            <strong>Selecione Pix</strong>
                            <small>Escolha a opção de Pix Copia e Cola.</small>
                          </div>
                        </li>
                        <li>
                          <span>4</span>
                          <div>
                            <strong>Cole e confirme</strong>
                            <small>
                              Revise o valor e finalize o pagamento.
                            </small>
                          </div>
                        </li>
                      </ol>
                    </div>
                    <p className="pix-modal-status">
                      {pixChargeStatus.data?.status === "expired" ||
                      pixChargeStatus.data?.status === "failed" ? (
                        <>Este Pix expirou ou não pôde ser processado.</>
                      ) : (
                        <>
                          <span className="pix-pulse-dot" aria-hidden="true" />{" "}
                          Aguardando pagamento. O lance será confirmado
                          automaticamente.
                        </>
                      )}
                    </p>
                    <button
                      className={`pix-copy-button ${pixCopied ? "is-copied" : ""}`}
                      type="button"
                      onClick={() => void handleCopyPix()}
                      aria-live="polite"
                    >
                      <span className="pix-copy-icon">
                        {pixCopied ? (
                          <CircleCheck size={18} />
                        ) : (
                          <Copy size={17} />
                        )}
                      </span>
                      {pixCopied ? "Código copiado!" : "Copiar código Pix"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isCelebrating && paymentSuccess && (
          <motion.div
            className="payment-celebration-toast"
            role="status"
            aria-live="polite"
            initial={{ y: -18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
          >
            <span className="celebration-icon">
              <PartyPopper size={18} />
            </span>
            <div>
              <strong>Pagamento confirmado!</strong>
              <span>
                {formatCurrency(paymentSuccess.amount)} — seu lance já está na
                rodada
              </span>
            </div>
            <Sparkles size={16} className="celebration-sparkle" />
          </motion.div>
        )}
      </AnimatePresence>
    </MajorLanceShell>
  );
}

function HowStep({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="how-step">
      <span className="step-number">{number}</span>
      <div className="step-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function TrustItem({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="trust-item">
      <div>{icon}</div>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
