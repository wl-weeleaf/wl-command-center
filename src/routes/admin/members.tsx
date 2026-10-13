import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMembersAndOrders } from "@/lib/wl/fns";
import { formatDkk } from "@/lib/wl/money";
import { Badge } from "@/components/ui/badge";
import { formatDate, statusLabel, statusVariant } from "@/components/wl/format";

export const Route = createFileRoute("/admin/members")({ component: MembersPage });

function MembersPage() {
  const { data } = useQuery({ queryKey: ["members"], queryFn: () => listMembersAndOrders() });
  const members = data?.members ?? [];
  const orders = data?.orders ?? [];
  const commission = orders.reduce((s, o) => s + o.wlCommissionOre, 0);
  const savings = orders.reduce((s, o) => s + o.memberSavingsOre, 0);
  const sales = orders.reduce((s, o) => s + o.paidOre, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Medlemmer og ordrer</h1>
        <p className="text-sm text-muted-foreground">{data?.note}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Omsætning" value={formatDkk(sales)} />
        <Stat label="WL-provision (10 %)" value={formatDkk(commission)} />
        <Stat label="Medlemsbesparelse (20 %)" value={formatDkk(savings)} />
      </div>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Medlemmer</h2>
        {members.map((m) => (
          <article key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 shadow-(--shadow-card)">
            <div>
              <h3 className="font-medium">{m.displayName}</h3>
              <p className="text-xs text-muted-foreground">
                Indmeldt {formatDate(m.joinedAt)}
                {m.leftAt ? ` · udmeldt ${formatDate(m.leftAt)}` : ""}
              </p>
            </div>
            <div className="text-right">
              <Badge variant={statusVariant(m.status)}>{statusLabel(m.status)}</Badge>
              <p className="mt-1 text-xs tabular text-muted-foreground">bidrag {formatDkk(m.contributionOre)}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Ordrer · 10–20–30</h2>
        {orders.map((o) => (
          <article key={o.id} className="rounded-xl bg-card p-4 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{o.title}</h3>
              <span className="text-xs text-muted-foreground">{formatDate(o.orderedAt)}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Oprindelig</dt><dd className="tabular">{formatDkk(o.originalOre)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Betalt</dt><dd className="tabular">{formatDkk(o.paidOre)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Medlem 20 %</dt><dd className="tabular">{formatDkk(o.memberSavingsOre)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">WL 10 %</dt><dd className="tabular">{formatDkk(o.wlCommissionOre)}</dd></div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-(--shadow-card)">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular">{value}</p>
    </div>
  );
}
