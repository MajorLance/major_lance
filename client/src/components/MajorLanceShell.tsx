import { Link, useLocation } from "wouter";
import { ArrowUpRight, Bell, Home, Trophy, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import "./header-refinements.css";

const navItems = [
  { href: "/", label: "Início", icon: Home },
  { href: "/vencedores", label: "Vencedores", icon: Trophy },
  { href: "/proximas-rodadas", label: "Próxima", icon: Bell },
  { href: "/conta", label: "Minha Conta", icon: UserRound },
];

const CUSTOMER_STORAGE_KEY = "major-lance-customer-profile";

function readCustomerId() {
  try {
    const stored = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    const profile = stored ? JSON.parse(stored) as { id?: number } : null;
    return typeof profile?.id === "number" ? profile.id : null;
  } catch {
    return null;
  }
}

export function MajorLanceLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img className={`brand-image ${compact ? "is-compact" : ""}`} src="/major-lance-logo.webp" alt="Major Lance" />
  );
}

export function MajorLanceFooter() {
  return <img className="footer-brand-image" src="/major-lance-logo.webp" alt="Major Lance" />;
}

export function MajorLanceHeader() {
  const [customerId] = useState<number | null>(readCustomerId);
  const wallet = trpc.wallet.balance.useQuery(
    { customerId: customerId ?? 0 },
    { enabled: customerId !== null, refetchInterval: 10000 },
  );
  const balance = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(wallet.data?.balance ?? 0);
  return (
    <header className="app-header">
      <Link href="/" className="header-logo-link"><MajorLanceLogo /></Link>
      <div className="header-actions">
        <div className="balance-cluster" aria-label={`Saldo disponível: ${balance}`}>
          <Link href="/saldo" className="balance-value"><span className="balance-copy"><small>Saldo</small><b>{balance}</b></span></Link>
          <Link href="/saque" className="withdraw-button"><span>Sacar</span><ArrowUpRight size={15} /></Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNavigation() {
  const [location] = useLocation();
  return (
    <nav className="bottom-navigation" aria-label="Navegação principal">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? location === "/" : location.startsWith(href);
        return (
          <Link href={href} className={`bottom-nav-item ${active ? "is-active" : ""}`} key={href}>
            <Icon size={25} strokeWidth={active ? 2.5 : 2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MajorLanceShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-canvas">
      <MajorLanceHeader />
      <main className="app-content">{children}</main>
      <BottomNavigation />
    </div>
  );
}
