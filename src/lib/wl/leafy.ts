import { z } from "zod";
import type { Sql } from "@/lib/db";
import { ACTION_TYPES, ENTITIES, PRIORITIES, type ActionType, type Entity, type JsonObject, type Priority } from "./types";
import { newId, payloadHash, isActionType } from "./hash";
import { mapProposal } from "./map";

const MODEL = process.env.XAI_MODEL?.trim() || "grok-4.5";
const API_BASE = "https://api.x.ai/v1";

export function aiAvailable() {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

const ProposalTool = z.object({
  title: z.string().min(3).max(180),
  description: z.string().min(8).max(4000),
  priority: z.enum(PRIORITIES).default("normal"),
  entity: z.enum(ENTITIES).default("platform"),
  action_type: z.enum(ACTION_TYPES),
  rationale: z.string().min(8).max(2000),
  action_payload: z.record(z.string(), z.any()).default({}),
});

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_proposal",
      description:
        "Opret et struktureret administrativt forslag i godkendelsescenteret. Brug altid dette når brugeren beder om en handling, mailkladde, opgave eller anbefaling der kræver menneskelig godkendelse. Udfør aldrig handlingen selv.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: PRIORITIES },
          entity: { type: "string", enum: ENTITIES },
          action_type: {
            type: "string",
            enum: ACTION_TYPES,
            description:
              "log_internal_event = intern log. create_task = opret opgave efter godkendelse. save_report = gem ugestatus. draft_email = gem mailkladde (sendes ikke). external_unavailable = handling uden integration.",
          },
          rationale: { type: "string" },
          action_payload: { type: "object" },
        },
        required: [
          "title",
          "description",
          "priority",
          "entity",
          "action_type",
          "rationale",
        ],
      },
    },
  },
];

type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string; name?: string; tool_call_id?: string; tool_calls?: unknown };

export async function leafyChat(input: {
  sql: Sql;
  userId: string;
  displayName: string;
  orgContext: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  allowProposals?: boolean;
}): Promise<{ text: string; proposalIds: string[] }> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: "Leafys hjerne (Grok) er ikke tilgængelig i dette miljø. Du kan stadig oprette forslag manuelt i godkendelsescenteret.",
      proposalIds: [],
    };
  }

  const system = `Du er Leafy, WeeLeafs (WL) administrative AI-assistent.
Sprog: dansk. Tone: hjælpsom, kortfattet, nysgerrig og professionel. Ingen emoji.

WeeLeaf arbejder med cirkulær økonomi, bæredygtig produktion, selvforsyning og social inklusion.
10–20–30-modellen: 30 % rabat på oprindelig pris fordeles som 20 % besparelse til medlemmet og 10 % provision til WL.

Hovedprincip: Du FORBEREDER. Mennesker GODKENDER.
- Du må ikke gennemføre eksterne betalinger, underskrive, indberette til myndigheder eller sende eksterne beskeder.
- Når du foreslår en handling, SKAL du kalde create_proposal.
- Påstå aldrig at en handling er udført. En godkendelse er ikke udførsel.
- Brug kun faktiske data fra konteksten. Find ikke på tal, medlemmer, fakturaer eller frister.
- Hvis data mangler, sig det tydeligt.
- Følsomme bank-, løn- og personoplysninger sendes ikke til dig i fuld form. Respekter det.
- Administrator hedder ${input.displayName}.

Tilgængeligt organisationsudsnit:
${input.orgContext}`;

  const messages: ChatMsg[] = [
    { role: "system", content: system },
    ...input.history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.userMessage },
  ];

  const proposalIds: string[] = [];
  let lastText = "";

  for (let round = 0; round < 4; round += 1) {
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: input.allowProposals === false ? undefined : TOOLS,
        tool_choice: input.allowProposals === false ? undefined : "auto",
        temperature: 0.4,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Grok API-fejl ${res.status}${errText ? `: ${errText.slice(0, 180)}` : ""}`);
    }

    const body = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };
    const msg = body.choices?.[0]?.message;
    if (!msg) throw new Error("Grok returnerede et tomt svar.");

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      lastText = (msg.content ?? "").trim();
      break;
    }

    messages.push({
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: toolCalls,
    } as ChatMsg);

    for (const call of toolCalls) {
      if (call.function.name !== "create_proposal") {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: "Ukendt værktøj." }),
        });
        continue;
      }
      const created = await createProposalFromTool(input.sql, call.function.arguments, input.userId);
      if (created.ok) proposalIds.push(created.id);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(created),
      });
    }
  }

  if (!lastText) {
    lastText = proposalIds.length
      ? "Jeg har lagt et konkret forslag i godkendelsescenteret. Det udføres først, når en administrator har godkendt det."
      : "Jeg kunne ikke danne et sikkert svar. Prøv at omformulere.";
  }
  return { text: lastText, proposalIds };
}

async function createProposalFromTool(sql: Sql, rawArgs: string, userId: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    return { ok: false as const, error: "Ugyldigt JSON fra modellen." };
  }
  const result = ProposalTool.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false as const,
      error: "Forslaget manglede påkrævede felter og blev afvist.",
      issues: result.error.issues.map((i) => i.message),
    };
  }
  const data = result.data;
  if (!isActionType(data.action_type)) {
    return { ok: false as const, error: "Handlingstypen er ikke tilladt." };
  }

  const payload = sanitizePayload(data.action_type, data.action_payload as JsonObject);
  const id = newId();
  const hash = payloadHash(data.action_type, payload);
  await sql`
    insert into proposals (
      id, title, description, priority, source, entity, assignee_user_id,
      action_type, action_payload, payload_hash, rationale, status, created_by
    ) values (
      ${id}, ${data.title}, ${data.description}, ${data.priority}, ${"leafy"},
      ${data.entity}, ${userId}, ${data.action_type}, ${JSON.stringify(payload)},
      ${hash}, ${data.rationale}, ${"pending"}, ${userId}
    )
  `;
  await sql`
    insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
    values (${newId()}, ${id}, ${"created"}, ${userId}, ${"Oprettet af Leafy via Grok."})
  `;
  await sql`
    insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
    values (${newId()}, ${userId}, ${"proposal_created"}, ${"proposal"}, ${id}, ${data.title})
  `;
  const rows = await sql<Record<string, unknown>>`select * from proposals where id = ${id}`;
  return { ok: true as const, id, proposal: mapProposal(rows[0] ?? { id }) };
}

function sanitizePayload(type: ActionType, payload: JsonObject): JsonObject {
  const pick = (...keys: string[]): JsonObject => {
    const out: JsonObject = {};
    for (const k of keys) if (payload[k] != null) out[k] = payload[k];
    return out;
  };
  switch (type) {
    case "log_internal_event":
      return { message: String(payload.message ?? payload.title ?? "Intern hændelse").slice(0, 2000) };
    case "create_task":
      return pick("title", "description", "priority", "entity", "dueAt", "projectId");
    case "save_report":
      return pick("content", "weekKey");
    case "draft_email":
      return pick("recipient", "subject", "body");
    case "external_unavailable":
      return pick("wanted", "note");
    default:
      return {};
  }
}

export async function leafyBriefing(input: {
  displayName: string;
  snapshotText: string;
}): Promise<string> {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AI is not available in this environment");
  }
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "Du er Leafy. Skriv en kort dagsbriefing på dansk (maks 120 ord) ud fra de faktiske opgaver. Ingen emoji. Ingen opdigtede tal. Start med en hilsen til administratoren.",
        },
        {
          role: "user",
          content: `Administrator: ${input.displayName}\n\n${input.snapshotText}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Grok API-fejl ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Tom briefing fra Grok.");
  return text;
}

export { type Priority, type Entity };
