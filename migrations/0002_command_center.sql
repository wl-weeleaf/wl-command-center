-- WL Command Center — organisation, opgaver, godkendelser, økonomi, projekter.
-- Org-data er delt mellem autoriserede administratorer. Adgang styres i
-- admin_users + server-side rollecheck (ikke via skjulte knapper).

create table if not exists org_kv (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists admin_users (
  user_id text primary key,
  email text,
  display_name text not null,
  role text not null,
  entity text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);
create index if not exists admin_users_role_idx on admin_users (role);

create table if not exists tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  status text not null default 'open',
  priority text not null default 'normal',
  source text not null default 'manual',
  entity text not null default 'platform',
  assignee_user_id text,
  due_at timestamptz,
  routine_key text,
  routine_date text,
  project_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tasks_routine_unique
  on tasks (routine_key, routine_date)
  where routine_key is not null and routine_date is not null;
create index if not exists tasks_status_due_idx on tasks (status, due_at);

create table if not exists proposals (
  id text primary key,
  title text not null,
  description text not null,
  priority text not null default 'normal',
  source text not null default 'leafy',
  entity text not null default 'platform',
  assignee_user_id text,
  action_type text not null,
  action_payload text not null default '{}',
  payload_hash text not null,
  rationale text not null default '',
  attachments text not null default '[]',
  status text not null default 'pending',
  created_by text,
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposals_status_idx on proposals (status, created_at desc);

create table if not exists proposal_events (
  id text primary key,
  proposal_id text not null references proposals(id) on delete cascade,
  event_type text not null,
  actor_user_id text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists proposal_events_proposal_idx on proposal_events (proposal_id, created_at);

create table if not exists action_executions (
  id text primary key,
  proposal_id text not null,
  action_type text not null,
  payload_hash text not null,
  status text not null,
  result text not null default '{}',
  executed_by text,
  executed_at timestamptz not null default now(),
  unique (proposal_id, payload_hash)
);

create table if not exists shortcuts (
  id text primary key,
  title text not null,
  url text not null,
  category text not null,
  owner_name text,
  entity text,
  integration_status text not null default 'shortcut',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists finance_records (
  id text primary key,
  entity text not null,
  kind text not null,
  title text not null,
  amount_ore integer,
  currency text not null default 'DKK',
  counterparty text,
  status text not null default 'open',
  due_at date,
  notes text,
  is_test_data boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists finance_entity_idx on finance_records (entity, kind);

create table if not exists members (
  id text primary key,
  display_name text not null,
  status text not null,
  joined_at date,
  left_at date,
  contribution_ore integer not null default 0,
  is_test_data boolean not null default true
);

create table if not exists orders (
  id text primary key,
  member_id text,
  title text not null,
  original_ore integer not null,
  paid_ore integer not null,
  member_savings_ore integer not null,
  wl_commission_ore integer not null,
  entity text not null default 'enkeltmand',
  status text not null default 'paid',
  ordered_at date,
  is_test_data boolean not null default true
);

create table if not exists projects (
  id text primary key,
  title text not null,
  summary text not null,
  owner_name text,
  status text not null,
  next_action text,
  updated_at timestamptz not null default now()
);

create table if not exists milestones (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  title text not null,
  due_at date,
  status text not null default 'open',
  sort_order integer not null default 0
);

create table if not exists audit_log (
  id text primary key,
  actor_user_id text,
  action text not null,
  target_type text,
  target_id text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

create table if not exists chat_messages (
  id text primary key,
  user_id text not null,
  role text not null,
  content text not null,
  proposal_id text,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on chat_messages (user_id, created_at);

create table if not exists briefings (
  id text primary key,
  briefing_date text not null unique,
  content text not null,
  source text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists weekly_reports (
  id text primary key,
  week_key text not null unique,
  content text not null,
  status text not null default 'draft',
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists email_drafts (
  id text primary key,
  proposal_id text,
  recipient text,
  subject text not null,
  body text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
