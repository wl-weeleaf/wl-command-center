import { createContext, useContext } from "react";
import { leafyEmbedUrl } from "@/lib/wl/platform";

const OpenChatContext = createContext<(() => void) | null>(null);

export function LeafyChatProvider({
  open,
  children,
}: {
  open: () => void;
  children: React.ReactNode;
}) {
  return <OpenChatContext.Provider value={open}>{children}</OpenChatContext.Provider>;
}

/** Platformens 3D-Leafy. Et klik åbner chat, samme sted som på kommandocentralen. */
export function LeafyWidget({ size = 96 }: { size?: number }) {
  const openChat = useContext(OpenChatContext);
  return (
    <button
      type="button"
      onClick={() => openChat?.()}
      className="relative shrink-0 overflow-hidden rounded-2xl bg-[#06150c] shadow-(--shadow-card)"
      style={{ width: size, height: Math.round(size * 1.15) }}
      aria-label="Åbn chat med Leafy"
      title="Åbn chat med Leafy"
    >
      <iframe
        title="Leafy"
        src={leafyEmbedUrl()}
        className="pointer-events-none absolute inset-0 h-full w-full border-0"
        tabIndex={-1}
        loading="lazy"
      />
    </button>
  );
}
