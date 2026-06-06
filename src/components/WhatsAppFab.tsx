import { MessageCircle } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/5511971589089?text=Ol%C3%A1!%20Tenho%20interesse%20no%20BE%CC%88%20RAINBOW.";

export function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-5 right-5 z-50 size-14 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
    >
      <MessageCircle className="size-7" fill="currentColor" stroke="none" />
      <span className="sr-only">WhatsApp</span>
    </a>
  );
}

export { WHATSAPP_URL };
