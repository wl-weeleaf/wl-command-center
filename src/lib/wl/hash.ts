import { createHash } from "node:crypto";
import { ACTION_TYPES, type ActionType, type JsonObject } from "./types";

export function newId() {
  return crypto.randomUUID();
}

export function payloadHash(actionType: string, payload: JsonObject) {
  const sensitive = {
    actionType,
    amount: payload.amount ?? payload.amountOre ?? null,
    recipient: payload.recipient ?? payload.counterparty ?? null,
    payload,
  };
  return createHash("sha256").update(stableStringify(sensitive)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function parseJsonObject(raw: string | null | undefined): JsonObject {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as JsonObject;
    return {};
  } catch {
    return {};
  }
}

export function parseAttachments(raw: string | null | undefined) {
  if (!raw) return [] as Array<{ name: string; url?: string }>;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x === "object")
      .map((x) => {
        const o = x as { name?: unknown; url?: unknown };
        return {
          name: String(o.name ?? "bilag"),
          url: o.url ? String(o.url) : undefined,
        };
      });
  } catch {
    return [];
  }
}

export function isActionType(value: string): value is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(value);
}
