# Integração Mercado Pago + Frenet — Checkout 100% Próprio

Plano para sair de "site vitrine" para e-commerce funcional, com banco de dados, cálculo de frete via Frenet e pagamento via Mercado Pago (cartão, PIX e boleto), tudo dentro do próprio site (sem redirect).

## 1. Segurança das credenciais (antes de qualquer código)

Você colou Access Token do MP e tokens do Frenet no chat. **Não vou salvar nada disso em código.** Vou pedir que você insira os secrets de forma segura via formulário do Lovable. Os nomes que vou usar:

- `MP_ACCESS_TOKEN` (o `TEST-8082230887056609-...`)
- `MP_WEBHOOK_SECRET` (gero depois no painel do MP para validar webhook)
- `FRENET_TOKEN` (o `0B4301F5...`)
- `FRENET_SELLER_CEP` (CEP de origem do envio — preciso que você me passe)

A Public Key do MP (`TEST-98759cc1-...`) é pública e fica no código como `VITE_MP_PUBLIC_KEY` no `.env`.

**Importante:** depois que terminarmos os testes em modo TEST, você gera as credenciais de PRODUÇÃO no MP e atualizamos os secrets — o código não muda.

## 2. Ativar Lovable Cloud

Necessário para ter banco, server functions e secrets. Vou ativar e criar as tabelas.

## 3. Banco de dados (schema)

```text
customers       (id, email, cpf, nome, telefone, created_at)
addresses       (id, customer_id, cep, rua, numero, complemento, bairro, cidade, uf)
orders          (id, customer_id, address_id, status, subtotal, shipping_cost,
                 shipping_service, total, created_at, updated_at)
order_items     (id, order_id, sku, title, qty, unit_price)
payments        (id, order_id, mp_payment_id, method, status, status_detail,
                 amount, raw_response_jsonb, created_at, updated_at)
shipping_quotes (id, cep, service_code, service_name, price, days, fetched_at)
```

RLS ativada em todas; acesso de escrita apenas via server functions (service role). Sem leitura pública.

## 4. Backend — Server Functions e rota pública

Tudo em TanStack Start (sem Edge Functions Supabase).

**`src/lib/shipping.functions.ts`** — `quoteShipping({ cep, items })`
- Chama Frenet `POST /shipping/quote` com `FRENET_TOKEN` e `FRENET_SELLER_CEP`
- Retorna lista de serviços (PAC, SEDEX, transportadoras) com preço e prazo
- Cacheia em `shipping_quotes` por 24h

**`src/lib/checkout.functions.ts`** — `createOrder({ customer, address, items, shippingChoice })`
- Cria `customer`, `address`, `order`, `order_items`
- Retorna `order_id` + total

**`src/lib/checkout.functions.ts`** — `payOrder({ order_id, method, cardToken?, payerEmail, cpf, installments? })`
- Chama MP `POST /v1/payments` com `MP_ACCESS_TOKEN`:
  - **Cartão:** usa `cardToken` gerado no browser pelo SDK do MP (PCI-safe, dado do cartão nunca toca nosso servidor)
  - **PIX:** retorna `qr_code`, `qr_code_base64`, `ticket_url`
  - **Boleto:** retorna `barcode` e `external_resource_url` (PDF)
- Grava em `payments`, atualiza `orders.status`

**`src/lib/checkout.functions.ts`** — `getPaymentStatus({ order_id })`
- Para polling de PIX/boleto no front

**`src/routes/api/public/mp-webhook.ts`** — endpoint público
- URL: `https://rainbow-sip-kit.lovable.app/api/public/mp-webhook`
- Recebe notificação do MP quando status muda
- Valida assinatura (`x-signature` + `MP_WEBHOOK_SECRET`)
- Busca pagamento em `GET /v1/payments/{id}` e atualiza `payments` + `orders.status`
- Essa URL você vai colar no painel do MP → Suas integrações → Webhooks

## 5. Frontend — fluxo do checkout

Novas rotas:

- `/checkout` — formulário em etapas:
  1. **Identificação:** email, nome, CPF, telefone
  2. **Endereço + Frete:** CEP (autocompleta via ViaCEP) → chama `quoteShipping` → mostra opções (PAC/SEDEX) → usuário escolhe
  3. **Pagamento:** tabs Cartão / PIX / Boleto
     - Cartão: campos número, validade, CVV, parcelas — tokeniza com `@mercadopago/sdk-js` no browser → envia só o token pro backend
     - PIX: clica "Gerar PIX" → mostra QR code + copia-cola, polling de status a cada 3s
     - Boleto: clica "Gerar boleto" → mostra linha digitável + link PDF
  4. **Sucesso/falha:** página de confirmação

- `/pedido/$orderId` — status do pedido (útil para PIX/boleto pendente)

Atualiza o botão "Comprar agora" da home para empurrar o item no `cart` (localStorage simples por enquanto) e ir pra `/checkout`.

## 6. Configuração no painel do Mercado Pago (você faz, eu te guio)

Depois que o webhook estiver no ar:
1. MP → Suas integrações → seu app → Webhooks
2. Cola: `https://rainbow-sip-kit.lovable.app/api/public/mp-webhook`
3. Eventos: `payment`
4. Copia a "Chave secreta" gerada → me passa via secret `MP_WEBHOOK_SECRET`

## 7. Modo TEST → PRODUÇÃO

- Começamos com as credenciais TEST que você passou.
- Pra testar cartão sem cobrar de verdade, MP fornece cartões de teste (te mando a lista).
- Quando quiser ativar produção: gera as credenciais PROD no MP, atualizo o secret, e ativo no Frenet também (o token Frenet que você passou já deve funcionar pra cotação real).

## Detalhes técnicos

- **Cartão:** PCI compliance preservada — tokenização 100% no browser via SDK oficial do MP. Backend nunca vê número/CVV.
- **Idempotência:** header `X-Idempotency-Key` em todas as chamadas a `POST /v1/payments` (usa o `order_id`).
- **Webhook:** validação HMAC SHA256 conforme docs MP, comparação `timingSafeEqual`.
- **Frenet:** cache de 24h por (CEP + composição do carrinho) pra economizar chamadas.
- **Validação:** Zod em todos os inputs server-side (CEP, CPF, email, valores).
- **Não inclui ainda:** integração UpSeller (gestão pós-pedido) e emissão de NF — fica pra próxima fase, mas a estrutura `orders` já fica pronta pra disparar webhook pra eles depois.

## O que preciso de você antes de implementar

1. Confirmar que posso **ativar Lovable Cloud** agora.
2. Me passar o **CEP de origem** dos envios (de onde sai a mercadoria).
3. Confirmar que quer **os 3 métodos** (cartão + PIX + boleto) já no v1.