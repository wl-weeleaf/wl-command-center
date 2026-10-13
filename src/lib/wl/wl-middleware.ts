import { createMiddleware } from "@tanstack/react-start";

const COOKIE = "wl_session";

function readClientToken() {
  if (typeof window === "undefined") return "";
  const fromUrl = new URLSearchParams(window.location.search).get("wl")?.trim() ?? "";
  if (fromUrl) return fromUrl;
  try {
    return sessionStorage.getItem(COOKIE)?.trim() ?? "";
  } catch {
    return "";
  }
}

async function userIdForToken(token: string) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `wl_${hex.slice(0, 24)}`;
}

export const wlMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    return next({ sendContext: { wlToken: readClientToken() } });
  })
  .server(async ({ next, context }) => {
    const sent = (context as { wlToken?: string }).wlToken?.trim() ?? "";
    let token = sent;
    if (!token) {
      const { getCookie } = await import("@tanstack/react-start/server");
      token = getCookie(COOKIE)?.trim() ?? "";
    }
    if (!token) {
      throw new Error("Log ind på WeeLeaf-platformen først.");
    }
    const userId = await userIdForToken(token);
    return next({ context: { userId, wlToken: token } });
  });
