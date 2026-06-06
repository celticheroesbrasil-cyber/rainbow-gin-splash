import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — BË RAINBOW" },
      { name: "description", content: "Política de Privacidade da BË RAINBOW conforme a LGPD." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <LegalLayout title="Política de Privacidade" updated="06/2026">
      <h2>1. Quem somos</h2>
      <p>BË RAINBOW é uma marca de gin orgânico premium. Este site comercializa bebidas alcoólicas exclusivamente para maiores de 18 anos.</p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro/compra:</strong> nome, CPF, e-mail, telefone, endereço de entrega.</li>
        <li><strong>Pagamento:</strong> os dados de cartão são processados diretamente pelo Mercado Pago e nunca tocam nossos servidores; armazenamos apenas o identificador da transação.</li>
        <li><strong>Navegação:</strong> cookies, IP, dispositivo, páginas visitadas (analytics).</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Processar pedidos, pagamentos e entregas.</li>
        <li>Cumprir obrigações legais (fiscais, antifraude, controle etário).</li>
        <li>Comunicação transacional e, com seu consentimento, comunicação de marketing.</li>
      </ul>

      <h2>4. Compartilhamento</h2>
      <p>Compartilhamos dados estritamente necessários com: <strong>Mercado Pago</strong> (pagamentos), <strong>Frenet/Correios/transportadoras</strong> (entrega) e autoridades quando exigido por lei.</p>

      <h2>5. Seus direitos (LGPD)</h2>
      <p>Você pode solicitar acesso, correção, anonimização, portabilidade ou exclusão dos seus dados a qualquer momento por <strong>contato@berainbow.com.br</strong>.</p>

      <h2>6. Cookies</h2>
      <p>Usamos cookies essenciais (funcionamento do carrinho/checkout) e, com sua autorização, cookies de analytics. Você pode revisar sua escolha limpando o armazenamento do navegador.</p>

      <h2>7. Segurança</h2>
      <p>Adotamos criptografia em trânsito (HTTPS/TLS), controle de acesso e segregação de dados de pagamento via tokenização PCI-compliant do Mercado Pago.</p>

      <h2>8. Contato do encarregado (DPO)</h2>
      <p><strong>contato@berainbow.com.br</strong></p>
    </LegalLayout>
  );
}

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-display font-700 text-lg">BË RAINBOW</Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 py-10 prose prose-sm sm:prose-base prose-headings:font-display prose-headings:font-700 prose-h1:text-4xl prose-h2:text-xl prose-h2:mt-8 prose-p:leading-relaxed prose-li:leading-relaxed max-w-none">
        <h1 className="text-3xl sm:text-4xl font-display font-700 mb-2">{title}</h1>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-8">Atualizada em {updated}</p>
        <div className="space-y-3 text-foreground/85 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_p]:my-3">
          {children}
        </div>
      </article>
    </div>
  );
}

export { LegalLayout };
