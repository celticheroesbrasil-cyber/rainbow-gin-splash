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
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full bg-background rounded-2xl p-5 sm:p-8 text-center border border-border">
        <div className="text-3xl sm:text-4xl font-display font-700 mb-2 tracking-tight">+18</div>
        <h2 className="font-display text-xl sm:text-2xl font-700 mb-3">Você tem mais de 18 anos?</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mb-6 leading-relaxed">
          Este site comercializa bebidas alcoólicas. A venda é proibida para menores de 18 anos.
          Ao continuar, você declara ter idade legal para consumo de álcool no Brasil.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <Button variant="outline" className="flex-1" onClick={deny}>Não tenho</Button>
          <button
            onClick={confirm}
            className="flex-1 h-10 sm:h-9 rounded-md bg-rainbow text-white text-sm font-bold tracking-wide shadow-sm hover:opacity-95 transition cursor-pointer"
          >
            Sim, tenho 18+
          </button>
        </div>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-4 uppercase tracking-wider font-semibold">
          Beba com moderação · Se beber, não dirija
        </p>
      </div>
    </div>
  );
}
