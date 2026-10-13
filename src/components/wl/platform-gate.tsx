import { useLayoutEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/wl/brand-mark";

const STORAGE_KEY = "wl_session";

export function persistWlToken(token: string) {
  const value = token.trim();
  if (!value) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private mode */
  }
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=86400`;
}

export function readWlToken() {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("wl")?.trim() ?? "";
  if (fromUrl) return fromUrl;
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function PlatformRequired() {
  return (
    <main className="grid min-h-dvh place-items-center bg-sidebar px-6 text-sidebar-foreground">
      <div className="max-w-md text-center">
        <BrandMark className="mx-auto size-12" />
        <p className="mt-6 font-display text-2xl leading-snug">Log ind på WeeLeaf-platformen først.</p>
      </div>
    </main>
  );
}

export function PlatformGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");

  useLayoutEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("wl")?.trim() ?? "";
    if (incoming) persistWlToken(incoming);
    setToken(incoming || readWlToken());
  }, []);

  if (!token) return <PlatformRequired />;
  return <>{children}</>;
}
