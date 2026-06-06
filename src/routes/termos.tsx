import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "./politica-privacidade";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — BË RAINBOW" },
      { name: "description", content: "Termos e condições de uso da loja BË RAINBOW." },
    ],
  }),
  component: () => (
    <LegalLayout title="Termos de Uso" updated="06/2026">
      <h2>1. Aceite</h2>
      <p>Ao utilizar este site e efetuar compras, você concorda com estes Termos de Uso, com a Política de Privacidade e com a Política de Venda Responsável de Bebidas Alcoólicas.</p>

      <h2>2. Idade mínima</h2>
      <p>A venda de bebidas alcoólicas é <strong>proibida para menores de 18 anos</strong>, conforme Lei nº 8.069/90 (ECA) e Lei nº 13.106/2015. Ao confirmar a compra, você declara ter 18 anos ou mais. Reservamo-nos o direito de exigir documento de identidade no momento da entrega.</p>

      <h2>3. Produtos</h2>
      <p>Imagens são meramente ilustrativas. O teor alcoólico, volume e composição constam no rótulo do produto. Diferenças tonais de safra podem ocorrer.</p>

      <h2>4. Preços e pagamento</h2>
      <p>Preços em reais (R$), com impostos inclusos. Pagamentos processados por Mercado Pago (cartão, PIX, boleto). Pedidos só são liberados após confirmação do pagamento.</p>

      <h2>5. Entrega</h2>
      <p>Prazos calculados via integração Frenet a partir do CEP. No ato da entrega, será exigida a apresentação de documento de identificação para confirmação da maioridade do destinatário. A recusa por menor de idade ou ausência de documento implica devolução do pedido.</p>

      <h2>6. Troca, devolução e arrependimento</h2>
      <p>Conforme o art. 49 do CDC, você pode exercer o direito de arrependimento em até <strong>7 dias corridos</strong> após o recebimento, desde que o produto esteja lacrado e sem violação. Para produtos com defeito ou avaria de transporte, contate-nos em até 7 dias com fotos.</p>

      <h2>7. Cancelamento</h2>
      <p>Pedidos podem ser cancelados antes da postagem. Após o envio, segue o procedimento de devolução.</p>

      <h2>8. Propriedade intelectual</h2>
      <p>Marca, logotipo, fotos e textos são de propriedade da BË RAINBOW e não podem ser reproduzidos sem autorização.</p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>Não nos responsabilizamos pelo consumo inadequado ou abusivo do produto. <strong>Beba com moderação. Se beber, não dirija.</strong></p>

      <h2>10. Foro</h2>
      <p>Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer questões oriundas destes Termos.</p>
    </LegalLayout>
  ),
});
