import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAudit } from "@/lib/wl/fns";
import { formatWhen } from "@/components/wl/format";

export const Route = createFileRoute("/admin/audit")({ component: AuditPage });

function AuditPage() {
  const { data: rows = [] } = useQuery({ queryKey: ["audit"], queryFn: () => listAudit() });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Revisionslog</h1>
        <p className="text-sm text-muted-foreground">Hvem gjorde hvad, og hvad blev det faktiske resultat.</p>
      </div>
      <div className="overflow-x-auto rounded-xl bg-card shadow-(--shadow-card)">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs tracking-wide text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Tid</th>
              <th className="px-4 py-3">Handling</th>
              <th className="px-4 py-3">Mål</th>
              <th className="px-4 py-3">Detalje</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/70">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatWhen(r.createdAt)}</td>
                <td className="px-4 py-3 font-medium">{r.action}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.targetType} {r.targetId}</td>
                <td className="px-4 py-3">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
