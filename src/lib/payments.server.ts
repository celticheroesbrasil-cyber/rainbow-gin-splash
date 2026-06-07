import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createShopifyOrderFromSupabase } from "@/lib/shopify-orders.server";
import { generateFrenetLabelForOrder } from "@/lib/frenet-label.server";

type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  transaction_details?: {
    external_resource_url?: string;
  };
  barcode?: {
    content?: string;
  };
};

export function mapMercadoPagoStatusToOrderStatus(status?: string) {
  return status === "approved"
    ? "paid"
    : status === "rejected"
      ? "failed"
      : status === "cancelled"
        ? "cancelled"
        : status === "refunded"
          ? "refunded"
          : "pending";
}

export async function fetchMercadoPagoPayment(paymentId: string) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago não configurado");

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Mercado Pago HTTP ${res.status}`);
  }

  return await res.json() as MercadoPagoPayment;
}

export async function syncMercadoPagoPayment(paymentId: string) {
  const mp = await fetchMercadoPagoPayment(paymentId);

  await supabaseAdmin
    .from("payments")
    .update({
      status: mp.status,
      status_detail: mp.status_detail,
      raw_response: mp as never,
    })
    .eq("mp_payment_id", String(mp.id));

  if (mp.external_reference) {
    const orderStatus = mapMercadoPagoStatusToOrderStatus(mp.status);

    await supabaseAdmin
      .from("orders")
      .update({ status: orderStatus })
      .eq("id", mp.external_reference);

    if (orderStatus === "paid") {
      await createShopifyOrderFromSupabase(mp.external_reference, String(mp.id));
      try {
        await generateFrenetLabelForOrder(mp.external_reference);
      } catch (err) {
        console.error("Frenet label generation failed", err);
      }
    }
  }

  return mp;
}