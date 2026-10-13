export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

export const ROLES = [
  "superadmin",
  "finance",
  "project",
  "tech",
  "reader",
  "pending",
] as const;
export type Role = (typeof ROLES)[number];

export const ENTITIES = ["forening", "enkeltmand", "aps", "platform"] as const;
export type Entity = (typeof ENTITIES)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_STATUSES = ["open", "doing", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PROPOSAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "deferred",
  "superseded",
  "executing",
  "executed",
  "failed",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const ACTION_TYPES = [
  "log_internal_event",
  "create_task",
  "save_report",
  "draft_email",
  "external_unavailable",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const SHORTCUT_CATEGORIES = [
  "offentligt",
  "okonomi",
  "administration",
  "platform",
  "kommunikation",
  "ai",
] as const;
export type ShortcutCategory = (typeof SHORTCUT_CATEGORIES)[number];

export type AdminProfile = {
  userId: string;
  email: string | null;
  displayName: string;
  role: Role;
  entity: Entity | null;
  imageUrl: string | null;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  source: string;
  entity: Entity;
  assigneeUserId: string | null;
  dueAt: string | null;
  routineKey: string | null;
  routineDate: string | null;
  projectId: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type ProposalRow = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  source: string;
  entity: Entity;
  assigneeUserId: string | null;
  actionType: ActionType;
  actionPayload: JsonObject;
  payloadHash: string;
  rationale: string;
  attachments: Array<{ name: string; url?: string }>;
  status: ProposalStatus;
  createdBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProposalEvent = {
  id: string;
  eventType: string;
  actorUserId: string | null;
  detail: string | null;
  createdAt: string;
};

export type ShortcutRow = {
  id: string;
  title: string;
  url: string;
  category: ShortcutCategory;
  ownerName: string | null;
  entity: Entity | null;
  integrationStatus: "shortcut" | "connected" | "missing";
  notes: string | null;
  sortOrder: number;
};

export type FinanceRow = {
  id: string;
  entity: Entity;
  kind: string;
  title: string;
  amountOre: number | null;
  currency: string;
  counterparty: string | null;
  status: string;
  dueAt: string | null;
  notes: string | null;
  isTestData: boolean;
};

export type MemberRow = {
  id: string;
  displayName: string;
  status: string;
  joinedAt: string | null;
  leftAt: string | null;
  contributionOre: number;
  isTestData: boolean;
};

export type OrderRow = {
  id: string;
  memberId: string | null;
  title: string;
  originalOre: number;
  paidOre: number;
  memberSavingsOre: number;
  wlCommissionOre: number;
  entity: Entity;
  status: string;
  orderedAt: string | null;
  isTestData: boolean;
};

export type ProjectRow = {
  id: string;
  title: string;
  summary: string;
  ownerName: string | null;
  status: string;
  nextAction: string | null;
  milestones: Array<{
    id: string;
    title: string;
    dueAt: string | null;
    status: string;
  }>;
};

export type AuditRow = {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposalId: string | null;
  createdAt: string;
};

export type DashboardSnapshot = {
  profile: AdminProfile;
  todayLabel: string;
  weekday: string;
  greeting: string;
  briefing: { content: string; source: string; briefingDate: string } | null;
  todayTasks: TaskRow[];
  pendingProposals: ProposalRow[];
  upcomingDeadlines: FinanceRow[];
  recentEvents: AuditRow[];
  kpis: {
    activeMembers: number;
    newMembers: number;
    leftMembers: number;
    orders: number;
    salesOre: number;
    commissionOre: number;
    memberSavingsOre: number;
    openInvoices: number;
    dataNote: string;
  };
  aiAvailable: boolean;
};
