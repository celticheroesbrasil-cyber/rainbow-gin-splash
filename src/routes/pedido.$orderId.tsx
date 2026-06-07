import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getOrderStatus } from "@/lib/checkout.functions";
import { Check, Clock, AlertCircle, Loader2 } from "lucide-react";
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
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><AlertCircle className="size-8 mx-auto mb-2" /> <p>Pedido não encontrado.</p><Link to="/" className="text-primary underline text-sm">Voltar à loja</Link></div></div>;
  }

  const { order, payment } = data;
  const isPaid = order.status === "paid";
  const isFailed = order.status === "failed" || order.status === "cancelled";
  const rawResponse = (payment?.raw_response ?? null) as PaymentRawResponse | null;
  const pix = rawResponse?.point_of_interaction?.transaction_data;
  const boletoUrl = rawResponse?.transaction_details?.external_resource_url;
  const boletoBarcode = rawResponse?.barcode?.content;

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
