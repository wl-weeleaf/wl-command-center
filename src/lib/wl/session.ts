import { getSql, type Sql } from "@/lib/db";
import { ROLE_LABELS, type Permission, assertCan } from "./access";
import { seedIfNeeded, runDailyRoutines } from "./seed";
import { newId } from "./hash";
import type { AdminProfile, Role } from "./types";

const ROLES = new Set<Role>([
  "superadmin",
  "finance",
  "project",
  "tech",
  "reader",
  "pending",
]);

const GATE_PROVIDER = "grok-gate";
const GATE_EMAIL_SUFFIX = "@viewer.grok.invalid";

function asRole(value: string): Role {
  return ROLES.has(value as Role) ? (value as Role) : "pending";
}

function looksLikeGateIdentity(email?: string | null, name?: string | null) {
  const e = (email ?? "").toLowerCase();
  const n = (name ?? "").trim().toLowerCase();
  return e.endsWith(GATE_EMAIL_SUFFIX) || n === "grok user";
}

function preferredName(input: {
  email?: string | null;
  name?: string | null;
}): string {
  const name = input.name?.trim();
  if (name && name.toLowerCase() !== "grok user") return name;
  const local = input.email?.split("@")[0]?.trim();
  if (local && !input.email?.toLowerCase().endsWith(GATE_EMAIL_SUFFIX)) return local;
  return "Nicki";
}

async function hasGrokGateAccount(sql: Sql, userId: string) {
  try {
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from account
      where "userId" = ${userId} and "providerId" = ${GATE_PROVIDER}
    `;
    return (rows[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

async function isOwnerCandidate(
  sql: Sql,
  userId: string,
  email?: string | null,
  name?: string | null,
) {
  if (looksLikeGateIdentity(email, name)) return true;
  return hasGrokGateAccount(sql, userId);
}

async function grantSuperadmin(
  sql: Sql,
  userId: string,
  displayName: string,
  detail: string,
) {
  await sql`
    update admin_users
    set role = ${"superadmin"},
        display_name = ${displayName},
        entity = coalesce(entity, ${"platform"}),
        updated_at = now()
    where user_id = ${userId}
  `;
  await sql`
    insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
    values (
      ${newId()},
      ${userId},
      ${"bootstrap_superadmin"},
      ${"admin_user"},
      ${userId},
      ${detail}
    )
  `;
  await runDailyRoutines(sql);
}

export async function resolveProfile(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  fromPlatform?: boolean;
}): Promise<AdminProfile> {
  const sql = await getSql();
  await seedIfNeeded(sql);

  const existing = await sql<{
    user_id: string;
    email: string | null;
    display_name: string;
    role: string;
    entity: string | null;
    image_url: string | null;
  }>`select user_id, email, display_name, role, entity, image_url from admin_users where user_id = ${input.userId}`;

  if (existing[0]) {
    const row = existing[0];
    let role = asRole(row.role);
    let displayName = row.display_name;
    const placeholder =
      row.display_name === (row.email?.split("@")[0] ?? "Administrator") ||
      row.display_name.toLowerCase() === "grok user";
    if (placeholder) displayName = preferredName(input);

    if (input.email && input.email !== row.email) {
      await sql`
        update admin_users
        set email = ${input.email},
            image_url = ${input.image ?? row.image_url},
            display_name = ${displayName},
            updated_at = now()
        where user_id = ${input.userId}
      `;
    } else if (displayName !== row.display_name) {
      await sql`
        update admin_users
        set display_name = ${displayName}, updated_at = now()
        where user_id = ${input.userId}
      `;
    }

    if (role === "pending" && (input.fromPlatform || (await isOwnerCandidate(sql, input.userId, input.email, input.name)))) {
      await grantSuperadmin(
        sql,
        input.userId,
        displayName,
        "Grok-identiteten blev superadmin — Command Center er et privat arbejdsrum.",
      );
      role = "superadmin";
    }

    return {
      userId: row.user_id,
      email: input.email ?? row.email,
      displayName,
      role,
      entity:
        role === "superadmin"
          ? ((row.entity as AdminProfile["entity"]) ?? "platform")
          : (row.entity as AdminProfile["entity"]),
      imageUrl: input.image ?? row.image_url,
    };
  }

  const claimed = await sql<{ value: string }>`
    insert into org_kv (key, value)
    values (${"first_admin_user_id"}, ${input.userId})
    on conflict (key) do nothing
    returning value
  `;
  const first = claimed[0]?.value === input.userId;
  const owner =
    Boolean(input.fromPlatform) || first || (await isOwnerCandidate(sql, input.userId, input.email, input.name));
  const role: Role = owner ? "superadmin" : "pending";
  const displayName = preferredName(input);

  await sql`
    insert into admin_users (user_id, email, display_name, role, entity, image_url, created_by)
    values (
      ${input.userId},
      ${input.email ?? null},
      ${displayName},
      ${role},
      ${owner ? "platform" : null},
      ${input.image ?? null},
      ${"system"}
    )
    on conflict (user_id) do nothing
  `;

  await sql`
    insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
    values (
      ${newId()},
      ${input.userId},
      ${owner ? "bootstrap_superadmin" : "access_requested"},
      ${"admin_user"},
      ${input.userId},
      ${
        first
          ? "Første administrator blev superadmin."
          : owner
            ? input.fromPlatform
              ? "Adgang via WeeLeaf-platformens medlemslogin."
              : "Grok-identiteten blev superadmin — Command Center er et privat arbejdsrum."
            : "Ny bruger afventer tildeling af rolle."
      }
    )
  `;

  if (owner) {
    await runDailyRoutines(sql);
  }

  return {
    userId: input.userId,
    email: input.email ?? null,
    displayName,
    role,
    entity: owner ? "platform" : null,
    imageUrl: input.image ?? null,
  };
}

export async function loadIdentity(userId: string) {
  if (userId.startsWith("wl_")) {
    return resolveProfile({ userId, name: "Nicki", fromPlatform: true });
  }
  const sql = await getSql();
  const users = await sql<{
    id: string;
    name: string;
    email: string;
    image: string | null;
  }>`select id, name, email, image from "user" where id = ${userId}`;
  const u = users[0];
  return resolveProfile({
    userId,
    email: u?.email ?? null,
    name: u?.name ?? null,
    image: u?.image ?? null,
  });
}

export async function requirePerm(userId: string, perm: Permission) {
  const profile = await loadIdentity(userId);
  assertCan(profile, perm);
  return profile;
}

export function roleLabel(role: Role) {
  return ROLE_LABELS[role];
}
