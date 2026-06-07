import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import { mapMercadoPagoStatusToOrderStatus, syncMercadoPagoPayment } from "@/lib/payments.server";

const CustomerSchema = z.object({
  email: z.string().email(),
  cpf: z.string().regex(/^\d{11}$/),
  nome: z.string().min(2).max(120),
  telefone: z.string().min(10).max(20),
});

const AddressSchema = z.object({
  cep: z.string().regex(/^\d{8}$/),
  rua: z.string().min(2).max(200),
  numero: z.string().min(1).max(20),
  complemento: z.string().max(100).optional().nullable(),
  bairro: z.string().min(1).max(120),
  cidade: z.string().min(1).max(120),
  uf: z.string().length(2),
});

const ItemSchema = z.object({
  sku: z.string(),
  title: z.string(),
  qty: z.number().int().positive(),
  unit_price: z.number().positive(),
});

const CreateOrderInput = z.object({
  customer: CustomerSchema,
  address: AddressSchema,
  items: z.array(ItemSchema).min(1),
  shipping: z.object({
    service: z.string(),
    name: z.string(),
    price: z.number().nonnegative(),
  }),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => CreateOrderInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const subtotal = data.items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const total = subtotal + data.shipping.price;

    const { data: customer, error: cErr } = await supabaseAdmin
      .from("customers")
      .insert({
        email: data.customer.email,
        cpf: data.customer.cpf,
        nome: data.customer.nome,
        telefone: data.customer.telefone,
      })
      .select("id")
      .single();
    if (cErr || !customer) throw new Error(cErr?.message ?? "Falha ao criar cliente");

    const { data: address, error: aErr } = await supabaseAdmin
      .from("addresses")
      .insert({
        customer_id: customer.id,
        cep: data.address.cep,
        rua: data.address.rua,
        numero: data.address.numero,
        complemento: data.address.complemento ?? null,
        bairro: data.address.bairro,
        cidade: data.address.cidade,
        uf: data.address.uf,
      })
      .select("id")
      .single();
    if (aErr || !address) throw new Error(aErr?.message ?? "Falha ao criar endereço");

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: customer.id,
        address_id: address.id,
        status: "pending",
        subtotal,
        shipping_cost: data.shipping.price,
        shipping_service: `${data.shipping.service}:${data.shipping.name}`,
        total,
      })
      .select("id")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "Falha ao criar pedido");

    await supabaseAdmin.from("order_items").insert(
      data.items.map((i) => ({
        order_id: order.id,
        sku: i.sku,
        title: i.title,
        qty: i.qty,
        unit_price: i.unit_price,
      })),
    );

    return { orderId: order.id, total };
  });

const PayInput = z.object({
  orderId: z.string().uuid(),
  method: z.enum(["credit_card", "debit_card", "pix", "bolbradesco"]),
  cardToken: z.string().optional(),
  paymentMethodId: z.string().optional(), // ex: "visa", "master", "pix", "bolbradesco"
  issuerId: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional(),
});

export const payOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => PayInput.parse(input))
  .handler(async ({ data }) => {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("Mercado Pago não configurado");
    const requestUrl = getRequestUrl();
    const notificationBaseUrl = (process.env.SITE_URL && process.env.SITE_URL.trim())
      || new URL(requestUrl).origin
      || "https://beberainbow.com.br";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, total, customer_id, customers!inner(email, cpf, nome)")
      .eq("id", data.orderId)
      .single();
    if (oErr || !order) throw new Error("Pedido não encontrado");
    if (order.status !== "pending") throw new Error("Pedido já processado");

    const customer = (order.customers as unknown) as { email: string; cpf: string; nome: string };
    const [firstName, ...rest] = customer.nome.split(" ");
    const lastName = rest.join(" ") || firstName;

    const isCard = data.method === "credit_card" || data.method === "debit_card";
    if (isCard && !data.cardToken) throw new Error("Token do cartão ausente");

    const paymentMethodId =
      data.method === "pix" ? "pix" :
      data.method === "bolbradesco" ? "bolbradesco" :
      (data.paymentMethodId ?? "");

    const mpBody: Record<string, unknown> = {
      transaction_amount: Number(order.total),
      description: `Pedido BË RAINBOW ${order.id.slice(0, 8)}`,
      payment_method_id: paymentMethodId,
      payer: {
        email: customer.email,
        first_name: firstName,
        last_name: lastName,
        identification: { type: "CPF", number: customer.cpf },
      },
      external_reference: order.id,
      notification_url: `${notificationBaseUrl}/api/public/mp-webhook`,
    };

    if (isCard) {
      mpBody.token = data.cardToken;
      mpBody.installments = data.installments ?? 1;
      if (data.issuerId) mpBody.issuer_id = data.issuerId;
    }

    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.id,
      },
      body: JSON.stringify(mpBody),
    });

    const mpJson = await res.json() as {
      id?: number;
      status?: string;
      status_detail?: string;
      point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
      transaction_details?: { external_resource_url?: string };
      barcode?: { content?: string };
      message?: string;
      cause?: unknown;
    };

    if (!res.ok || !mpJson.id) {
      console.error("MP error", res.status, mpJson);
      await supabaseAdmin.from("payments").insert({
        order_id: order.id,
        method: data.method,
        status: "error",
        status_detail: mpJson.message ?? `HTTP ${res.status}`,
        amount: order.total,
        raw_response: mpJson as never,
      });
      throw new Error(mpJson.message ?? "Falha ao processar pagamento");
    }

    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      mp_payment_id: String(mpJson.id),
      method: data.method,
      status: mpJson.status ?? "pending",
      status_detail: mpJson.status_detail,
      amount: order.total,
      raw_response: mpJson as never,
    });

    const orderStatus = mapMercadoPagoStatusToOrderStatus(mpJson.status);
    await supabaseAdmin.from("orders").update({ status: orderStatus }).eq("id", order.id);

    return {
      paymentId: String(mpJson.id),
      status: mpJson.status ?? "pending",
      statusDetail: mpJson.status_detail,
      pix: mpJson.point_of_interaction?.transaction_data
        ? {
            qrCode: mpJson.point_of_interaction.transaction_data.qr_code,
            qrCodeBase64: mpJson.point_of_interaction.transaction_data.qr_code_base64,
            ticketUrl: mpJson.point_of_interaction.transaction_data.ticket_url,
          }
        : undefined,
      boleto: data.method === "bolbradesco"
        ? {
            barcode: mpJson.barcode?.content,
            pdfUrl: mpJson.transaction_details?.external_resource_url,
          }
        : undefined,
    };
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, total, shipping_service")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");

    let { data: payment } = await supabaseAdmin
      .from("payments")
      .select("status, status_detail, method, mp_payment_id, raw_response")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (order.status === "pending" && payment?.mp_payment_id) {
      try {
        const freshPayment = await syncMercadoPagoPayment(payment.mp_payment_id);
        order = {
          ...order,
          status: mapMercadoPagoStatusToOrderStatus(freshPayment.status),
        };
        payment = {
          ...payment,
          status: freshPayment.status,
          status_detail: freshPayment.status_detail ?? null,
          raw_response: freshPayment as never,
        };
      } catch (error) {
        console.error("Mercado Pago sync failed", error);
      }
    }

    return { order, payment };
  });
