import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { quoteShipping } from "@/lib/shipping.functions";
import { createOrder, payOrder } from "@/lib/checkout.functions";
import { getCart, clearCart, type CartItem } from "@/lib/cart";
import { Loader2, Lock, CreditCard, QrCode, FileText, ShieldCheck, Leaf } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — BË RAINBOW" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const onlyDigits = (s: string) => s.replace(/\D/g, "");

type Quote = { service: string; name: string; price: number; days: number };
type MpCardForm = {
  getCardFormData: () => Promise<{
    token: string;
    payment_method_id: string;
    issuer_id?: string;
    installments: number;
  }>;
  unmount: () => void;
};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opts?: { locale?: string }) => {
      cardForm: (opts: unknown) => MpCardForm;
    };
  }
}

function Checkout() {
  const navigate = useNavigate();
  const [cart, setCartState] = useState<CartItem[]>([]);
  // Identificação
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");

  // Step 2
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [chosen, setChosen] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Pagamento
  const [method, setMethod] = useState<"credit_card" | "pix" | "bolbradesco">("credit_card");
  const [installments, setInstallments] = useState(1);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pixResult, setPixResult] = useState<{ qrCode?: string; qrCodeBase64?: string } | null>(null);
  const [boletoResult, setBoletoResult] = useState<{ barcode?: string; pdfUrl?: string } | null>(null);

  const quoteFn = useServerFn(quoteShipping);
  const createOrderFn = useServerFn(createOrder);
  const payOrderFn = useServerFn(payOrder);

  useEffect(() => {
    const c = getCart();
    if (c.length === 0) {
      navigate({ to: "/" });
      return;
    }
    setCartState(c);
  }, [navigate]);

  // Load MP SDK
  useEffect(() => {
    if (typeof window === "undefined" || window.MercadoPago) return;
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.unit_price * i.qty, 0), [cart]);
  const total = subtotal + (chosen?.price ?? 0);

  // ViaCEP autofill + auto quote
  async function lookupCep(value: string) {
    const v = onlyDigits(value).slice(0, 8);
    setCep(v);
    if (v.length !== 8) return;
    // ViaCEP (não bloqueia a cotação se falhar)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${v}/json/`);
      const j = await r.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (!j.erro) {
        if (j.logradouro) setRua(j.logradouro);
        if (j.bairro) setBairro(j.bairro);
        if (j.localidade) setCidade(j.localidade);
        if (j.uf) setUf(j.uf);
      }
    } catch (e) {
      console.warn("ViaCEP falhou", e);
    }
    await calcShipping(v);
  }

  async function calcShipping(cepArg?: string) {
    const v = onlyDigits(cepArg ?? cep);
    if (v.length !== 8) { setQuoteError("Informe um CEP válido (8 dígitos)."); return; }
    if (cart.length === 0) { setQuoteError("Carrinho vazio."); return; }
    setQuoteError(null);
    setQuoteLoading(true);
    setQuotes([]);
    setChosen(null);
    try {
      const res = await quoteFn({ data: {
        cep: v,
        items: cart.map((i) => ({ sku: i.sku, qty: i.qty, weight: i.weight, price: i.unit_price })),
      }});
      setQuotes(res.quotes);
      if (res.quotes[0]) setChosen(res.quotes[0]);
      if (res.quotes.length === 0) setQuoteError("Nenhuma transportadora retornou opções para este CEP.");
    } catch (e) {
      console.error("Erro ao calcular frete", e);
      setQuoteError(e instanceof Error ? e.message : "Erro ao calcular frete.");
    } finally {
      setQuoteLoading(false);
    }
  }

  function canPay() {
    return (
      /^[^@]+@[^@]+\.[^@]+$/.test(email) &&
      nome.length >= 2 &&
      onlyDigits(cpf).length === 11 &&
      onlyDigits(telefone).length >= 10 &&
      onlyDigits(cep).length === 8 &&
      rua && numero && bairro && cidade && uf.length === 2 && !!chosen
    );
  }

  // Init MP cardForm quando método = cartão
  useEffect(() => {
    if (method !== "credit_card") return;
    let cardForm: MpCardForm | null = null;
    const interval = setInterval(() => {
      if (!window.MercadoPago) return;
      clearInterval(interval);
      const mp = new window.MercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY as string, { locale: "pt-BR" });
      cardForm = mp.cardForm({
        amount: String(total.toFixed(2)),
        iframe: true,
        form: {
          id: "form-checkout",
          cardNumber: { id: "form-checkout__cardNumber", placeholder: "Número do cartão" },
          expirationDate: { id: "form-checkout__expirationDate", placeholder: "MM/YY" },
          securityCode: { id: "form-checkout__securityCode", placeholder: "CVV" },
          cardholderName: { id: "form-checkout__cardholderName", placeholder: "Titular" },
          issuer: { id: "form-checkout__issuer", placeholder: "Banco emissor" },
          installments: { id: "form-checkout__installments", placeholder: "Parcelas" },
          identificationType: { id: "form-checkout__identificationType", placeholder: "Tipo de doc" },
          identificationNumber: { id: "form-checkout__identificationNumber", placeholder: "CPF" },
          cardholderEmail: { id: "form-checkout__cardholderEmail", placeholder: "Email" },
        },
        callbacks: {
          onFormMounted: (err: unknown) => err && console.error("MP form mount", err),
          onSubmit: (event: Event) => event.preventDefault(),
        },
      });
      // expose for handlePay
      (window as unknown as { __mpCardForm?: MpCardForm }).__mpCardForm = cardForm;
    }, 200);
    return () => {
      clearInterval(interval);
      try { cardForm?.unmount(); } catch { /* ignore */ }
      delete (window as unknown as { __mpCardForm?: MpCardForm }).__mpCardForm;
    };
  }, [method, total]);

  async function handlePay() {
    setError(null);
    setPaying(true);
    try {
      const orderRes = await createOrderFn({ data: {
        customer: { email, cpf: onlyDigits(cpf), nome, telefone: onlyDigits(telefone) },
        address: { cep: onlyDigits(cep), rua, numero, complemento: complemento || null, bairro, cidade, uf: uf.toUpperCase() },
        items: cart.map((i) => ({ sku: i.sku, title: i.title, qty: i.qty, unit_price: i.unit_price })),
        shipping: { service: chosen!.service, name: chosen!.name, price: chosen!.price },
      }});

      let payInput: {
        orderId: string;
        method: "credit_card" | "pix" | "bolbradesco";
        cardToken?: string;
        paymentMethodId?: string;
        issuerId?: string;
        installments?: number;
      };
      if (method === "credit_card") {
        const form = (window as unknown as { __mpCardForm?: MpCardForm }).__mpCardForm;
        if (!form) throw new Error("Formulário de cartão não carregou");
        const card = await form.getCardFormData();
        if (!card.token) throw new Error("Não foi possível validar o cartão");
        payInput = {
          orderId: orderRes.orderId,
          method: "credit_card",
          cardToken: card.token,
          paymentMethodId: card.payment_method_id,
          issuerId: card.issuer_id,
          installments: Number(card.installments) || installments,
        };
      } else {
        payInput = { orderId: orderRes.orderId, method };
      }

      const pay = await payOrderFn({ data: payInput });

      if (pay.status === "approved") {
        clearCart();
        navigate({ to: "/pedido/$orderId", params: { orderId: orderRes.orderId } });
        return;
      }
      if (pay.pix) {
        clearCart();
        navigate({ to: "/pedido/$orderId", params: { orderId: orderRes.orderId } });
      } else if (pay.boleto) {
        clearCart();
        navigate({ to: "/pedido/$orderId", params: { orderId: orderRes.orderId } });
      } else if (pay.status === "rejected") {
        setError(pay.statusDetail ?? "Pagamento recusado");
      } else {
        // pending non-pix: still send to status page
        clearCart();
        navigate({ to: "/pedido/$orderId", params: { orderId: orderRes.orderId } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar pagamento");
    } finally {
      setPaying(false);
    }
  }

  if (cart.length === 0) return null;

  const inputCls = "w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all placeholder:text-zinc-400";
  const labelCls = "block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rainbow flex items-center justify-center p-[2px]">
              <div className="bg-white w-full h-full rounded-full flex items-center justify-center">
                <span className="font-display font-700 text-xs tracking-tighter">BË</span>
              </div>
            </div>
            <span className="font-display font-700 text-base hidden sm:inline">BË RAINBOW</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Lock className="size-3.5" /> Compra 100% segura</div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* MAIN */}
        <div className="lg:col-span-7 space-y-10">
          <div>
            <h1 className="font-display text-4xl font-700 tracking-tight">Checkout</h1>
            <p className="text-zinc-500 text-sm mt-1">Finalize seu pedido com tranquilidade.</p>
          </div>

          {/* Step 1 — Contato */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-semibold">1</span>
              <h2 className="font-display text-xl font-600">Dados de contato</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
              <div>
                <label className={labelCls}>Nome completo</label>
                <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>
              <div>
                <label className={labelCls}>CPF</label>
                <input className={inputCls} value={cpf} onChange={(e) => setCpf(onlyDigits(e.target.value).slice(0, 11))} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className={labelCls}>Celular</label>
                <input className={inputCls} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
          </section>

          {/* Step 2 — Entrega */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-semibold">2</span>
              <h2 className="font-display text-xl font-600">Endereço de entrega</h2>
            </div>
            <div className="grid sm:grid-cols-[180px_1fr_140px] gap-4">
              <div>
                <label className={labelCls}>CEP</label>
                <input className={inputCls} value={cep} onChange={(e) => lookupCep(e.target.value)} placeholder="00000-000" maxLength={8} />
              </div>
              <div>
                <label className={labelCls}>Rua</label>
                <input className={inputCls} value={rua} onChange={(e) => setRua(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Número</label>
                <input className={inputCls} value={numero} onChange={(e) => setNumero(e.target.value)} />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Bairro</label>
                <input className={inputCls} value={bairro} onChange={(e) => setBairro(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Cidade</label>
                <input className={inputCls} value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>UF</label>
                <input className={inputCls} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Complemento (opcional)</label>
              <input className={inputCls} value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </div>

            {/* Frete */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className={labelCls + " mb-0"}>Frete</span>
                <Button type="button" variant="outline" size="sm" onClick={() => calcShipping()} disabled={quoteLoading || cep.length !== 8} className="rounded-full">
                  {quoteLoading ? <><Loader2 className="size-4 animate-spin mr-2" /> Calculando…</> : "Calcular frete"}
                </Button>
              </div>
              {quoteError && <div className="text-sm text-destructive">{quoteError}</div>}
              <div className="space-y-2">
                {quotes.map((q) => (
                  <label key={q.service} className={`flex items-center justify-between gap-3 rounded-xl p-4 cursor-pointer transition-all bg-white ${chosen?.service === q.service ? "border-2 border-zinc-900 shadow-sm" : "border border-zinc-200 hover:border-zinc-400"}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" className="accent-zinc-900" checked={chosen?.service === q.service} onChange={() => setChosen(q)} />
                      <div>
                        <div className="text-sm font-semibold">{q.name}</div>
                        <div className="text-xs text-zinc-500">Entrega em até {q.days} dias úteis</div>
                      </div>
                    </div>
                    <div className="font-semibold text-sm">{BRL(q.price)}</div>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Step 3 — Pagamento */}
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-semibold">3</span>
              <h2 className="font-display text-xl font-600">Pagamento</h2>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {([
                { id: "pix", label: "PIX", sub: "Liberação imediata", icon: QrCode, accent: true },
                { id: "credit_card", label: "Cartão", sub: "Até 12x s/ juros", icon: CreditCard, accent: false },
                { id: "bolbradesco", label: "Boleto", sub: "Vence em 3 dias", icon: FileText, accent: false },
              ] as const).map((m) => {
                const active = method === m.id;
                return (
                  <button key={m.id} type="button"
                    onClick={() => { setMethod(m.id); setPixResult(null); setBoletoResult(null); setError(null); }}
                    className={`relative p-4 sm:p-5 rounded-2xl bg-white flex flex-col items-center text-center gap-2 transition-all ${active ? "border-2 border-zinc-900 shadow-sm" : "border border-zinc-200 hover:border-zinc-400"}`}>
                    {m.accent && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-rainbow text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm whitespace-nowrap">Recomendado</span>
                    )}
                    <m.icon className={`size-6 ${active ? "text-zinc-900" : "text-zinc-400"}`} />
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span className="text-[10px] text-zinc-500 leading-tight">{m.sub}</span>
                  </button>
                );
              })}
            </div>

            {method === "credit_card" && !pixResult && (
              <form id="form-checkout" className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
                <div>
                  <label className={labelCls}>Número do cartão</label>
                  <div id="form-checkout__cardNumber" className="h-11 border border-zinc-200 rounded-xl px-4 bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Validade</label>
                    <div id="form-checkout__expirationDate" className="h-11 border border-zinc-200 rounded-xl px-4 bg-white" />
                  </div>
                  <div>
                    <label className={labelCls}>CVV</label>
                    <div id="form-checkout__securityCode" className="h-11 border border-zinc-200 rounded-xl px-4 bg-white" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Nome do titular</label>
                  <input id="form-checkout__cardholderName" className={inputCls + " h-11"} placeholder="Como impresso no cartão" />
                </div>
                <input id="form-checkout__cardholderEmail" type="hidden" defaultValue={email} />
                <select id="form-checkout__identificationType" className="hidden" />
                <input id="form-checkout__identificationNumber" type="hidden" defaultValue={cpf} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Banco emissor</label>
                    <select id="form-checkout__issuer" className="h-11 w-full border border-zinc-200 rounded-xl px-3 text-sm bg-white" />
                  </div>
                  <div>
                    <label className={labelCls}>Parcelas</label>
                    <select id="form-checkout__installments" className="h-11 w-full border border-zinc-200 rounded-xl px-3 text-sm bg-white" onChange={(e) => setInstallments(Number(e.target.value) || 1)} />
                  </div>
                </div>
              </form>
            )}

            {method === "pix" && pixResult && (
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 text-center">
                {pixResult.qrCodeBase64 && <img src={`data:image/png;base64,${pixResult.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto size-56 rounded-xl border border-zinc-100" loading="eager" />}
                <div className="text-sm text-zinc-600">Escaneie o QR Code ou copie o código abaixo:</div>
                <textarea readOnly className="w-full text-xs border border-zinc-200 rounded-lg p-3 font-mono bg-zinc-50" rows={4} value={pixResult.qrCode ?? ""} />
                <Button variant="outline" className="rounded-full" onClick={() => { if (pixResult.qrCode) navigator.clipboard.writeText(pixResult.qrCode); }}>Copiar código PIX</Button>
                <div className="text-xs text-zinc-500">Após o pagamento, atualizamos o pedido automaticamente.</div>
              </div>
            )}

            {method === "bolbradesco" && boletoResult && (
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3 text-center">
                <div className="text-sm text-zinc-600">Boleto gerado:</div>
                {boletoResult.pdfUrl && <a className="text-primary underline text-sm font-medium" href={boletoResult.pdfUrl} target="_blank" rel="noreferrer">Abrir PDF do boleto</a>}
                {boletoResult.barcode && <div className="text-xs font-mono break-all border border-zinc-200 rounded-lg p-3 bg-zinc-50">{boletoResult.barcode}</div>}
              </div>
            )}

            {error && <div className="text-sm text-destructive border border-destructive/30 rounded-xl p-3 bg-destructive/5">{error}</div>}
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="lg:col-span-5 w-full">
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto bg-white border border-zinc-100 shadow-2xl shadow-zinc-200/40 rounded-[2rem] p-6 sm:p-8 space-y-7">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-700">Seu pedido</h2>
              <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2">Editar</Link>
            </div>

            <div className="space-y-4">
              {cart.map((i) => (
                <div key={i.sku} className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rainbow-1/30 via-rainbow-3/30 to-rainbow-5/30 flex items-center justify-center">
                      <Leaf className="size-6 text-zinc-700/60" />
                    </div>
                    <span className="absolute -top-2 -right-2 bg-zinc-900 text-white text-[10px] font-bold size-6 flex items-center justify-center rounded-full">{i.qty}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-tight">{i.title}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{BRL(i.unit_price)} / un</p>
                  </div>
                  <p className="text-sm font-semibold">{BRL(i.unit_price * i.qty)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-6 border-t border-zinc-100">
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Subtotal</span>
                <span className="text-zinc-900 font-medium">{BRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Frete {chosen ? `· ${chosen.name}` : ""}</span>
                <span className="text-zinc-900 font-medium">{chosen ? BRL(chosen.price) : "—"}</span>
              </div>
              <div className="flex justify-between items-baseline pt-4 mt-2 border-t border-zinc-100">
                <span className="font-display text-xl font-600">Total</span>
                <span className="font-display text-3xl font-700 tracking-tight">{BRL(total)}</span>
              </div>
            </div>

            {!pixResult && !boletoResult && (
              <button
                onClick={handlePay}
                disabled={paying || !canPay()}
                className="group relative w-full overflow-hidden rounded-full py-4 sm:py-5 bg-zinc-900 text-white font-semibold tracking-wide transition-all hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-rainbow" />
                <span className="relative flex items-center justify-center gap-2">
                  {paying ? <><Loader2 className="size-4 animate-spin" /> Processando…</> : <>Finalizar compra · {BRL(total)}</>}
                </span>
              </button>
            )}

            {!canPay() && !paying && !pixResult && !boletoResult && (
              <div className="text-[11px] text-zinc-500 text-center -mt-3">Preencha seus dados, endereço e escolha o frete para liberar o pagamento.</div>
            )}

            <div className="flex justify-center gap-5 pt-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <ShieldCheck className="size-3.5" />
                <span className="text-[10px] uppercase tracking-widest font-bold">SSL</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Leaf className="size-3.5" />
                <span className="text-[10px] uppercase tracking-widest font-bold">Orgânico</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Lock className="size-3.5" />
                <span className="text-[10px] uppercase tracking-widest font-bold">Mercado Pago</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
