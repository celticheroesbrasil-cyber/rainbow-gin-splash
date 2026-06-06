import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "berainbow_age_ok";

export function AgeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, []);

  if (!open) return null;

  function confirm() {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  function deny() {
    window.location.href = "https://www.google.com";
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-background rounded-2xl p-6 sm:p-8 text-center border border-border">
        <div className="text-3xl sm:text-4xl font-display font-700 mb-2 tracking-tight">+18</div>
        <h2 className="font-display text-2xl font-700 mb-3">Você tem mais de 18 anos?</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Este site comercializa bebidas alcoólicas. A venda é proibida para menores de 18 anos.
          Ao continuar, você declara ter idade legal para consumo de álcool no Brasil.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={deny}>Não tenho</Button>
          <Button className="flex-1" onClick={confirm}>Sim, tenho 18+</Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-4 uppercase tracking-wider font-semibold">
          Beba com moderação · Se beber, não dirija
        </p>
      </div>
    </div>
  );
}
