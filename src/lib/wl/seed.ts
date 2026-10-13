import type { Sql } from "@/lib/db";
import { split103020 } from "./money";
import { addDaysIso, copenhagenNow } from "./time";
import { newId, payloadHash } from "./hash";

export async function seedIfNeeded(sql: Sql) {
  const flag = await sql<{ value: string }>`select value from org_kv where key = ${"seeded"}`;
  if (flag[0]?.value === "1") return;

  const today = copenhagenNow().isoDate;
  const later = addDaysIso(today, 12);
  const soon = addDaysIso(today, 3);
  const week = addDaysIso(today, 7);

  const shortcuts: Array<[string, string, string, string, string, string, string]> = [
    ["skat", "SKAT", "https://www.skat.dk", "offentligt", "Nicki", "forening", "Genvej til skat.dk. Ingen integration."],
    ["virk", "Virk", "https://virk.dk", "offentligt", "Nicki", "enkeltmand", "Erhvervsportalen. Kun genvej."],
    ["digital-post", "Digital Post", "https://www.borger.dk", "offentligt", "Nicki", "forening", "Myndighedspost. Kun genvej."],
    ["mitid", "MitID Erhverv", "https://mitid.dk", "offentligt", "Nicki", "enkeltmand", "Identitet til erhverv. Kun genvej."],
    ["cvr", "CVR", "https://datacvr.virk.dk", "offentligt", "Nicki", "platform", "Virksomhedsregister. Kun genvej."],
    ["bank", "Bank", "#", "okonomi", "Nicki", "enkeltmand", "Bankintegration er ikke tilsluttet."],
    ["regnskab", "Regnskabssystem", "#", "okonomi", "Nicki", "enkeltmand", "Intet regnskabssystem er tilkoblet endnu. WL bogfører ikke selv."],
    ["fakturering", "Fakturering", "#", "okonomi", "Nicki", "enkeltmand", "Ingen faktureringsintegration."],
    ["betaling", "Betalingsløsninger", "#", "okonomi", "Nicki", "enkeltmand", "MobilePay/kort er ikke tilsluttet her."],
    ["mail", "Mail", "https://mail.google.com", "administration", "Nicki", "platform", "Indbakke. Kun genvej — Leafy læser ikke mail automatisk."],
    ["kalender", "Kalender", "https://calendar.google.com", "administration", "Nicki", "platform", "Kun genvej. Ingen kalenderintegration i v1."],
    ["arkiv", "Dokumentarkiv", "#", "administration", "Nicki", "platform", "Arkiv er ikke tilsluttet."],
    ["kontrakter", "Kontrakter", "#", "administration", "Nicki", "forening", "Kontraktarkiv mangler."],
    ["webshop", "WL-webshop", "https://weeleaf.com", "platform", "Nicki", "enkeltmand", "Offentlig shop. Ordredata her er testdata, indtil live-kilden tilkobles."],
    ["github", "GitHub", "https://github.com/filiptom888-lgtm/Weeleafv2", "platform", "Teknisk admin", "platform", "Eksisterende offentlig platform (Vite + PHP). Kun genvej."],
    ["hosting", "Hosting", "#", "platform", "Teknisk admin", "platform", "Hostinger/Vercel — kun genvej."],
    ["database", "Database", "#", "platform", "Teknisk admin", "platform", "Platformens MySQL er ikke tilkoblet Command Center endnu."],
    ["instagram", "Instagram", "https://www.instagram.com/weeleaf", "kommunikation", "Nicki", "platform", "Kun genvej."],
    ["facebook", "Facebook", "https://www.facebook.com/profile.php?id=61584251567563", "kommunikation", "Nicki", "platform", "Kun genvej."],
    ["x", "X", "https://x.com/weeleaf", "kommunikation", "Nicki", "platform", "Kun genvej."],
    ["xai", "xAI Console", "https://console.x.ai", "ai", "Teknisk admin", "platform", "Grok-nøglen ligger kun på serveren."],
    ["leafy", "Leafy", "/admin", "ai", "Nicki", "platform", "Leafy kører i Command Center med Grok som hjerne."],
    ["ollama", "Lokal Ollama", "#", "ai", "Teknisk admin", "platform", "Planlagt. Ikke tilsluttet i v1."],
  ];

  let sort = 0;
  for (const s of shortcuts) {
    const [id, title, url, category, owner, entity, notes] = s;
    await sql`
      insert into shortcuts (id, title, url, category, owner_name, entity, integration_status, notes, sort_order)
      values (${id}, ${title}, ${url}, ${category}, ${owner}, ${entity}, ${"shortcut"}, ${notes}, ${sort})
    `;
    sort += 1;
  }

  const projects = [
    {
      id: "tamu",
      title: "TAMU-tekstilpilot",
      summary: "Pilot med TAMU om cirkulære tekstiler og lokal produktion.",
      owner: "Nicki",
      status: "active",
      next: "Følg op på seneste mødereferat og afklar stofprøver.",
      milestones: [
        ["Aftale om prøveproduktion", soon, "open"],
        ["Første stofprøver modtaget", week, "open"],
      ],
    },
    {
      id: "life10",
      title: "Life 1.0 / Ydernæs",
      summary: "Bolig- og livsprojekt på Ydernæs. Mangler stadig flere afklaringer.",
      owner: "Nicki",
      status: "blocked",
      next: "Samle åbne spørgsmål til næste dialog.",
      milestones: [
        ["Ramme for dialog", today, "done"],
        ["Næste interessentmøde", later, "open"],
      ],
    },
    {
      id: "ibe",
      title: "IBE-boligdialog",
      summary: "Dialog om inkluderende boligformer.",
      owner: "Nicki",
      status: "planned",
      next: "Book opfølgning når kalender er afstemt.",
      milestones: [["Idékatalog", later, "open"]],
    },
    {
      id: "leafy-ai",
      title: "Leafy AI-udvikling",
      summary: "Grok som Leafys hjerne. Forbereder, mennesker godkender.",
      owner: "Teknisk admin",
      status: "active",
      next: "Test godkendelsesflowet med en intern testhandling.",
      milestones: [
        ["Grok-backend", today, "done"],
        ["Godkendelsescenter", today, "done"],
      ],
    },
    {
      id: "wl-platform",
      title: "WL-platformen",
      summary: "Eksisterende medlems- og shop-platform. Command Center er det administrative lag.",
      owner: "Teknisk admin",
      status: "active",
      next: "Planlæg første rigtige datakilde (medlemmer/ordrer) når aftaler er på plads.",
      milestones: [["Command Center MVP", today, "done"]],
    },
    {
      id: "partners",
      title: "Leverandører og partnerskaber",
      summary: "Hemp CPH og øvrige cirkulære partnere.",
      owner: "Nicki",
      status: "active",
      next: "Opdater partnerlisten og næste indkøbsvindue.",
      milestones: [["Partneroversigt", week, "open"]],
    },
    {
      id: "funding",
      title: "Fondsansøgninger og finansiering",
      summary: "Ansøgninger og finansieringsmuligheder til WL-projekter.",
      owner: "Nicki",
      status: "planned",
      next: "Udvælg 1–2 fonde til næste udkast.",
      milestones: [["Longlist fonde", later, "open"]],
    },
  ];

  for (const p of projects) {
    await sql`
      insert into projects (id, title, summary, owner_name, status, next_action)
      values (${p.id}, ${p.title}, ${p.summary}, ${p.owner}, ${p.status}, ${p.next})
    `;
    let i = 0;
    for (const [title, due, status] of p.milestones) {
      await sql`
        insert into milestones (id, project_id, title, due_at, status, sort_order)
        values (${newId()}, ${p.id}, ${title}, ${due}::date, ${status}, ${i})
      `;
      i += 1;
    }
  }

  const members = [
    ["m1", "Medlem A", "active", "2025-11-02", null, 20000],
    ["m2", "Medlem B", "active", "2026-01-14", null, 20000],
    ["m3", "Medlem C", "new", today, null, 0],
    ["m4", "Medlem D", "left", "2025-08-01", "2026-08-20", 0],
  ] as const;
  for (const [id, name, status, joined, left, ore] of members) {
    await sql`
      insert into members (id, display_name, status, joined_at, left_at, contribution_ore, is_test_data)
      values (${id}, ${name}, ${status}, ${joined}::date, ${left}::date, ${ore}, ${true})
    `;
  }

  const orderSpecs = [
    ["o1", "m1", "Hampedyne cover sæt", 189900],
    ["o2", "m2", "Håndklæder GOTS", 79900],
    ["o3", "m3", "Pudebetræk 2-pak", 34900],
  ] as const;
  for (const [id, memberId, title, original] of orderSpecs) {
    const split = split103020(original);
    await sql`
      insert into orders (
        id, member_id, title, original_ore, paid_ore, member_savings_ore, wl_commission_ore,
        entity, status, ordered_at, is_test_data
      ) values (
        ${id}, ${memberId}, ${title}, ${split.originalOre}, ${split.paidOre},
        ${split.memberSavingsOre}, ${split.wlCommissionOre}, ${"enkeltmand"}, ${"paid"},
        ${today}::date, ${true}
      )
    `;
  }

  await sql`
    insert into finance_records (
      id, entity, kind, title, amount_ore, counterparty, status, due_at, notes, is_test_data
    ) values
      (${"f1"}, ${"enkeltmand"}, ${"invoice"}, ${"Udkast: partnerfaktura Hemp CPH"}, ${129900}, ${"Hemp CPH"}, ${"draft"}, ${soon}::date, ${"Testdata. Ikke sendt."}, ${true}),
      (${"f2"}, ${"enkeltmand"}, ${"expense"}, ${"Webhosting"}, ${14900}, ${"Hostingudbyder"}, ${"open"}, ${soon}::date, ${"Testdata. Bilag mangler."}, ${true}),
      (${"f3"}, ${"forening"}, ${"membership"}, ${"Medlemsbidrag (test)"}, ${40000}, ${"Medlemmer"}, ${"received"}, ${today}::date, ${"Aggregeret testdata."}, ${true}),
      (${"f4"}, ${"forening"}, ${"donation"}, ${"Symbolsk støtte"}, ${300}, ${"Fællesskab"}, ${"received"}, ${today}::date, ${"Testdata."}, ${true}),
      (${"f5"}, ${"enkeltmand"}, ${"commission"}, ${"WL-provision (testordrer)"}, ${30470}, ${"Webshop"}, ${"open"}, ${week}::date, ${"10 % af oprindelig pris. Testdata."}, ${true}),
      (${"f6"}, ${"enkeltmand"}, ${"vat_deadline"}, ${"Momsangivelse"}, ${null}, ${"SKAT"}, ${"upcoming"}, ${later}::date, ${"Frist — ingen beløb endnu. Ingen indberetning uden godkendelse."}, ${true}),
      (${"f7"}, ${"aps"}, ${"liquidity"}, ${"WL ApS er ikke stiftet"}, ${null}, ${null}, ${"missing"}, ${null}::date, ${"Ingen data. Selskabet er planlagt, ikke oprettet."}, ${true})
  `;

  const testPayload = {
    message: "WL Command Center er online. Intern testhandling gennemført.",
    channel: "audit",
  };
  const testHash = payloadHash("log_internal_event", testPayload);
  const proposalId = "p-test-internal";
  await sql`
    insert into proposals (
      id, title, description, priority, source, entity, action_type, action_payload,
      payload_hash, rationale, status, created_by
    ) values (
      ${proposalId},
      ${"Log intern testhandling: Command Center online"},
      ${"Leafy foreslår at dokumentere, at Command Center er startet. Handlingen skriver kun i auditloggen — ingen ekstern udsendelse."},
      ${"normal"}, ${"leafy"}, ${"platform"}, ${"log_internal_event"},
      ${JSON.stringify(testPayload)}, ${testHash},
      ${"Giver et sikkert første godkendelsesflow, som kan testes både godkendt og afvist."},
      ${"pending"}, ${"leafy"}
    )
  `;
  await sql`
    insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
    values (${newId()}, ${proposalId}, ${"created"}, ${"leafy"}, ${"Oprettet som testdata til godkendelsesflowet."})
  `;

  const mailPayload = {
    recipient: "tamu@example.org",
    subject: "Opfølgning på TAMU-tekstilpilot",
    body: "Kære TAMU\n\nTak for sidst. Vi følger op på stofprøver og næste skridt i piloten.\n\nVenlig hilsen\nWeeLeaf",
  };
  const mailId = "p-tamu-mail";
  await sql`
    insert into proposals (
      id, title, description, priority, source, entity, action_type, action_payload,
      payload_hash, rationale, status, created_by
    ) values (
      ${mailId},
      ${"Forbered opfølgningsmail til TAMU"},
      ${"Kladde til opfølgning. Godkendes den, gemmes kladden — den sendes ikke automatisk."},
      ${"high"}, ${"leafy"}, ${"platform"}, ${"draft_email"},
      ${JSON.stringify(mailPayload)}, ${payloadHash("draft_email", mailPayload)},
      ${"Næste handling på TAMU-projektet er en konkret opfølgning."},
      ${"pending"}, ${"leafy"}
    )
  `;
  await sql`
    insert into proposal_events (id, proposal_id, event_type, actor_user_id, detail)
    values (${newId()}, ${mailId}, ${"created"}, ${"leafy"}, ${"Mailkladde afventer godkendelse."})
  `;

  await sql`
    insert into tasks (id, title, description, status, priority, source, entity, due_at, project_id, created_by)
    values
      (${"t-life"}, ${"Afklar blokeringer på Life 1.0"}, ${"Samle åbne spørgsmål til Ydernæs/Life 1.0 inden næste dialog."}, ${"open"}, ${"high"}, ${"manual"}, ${"platform"}, ${soon}::timestamptz, ${"life10"}, ${"system"}),
      (${"t-bilag"}, ${"Find manglende bilag for hosting"}, ${"Testdata: udgift til hosting mangler bilag."}, ${"open"}, ${"normal"}, ${"routine"}, ${"enkeltmand"}, ${soon}::timestamptz, ${null}, ${"system"})
  `;

  await sql`
    insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
    values
      (${newId()}, ${"system"}, ${"seed"}, ${"org"}, ${"wl"}, ${"Testdata indlæst til Command Center. Ikke live platformdata."})
  `;

  await sql`
    insert into org_kv (key, value) values (${"seeded"}, ${"1"})
    on conflict (key) do update set value = ${"1"}, updated_at = now()
  `;
}

type Routine = {
  key: string;
  title: string;
  description: string;
  weekday?: number;
  hour?: number;
  entity: string;
  priority: string;
};

const DAILY: Routine[] = [
  { key: "inbox", title: "Indbakke og nye henvendelser", description: "Gennemgå nye mails og formularer. Leafy forbereder — I beslutter.", entity: "platform", priority: "high" },
  { key: "calendar", title: "Kalender og møder", description: "Tjek dagens møder. Ingen kalenderintegration i v1 — manuel kontrol.", entity: "platform", priority: "normal" },
  { key: "receipts", title: "Manglende bilag", description: "Find udgifter uden bilag. Bogføring sker ikke her.", entity: "enkeltmand", priority: "normal" },
  { key: "payments", title: "Forfaldne betalinger", description: "Se åbne poster. Ingen betalinger uden godkendelse.", entity: "enkeltmand", priority: "high" },
  { key: "orders", title: "Nye ordrer og medlemshenvendelser", description: "Tjek shop og medlemskab. Data er testdata indtil live-kilden tilkobles.", entity: "enkeltmand", priority: "normal" },
  { key: "projects", title: "Afventede projektsvar", description: "Følg op på TAMU, Life 1.0 og partnere.", entity: "platform", priority: "normal" },
  { key: "ops", title: "Platformens driftsstatus", description: "Kort tjek af webshop, login og hosting.", entity: "platform", priority: "low" },
  { key: "deadlines", title: "Administrative frister", description: "Moms, indberetninger og myndighedsfrister. Ingen indberetning uden godkendelse.", entity: "forening", priority: "high" },
];

const WEEKLY: Routine[] = [
  { key: "mon-economy", title: "Mandag: Økonomi og ugeplan", description: "Ugens økonomi og prioritering.", weekday: 1, entity: "enkeltmand", priority: "high" },
  { key: "tue-partners", title: "Tirsdag: Partnere, TAMU og udvikling", description: "Partner- og udviklingsdag.", weekday: 2, entity: "platform", priority: "normal" },
  { key: "wed-members", title: "Onsdag: Medlemmer, webshop og platform", description: "Medlemskab og shop.", weekday: 3, entity: "enkeltmand", priority: "normal" },
  { key: "thu-projects", title: "Torsdag: Projekter og finansiering", description: "Life 1.0, fonde og milepæle.", weekday: 4, entity: "platform", priority: "normal" },
  { key: "fri-status", title: "Fredag: Ugentlig WL/Leafy-status kl. 15.00", description: "Statusrapport med milepæle, blokeringer, beslutninger og næste 3–5 handlinger.", weekday: 5, hour: 15, entity: "platform", priority: "high" },
];

export async function runDailyRoutines(sql: Sql) {
  const now = copenhagenNow();
  const created: string[] = [];

  const maybeInsert = async (r: Routine) => {
    const exists = await sql<{ id: string }>`
      select id from tasks where routine_key = ${r.key} and routine_date = ${now.isoDate}
    `;
    if (exists[0]) return;
    const id = `rtn-${r.key}-${now.isoDate}`;
    await sql`
      insert into tasks (
        id, title, description, status, priority, source, entity, due_at, routine_key, routine_date, created_by
      ) values (
        ${id}, ${r.title}, ${r.description}, ${"open"}, ${r.priority}, ${"routine"}, ${r.entity},
        ${now.isoDate}::date, ${r.key}, ${now.isoDate}, ${"leafy"}
      )
    `;
    created.push(id);
  };

  for (const r of DAILY) await maybeInsert(r);

  for (const r of WEEKLY) {
    if (r.weekday !== now.weekdayIndex) continue;
    if (r.hour != null && now.hour < r.hour) continue;
    await maybeInsert(r);
  }

  if (created.length) {
    await sql`
      insert into audit_log (id, actor_user_id, action, target_type, target_id, detail)
      values (${newId()}, ${"leafy"}, ${"routines"}, ${"task"}, ${now.isoDate}, ${`${created.length} rutineopgaver oprettet for ${now.isoDate}.`})
    `;
  }

  return { date: now.isoDate, created: created.length };
}
