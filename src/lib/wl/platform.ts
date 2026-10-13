export const WL_PLATFORM_ORIGIN = "https://weeleaf.com";

export type PlatformNode = {
  id: string;
  label: string;
  status: string;
  detail?: string;
};

export type PlatformSnapshot = {
  ok: boolean;
  userName?: string;
  nodes: PlatformNode[];
  statusLabel: string;
  statusDetail?: string;
  error?: string;
};

export function leafyEmbedUrl() {
  return `${WL_PLATFORM_ORIGIN}/?embed=leafy`;
}

export function snapshotUrl(token: string) {
  const url = new URL("/api/command/snapshot", WL_PLATFORM_ORIGIN);
  url.searchParams.set("wl", token);
  return url.toString();
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function asNodes(value: unknown): PlatformNode[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: text(row.id) || text(row.key) || String(index),
      label: text(row.label) || text(row.name) || text(row.title) || "Node",
      status: text(row.status) || text(row.state) || "ukendt",
      detail: text(row.detail) || text(row.note) || undefined,
    };
  });
}

export function parsePlatformSnapshot(body: unknown): PlatformSnapshot {
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const user = row.user && typeof row.user === "object" ? (row.user as Record<string, unknown>) : {};
  const statusRaw = row.status ?? row.platformStatus;
  let statusLabel = "";
  let statusDetail: string | undefined;
  if (typeof statusRaw === "string") statusLabel = statusRaw;
  else if (statusRaw && typeof statusRaw === "object") {
    const status = statusRaw as Record<string, unknown>;
    statusLabel = text(status.label) || text(status.text) || text(status.state);
    statusDetail = text(status.detail) || text(status.message) || undefined;
  }
  const nodes = asNodes(row.nodes ?? row.noder);
  return {
    ok: row.ok !== false && !text(row.error),
    userName: text(user.name) || text(user.displayName) || text(row.userName) || undefined,
    nodes,
    statusLabel: statusLabel || (nodes.length ? "Forbundet" : "Mangler"),
    statusDetail,
    error: text(row.error) || undefined,
  };
}

export async function fetchPlatformSnapshot(token: string): Promise<PlatformSnapshot> {
  try {
    const res = await fetch(snapshotUrl(token), {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    const raw = await res.text();
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    if (!res.ok || !body) {
      return {
        ok: false,
        nodes: [],
        statusLabel: "Mangler",
        statusDetail: res.status === 404 ? "Platformen har endnu ikke /api/command/snapshot." : `Platformen svarede ${res.status}.`,
        error: res.status === 404 ? "snapshot-mangler" : `http-${res.status}`,
      };
    }
    const parsed = parsePlatformSnapshot(body);
    if (!parsed.ok && !parsed.error) parsed.error = "snapshot-afvist";
    return parsed;
  } catch {
    return {
      ok: false,
      nodes: [],
      statusLabel: "Mangler",
      statusDetail: "Kunne ikke hente /api/command/snapshot fra WeeLeaf-platformen.",
      error: "unreachable",
    };
  }
}
