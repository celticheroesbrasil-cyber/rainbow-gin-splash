import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quoteShipping } from "@/lib/shipping.functions";
import { createOrder, payOrder } from "@/lib/checkout.functions";
import { getCart, clearCart, type CartItem } from "@/lib/cart";
import { Loader2, Lock, CreditCard, QrCode, FileText, Check } from "lucide-react";

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
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
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

  // Step 3
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

  function validStep1() {
    return /^[^@]+@[^@]+\.[^@]+$/.test(email) && nome.length >= 2 && onlyDigits(cpf).length === 11 && onlyDigits(telefone).length >= 10;
  }
  function validStep2() {
    return onlyDigits(cep).length === 8 && rua && numero && bairro && cidade && uf.length === 2 && chosen;
  }

  // Init MP cardForm when on step 3 with credit_card
  useEffect(() => {
    if (step !== 3 || method !== "credit_card") return;
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
  }, [step, method, total]);

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
        setPixResult({ qrCode: pay.pix.qrCode, qrCodeBase64: pay.pix.qrCodeBase64 });
      } else if (pay.boleto) {
        setBoletoResult({ barcode: pay.boleto.barcode, pdfUrl: pay.boleto.pdfUrl });
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-700 text-lg">BË RAINBOW</Link>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" /> Compra segura</div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          {/* Stepper */}
          <div className="flex items-center gap-2 mb-6 text-xs font-semibold">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`flex items-center gap-2 ${step >= n ? "text-foreground" : "text-muted-foreground"}`}>
                <div className={`size-6 rounded-full flex items-center justify-center ${step > n ? "bg-emerald-600 text-white" : step === n ? "bg-foreground text-background" : "bg-secondary"}`}>
                  {step > n ? <Check className="size-3.5" /> : n}
                </div>
                {n === 1 ? "Identificação" : n === 2 ? "Entrega" : "Pagamento"}
                {n < 3 && <div className="w-6 h-px bg-border" />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-700">Seus dados</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" /></div>
                <div><Label>Nome completo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(onlyDigits(e.target.value).slice(0, 11))} placeholder="000.000.000-00" /></div>
                <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" /></div>
              </div>
              <Button disabled={!validStep1()} onClick={() => setStep(2)}>Continuar</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-700">Endereço e frete</h2>
              <div className="grid sm:grid-cols-[160px_1fr] gap-3">
                <div><Label>CEP</Label><Input value={cep} onChange={(e) => lookupCep(e.target.value)} placeholder="00000-000" maxLength={8} /></div>
                <div><Label>Rua</Label><Input value={rua} onChange={(e) => setRua(e.target.value)} /></div>
                <div><Label>Número</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
                <div><Label>Complemento</Label><Input value={complemento} onChange={(e) => setComplemento(e.target.value)} /></div>
                <div><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
                <div className="grid grid-cols-[1fr_80px] gap-3">
                  <div><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
                  <div><Label>UF</Label><Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} /></div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Opções de frete</Label>
                {quoteLoading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Calculando frete…</div>}
                {!quoteLoading && quotes.length === 0 && cep.length === 8 && (
                  <div className="text-sm text-muted-foreground">Nenhuma opção encontrada para este CEP.</div>
                )}
                {quotes.map((q) => (
                  <label key={q.service} className={`flex items-center justify-between gap-2 border rounded-lg p-3 cursor-pointer ${chosen?.service === q.service ? "border-foreground bg-foreground/[0.04]" : "border-border"}`}>
                    <div className="flex items-center gap-3">
                      <input type="radio" checked={chosen?.service === q.service} onChange={() => setChosen(q)} />
                      <div>
                        <div className="text-sm font-medium">{q.name}</div>
                        <div className="text-xs text-muted-foreground">Entrega em até {q.days} dias úteis</div>
                      </div>
                    </div>
                    <div className="font-semibold">{BRL(q.price)}</div>
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button disabled={!validStep2()} onClick={() => setStep(3)}>Continuar</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-2xl font-700">Pagamento</h2>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "credit_card", label: "Cartão", icon: CreditCard },
                  { id: "pix", label: "PIX", icon: QrCode },
                  { id: "bolbradesco", label: "Boleto", icon: FileText },
                ] as const).map((m) => (
                  <button key={m.id} onClick={() => { setMethod(m.id); setPixResult(null); setBoletoResult(null); setError(null); }}
                    className={`border rounded-lg p-3 flex flex-col items-center gap-1 text-sm ${method === m.id ? "border-foreground bg-foreground/[0.04]" : "border-border"}`}>
                    <m.icon className="size-5" />
                    {m.label}
                  </button>
                ))}
              </div>

              {method === "credit_card" && !pixResult && (
                <form id="form-checkout" className="space-y-3">
                  <div id="form-checkout__cardNumber" className="h-10 border rounded-md px-3" />
                  <div className="grid grid-cols-2 gap-3">
                    <div id="form-checkout__expirationDate" className="h-10 border rounded-md px-3" />
                    <div id="form-checkout__securityCode" className="h-10 border rounded-md px-3" />
                  </div>
                  <input id="form-checkout__cardholderName" className="h-10 border rounded-md px-3 w-full text-sm" placeholder="Nome do titular" />
                  <input id="form-checkout__cardholderEmail" className="h-10 border rounded-md px-3 w-full text-sm" placeholder="Email" defaultValue={email} />
                  <div className="grid grid-cols-2 gap-3">
                    <select id="form-checkout__identificationType" className="h-10 border rounded-md px-2 text-sm bg-background" />
                    <input id="form-checkout__identificationNumber" className="h-10 border rounded-md px-3 text-sm" placeholder="CPF" defaultValue={cpf} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select id="form-checkout__issuer" className="h-10 border rounded-md px-2 text-sm bg-background" />
                    <select id="form-checkout__installments" className="h-10 border rounded-md px-2 text-sm bg-background" onChange={(e) => setInstallments(Number(e.target.value) || 1)} />
                  </div>
                </form>
              )}

              {method === "pix" && pixResult && (
                <div className="border rounded-lg p-4 space-y-3 text-center">
                  {pixResult.qrCodeBase64 && <img src={`data:image/png;base64,${pixResult.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto size-56" loading="eager" />}
                  <div className="text-sm">Escaneie o QR Code ou copie o código abaixo:</div>
                  <textarea readOnly className="w-full text-xs border rounded p-2 font-mono" rows={4} value={pixResult.qrCode ?? ""} />
                  <Button variant="outline" onClick={() => { if (pixResult.qrCode) navigator.clipboard.writeText(pixResult.qrCode); }}>Copiar código PIX</Button>
                  <div className="text-xs text-muted-foreground">Após o pagamento, atualizamos o pedido automaticamente.</div>
                </div>
              )}

              {method === "bolbradesco" && boletoResult && (
                <div className="border rounded-lg p-4 space-y-3 text-center">
                  <div className="text-sm">Boleto gerado:</div>
                  {boletoResult.pdfUrl && <a className="text-primary underline text-sm" href={boletoResult.pdfUrl} target="_blank" rel="noreferrer">Abrir PDF do boleto</a>}
                  {boletoResult.barcode && <div className="text-xs font-mono break-all border rounded p-2">{boletoResult.barcode}</div>}
                </div>
              )}

              {error && <div className="text-sm text-destructive border border-destructive/30 rounded p-3">{error}</div>}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={paying}>Voltar</Button>
                {!pixResult && !boletoResult && (
                  <Button onClick={handlePay} disabled={paying}>
                    {paying ? <><Loader2 className="size-4 animate-spin" /> Processando…</> : `Pagar ${BRL(total)}`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <aside className="border border-border rounded-xl p-5 h-fit lg:sticky lg:top-6 space-y-3">
          <div className="font-display text-lg font-700">Resumo</div>
          {cart.map((i) => (
            <div key={i.sku} className="flex justify-between text-sm">
              <span>{i.qty}× {i.title}</span>
              <span>{BRL(i.unit_price * i.qty)}</span>
            </div>
          ))}
          <div className="border-t border-border pt-3 text-sm flex justify-between">
            <span>Subtotal</span><span>{BRL(subtotal)}</span>
          </div>
          <div className="text-sm flex justify-between">
            <span>Frete {chosen ? `(${chosen.name})` : ""}</span>
            <span>{chosen ? BRL(chosen.price) : "—"}</span>
          </div>
          <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
            <span>Total</span><span>{BRL(total)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
