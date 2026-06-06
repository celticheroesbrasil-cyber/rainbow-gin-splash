import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const KEY = "berainbow_cookies_ok";

export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) {
      // small delay so age gate aparece primeiro
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  if (!open) return null;

  function accept(value: "all" | "essential") {
    localStorage.setItem(KEY, value);
    setOpen(false);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-[90] p-3 sm:p-4">
      <div className="max-w-4xl mx-auto bg-background border border-border rounded-xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <p className="text-sm flex-1 leading-relaxed">
          Usamos cookies para melhorar sua experiência, analisar o tráfego e personalizar o conteúdo.
          Saiba mais na nossa{" "}
          <Link to="/politica-privacidade" className="underline font-semibold">Política de Privacidade</Link>.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => accept("essential")}>Só essenciais</Button>
          <Button size="sm" onClick={() => accept("all")}>Aceitar todos</Button>
        </div>
      </div>
    </div>
  );
}
