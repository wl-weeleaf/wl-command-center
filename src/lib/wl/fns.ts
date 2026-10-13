import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { loadIdentity, requirePerm } from "./session";
import { can } from "./access";
import { runDailyRoutines } from "./seed";
import { executeApprovedAction } from "./execute";
import { aiAvailable, leafyBriefing, leafyChat } from "./leafy";
import { buildOrgContext, deterministicBriefing } from "./snapshot";
import { mapFinance, mapProposal, mapShortcut, mapTask } from "./map";
import { isActionType, newId, payloadHash, parseJsonObject } from "./hash";
import { copenhagenNow, greetingWord, todayLabelDa, toDateOnly, toIso } from "./time";
import { ACTION_TYPES, ENTITIES, PRIORITIES, ROLES, type ActionType, type Entity, type JsonObject, type Priority, type Role } from "./types";
import type { AdminProfile, DashboardSnapshot, ProposalRow } from "./types";
import { wlMiddleware } from "./wl-middleware";
import { fetchPlatformSnapshot } from "./platform";

async function actor(userId: string) {
  return loadIdentity(userId);
}

export const getSessionProfile = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    const profile = await actor(context.userId);
    return { profile, aiAvailable: aiAvailable() };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }): Promise<DashboardSnapshot> => {
    const profile = await requirePerm(context.userId, "read");
    const sql = await getSql();
    await runDailyRoutines(sql);

    const clock = todayLabelDa();
    const greeting = greetingWord(clock.hour);

    const todayTasks = (
      await sql<Record<string, unknown>>`
        select * from tasks
        where status in ('open', 'doing')
        order by
          case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
          due_at nulls last, created_at
        limit 40
      `
    ).map(mapTask);

    const pendingProposals = (
      await sql<Record<string, unknown>>`
        select * from proposals where status = 'pending' order by created_at desc limit 20
      `
    ).map(mapProposal);

    const upcomingDeadlines = (
      await sql<Record<string, unknown>>`
        select * from finance_records
        where due_at is not null and status in ('open', 'upcoming', 'draft')
        order by due_at
        limit 8
      `
    ).map(mapFinance);

    const recentEvents = (
      await sql<{
        id: string;
        actor_user_id: string | null;
        action: string;
        target_type: string | null;
        target_id: string | null;
        detail: string | null;
        created_at: unknown;
      }>`
        select id, actor_user_id, action, target_type, target_id, detail, created_at
        from audit_log order by created_at desc limit 8
      `
    ).map((r) => ({
      id: r.id,
      actorUserId: r.actor_user_id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      detail: r.detail,
      createdAt: toIso(r.created_at) ?? "",
    }));

    const memberCounts = await sql<{ status: string; n: number }>`
      select status, count(*)::int as n from members group by status
    `;
    const byStatus = Object.fromEntries(memberCounts.map((m) => [m.status, m.n]));
    const orderAgg = await sql<{
      n: number;
      sales: number;
      commission: number;
      savings: number;
    }>`
      select count(*)::int as n,
        coalesce(sum(paid_ore),0)::int as sales,
        coalesce(sum(wl_commission_ore),0)::int as commission,
        coalesce(sum(member_savings_ore),0)::int as savings
      from orders
    `;
    const invoices = await sql<{ n: number }>`
      select count(*)::int as n from finance_records
      where kind in ('invoice', 'expense', 'commission') and status in ('open', 'draft')
    `;

    const briefingRow = await sql<{ content: string; source: string; briefing_date: string }>`
      select content, source, briefing_date from briefings where briefing_date = ${clock.isoDate}
    `;

    return {
      profile,
      todayLabel: clock.label,
      weekday: clock.weekday,
      greeting,
      briefing: briefingRow[0]
        ? {
            content: briefingRow[0].content,
            source: briefingRow[0].source,
            briefingDate: briefingRow[0].briefing_date,
          }
        : {
            content: deterministicBriefing(profile.displayName, {
              weekday: clock.weekday,
              dateLabel: clock.label,
              greeting,
              taskCount: todayTasks.length,
              pendingCount: pendingProposals.length,
              deadlineCount: upcomingDeadlines.length,
              tasks: todayTasks.map((t) => t.title),
            }),
            source: "deterministic",
            briefingDate: clock.isoDate,
          },
      todayTasks,
      pendingProposals,
      upcomingDeadlines,
      recentEvents,
      kpis: {
        activeMembers: Number(byStatus.active ?? 0),
        newMembers: Number(byStatus.new ?? 0),
        leftMembers: Number(byStatus.left ?? 0),
        orders: orderAgg[0]?.n ?? 0,
        salesOre: orderAgg[0]?.sales ?? 0,
        commissionOre: orderAgg[0]?.commission ?? 0,
        memberSavingsOre: orderAgg[0]?.savings ?? 0,
        openInvoices: invoices[0]?.n ?? 0,
        dataNote:
          "Nøgletal er testdata, indtil den eksisterende WL-platform er tilkoblet. WL ApS er ikke stiftet.",
      },
      aiAvailable: aiAvailable(),
    };
  });

export const generateBriefing = createServerFn({ method: "POST" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    const profile = await requirePerm(context.userId, "run_routines");
    const sql = await getSql();
    const clock = todayLabelDa();
    const org = await buildOrgContext(sql);
    let content: string;
    let source = "leafy";
    try {
      content = await leafyBriefing({ displayName: profile.displayName, snapshotText: org });
    } catch {
      content = `${greetingWord(clock.hour)}, ${profile.displayName}. Grok kunne ikke skrive briefingen lige nu. Brug opgavelisten og godkendelsescenteret — de er baseret på registrerede data.`;
      source = "deterministic";
    }
    await sql`
      insert into briefings (id, briefing_date, content, source, created_by)
      values (${newId()}, ${clock.isoDate}, ${content}, ${source}, ${profile.userId})
      on conflict (briefing_date) do update
        set content = excluded.content, source = excluded.source, created_by = excluded.created_by
    `;
    await sql`
      insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
      values (${newId()}, ${profile.userId}, ${"briefing"}, ${"briefing"}, ${clock.isoDate}, ${source})
    `;
    return { content, source, briefingDate: clock.isoDate };
  });

export const listTasks = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from tasks order by
        case status when 'open' then 0 when 'doing' then 1 else 2 end,
        case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
        due_at nulls last, created_at desc
    `;
    return rows.map(mapTask);
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .validator((input: { id: string; status: "open" | "doing" | "done" | "cancelled" }) => input)
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    await requirePerm(context.userId, "write_tasks");
    const sql = await getSql();
    await sql`
      update tasks set status = ${data.status}, updated_at = now() where id = ${data.id}
    `;
    await sql`
      insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
      values (${newId()}, ${context.userId}, ${"task_status"}, ${"task"}, ${data.id}, ${data.status})
    `;
    return { ok: true as const };
  });

export const createTask = createServerFn({ method: "POST" })
  .validator((input: { title: string; description?: string; priority?: Priority; entity?: Entity }) => input)
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    await requirePerm(context.userId, "write_tasks");
    const title = data.title.trim();
    if (!title) throw new Error("Titel er påkrævet.");
    const sql = await getSql();
    const id = newId();
    await sql`
      insert into tasks (id, title, description, priority, entity, source, created_by)
      values (
        ${id}, ${title}, ${data.description ?? ""}, ${data.priority ?? "normal"},
        ${data.entity ?? "platform"}, ${"manual"}, ${context.userId}
      )
    `;
    return { id };
  });

export const listProposals = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from proposals order by
        case status when 'pending' then 0 when 'approved' then 1 when 'executing' then 1 else 2 end,
        created_at desc
    `;
    return rows.map(mapProposal);
  });

export const getProposal = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .middleware([wlMiddleware])
  .handler(async ({ context, data: id }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`select * from proposals where id = ${id}`;
    if (!rows[0]) throw new Error("Forslaget findes ikke.");
    const events = await sql<{
      id: string;
      event_type: string;
      actor_user_id: string | null;
      detail: string | null;
      created_at: unknown;
    }>`
      select id, event_type, actor_user_id, detail, created_at
      from proposal_events where proposal_id = ${id} order by created_at
    `;
    const executions = await sql<{
      id: string;
      status: string;
      result: string;
      executed_by: string | null;
      executed_at: unknown;
    }>`
      select id, status, result, executed_by, executed_at
      from action_executions where proposal_id = ${id} order by executed_at
    `;
    return {
      proposal: mapProposal(rows[0]),
      events: events.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        actorUserId: e.actor_user_id,
        detail: e.detail,
        createdAt: toIso(e.created_at) ?? "",
      })),
      executions: executions.map((e) => ({
        id: e.id,
        status: e.status,
        result: parseJsonObject(e.result),
        executedBy: e.executed_by,
        executedAt: toIso(e.executed_at) ?? "",
      })),
    };
  });

export const createProposalManual = createServerFn({ method: "POST" })
  .validator(
    (input: {
      title: string;
      description: string;
      priority?: Priority;
      entity?: Entity;
      actionType: ActionType;
      actionPayload?: JsonObject;
      rationale: string;
    }) => input,
  )
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    await requirePerm(context.userId, "propose");
    if (!isActionType(data.actionType)) throw new Error("Ugyldig handlingstype.");
    const sql = await getSql();
    const payload = data.actionPayload ?? {};
    const id = newId();
    const hash = payloadHash(data.actionType, payload);
    await sql`
      insert into proposals (
        id, title, description, priority, source, entity, assignee_user_id,
        action_type, action_payload, payload_hash, rationale, status, created_by
      ) values (
        ${id}, ${data.title.trim()}, ${data.description.trim()}, ${data.priority ?? "normal"},
        ${"manual"}, ${data.entity ?? "platform"}, ${context.userId}, ${data.actionType},
        ${JSON.stringify(payload)}, ${hash}, ${data.rationale.trim()}, ${"pending"}, ${context.userId}
      )
    `;
    await sql`
      insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
      values (${newId()}, ${id}, ${"created"}, ${context.userId}, ${"Oprettet manuelt."})
    `;
    return { id };
  });

export const decideProposal = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      decision: "approve" | "reject" | "defer";
      note?: string;
    }) => input,
  )
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    const profile = await requirePerm(context.userId, "decide");
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`select * from proposals where id = ${data.id}`;
    if (!rows[0]) throw new Error("Forslaget findes ikke.");
    const proposal = mapProposal(rows[0]);
    if (proposal.status !== "pending" && data.decision !== "approve") {
      if (proposal.status !== "approved") throw new Error("Forslaget kan ikke behandles i sin nuværende status.");
    }
    if (data.decision === "reject" || data.decision === "defer") {
      if (proposal.status !== "pending") throw new Error("Kun afventende forslag kan afvises eller udsættes.");
      const status = data.decision === "reject" ? "rejected" : "deferred";
      await sql`
        update proposals
        set status = ${status}, decided_by = ${profile.userId}, decided_at = now(),
            decision_note = ${data.note ?? null}, updated_at = now()
        where id = ${data.id} and status = ${"pending"}
      `;
      await sql`
        insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
        values (${newId()}, ${data.id}, ${data.decision}, ${profile.userId}, ${data.note ?? ""})
      `;
      await sql`
        insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
        values (${newId()}, ${profile.userId}, ${data.decision}, ${"proposal"}, ${data.id}, ${data.note ?? status})
      `;
      return { status, executed: false as const };
    }

    if (proposal.status !== "pending" && proposal.status !== "approved") {
      throw new Error("Forslaget kan ikke godkendes.");
    }
    if (proposal.status === "pending") {
      await sql`
        update proposals
        set status = ${"approved"}, decided_by = ${profile.userId}, decided_at = now(),
            decision_note = ${data.note ?? null}, updated_at = now()
        where id = ${data.id} and status = ${"pending"}
      `;
      await sql`
        insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
        values (${newId()}, ${data.id}, ${"approved"}, ${profile.userId}, ${data.note ?? "Godkendt."})
      `;
    }

    if (!can(profile.role, "execute")) {
      return { status: "approved", executed: false as const };
    }

    await sql`update proposals set status = ${"executing"}, updated_at = now() where id = ${data.id}`;
    const result = await executeApprovedAction(sql, {
      proposalId: proposal.id,
      actionType: proposal.actionType,
      payload: proposal.actionPayload,
      payloadHash: proposal.payloadHash,
      executedBy: profile.userId,
    });
    const next = result.status === "failed" ? "failed" : "executed";
    await sql`
      update proposals set status = ${next}, updated_at = now() where id = ${data.id}
    `;
    await sql`
      insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
      values (${newId()}, ${data.id}, ${next}, ${profile.userId}, ${result.summary})
    `;
    return { status: next, executed: true as const, result };
  });

export const editProposal = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      title: string;
      description: string;
      priority: Priority;
      entity: Entity;
      actionType: ActionType;
      actionPayload: JsonObject;
      rationale: string;
      assigneeUserId?: string | null;
    }) => input,
  )
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    await requirePerm(context.userId, "decide");
    if (!isActionType(data.actionType)) throw new Error("Ugyldig handlingstype.");
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`select * from proposals where id = ${data.id}`;
    if (!rows[0]) throw new Error("Forslaget findes ikke.");
    const current = mapProposal(rows[0]);
    const nextHash = payloadHash(data.actionType, data.actionPayload);
    const materialChange = nextHash !== current.payloadHash;
    const nextStatus = materialChange ? "pending" : current.status;
    await sql`
      update proposals set
        title = ${data.title.trim()},
        description = ${data.description.trim()},
        priority = ${data.priority},
        entity = ${data.entity},
        action_type = ${data.actionType},
        action_payload = ${JSON.stringify(data.actionPayload)},
        payload_hash = ${nextHash},
        rationale = ${data.rationale.trim()},
        assignee_user_id = ${data.assigneeUserId ?? current.assigneeUserId},
        status = ${nextStatus},
        decided_by = ${materialChange ? null : current.decidedBy},
        decided_at = ${materialChange ? null : current.decidedAt}::timestamptz,
        updated_at = now()
      where id = ${data.id}
    `;
    await sql`
      insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
      values (
        ${newId()}, ${data.id}, ${materialChange ? "edited_reapproval" : "edited"},
        ${context.userId},
        ${materialChange ? "Væsentlige felter ændret — ny godkendelse kræves." : "Redigeret uden ændring af beløb/modtager/handling."}
      )
    `;
    return { requiresReapproval: materialChange };
  });

export const assignProposal = createServerFn({ method: "POST" })
  .validator((input: { id: string; assigneeUserId: string | null }) => input)
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    await requirePerm(context.userId, "decide");
    const sql = await getSql();
    await sql`
      update proposals set assignee_user_id = ${data.assigneeUserId}, updated_at = now()
      where id = ${data.id}
    `;
    await sql`
      insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
      values (${newId()}, ${data.id}, ${"assigned"}, ${context.userId}, ${data.assigneeUserId ?? "fjernet"})
    `;
    return { ok: true as const };
  });

export const listShortcuts = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`select * from shortcuts order by sort_order, title`;
    return rows.map(mapShortcut);
  });

export const saveShortcut = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id?: string;
      title: string;
      url: string;
      category: string;
      ownerName?: string;
      entity?: Entity | null;
      notes?: string;
      integrationStatus?: "shortcut" | "connected" | "missing";
    }) => input,
  )
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    await requirePerm(context.userId, "write_shortcuts");
    const sql = await getSql();
    const id = data.id ?? newId();
    await sql`
      insert into shortcuts (
        id, title, url, category, owner_name, entity, integration_status, notes, sort_order
      ) values (
        ${id}, ${data.title.trim()}, ${data.url.trim()}, ${data.category},
        ${data.ownerName ?? null}, ${data.entity ?? null},
        ${data.integrationStatus ?? "shortcut"}, ${data.notes ?? null}, ${0}
      )
      on conflict (id) do update set
        title = excluded.title,
        url = excluded.url,
        category = excluded.category,
        owner_name = excluded.owner_name,
        entity = excluded.entity,
        integration_status = excluded.integration_status,
        notes = excluded.notes,
        updated_at = now()
    `;
    return { id };
  });

export const deleteShortcut = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .middleware([wlMiddleware])
  .handler(async ({ context, data: id }) => {
    await requirePerm(context.userId, "write_shortcuts");
    const sql = await getSql();
    await sql`delete from shortcuts where id = ${id}`;
    return { ok: true as const };
  });

export const listFinance = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<Record<string, unknown>>`
      select * from finance_records order by entity, due_at nulls last, created_at desc
    `;
    return {
      records: rows.map(mapFinance),
      note: "Ingen lovpligtig bogføring i Command Center. Data er testdata, indtil et regnskabssystem tilkobles.",
    };
  });

export const listMembersAndOrders = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const members = await sql<{
      id: string;
      display_name: string;
      status: string;
      joined_at: unknown;
      left_at: unknown;
      contribution_ore: number;
      is_test_data: boolean;
    }>`select * from members order by joined_at desc nulls last`;
    const orders = await sql<{
      id: string;
      member_id: string | null;
      title: string;
      original_ore: number;
      paid_ore: number;
      member_savings_ore: number;
      wl_commission_ore: number;
      entity: string;
      status: string;
      ordered_at: unknown;
      is_test_data: boolean;
    }>`select * from orders order by ordered_at desc`;
    return {
      members: members.map((m) => ({
        id: m.id,
        displayName: m.display_name,
        status: m.status,
        joinedAt: toDateOnly(m.joined_at),
        leftAt: toDateOnly(m.left_at),
        contributionOre: Number(m.contribution_ore),
        isTestData: Boolean(m.is_test_data),
      })),
      orders: orders.map((o) => ({
        id: o.id,
        memberId: o.member_id,
        title: o.title,
        originalOre: Number(o.original_ore),
        paidOre: Number(o.paid_ore),
        memberSavingsOre: Number(o.member_savings_ore),
        wlCommissionOre: Number(o.wl_commission_ore),
        entity: o.entity as Entity,
        status: o.status,
        orderedAt: toDateOnly(o.ordered_at),
        isTestData: Boolean(o.is_test_data),
      })),
      note: "Medlems- og ordredata er testdata. Den eksisterende WeeLeaf-platform er ikke tilkoblet endnu.",
    };
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const projects = await sql<{
      id: string;
      title: string;
      summary: string;
      owner_name: string | null;
      status: string;
      next_action: string | null;
    }>`select id, title, summary, owner_name, status, next_action from projects order by title`;
    const milestones = await sql<{
      id: string;
      project_id: string;
      title: string;
      due_at: unknown;
      status: string;
    }>`select id, project_id, title, due_at, status from milestones order by sort_order`;
    return projects.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      ownerName: p.owner_name,
      status: p.status,
      nextAction: p.next_action,
      milestones: milestones
        .filter((m) => m.project_id === p.id)
        .map((m) => ({
          id: m.id,
          title: m.title,
          dueAt: toDateOnly(m.due_at),
          status: m.status,
        })),
    }));
  });

export const updateProject = createServerFn({ method: "POST" })
  .validator((input: { id: string; nextAction: string; status: string }) => input)
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    await requirePerm(context.userId, "write_projects");
    const sql = await getSql();
    await sql`
      update projects set next_action = ${data.nextAction}, status = ${data.status}, updated_at = now()
      where id = ${data.id}
    `;
    return { ok: true as const };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      email: string | null;
      display_name: string;
      role: string;
      entity: string | null;
    }>`select user_id, email, display_name, role, entity from admin_users order by created_at`;
    return rows.map((r) => ({
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      role: r.role as Role,
      entity: r.entity as Entity | null,
    }));
  });

export const updateAdminRole = createServerFn({ method: "POST" })
  .validator((input: { userId: string; role: Role; displayName?: string; entity?: Entity | null }) => input)
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    const profile = await requirePerm(context.userId, "manage_users");
    if (!ROLES.includes(data.role)) throw new Error("Ugyldig rolle.");
    if (data.userId === profile.userId && data.role !== "superadmin") {
      throw new Error("Du kan ikke fjerne din egen superadmin-rolle.");
    }
    const sql = await getSql();
    await sql`
      update admin_users
      set role = ${data.role},
          display_name = coalesce(${data.displayName ?? null}, display_name),
          entity = ${data.entity ?? null},
          updated_at = now()
      where user_id = ${data.userId}
    `;
    await sql`
      insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
      values (${newId()}, ${profile.userId}, ${"role_change"}, ${"admin_user"}, ${data.userId}, ${data.role})
    `;
    return { ok: true as const };
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      actor_user_id: string | null;
      action: string;
      target_type: string | null;
      target_id: string | null;
      detail: string | null;
      created_at: unknown;
    }>`select * from audit_log order by created_at desc limit 80`;
    return rows.map((r) => ({
      id: r.id,
      actorUserId: r.actor_user_id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      detail: r.detail,
      createdAt: toIso(r.created_at) ?? "",
    }));
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      week_key: string;
      content: string;
      status: string;
      created_at: unknown;
    }>`select id, week_key, content, status, created_at from weekly_reports order by created_at desc`;
    const drafts = await sql<{
      id: string;
      recipient: string | null;
      subject: string;
      status: string;
      created_at: unknown;
    }>`select id, recipient, subject, status, created_at from email_drafts order by created_at desc`;
    return {
      reports: rows.map((r) => ({
        id: r.id,
        weekKey: r.week_key,
        content: r.content,
        status: r.status,
        createdAt: toIso(r.created_at) ?? "",
      })),
      emailDrafts: drafts.map((d) => ({
        id: d.id,
        recipient: d.recipient,
        subject: d.subject,
        status: d.status,
        createdAt: toIso(d.created_at) ?? "",
      })),
    };
  });

export const listChat = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "chat");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      role: string;
      content: string;
      proposal_id: string | null;
      created_at: unknown;
    }>`
      select id, role, content, proposal_id, created_at
      from chat_messages where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return rows
      .reverse()
      .map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        content: r.content,
        proposalId: r.proposal_id,
        createdAt: toIso(r.created_at) ?? "",
      }));
  });

export const sendChat = createServerFn({ method: "POST" })
  .validator((input: { message: string }) => input)
  .middleware([wlMiddleware])
  .handler(async ({ context, data }) => {
    const profile = await requirePerm(context.userId, "chat");
    const message = data.message.trim();
    if (!message) throw new Error("Skriv en besked til Leafy.");
    const sql = await getSql();
    const userMsgId = newId();
    await sql`
      insert into chat_messages (id, user_id, role, content)
      values (${userMsgId}, ${profile.userId}, ${"user"}, ${message})
    `;
    const historyRows = await sql<{ role: string; content: string }>`
      select role, content from chat_messages
      where user_id = ${profile.userId} and id <> ${userMsgId}
      order by created_at asc
      limit 12
    `;
    const org = await buildOrgContext(sql);
    const history = historyRows.map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));
    const extra =
      can(profile.role, "propose")
        ? ""
        : "\n\nBemærk: brugeren har ikke rettighed til at oprette forslag. Svar, men kald ikke create_proposal.";
    let reply: { text: string; proposalIds: string[] };
    try {
      reply = await leafyChat({
        sql,
        userId: profile.userId,
        displayName: profile.displayName,
        orgContext: org + extra,
        history,
        userMessage: message,
        allowProposals: can(profile.role, "propose"),
      });
      if (!can(profile.role, "propose") && reply.proposalIds.length) {
        reply = {
          text: reply.text + "\n\nForslag blev ikke oprettet, fordi din rolle kun har læseadgang.",
          proposalIds: [],
        };
      }
    } catch (err) {
      reply = {
        text: `Grok kunne ikke svare (${err instanceof Error ? err.message : "ukendt fejl"}). Prøv igen om lidt.`,
        proposalIds: [],
      };
    }

    const asstId = newId();
    await sql`
      insert into chat_messages (id, user_id, role, content, proposal_id)
      values (
        ${asstId}, ${profile.userId}, ${"assistant"}, ${reply.text},
        ${reply.proposalIds[0] ?? null}
      )
    `;
    return {
      id: asstId,
      text: reply.text,
      proposalIds: reply.proposalIds,
    };
  });

export const envStatus = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    return {
      aiAvailable: aiAvailable(),
      model: process.env.XAI_MODEL?.trim() || "grok-4.5",
      timezone: "Europe/Copenhagen",
      hasDatabase: true,
    };
  });

export const getPlatformSnapshot = createServerFn({ method: "GET" })
  .middleware([wlMiddleware])
  .handler(async ({ context }) => {
    await requirePerm(context.userId, "read");
    const snapshot = await fetchPlatformSnapshot(context.wlToken);
    if (snapshot.userName) {
      const sql = await getSql();
      await sql`
        update admin_users
        set display_name = ${snapshot.userName}, updated_at = now()
        where user_id = ${context.userId}
          and display_name in (${"Nicki"}, ${"Grok user"}, ${"Administrator"})
      `;
    }
    return snapshot;
  });

export const ACTION_TYPE_VALUES = ACTION_TYPES;
export const ENTITY_VALUES = ENTITIES;
export const PRIORITY_VALUES = PRIORITIES;
export const ROLE_VALUES = ROLES;
export type { AdminProfile, ProposalRow };
