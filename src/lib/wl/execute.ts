import type { Sql } from "@/lib/db";
import { isoWeekKey } from "./time";
import { newId, parseJsonObject } from "./hash";
import type { ActionType, JsonObject } from "./types";

export type ExecutionResult = {
  status: "succeeded" | "failed" | "skipped";
  summary: string;
  data: JsonObject;
};

export async function executeApprovedAction(
  sql: Sql,
  input: {
    proposalId: string;
    actionType: ActionType;
    payload: JsonObject;
    payloadHash: string;
    executedBy: string;
  },
): Promise<ExecutionResult> {
  const existing = await sql<{ status: string; result: string }>`
    select status, result from action_executions
    where proposal_id = ${input.proposalId} and payload_hash = ${input.payloadHash}
  `;
  if (existing[0]) {
    const prev = parseJsonObject(existing[0].result);
    return {
      status: existing[0].status === "succeeded" ? "skipped" : "skipped",
      summary: "Handlingen var allerede udført. Gentagen kørsel blev blokeret.",
      data: prev,
    };
  }

  const execId = newId();
  await sql`
    insert into action_executions (
      id, proposal_id, action_type, payload_hash, status, result, executed_by
    ) values (
      ${execId}, ${input.proposalId}, ${input.actionType}, ${input.payloadHash},
      ${"started"}, ${"{}"}, ${input.executedBy}
    )
  `;

  try {
    const result = await runAction(sql, input.actionType, input.payload, input.proposalId);
    await sql`
      update action_executions
      set status = ${result.status}, result = ${JSON.stringify(result)}
      where id = ${execId}
    `;
    await sql`
      insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
      values (
        ${newId()}, ${input.executedBy}, ${"execute"}, ${"proposal"}, ${input.proposalId},
        ${result.summary}
      )
    `;
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukendt fejl";
    const failed: ExecutionResult = {
      status: "failed",
      summary: `Udførsel fejlede: ${message}`,
      data: {},
    };
    await sql`
      update action_executions
      set status = ${"failed"}, result = ${JSON.stringify(failed)}
      where id = ${execId}
    `;
    return failed;
  }
}

async function runAction(
  sql: Sql,
  type: ActionType,
  payload: JsonObject,
  proposalId: string,
): Promise<ExecutionResult> {
  switch (type) {
    case "log_internal_event": {
      const message = String(payload.message ?? "Intern testhandling").slice(0, 2000);
      await sql`
        insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
        values (${newId()}, ${"system"}, ${"internal_event"}, ${"proposal"}, ${proposalId}, ${message})
      `;
      return {
        status: "succeeded",
        summary: `Intern hændelse dokumenteret: ${message}`,
        data: { message },
      };
    }
    case "create_task": {
      const title = String(payload.title ?? "").trim();
      if (!title) throw new Error("Opgaven mangler titel.");
      const id = newId();
      await sql`
        insert into tasks (
          id, title, description, status, priority, source, entity, due_at, project_id, created_by
        ) values (
          ${id},
          ${title},
          ${String(payload.description ?? "")},
          ${"open"},
          ${String(payload.priority ?? "normal")},
          ${"leafy"},
          ${String(payload.entity ?? "platform")},
          ${payload.dueAt ? String(payload.dueAt) : null}::timestamptz,
          ${payload.projectId ? String(payload.projectId) : null},
          ${"leafy"}
        )
      `;
      return {
        status: "succeeded",
        summary: `Opgave oprettet: ${title}`,
        data: { taskId: id },
      };
    }
    case "save_report": {
      const content = String(payload.content ?? "").trim();
      if (!content) throw new Error("Rapporten er tom.");
      const week = String(payload.weekKey ?? isoWeekKey());
      const id = newId();
      await sql`
        insert into weekly_reports (id, week_key, content, status, created_by)
        values (${id}, ${week}, ${content}, ${"saved"}, ${"leafy"})
        on conflict (week_key) do update
          set content = excluded.content, status = ${"saved"}, created_by = ${"leafy"}
      `;
      return {
        status: "succeeded",
        summary: `Ugentlig status gemt for ${week}.`,
        data: { weekKey: week },
      };
    }
    case "draft_email": {
      const subject = String(payload.subject ?? "").trim();
      const body = String(payload.body ?? "").trim();
      if (!subject || !body) throw new Error("Mailkladden mangler emne eller indhold.");
      const id = newId();
      const recipient = payload.recipient ? String(payload.recipient) : null;
      await sql`
        insert into email_drafts (id, proposal_id, recipient, subject, body, status)
        values (${id}, ${proposalId}, ${recipient}, ${subject}, ${body}, ${"draft"})
      `;
      return {
        status: "succeeded",
        summary: `Mailkladde gemt (ikke sendt) til ${recipient ?? "ukendt modtager"}.`,
        data: { draftId: id, sent: false },
      };
    }
    case "external_unavailable":
      return {
        status: "succeeded",
        summary:
          "Ingen understøttet ekstern integration. Handlingen blev registreret, men intet blev sendt, betalt eller indberettet.",
        data: { executedExternally: false },
      };
    default:
      throw new Error("Ukendt handlingstype.");
  }
}
