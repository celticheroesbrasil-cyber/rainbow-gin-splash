import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getOrderStatus } from "@/lib/checkout.functions";
import { Check, Clock, AlertCircle, Loader2, Package, Truck, MapPin, ChevronRight, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pedido/$orderId")({
  head: () => ({ meta: [{ title: "Pedido — BË RAINBOW" }, { name: "robots", content: "noindex" }] }),
  component: OrderPage,
});

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PaymentRawResponse = {
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
  transaction_details?: { external_resource_url?: string };
  barcode?: { content?: string };
};

function OrderPage() {
  const { orderId } = Route.useParams();
  const fetchStatus = useServerFn(getOrderStatus);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchStatus({ data: { orderId } }),
    refetchInterval: (q) => {
      const status = q.state.data?.order?.status;
      return status === "pending" ? 4000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertCircle className="size-8 mx-auto mb-2 text-destructive" />
          <p>Pedido não encontrado.</p>
          <Link to="/" className="text-primary underline text-sm">Voltar à loja</Link>
        </div>
      </div>
    );
  }

  const { order, payment, items, customer, address } = data;
  const isPaid = order.status === "paid";
  const isFailed = order.status === "failed" || order.status === "cancelled";
  const rawResponse = (payment?.raw_response ?? null) as PaymentRawResponse | null;
  const pix = rawResponse?.point_of_interaction?.transaction_data;
  const boletoUrl = rawResponse?.transaction_details?.external_resource_url;
  const boletoBarcode = rawResponse?.barcode?.content;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const formatCep = (cep: string) => `${cep.slice(0, 5)}-${cep.slice(5)}`;

  if (isPaid) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
            <Link to="/" className="font-display font-700 text-lg">BË RAINBOW</Link>
          </div>
        </header>

        <div className="max-w-xl mx-auto px-4 py-10 sm:py-16">
          {/* Success Header */}
          <div className="text-center mb-10">
            <div className="relative mx-auto size-24 mb-6">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-75" style={{ animationDuration: "2s" }} />
              <div className="relative mx-auto size-24 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <PartyPopper className="size-10 text-emerald-600" />
              </div>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-700 mb-2 text-emerald-700">
              Pagamento aprovado!
            </h1>
            <p className="text-muted-foreground text-base">
              Obrigado pela sua compra, <span className="font-medium text-foreground">{customer?.nome?.split(" ")[0] ?? "cliente"}</span>!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Pedido <span className="font-mono font-medium">{order.id.slice(0, 8).toUpperCase()}</span> · {formatDate(order.created_at)}
            </p>
          </div>

          {/* Status Timeline */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="size-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Check className="size-4" />
                </div>
                <div className="w-0.5 h-8 bg-emerald-200" />
                <div className="size-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Package className="size-4" />
                </div>
                <div className="w-0.5 h-8 bg-zinc-200" />
                <div className="size-8 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center">
                  <Truck className="size-4" />
                </div>
              </div>
              <div className="flex-1 space-y-5 pt-0.5">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Pagamento confirmado</p>
                  <p className="text-xs text-muted-foreground">Recebemos seu pagamento com sucesso.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700">Preparando pedido</p>
                  <p className="text-xs text-muted-foreground">Estamos separando seus produtos para envio.</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-400">Em trânsito</p>
                  <p className="text-xs text-muted-foreground">Você receberá atualizações por email.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
            <h2 className="font-display text-lg font-600 mb-4 flex items-center gap-2">
              <Package className="size-5 text-primary" />
              Resumo do pedido
            </h2>
            <div className="space-y-3">
              {items?.map((item) => (
                <div key={item.sku} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {item.qty}x
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{BRL(item.unit_price)} unid.</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{BRL(item.unit_price * item.qty)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{BRL(Number(order.subtotal))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete ({order.shipping_service?.split(":")[1] ?? order.shipping_service})</span>
                <span>{BRL(Number(order.shipping_cost))}</span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                <span>Total</span>
                <span>{BRL(Number(order.total))}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Forma de pagamento</span>
                <span className="capitalize">{payment?.method === "credit_card" ? "Cartão de crédito" : payment?.method === "pix" ? "PIX" : payment?.method === "bolbradesco" ? "Boleto" : payment?.method}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          {address && (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
              <h2 className="font-display text-lg font-600 mb-3 flex items-center gap-2">
                <MapPin className="size-5 text-primary" />
                Endereço de entrega
              </h2>
              <div className="text-sm space-y-0.5">
                <p className="font-medium">{customer?.nome}</p>
                <p className="text-muted-foreground">{address.rua}, {address.numero}{address.complemento ? ` — ${address.complemento}` : ""}</p>
                <p className="text-muted-foreground">{address.bairro}</p>
                <p className="text-muted-foreground">{address.cidade} — {address.uf}</p>
                <p className="text-muted-foreground">CEP {formatCep(address.cep)}</p>
                {customer?.telefone && <p className="text-muted-foreground">Tel: {customer.telefone}</p>}
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5 sm:p-6 mb-8">
            <h3 className="font-display font-600 text-base mb-2 text-primary">E agora?</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <Check className="size-4 text-primary mt-0.5 shrink-0" />
                Você receberá um email de confirmação em <span className="font-medium text-foreground">{customer?.email}</span> com todos os detalhes.
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 text-primary mt-0.5 shrink-0" />
                Assim que seu pedido for enviado, enviaremos o código de rastreamento.
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 text-primary mt-0.5 shrink-0" />
                Dúvidas? Entre em contato pelo WhatsApp ou email.
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="w-full sm:w-auto">
              <Button className="w-full rounded-full" size="lg">
                Continuar comprando <ChevronRight className="size-4 ml-1" />
              </Button>
            </Link>
            <Button variant="outline" className="w-full sm:w-auto rounded-full" size="lg" onClick={() => refetch()}>
              Atualizar status
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pending / failed layout (original, kept)
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <Link to="/" className="font-display font-700 text-lg">BË RAINBOW</Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className={`mx-auto size-16 rounded-full flex items-center justify-center mb-4 ${isPaid ? "bg-emerald-100 text-emerald-700" : isFailed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
          {isPaid ? <Check className="size-8" /> : isFailed ? <AlertCircle className="size-8" /> : <Clock className="size-8" />}
        </div>
        <h1 className="font-display text-3xl font-700 mb-2">
          {isPaid ? "Pagamento confirmado!" : isFailed ? "Pagamento não aprovado" : "Aguardando pagamento"}
        </h1>
        <p className="text-muted-foreground mb-6">
          Pedido <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span> — Total {BRL(Number(order.total))}
        </p>
        {payment?.status_detail && (
          <p className="text-sm text-muted-foreground mb-6">Status: {payment.status} ({payment.status_detail})</p>
        )}
        {!isPaid && !isFailed && payment?.method === "pix" && (pix?.qr_code || pix?.qr_code_base64) && (
          <div className="max-w-md mx-auto mb-6 rounded-2xl border border-border bg-card p-5 space-y-4">
            {pix.qr_code_base64 && <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code PIX" className="mx-auto size-56 rounded-xl border border-border" loading="eager" />}
            {pix.qr_code && <textarea readOnly className="w-full rounded-lg border border-border bg-muted p-3 text-xs font-mono" rows={4} value={pix.qr_code} />}
            {pix.qr_code && <Button variant="outline" onClick={() => void navigator.clipboard.writeText(pix.qr_code ?? "")}>Copiar código PIX</Button>}
          </div>
        )}
        {!isPaid && !isFailed && payment?.method === "bolbradesco" && (boletoUrl || boletoBarcode) && (
          <div className="max-w-md mx-auto mb-6 rounded-2xl border border-border bg-card p-5 space-y-4">
            {boletoUrl && <a className="text-primary underline" href={boletoUrl} target="_blank" rel="noreferrer">Abrir boleto</a>}
            {boletoBarcode && <div className="rounded-lg border border-border bg-muted p-3 text-xs font-mono break-all">{boletoBarcode}</div>}
          </div>
        )}
        {!isPaid && !isFailed && (
          <p className="text-sm text-muted-foreground mb-6 flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Atualizando automaticamente…
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={() => refetch()}>Atualizar</Button>
          <Link to="/"><Button>Voltar à loja</Button></Link>
        </div>
      </div>
    </div>
  );
}
