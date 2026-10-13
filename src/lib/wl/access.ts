import type { AdminProfile, Role } from "./types";

export type Permission =
  | "read"
  | "chat"
  | "propose"
  | "write_tasks"
  | "decide"
  | "execute"
  | "write_shortcuts"
  | "write_finance"
  | "write_projects"
  | "manage_users"
  | "run_routines";

const ROLE_PERMS: Record<Role, Permission[]> = {
  superadmin: [
    "read",
    "chat",
    "propose",
    "write_tasks",
    "decide",
    "execute",
    "write_shortcuts",
    "write_finance",
    "write_projects",
    "manage_users",
    "run_routines",
  ],
  finance: [
    "read",
    "chat",
    "propose",
    "write_tasks",
    "decide",
    "execute",
    "write_finance",
    "run_routines",
  ],
  project: [
    "read",
    "chat",
    "propose",
    "write_tasks",
    "decide",
    "execute",
    "write_projects",
    "run_routines",
  ],
  tech: [
    "read",
    "chat",
    "propose",
    "write_tasks",
    "decide",
    "execute",
    "write_shortcuts",
    "run_routines",
  ],
  reader: ["read", "chat"],
  pending: [],
};

export function can(role: Role, perm: Permission) {
  return ROLE_PERMS[role]?.includes(perm) ?? false;
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(profile: AdminProfile, perm: Permission) {
  if (!can(profile.role, perm)) {
    throw new ForbiddenError("Du har ikke rettighed til denne handling.");
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Superadmin",
  finance: "Økonomiadministrator",
  project: "Projektadministrator",
  tech: "Teknisk administrator",
  reader: "Læseadgang",
  pending: "Afventer adgang",
};

export const ENTITY_LABELS: Record<string, string> = {
  forening: "WL Forening",
  enkeltmand: "WL enkeltmandsvirksomhed",
  aps: "WL ApS",
  platform: "WL-platformen",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Lav",
  normal: "Normal",
  high: "Høj",
  urgent: "Akut",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Åben",
  doing: "I gang",
  done: "Udført",
  cancelled: "Annulleret",
  pending: "Afventer",
  approved: "Godkendt",
  rejected: "Afvist",
  deferred: "Udsat",
  superseded: "Erstatter",
  executing: "Udfører",
  executed: "Gennemført",
  failed: "Fejlet",
  draft: "Kladde",
  received: "Modtaget",
  upcoming: "Kommende",
  missing: "Mangler",
  saved: "Gemt",
  active: "Aktiv",
  blocked: "Blokeret",
  planned: "Planlagt",
  new: "Ny",
  left: "Udmeldt",
};

export const CATEGORY_LABELS: Record<string, string> = {
  offentligt: "Offentligt",
  okonomi: "Økonomi",
  administration: "Administration",
  platform: "Platform",
  kommunikation: "Kommunikation",
  ai: "AI",
};

export const ACTION_LABELS: Record<string, string> = {
  log_internal_event: "Intern testhandling",
  create_task: "Opret opgave",
  save_report: "Gem rapport",
  draft_email: "Gem mailkladde",
  external_unavailable: "Ekstern handling (ingen integration)",
};
