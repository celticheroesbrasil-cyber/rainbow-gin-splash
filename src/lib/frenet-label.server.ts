import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SHIPPER = {
  Name: "123SHOP ECOMMERCE LTDA",
  CNPJ: "01376406000136",
  Email: "123shopecom@gmail.com",
  Phone: "5511971589089",
  Address: {
    Street: "Avenida Martins Júnior",
    Number: "2162",
    Complement: "Galpão 2 - Box 004",
    District: "Jardim Bela Vista",
    City: "Guarulhos",
    State: "SP",
    PostalCode: "07141000",
    Country: "BR",
  },
};

function digits(s?: string | null) {
  return (s ?? "").replace(/\D/g, "");
}

export async function generateFrenetLabelForOrder(orderId: string) {
  const token = process.env.FRENET_TOKEN;
  if (!token) {
    console.error("FRENET_TOKEN missing");
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("shipping_labels")
    .select("id, status")
    .eq("order_id", orderId)
    .eq("status", "created")
    .maybeSingle();
  if (existing) {
    console.log("Frenet label already exists for order", orderId);
    return existing;
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, subtotal, shipping_cost, shipping_service, total, customer_id, address_id")
    .eq("id", orderId)
    .single();
  if (error || !order) {
    console.error("Order not found for label", orderId, error);
    return;
  }

  const [{ data: customer }, { data: address }, { data: items }] = await Promise.all([
    supabaseAdmin.from("customers").select("nome, email, telefone, cpf").eq("id", order.customer_id).single(),
    supabaseAdmin.from("addresses").select("cep, rua, numero, complemento, bairro, cidade, uf").eq("id", order.address_id).single(),
    supabaseAdmin.from("order_items").select("sku, title, qty, unit_price").eq("order_id", orderId),
  ]);

  if (!customer || !address || !items?.length) {
    console.error("Missing data for Frenet label", { customer, address, items });
    return;
  }

  const serviceCode = (order.shipping_service ?? "").split(":")[0] ?? "";
  if (!serviceCode) {
    console.error("Order has no shipping_service code", orderId);
    await supabaseAdmin.from("shipping_labels").insert({
      order_id: orderId,
      status: "error",
      error: "Sem código de serviço de frete",
    });
    return;
  }

  const totalWeight = Math.max(0.3, items.reduce((s, i) => s + 0.5 * i.qty, 0));

  const payload = {
    ShippingServiceCode: serviceCode,
    OrderNumber: orderId.slice(0, 18),
    ShipmentInvoice: {
      InvoiceNumber: orderId.slice(0, 8),
      InvoiceSeries: "1",
      InvoiceValue: Number(order.subtotal),
    },
    Shipper: {
      Name: SHIPPER.Name,
      CNPJ: SHIPPER.CNPJ,
      Email: SHIPPER.Email,
      Phone: SHIPPER.Phone,
      Address: SHIPPER.Address,
    },
    Recipient: {
      Name: customer.nome,
      CPF: digits(customer.cpf),
      Email: customer.email,
      Phone: digits(customer.telefone),
      Address: {
        Street: address.rua,
        Number: address.numero,
        Complement: address.complemento ?? "",
        District: address.bairro,
        City: address.cidade,
        State: address.uf,
        PostalCode: digits(address.cep),
        Country: "BR",
      },
    },
    PackageList: [
      {
        Height: 28,
        Length: 10,
        Width: 10,
        Weight: totalWeight,
      },
    ],
    ShippingItemArray: items.map((it) => ({
      Weight: 0.5,
      Height: 28,
      Length: 10,
      Width: 10,
      Quantity: it.qty,
      SKU: it.sku,
      Description: it.title,
    })),
  };

  let responseJson: unknown = null;
  try {
    const res = await fetch("https://api.frenet.com.br/shipping/efetuaenvio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        token,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    try { responseJson = JSON.parse(text); } catch { responseJson = { raw: text }; }

    if (!res.ok) {
      console.error("Frenet label HTTP error", res.status, text);
      await supabaseAdmin.from("shipping_labels").insert({
        order_id: orderId,
        status: "error",
        service_code: serviceCode,
        error: `HTTP ${res.status}: ${text.slice(0, 500)}`,
        raw_request: payload as never,
        raw_response: responseJson as never,
      });
      return;
    }

    const r = responseJson as {
      ShippingOrderNumber?: string;
      TrackingNumber?: string;
      ShippingLabelUrl?: string;
      LabelUrl?: string;
      Error?: boolean;
      Msg?: string;
      Message?: string;
    };

    if (r.Error) {
      await supabaseAdmin.from("shipping_labels").insert({
        order_id: orderId,
        status: "error",
        service_code: serviceCode,
        error: r.Msg ?? r.Message ?? "Erro Frenet",
        raw_request: payload as never,
        raw_response: responseJson as never,
      });
      return;
    }

    await supabaseAdmin.from("shipping_labels").insert({
      order_id: orderId,
      status: "created",
      service_code: serviceCode,
      tracking_number: r.TrackingNumber ?? null,
      shipping_order_number: r.ShippingOrderNumber ?? null,
      label_url: r.ShippingLabelUrl ?? r.LabelUrl ?? null,
      raw_request: payload as never,
      raw_response: responseJson as never,
    });

    console.log("Frenet label created", orderId, r.ShippingOrderNumber, r.TrackingNumber);
  } catch (err) {
    console.error("Frenet label exception", err);
    await supabaseAdmin.from("shipping_labels").insert({
      order_id: orderId,
      status: "error",
      service_code: serviceCode,
      error: err instanceof Error ? err.message : String(err),
      raw_request: payload as never,
      raw_response: responseJson as never,
    });
  }
}