import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { setCart } from "@/lib/cart";
import { WhatsAppFab, WHATSAPP_URL } from "@/components/WhatsAppFab";
import { AgeGate } from "@/components/AgeGate";
import { CookieBanner } from "@/components/CookieBanner";
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { mainProductQuery } from "@/lib/shopify";
import {
  Check, ShoppingCart, Truck, ShieldCheck, Leaf, Award, Search, Menu,
  ChevronLeft, ChevronRight, Star, CreditCard, Lock, Package, Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import logo from "@/assets/logo.png.asset.json";
import capa1 from "@/assets/1_Capa.png.asset.json";
import capa2 from "@/assets/2_Capa.png.asset.json";
import capa3 from "@/assets/3_Capa.png.asset.json";
import capa4 from "@/assets/4_Capa.png.asset.json";
import img5 from "@/assets/5.png.asset.json";
import img6 from "@/assets/6.png.asset.json";
import img7 from "@/assets/7.png.asset.json";
import img8 from "@/assets/8.png.asset.json";
import img9 from "@/assets/9.png.asset.json";
import img10 from "@/assets/10.png.asset.json";
// partner logos removed

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BË RAINBOW — Gin Orgânico Premium 45%" },
      { name: "description", content: "BË RAINBOW: Gin Orgânico premium 45% vol. Sabor autêntico, qualidade que você sente. Entrega rápida em todo o Brasil." },
      { property: "og:title", content: "BË RAINBOW — Gin Orgânico Premium 45%" },
      { property: "og:description", content: "Gin Orgânico premium 45% vol. Pagamento 100% seguro." },
      { property: "og:image", content: capa1.url },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: capa1.url },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,900&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(mainProductQuery),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <div className="font-display text-2xl font-700 mb-2">Não consegui carregar os produtos</div>
        <div className="text-sm text-muted-foreground">{error.message}</div>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="font-display text-2xl font-700">Produto não encontrado na loja.</div>
    </div>
  ),
  component: Index,
});

type Kit = {
  id: string; sku: string; qty: number; title: string; badge?: string;
  price: number; oldPrice: number; unit: number;
  weight: number; perks: string[];
};

const BADGE_BY_QTY: Record<number, string | undefined> = {
  3: "Mais escolhido",
  6: "Melhor custo",
  9: "Festa garantida",
  12: "Brinde especial",
};

const PERKS_BY_QTY: Record<number, string[]> = {
  1: ["Frete calculado no checkout", "Embalagem segura", "Pagamento via Pix"],
  3: ["5% off no Pix", "Embalagem reforçada", "Postagem em até 48h"],
  6: ["Melhor custo por unidade", "Embalagem reforçada", "5% off no Pix"],
  9: ["Brinde: taça oficial", "Embalagem reforçada", "5% off no Pix"],
  12: ["Brinde: 2 taças oficiais", "Embalagem reforçada", "5% off no Pix"],
};

const FALLBACK_GALLERY = [
  { src: capa1.url, alt: "BË RAINBOW lifestyle" },
  { src: capa2.url, alt: "BË RAINBOW garrafa" },
  { src: capa3.url, alt: "BË RAINBOW drink" },
  { src: capa4.url, alt: "BË RAINBOW bartender" },
  { src: img5.url, alt: "BË RAINBOW detalhe" },
  { src: img6.url, alt: "BË RAINBOW orgânico" },
];

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Index() {
  const { data: product } = useSuspenseQuery(mainProductQuery);

  const KITS: Kit[] = useMemo(() => {
    if (!product) return [];
    return product.variants
      .slice()
      .sort((a, b) => a.qty - b.qty)
      .map((v) => {
        const oldPrice = v.oldPrice && v.oldPrice > v.price
          ? v.oldPrice
          : Math.round(v.price * 1.4 * 100) / 100; // fallback markup so the strikethrough still works
        return {
          id: v.id,
          sku: v.sku ?? v.id,
          qty: v.qty,
          title: v.qty === 1 ? "1 Garrafa" : `Kit ${v.qty} Garrafas`,
          badge: BADGE_BY_QTY[v.qty],
          price: v.price,
          oldPrice,
          unit: v.unitPrice,
          weight: v.weightKg || 0.4 * Math.max(v.qty, 1),
          perks: PERKS_BY_QTY[v.qty] ?? ["Frete calculado no checkout", "Embalagem segura"],
        };
      });
  }, [product]);

  const GALLERY = useMemo(() => {
    if (product && product.images.length > 0) {
      return product.images.map((i) => ({ src: i.url, alt: i.alt }));
    }
    return FALLBACK_GALLERY;
  }, [product]);

  const defaultId = useMemo(() => {
    const three = KITS.find((k) => k.qty === 3);
    return (three ?? KITS[0])?.id ?? "";
  }, [KITS]);

  const [selected, setSelected] = useState<string>(defaultId);
  const [activeImg, setActiveImg] = useState(0);
  const [cep, setCep] = useState("");
  const kit = useMemo(() => KITS.find((k) => k.id === selected) ?? KITS[0], [KITS, selected]);

  const navigate = useNavigate();

  const checkout = () => {
    if (!kit) return;
    setCart([{
      sku: kit.sku,
      title: `${product?.title ?? "BË RAINBOW"} — ${kit.title}`,
      qty: kit.qty,
      unit_price: kit.price / kit.qty,
      weight: kit.weight,
    }]);
    navigate({ to: "/checkout" });
  };

  if (!kit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="font-display text-2xl font-700">Nenhum kit disponível no momento.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Promo strip */}
      <div className="bg-rainbow text-white text-center text-[10px] xs:text-[11px] sm:text-sm py-2 px-3 sm:px-4 font-semibold tracking-wide overflow-hidden leading-snug">
        <span className="hidden sm:inline">ENVIO PARA TODO BRASIL · POSTAGEM EM ATÉ 48H · COMPRA 100% SEGURA · +18 BEBA COM MODERAÇÃO</span>
        <span className="sm:hidden">ENVIO PARA TODO BRASIL · POSTAGEM EM 48H · +18</span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <button className="md:hidden p-1.5 -ml-1.5" aria-label="Menu"><Menu className="size-5" /></button>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-foreground/80">
            <a href="#produto" className="hover:text-primary">Produto</a>
            <a href="#kits" className="hover:text-primary">Kits</a>
            <a href="#avaliacoes" className="hover:text-primary">Avaliações</a>
          </nav>
          <a href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <img src={logo.url} alt="BË RAINBOW" className="h-8 sm:h-10 w-auto" loading="eager" />
          </a>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button className="p-1.5 sm:p-2" aria-label="Buscar"><Search className="size-5" /></button>
            <button className="p-1.5 sm:p-2 relative" aria-label="Sacola">
              <ShoppingCart className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full size-4 flex items-center justify-center font-bold">0</span>
            </button>
          </div>
        </div>
      </header>

      {/* PRODUCT PAGE */}
      <section id="produto" className="max-w-6xl mx-auto px-4 pt-4 sm:pt-6 pb-10 sm:pb-12">
        <div className="text-xs text-muted-foreground mb-4">
          <a href="/" className="hover:underline">Início</a> / <span>Gin Orgânico</span> / <span className="text-foreground">BË RAINBOW 45%</span>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12">
          {/* Gallery */}
          <div className="lg:sticky lg:top-20 lg:self-start">

            <div className="relative bg-secondary rounded-2xl overflow-hidden aspect-square">
              <img
                src={GALLERY[activeImg].src}
                alt={GALLERY[activeImg].alt}
                className="w-full h-full object-cover transition-opacity"
                loading="eager"
              />
              <span className="absolute top-4 left-4 bg-rainbow text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full uppercase">Orgânico 45%</span>
              <button aria-label="Favoritar" className="absolute top-4 right-4 bg-white/90 hover:bg-white p-2 rounded-full shadow-sm">
                <Heart className="size-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                aria-label="Anterior"
                onClick={() => setActiveImg((i) => (i - 1 + GALLERY.length) % GALLERY.length)}
                className="p-2 rounded-full border border-border hover:bg-secondary shrink-0"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="flex gap-2 overflow-x-auto flex-1 scrollbar-none">
                {GALLERY.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`shrink-0 size-16 sm:size-20 rounded-lg overflow-hidden border-2 transition ${activeImg === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
                    aria-label={`Imagem ${i + 1}`}
                  >
                    <img src={g.src} alt="" className="w-full h-full object-cover" loading="eager" />
                  </button>
                ))}
              </div>
              <button
                aria-label="Próxima"
                onClick={() => setActiveImg((i) => (i + 1) % GALLERY.length)}
                className="p-2 rounded-full border border-border hover:bg-secondary shrink-0"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

          </div>


          <div className="flex flex-col">
            {/* 1 — Eyebrow */}
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
              <Leaf className="size-3.5 text-emerald-600" />
              Gin Orgânico Premium · 45% vol · 200ml
            </div>

            {/* 2 — H1 dominante */}
            <h1 className="font-display text-3xl sm:text-5xl lg:text-[3.25rem] font-700 leading-[1.02] tracking-tight mb-3">
              BË RAINBOW
            </h1>
            <p className="text-rainbow font-display text-lg sm:text-2xl font-600 mb-5 leading-tight">
              Beba o arco-íris. Beba autêntico.
            </p>

            {/* 3 — Rating (supporting) */}
            <div className="flex items-center gap-2 mb-7 text-sm">
              <div className="flex text-yellow-500">
                {[...Array(5)].map((_, i) => <Star key={i} className="size-4 fill-current" />)}
              </div>
              <span className="font-semibold">4.9</span>
              <a href="#avaliacoes" className="text-muted-foreground hover:underline">· 1.247 avaliações</a>
            </div>

            {/* 4 — PREÇO focal (sem caixa) */}
            <div className="mb-7">
              <div className="flex items-center gap-2 text-sm mb-1.5">
                <span className="text-muted-foreground line-through">{BRL(kit.oldPrice)}</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  -{Math.round((1 - kit.price / kit.oldPrice) * 100)}% OFF
                </span>
              </div>
              <div className="font-display text-4xl sm:text-6xl font-700 text-foreground leading-none tracking-tight">
                {BRL(kit.price)}
              </div>
              <div className="text-xs sm:text-sm text-foreground/70 mt-2.5">
                ou <strong className="text-foreground">12x de {BRL(kit.price / 12)}</strong> sem juros · <strong className="text-emerald-700">5% off no Pix</strong>
              </div>
            </div>

            {/* 5 — Kit selector enxuto */}
            <div className="mb-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2.5">
                Escolha seu kit · <span className="text-foreground">{kit.title}</span>
              </div>
              <div className={`grid gap-1.5 sm:gap-2 ${KITS.length >= 5 ? "grid-cols-5" : "grid-cols-4"}`}>
                {KITS.map((k) => {
                  const active = k.id === selected;
                  const isHero = k.qty === 3;
                  return (
                    <button
                      key={k.id}
                      onClick={() => setSelected(k.id)}
                      className={`relative rounded-lg border p-2 sm:p-2.5 text-center transition min-w-0 ${
                        active
                          ? "border-foreground bg-foreground/[0.04] ring-1 ring-foreground"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      {isHero && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap">
                          Top
                        </span>
                      )}
                      <div className="font-display text-lg sm:text-xl font-700 leading-none">{k.qty}<span className="text-[10px] font-sans text-muted-foreground ml-0.5">un</span></div>
                      <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-1.5 truncate">{BRL(k.unit)}/un</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 font-medium">
                <Check className="size-4 shrink-0" /> {kit.perks[0]}
              </div>
            </div>

            {/* 6 — CTA primária (ponto focal) */}
            <button
              onClick={checkout}
              className="w-full h-12 sm:h-14 rounded-xl bg-rainbow text-white text-sm sm:text-base font-bold tracking-wide shadow-lg shadow-primary/25 hover:opacity-95 transition flex items-center justify-center gap-2"
            >
              <ShoppingCart className="size-5" /> COMPRAR AGORA
            </button>
            <button className="w-full h-11 mt-1.5 text-sm font-semibold text-foreground/70 hover:text-foreground transition">
              Adicionar à sacola
            </button>

            {/* 7 — Trust line (inline, discreto) */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3 text-[10px] sm:text-[11px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5"><Lock className="size-3 text-emerald-600" /> Site 100% criptografado</span>
              <span className="flex items-center gap-1.5"><CreditCard className="size-3 text-emerald-600" /> Dados protegidos</span>
            </div>

            {/* 8 — Apoio agrupado */}
            <div className="mt-8 pt-6 border-t border-border space-y-6">
              {/* CEP compacto */}
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                  <Truck className="size-4 text-foreground/60" /> Calcule o frete e prazo
                </div>
                <div className="flex gap-2">
                  <input
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    placeholder="00000-000"
                    inputMode="numeric"
                    className="flex-1 h-10 rounded-lg border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button className="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-semibold hover:bg-foreground/90">
                    Calcular
                  </button>
                </div>
              </div>

              {/* Benefícios em lista limpa */}
              <ul className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {[
                  { i: Truck, t: "Entrega para todo Brasil" },
                  { i: CreditCard, t: "Até 12x sem juros" },
                  { i: Package, t: "Embalagem reforçada" },
                  { i: ShieldCheck, t: "Compra 100% segura" },
                ].map(({ i: I, t }) => (
                  <li key={t} className="flex items-center gap-2 text-foreground/80">
                    <I className="size-4 text-foreground/50 shrink-0" /> {t}
                  </li>
                ))}
              </ul>

              {/* Pagamento minimal */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Pagamento:</span>
                {["PIX", "VISA", "MASTER", "ELO", "AMEX", "HIPER", "BOLETO"].map((p) => (
                  <span key={p} className="text-[10px] font-bold bg-secondary rounded px-1.5 py-0.5 text-foreground/60">{p}</span>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Description / Features */}
      <section className="bg-cream border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-3 gap-8">
          {[
            { img: img7.url, t: "Sabor sem complicação", d: "Notas botânicas equilibradas que conquistam no primeiro gole." },
            { img: img8.url, t: "Qualidade que você sente", d: "Gin orgânico 45% vol., produzido com botânicos selecionados." },
            { img: img9.url, t: "Postagem segura", d: "Embalagem reforçada e rastreio em todo o trajeto até você." },
          ].map((b) => (
            <div key={b.t} className="text-center">
              <div className="aspect-square rounded-2xl overflow-hidden bg-white mb-4">
                <img src={b.img} alt={b.t} className="w-full h-full object-cover" loading="eager" />
              </div>
              <h3 className="font-display text-xl font-700 mb-1">{b.t}</h3>
              <p className="text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lifestyle banner */}
      <section className="max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-2 gap-8 items-center">
        <div className="rounded-2xl overflow-hidden aspect-[4/5] md:aspect-square">
          <img src={img10.url} alt="Amigas brindando" className="w-full h-full object-cover" loading="eager" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Beba o arco-íris</span>
          <h2 className="font-display text-3xl sm:text-4xl font-700 mt-3 leading-tight">
            Feito para momentos que <span className="text-rainbow">merecem cor</span>.
          </h2>
          <p className="text-foreground/70 mt-4 leading-relaxed">
            BË RAINBOW é gin orgânico premium, destilado com botânicos cuidadosamente selecionados.
            Sabor autêntico, aroma marcante e aquela presença vibrante que transforma qualquer encontro.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 max-w-md">
            {[
              { i: Leaf, t: "100% orgânico" },
              { i: Award, t: "Premium 45%" },
              { i: ShieldCheck, t: "Selo de qualidade" },
              { i: Truck, t: "Entrega rápida" },
            ].map(({ i: I, t }) => (
              <div key={t} className="flex items-center gap-2 text-sm font-medium">
                <I className="size-4 text-primary" /> {t}
              </div>
            ))}
          </div>
          <a href="#kits" onClick={(e) => { e.preventDefault(); document.getElementById("produto")?.scrollIntoView({ behavior: "smooth" }); }}
             className="inline-flex mt-7 h-12 px-7 rounded-xl bg-rainbow text-white font-bold items-center gap-2 hover:opacity-95">
            <ShoppingCart className="size-4" /> Quero meu kit
          </a>
        </div>
      </section>

      {/* Reviews */}
      <section id="avaliacoes" className="bg-secondary/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-16">
          {/* Section header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary mb-3">Avaliações verificadas</span>
            <h2 className="font-display text-4xl md:text-5xl font-700 leading-tight">O que dizem sobre o BË RAINBOW</h2>
            <p className="text-muted-foreground mt-3">Mais de 1.247 clientes já experimentaram. Veja por que viram fãs.</p>
          </div>

          {/* Rating summary + breakdown card */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 sm:p-6 md:p-8 mb-8 grid md:grid-cols-[auto_1fr] gap-6 md:gap-12 items-center">
            <div className="text-center md:border-r md:border-border md:pr-12 pb-6 md:pb-0 border-b md:border-b-0 border-border">
              <div className="font-display text-6xl font-700 leading-none">4.9</div>
              <div className="flex justify-center text-yellow-500 my-2">{[...Array(5)].map((_, i) => <Star key={i} className="size-5 fill-current" />)}</div>
              <div className="text-sm text-muted-foreground">1.247 avaliações</div>
            </div>
            <div className="space-y-2.5">
              {[
                { s: 5, p: 86 }, { s: 4, p: 10 }, { s: 3, p: 3 }, { s: 2, p: 1 }, { s: 1, p: 0 },
              ].map((r) => (
                <div key={r.s} className="flex items-center gap-3 text-sm">
                  <span className="w-10 flex items-center gap-1 font-medium">{r.s}<Star className="size-3.5 fill-yellow-500 text-yellow-500" /></span>
                  <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-rainbow rounded-full transition-all" style={{ width: `${r.p}%` }} />
                  </div>
                  <span className="w-10 text-right text-muted-foreground text-xs tabular-nums">{r.p}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Review cards */}
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { n: "Marina S.", d: "Há 3 dias", t: "Sabor incrível! Chegou super rápido, embalagem caprichada. Já é meu gin oficial." },
              { n: "Ricardo P.", d: "Há 1 semana", t: "Comprei o kit de 6 para uma confraternização e foi sucesso. Qualidade impecável." },
              { n: "Juliana A.", d: "Há 2 semanas", t: "Aroma maravilhoso, encorpado e equilibrado. Vale cada centavo." },
              { n: "Fernando L.", d: "Há 3 semanas", t: "Pedido entregue em 2 dias, atendimento dez. Recomendo demais!" },
            ].map((c) => (
              <article key={c.n} className="bg-white rounded-2xl border border-border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-4">
                  <div className="size-11 rounded-full bg-rainbow flex items-center justify-center text-white font-display font-700 text-base shrink-0">
                    {c.n.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{c.n}</span>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">✓ Verificado</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{c.d}</span>
                    </div>
                    <div className="flex text-yellow-500 mt-1">{[...Array(5)].map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}</div>
                  </div>
                </div>
                <p className="text-[15px] text-foreground/85 leading-relaxed">"{c.t}"</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="font-display text-3xl font-700 text-center mb-2">Como funciona seu pedido</h2>
        <p className="text-center text-muted-foreground mb-10">Do clique até o brinde em até 48h</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            "1. Escolha seu kit e finalize com Pix ou cartão",
            "2. Confirmação do pagamento por e-mail",
            "3. Separação e embalagem segura",
            "4. Postagem em até 24h úteis",
            "5. Frete calculado no checkout pelo seu CEP",
            "6. Código de rastreio enviado após o envio",
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-5 rounded-xl border border-border bg-cream">
              <span className="size-8 rounded-full bg-rainbow text-white font-bold text-sm flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-sm leading-relaxed pt-1">{s.replace(/^\d+\.\s*/, "")}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Partners section removed */}


      {/* Footer */}
      <footer className="bg-foreground text-background">
        <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <img src={logo.url} alt="BË RAINBOW" className="h-10 w-auto mb-4 brightness-0 invert" loading="eager" />
            <p className="text-sm opacity-70 leading-relaxed">Gin Orgânico Premium 45% vol. Produzido no Brasil com botânicos selecionados.</p>
          </div>
          <div className="text-sm">
            <h4 className="font-bold mb-3 uppercase tracking-wider text-xs">Atendimento</h4>
            <ul className="space-y-1.5 opacity-80">
              <li>Seg a Sex · 9h às 18h</li>
              <li>contato@berainbow.com.br</li>
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1.5">
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
          <div className="text-sm">
            <h4 className="font-bold mb-3 uppercase tracking-wider text-xs">Institucional</h4>
            <ul className="space-y-1.5 opacity-80 mb-4">
              <li><Link to="/politica-privacidade" className="hover:underline">Política de Privacidade</Link></li>
              <li><Link to="/termos" className="hover:underline">Termos de Uso</Link></li>
              <li><Link to="/venda-responsavel" className="hover:underline">Venda Responsável +18</Link></li>
            </ul>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["PIX", "VISA", "MASTER", "ELO", "AMEX", "BOLETO"].map((p) => (
                <span key={p} className="text-[10px] font-bold bg-white/10 rounded px-2 py-1">{p}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["CORREIOS", "JADLOG", "LOGGI"].map((p) => (
                <span key={p} className="text-[10px] font-bold bg-white/10 rounded px-2 py-1">{p}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-70">
            <div className="flex items-center gap-2"><Lock className="size-3" /> Compra 100% segura · SSL</div>
            <div className="font-bold tracking-wider">SE BEBER, NÃO DIRIJA · BEBA COM MODERAÇÃO · VENDA PROIBIDA PARA MENORES DE 18 ANOS</div>
            <div>© {new Date().getFullYear()} BË RAINBOW</div>
          </div>
        </div>
      </footer>
      <AgeGate />
      <CookieBanner />
      <WhatsAppFab />
    </div>
  );
}
