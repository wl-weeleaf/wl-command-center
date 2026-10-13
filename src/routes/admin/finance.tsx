import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listFinance } from "@/lib/wl/fns";
import { ENTITY_LABELS } from "@/lib/wl/access";
import { ENTITIES } from "@/lib/wl/types";
import { formatDkk } from "@/lib/wl/money";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, statusLabel, statusVariant } from "@/components/wl/format";

export const Route = createFileRoute("/admin/finance")({ component: FinancePage });

const KINDS: Record<string, string> = {
  invoice: "Faktura",
  receipt: "Bilag",
  payment: "Betaling",
  expense: "Udgift",
  liquidity: "Likviditet",
  commission: "WL-provision",
  donation: "Donation",
  membership: "Medlemsbidrag",
  vat_deadline: "Moms/frist",
};

function FinancePage() {
  const { data } = useQuery({ queryKey: ["finance"], queryFn: () => listFinance() });
  const records = data?.records ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Økonomi</h1>
        <p className="text-sm text-muted-foreground">
          Adskilt pr. juridisk enhed. Command Center er ikke et bogføringssystem — poster her er testdata, indtil et regnskabssystem tilkobles.
        </p>
      </div>
      {data?.note && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{data.note}</p>}

      <Tabs defaultValue="enkeltmand">
        <TabsList>
          {ENTITIES.filter((e) => e !== "platform").map((e) => (
            <TabsTrigger key={e} value={e}>{ENTITY_LABELS[e]}</TabsTrigger>
          ))}
        </TabsList>
        {ENTITIES.filter((e) => e !== "platform").map((e) => {
          const rows = records.filter((r) => r.entity === e);
          return (
            <TabsContent key={e} value={e} className="space-y-3">
              {e === "aps" && (
                <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
                  WL ApS er ikke stiftet. Ingen likviditet, fakturaer eller momsdata.
                </p>
              )}
              {rows.length === 0 && e !== "aps" && (
                <p className="text-sm text-muted-foreground">Ingen poster. Oplysningerne mangler, indtil integrationen er på plads.</p>
              )}
              {rows.map((r) => (
                <article key={r.id} className="rounded-xl bg-card p-4 shadow-(--shadow-card)">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{KINDS[r.kind] ?? r.kind}</p>
                      <h2 className="font-medium">{r.title}</h2>
                    </div>
                    <p className="font-display text-xl tabular">{formatDkk(r.amountOre)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                    {r.counterparty && <span>{r.counterparty}</span>}
                    {r.dueAt && <span>frist {formatDate(r.dueAt)}</span>}
                    {r.isTestData && <span>testdata</span>}
                  </div>
                  {r.notes && <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p>}
                </article>
              ))}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
