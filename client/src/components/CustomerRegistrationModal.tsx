import { Check, ChevronDown, KeyRound, Phone, ShieldCheck, UserRound, X } from "lucide-react";
import { useState } from "react";

export type CustomerRegistrationValues = {
  fullName: string;
  whatsapp: string;
  pixKeyType: "cpf" | "email" | "phone" | "random";
  pixKey: string;
};

type CustomerRegistrationModalProps = {
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: CustomerRegistrationValues) => void;
};

const pixKeyOptions: Array<{ value: CustomerRegistrationValues["pixKeyType"]; label: string; placeholder: string }> = [
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { value: "email", label: "E-mail", placeholder: "seuemail@exemplo.com" },
  { value: "phone", label: "Celular", placeholder: "(00) 00000-0000" },
  { value: "random", label: "Chave aleatória", placeholder: "Cole sua chave aleatória" },
];

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function CustomerRegistrationModal({ isSubmitting, errorMessage, onClose, onSubmit }: CustomerRegistrationModalProps) {
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pixKeyType, setPixKeyType] = useState<CustomerRegistrationValues["pixKeyType"]>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [keyMenuOpen, setKeyMenuOpen] = useState(false);
  const selectedKey = pixKeyOptions.find(option => option.value === pixKeyType) ?? pixKeyOptions[0];

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ fullName, whatsapp, pixKeyType, pixKey });
  };

  return (
    <div className="registration-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title">
        <button className="registration-close" type="button" onClick={onClose} aria-label="Fechar cadastro"><X size={18} /></button>
        <div className="registration-badge"><UserRound size={16} /></div>
        <span className="registration-eyebrow">CONTA MAIOR LANCE</span>
        <h2 id="registration-title">Crie sua conta</h2>
        <p className="registration-intro">Cadastre seus dados uma única vez para participar das rodadas.</p>

        <form onSubmit={submit}>
          <label className="registration-label">
            Nome completo
            <span className="registration-input-wrap"><UserRound size={15} /><input value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Digite seu nome completo" minLength={3} maxLength={120} required autoComplete="name" /></span>
          </label>
          <label className="registration-label">
            WhatsApp
            <span className="registration-input-wrap"><Phone size={15} /><input value={whatsapp} onChange={event => setWhatsapp(formatPhone(event.target.value))} placeholder="(00) 00000-0000" minLength={8} maxLength={15} required inputMode="numeric" autoComplete="tel" /></span>
          </label>
          <div className="registration-label">
            Chave Pix para recebimento
            <p className="registration-help">Selecione o tipo de chave e informe abaixo a chave com que você deseja receber eventuais pagamentos da plataforma.</p>
            <div className={`registration-select-wrap ${keyMenuOpen ? "is-open" : ""}`}>
              <button className="registration-select-trigger" type="button" onClick={() => setKeyMenuOpen(open => !open)} aria-haspopup="listbox" aria-expanded={keyMenuOpen}><span>{selectedKey.label}</span><ChevronDown size={16} /></button>
              {keyMenuOpen && <div className="registration-select-menu" role="listbox" aria-label="Tipo de chave Pix">{pixKeyOptions.map(option => <button className="registration-select-option" type="button" role="option" aria-selected={pixKeyType === option.value} key={option.value} onClick={() => { setPixKeyType(option.value); setPixKey(""); setKeyMenuOpen(false); }}>{option.label}{pixKeyType === option.value && <Check size={15} />}</button>)}</div>}
            </div>
            <span className="registration-input-wrap"><KeyRound size={15} /><input value={pixKey} onChange={event => setPixKey(selectedKey.value === "cpf" ? formatCpf(event.target.value) : selectedKey.value === "phone" ? formatPhone(event.target.value) : event.target.value)} placeholder={selectedKey.placeholder} minLength={3} maxLength={160} required autoComplete="off" inputMode={selectedKey.value === "cpf" || selectedKey.value === "phone" ? "numeric" : "text"} /></span>
            <small className="registration-key-note">Confira sua chave antes de se cadastrar, ela será usada para recebimentos e deve estar correta.</small>
          </div>
          <p className="registration-security"><ShieldCheck size={15} /> Seus dados ficam protegidos e a sessão permanece ativa neste navegador.</p>
          {errorMessage && <p className="registration-error" role="alert">{errorMessage}</p>}
          <button className="registration-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "SALVANDO..." : "CADASTRAR CONTA"}</button>
        </form>
      </section>
    </div>
  );
}
