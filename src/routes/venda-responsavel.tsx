import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "./politica-privacidade";

export const Route = createFileRoute("/venda-responsavel")({
  head: () => ({
    meta: [
      { title: "Venda Responsável de Bebidas — BË RAINBOW" },
      { name: "description", content: "Política de venda responsável de bebidas alcoólicas e compromisso com o consumo consciente." },
    ],
  }),
  component: () => (
    <LegalLayout title="Venda Responsável de Bebidas Alcoólicas" updated="06/2026">
      <h2>Nosso compromisso</h2>
      <p>A BË RAINBOW comercializa bebidas alcoólicas com responsabilidade e em estrita observância à legislação brasileira.</p>

      <h2>Idade mínima — 18 anos</h2>
      <ul>
        <li>É <strong>proibida</strong> a venda, oferta, fornecimento ou entrega de bebidas alcoólicas a menores de 18 anos (Lei nº 13.106/2015 e ECA).</li>
        <li>O site exibe verificação de idade na entrada. Ao confirmar, o usuário declara ter 18 anos ou mais.</li>
        <li>No momento da entrega, a transportadora pode exigir documento oficial com foto do destinatário ou responsável.</li>
        <li>Pedidos cujo destinatário não comprovar maioridade serão devolvidos sem prejuízo para a BË RAINBOW.</li>
      </ul>

      <h2>Consumo consciente</h2>
      <ul>
        <li>Beba com moderação.</li>
        <li>Se beber, não dirija (Lei Seca — Lei nº 11.705/2008).</li>
        <li>O consumo de álcool é desaconselhado a gestantes, lactantes e pessoas em uso de medicação contínua.</li>
        <li>O abuso de álcool é prejudicial à saúde.</li>
      </ul>

      <h2>Publicidade</h2>
      <p>Nossa comunicação não retrata menores de idade consumindo, não associa o produto à direção de veículos, à performance esportiva ou a efeitos terapêuticos, em conformidade com o Código de Autorregulamentação Publicitária (CONAR).</p>

      <h2>Onde buscar ajuda</h2>
      <p>Caso você ou alguém próximo enfrente problemas relacionados ao consumo de álcool, procure orientação no <strong>CVV — 188</strong> (24h) ou no <strong>SUS — 136</strong>.</p>
    </LegalLayout>
  ),
});
