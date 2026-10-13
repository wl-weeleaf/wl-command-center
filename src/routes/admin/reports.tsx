import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listReports } from "@/lib/wl/fns";
import { Badge } from "@/components/ui/badge";
import { formatWhen, statusLabel, statusVariant } from "@/components/wl/format";

export const Route = createFileRoute("/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const { data } = useQuery({ queryKey: ["reports"], queryFn: () => listReports() });
  const reports = data?.reports ?? [];
  const drafts = data?.emailDrafts ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Rapporter og kladder</h1>
        <p className="text-sm text-muted-foreground">
          Ugentlig WL/Leafy-status og godkendte mailkladder. Kladder sendes ikke automatisk.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Ugentlige statusrapporter</h2>
        {reports.length === 0 && <p className="text-sm text-muted-foreground">Ingen gemt rapport endnu. Bed Leafy om at forberede fredagsstatus, og godkend den.</p>}
        {reports.map((r) => (
          <article key={r.id} className="rounded-xl bg-card p-4 shadow-(--shadow-card)">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{r.weekKey}</h3>
              <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{r.content}</p>
            <p className="mt-2 text-xs text-muted-foreground">{formatWhen(r.createdAt)}</p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Mailkladder</h2>
        {drafts.length === 0 && <p className="text-sm text-muted-foreground">Ingen kladder. En godkendt TAMU-mail lander her — uden at blive sendt.</p>}
        {drafts.map((d) => (
          <article key={d.id} className="rounded-xl bg-card p-4 shadow-(--shadow-card)">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">{d.subject}</h3>
              <Badge>{d.status === "draft" ? "Kladde · ikke sendt" : d.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{d.recipient ?? "Uden modtager"}</p>
            <p className="mt-2 text-xs text-muted-foreground">{formatWhen(d.createdAt)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
