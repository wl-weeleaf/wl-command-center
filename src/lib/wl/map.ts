import type {
  ActionType,
  Entity,
  FinanceRow,
  Priority,
  ProposalRow,
  ProposalStatus,
  ShortcutCategory,
  TaskRow,
  TaskStatus,
} from "./types";
import { parseAttachments, parseJsonObject } from "./hash";
import { toDateOnly, toIso } from "./time";

export function mapTask(row: Record<string, unknown>): TaskRow {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    status: String(row.status) as TaskStatus,
    priority: String(row.priority) as Priority,
    source: String(row.source ?? "manual"),
    entity: String(row.entity ?? "platform") as Entity,
    assigneeUserId: row.assignee_user_id ? String(row.assignee_user_id) : null,
    dueAt: toIso(row.due_at),
    routineKey: row.routine_key ? String(row.routine_key) : null,
    routineDate: row.routine_date ? String(row.routine_date) : null,
    projectId: row.project_id ? String(row.project_id) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: toIso(row.created_at) ?? "",
  };
}

export function mapProposal(row: Record<string, unknown>): ProposalRow {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    priority: String(row.priority) as Priority,
    source: String(row.source ?? "leafy"),
    entity: String(row.entity ?? "platform") as Entity,
    assigneeUserId: row.assignee_user_id ? String(row.assignee_user_id) : null,
    actionType: String(row.action_type) as ActionType,
    actionPayload: parseJsonObject(String(row.action_payload ?? "{}")),
    payloadHash: String(row.payload_hash),
    rationale: String(row.rationale ?? ""),
    attachments: parseAttachments(String(row.attachments ?? "[]")),
    status: String(row.status) as ProposalStatus,
    createdBy: row.created_by ? String(row.created_by) : null,
    decidedBy: row.decided_by ? String(row.decided_by) : null,
    decidedAt: toIso(row.decided_at),
    decisionNote: row.decision_note ? String(row.decision_note) : null,
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
  };
}

export function mapFinance(row: Record<string, unknown>): FinanceRow {
  return {
    id: String(row.id),
    entity: String(row.entity) as Entity,
    kind: String(row.kind),
    title: String(row.title),
    amountOre: row.amount_ore == null ? null : Number(row.amount_ore),
    currency: String(row.currency ?? "DKK"),
    counterparty: row.counterparty ? String(row.counterparty) : null,
    status: String(row.status),
    dueAt: toDateOnly(row.due_at),
    notes: row.notes ? String(row.notes) : null,
    isTestData: Boolean(row.is_test_data),
  };
}

export function mapShortcut(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    url: String(row.url),
    category: String(row.category) as ShortcutCategory,
    ownerName: row.owner_name ? String(row.owner_name) : null,
    entity: row.entity ? (String(row.entity) as Entity) : null,
    integrationStatus: String(row.integration_status ?? "shortcut") as
      | "shortcut"
      | "connected"
      | "missing",
    notes: row.notes ? String(row.notes) : null,
    sortOrder: Number(row.sort_order ?? 0),
  };
}
