import type { Sql } from "@/lib/db";
import { formatDkk } from "./money";
import { copenhagenNow } from "./time";
import { ENTITY_LABELS } from "./access";

export async function buildOrgContext(sql: Sql) {
  const now = copenhagenNow();
  const tasks = await sql<{ title: string; priority: string; status: string; due_at: unknown }>`
    select title, priority, status, due_at from tasks
    where status in ('open', 'doing')
    order by
      case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
      due_at nulls last
    limit 20
  `;
  const proposals = await sql<{ title: string; status: string; priority: string; action_type: string }>`
    select title, status, priority, action_type from proposals
    where status = 'pending'
    order by created_at desc
    limit 15
  `;
  const projects = await sql<{ title: string; status: string; next_action: string | null }>`
    select title, status, next_action from projects order by title
  `;
  const deadlines = await sql<{ title: string; entity: string; due_at: unknown; kind: string }>`
    select title, entity, due_at, kind from finance_records
    where due_at is not null and status in ('open', 'upcoming', 'draft')
    order by due_at
    limit 10
  `;
  const members = await sql<{ status: string; n: number }>`
    select status, count(*)::int as n from members group by status
  `;
  const orders = await sql<{
    sales: number;
    commission: number;
    savings: number;
    n: number;
  }>`
    select
      coalesce(sum(paid_ore), 0)::int as sales,
      coalesce(sum(wl_commission_ore), 0)::int as commission,
      coalesce(sum(member_savings_ore), 0)::int as savings,
      count(*)::int as n
    from orders
  `;
  const o = orders[0];

  const memberLine = members.map((m) => `${m.status}: ${m.n}`).join(", ") || "ingen";

  return [
    `Dato (Europe/Copenhagen): ${now.isoDate} ${now.weekday} kl. ${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`,
    `Åbne opgaver:\n${tasks.map((t) => `- [${t.priority}] ${t.title} (${t.status})`).join("\n") || "- ingen"}`,
    `Afventer godkendelse:\n${proposals.map((p) => `- [${p.priority}] ${p.title} (${p.action_type})`).join("\n") || "- ingen"}`,
    `Projekter:\n${projects.map((p) => `- ${p.title} [${p.status}] næste: ${p.next_action ?? "—"}`).join("\n")}`,
    `Frister:\n${deadlines.map((d) => `- ${d.title} (${ENTITY_LABELS[d.entity] ?? d.entity}) ${String(d.due_at).slice(0, 10)}`).join("\n") || "- ingen"}`,
    `Medlemmer (testdata): ${memberLine}`,
    `Ordrer testdata: ${o?.n ?? 0} stk, omsætning ${formatDkk(o?.sales ?? 0)}, provision ${formatDkk(o?.commission ?? 0)}, medlemsbesparelse ${formatDkk(o?.savings ?? 0)}`,
    `Bemærk: økonomi- og medlemsdata er testdata, indtil live-kilder er tilkoblet. WL ApS er ikke stiftet.`,
  ].join("\n\n");
}

export function deterministicBriefing(name: string, input: {
  weekday: string;
  dateLabel: string;
  greeting: string;
  taskCount: number;
  pendingCount: number;
  deadlineCount: number;
  tasks: string[];
}) {
  const lines = [
    `${input.greeting}, ${name}. Her er de opgaver, der kræver din opmærksomhed i dag.`,
    `${input.dateLabel}.`,
    input.taskCount
      ? `${input.taskCount} åbne opgaver i dag, heriblandt: ${input.tasks.slice(0, 4).join("; ")}.`
      : "Ingen åbne opgaver er registreret endnu.",
    input.pendingCount
      ? `${input.pendingCount} forslag venter på godkendelse.`
      : "Ingen forslag venter på godkendelse.",
    input.deadlineCount
      ? `${input.deadlineCount} kommende frister i økonomioversigten.`
      : "Ingen registrerede frister.",
    "Leafy forbereder. I godkender.",
  ];
  return lines.join(" ");
}
