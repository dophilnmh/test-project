'use client';

const WHATSAPP_LINK = 'https://wa.me/254759673053';

export function FloatingWhatsAppButton() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-[#25D366]/30 transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
    >
      <img
        src="/assets/whatsapp-logo.svg"
        alt="WhatsApp"
        className="h-14 w-14 rounded-full object-cover"
      />
      <span className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:block">
        Chat with us
      </span>
    </a>
  );
}
