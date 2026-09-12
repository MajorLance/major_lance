import { formatCurrency } from "@/lib/mockData";
import { trpc } from "@/lib/trpc";
import { CircleCheck, Clock3, Crown, Gavel, LockKeyhole, LogIn, LogOut, RefreshCw, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { useState } from "react";
import "./admin.css";

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatRemaining(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const rest = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatPixKeyType(value: string) {
  return ({ cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Celular", random: "Chave aleatória" } as Record<string, string>)[value] ?? value;
}

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const me = trpc.admin.me.useQuery(undefined, { refetchOnWindowFocus: false });
  const isAdmin = Boolean(me.data);

  const dashboard = trpc.admin.dashboard.useQuery(undefined, { enabled: isAdmin, refetchInterval: 5000 });
  const customers = trpc.admin.customers.useQuery(undefined, { enabled: isAdmin, refetchInterval: 10000 });
  const utils = trpc.useUtils();

  const login = trpc.admin.login.useMutation({
    onSuccess: async () => {
      setFeedback(null);
      await me.refetch();
      await Promise.all([dashboard.refetch(), customers.refetch()]);
    },
    onError: error => setFeedback({ type: "error", text: error.message }),
  });

  const logout = trpc.admin.logout.useMutation({
    onSuccess: async () => {
      await me.refetch();
      await utils.admin.dashboard.invalidate();
    },
  });

  const createManualBid = trpc.admin.createManualBid.useMutation({
    onSuccess: async () => {
      setName("");
      setAmount("");
      setFeedback({ type: "success", text: "Lance inserido e publicado na rodada atual." });
      await Promise.all([utils.admin.dashboard.invalidate(), utils.auction.state.invalidate()]);
    },
    onError: error => setFeedback({ type: "error", text: error.message }),
  });

  if (me.isLoading) {
    return <AdminFrame><div className="admin-state"><RefreshCw className="admin-spin" size={22} /> Verificando acesso administrativo...</div></AdminFrame>;
  }

  if (!isAdmin) {
    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setFeedback(null);
      login.mutate({ email, password });
    };
    return (
      <AdminFrame>
        <div className="admin-state admin-state-locked">
          <LockKeyhole size={28} />
          <h1>Acesso administrativo</h1>
          <p>Entre com o e-mail e senha definidos em <code>.env</code> (<code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code>).</p>
          <form onSubmit={handleLogin} className="admin-form-card" style={{ width: "100%", maxWidth: 380, marginTop: 16 }}>
            <label>E-mail<input value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@exemplo.com" type="email" required /></label>
            <label>Senha<input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" required /></label>
            <button type="submit" className="admin-primary-button" disabled={login.isPending}><LogIn size={17} /> {login.isPending ? "Entrando..." : "Entrar"}</button>
            {feedback && <p className={`admin-feedback ${feedback.type === "error" ? "is-error" : "is-success"}`}>{feedback.text}</p>}
            {login.error && !feedback && <p className="admin-feedback is-error">{login.error.message}</p>}
          </form>
        </div>
      </AdminFrame>
    );
  }

  const state = dashboard.data;
  const currentRound = state?.currentRound;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    if (!currentRound) return;
    createManualBid.mutate({ roundId: currentRound.id, name, amount: Number(amount.replace(",", ".")) });
  };

  return (
    <AdminFrame>
      <div className="admin-page">
        <header className="admin-heading">
          <div><span className="admin-eyebrow"><ShieldCheck size={15} /> ÁREA PROTEGIDA</span><h1>Painel administrador</h1><p>Insira lances manuais e acompanhe os pagamentos aprovados.</p></div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{me.data?.email}</span>
            <button type="button" className="admin-primary-button" onClick={() => logout.mutate()} style={{ background: "#333" }}><LogOut size={15} /> Sair</button>
            <div className="admin-heading-mark"><Crown size={25} /><span>MAIOR<br /><b>LANCE</b></span></div>
          </div>
        </header>

        {dashboard.isLoading && <div className="admin-state"><RefreshCw className="admin-spin" size={20} /> Carregando rodada atual...</div>}
        {dashboard.error && <div className="admin-alert is-error">Não foi possível carregar a rodada: {dashboard.error.message}</div>}

        {currentRound && (
          <>
            <section className="admin-round-card">
              <div><span>RODADA ATUAL</span><strong>{formatCurrency(currentRound.prize)}</strong><small>Encerra em {formatDateTime(currentRound.endsAt)}</small></div>
              <div className="admin-round-stat"><Clock3 size={17} /><b>{formatRemaining(currentRound.remainingSeconds)}</b><small>tempo restante</small></div>
              <div className="admin-round-stat"><Gavel size={17} /><b>{formatCurrency(currentRound.currentBid)}</b><small>maior lance</small></div>
            </section>

            <section className="admin-grid">
              <form className="admin-form-card" onSubmit={submit}>
                <div className="admin-card-title"><UserRound size={19} /><div><h2>Inserir lance manual</h2><p>O lance aparece publicamente com o nome informado.</p></div></div>
                <label>Nome do participante<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Fernanda L." minLength={2} maxLength={120} required /></label>
                <label>Valor do lance<input value={amount} onChange={event => setAmount(event.target.value)} placeholder="Ex.: 250" inputMode="decimal" type="text" required /></label>
                <button type="submit" className="admin-primary-button" disabled={createManualBid.isPending}><Gavel size={17} /> {createManualBid.isPending ? "Publicando..." : "Publicar lance"}</button>
                {feedback && <p className={`admin-feedback ${feedback.type === "error" ? "is-error" : "is-success"}`}>{feedback.type === "success" ? <CircleCheck size={16} /> : <ShieldCheck size={16} />} {feedback.text}</p>}
              </form>

              <section className="admin-list-card">
                <div className="admin-card-title"><Trophy size={19} /><div><h2>Últimos lances</h2><p>Pagos confirmados e inserções manuais.</p></div></div>
                <div className="admin-bid-list">
                  {state.recentBids.slice(0, 8).map(bid => <div className="admin-bid-row" key={bid.id}><span><b>{bid.name}</b><small>{bid.source === "pix" ? "Pix aprovado" : "Inserido pelo admin"} · {formatDateTime(bid.createdAt)}</small></span><strong>{formatCurrency(bid.amount)}</strong></div>)}
                  {!state.recentBids.length && <p className="admin-empty">Nenhum lance registrado nesta rodada.</p>}
                </div>
              </section>
            </section>

            {state.upcomingRound && <section className="admin-next-card"><div><span>PRÓXIMA RODADA</span><strong>{formatCurrency(state.upcomingRound.prize)}</strong></div><p>Começa automaticamente em {formatDateTime(state.upcomingRound.startsAt)}.</p></section>}

            <section className="admin-customers-card">
              <div className="admin-card-title"><UserRound size={19} /><div><h2>Cadastros de clientes</h2><p>Dados informados no formulário de participação.</p></div><strong className="admin-customer-count">{customers.data?.length ?? 0}</strong></div>
              {customers.isLoading && <p className="admin-empty">Carregando cadastros...</p>}
              {customers.error && <p className="admin-feedback is-error">Não foi possível carregar os cadastros: {customers.error.message}</p>}
              {!customers.isLoading && !customers.error && !customers.data?.length && <p className="admin-empty">Nenhum cliente cadastrado ainda.</p>}
              {!!customers.data?.length && <div className="admin-customer-list">{customers.data.map(customer => <article className="admin-customer-row" key={customer.id}><div><b>{customer.fullName}</b><small>WhatsApp: {customer.whatsapp} · Cadastro em {formatDateTime(customer.createdAt)}</small></div><div className="admin-customer-pix"><span>{formatPixKeyType(customer.pixKeyType)}</span><strong>{customer.pixKey}</strong></div></article>)}</div>}
            </section>
          </>
        )}
      </div>
    </AdminFrame>
  );
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  return <main className="admin-canvas"><a className="admin-back-link" href="/">← Voltar ao Major Lance</a>{children}</main>;
}
