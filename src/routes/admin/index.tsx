import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getDashboard, generateBriefing, getPlatformSnapshot } from "@/lib/wl/fns";
import { ENTITY_LABELS, can } from "@/lib/wl/access";
import { formatDkk } from "@/lib/wl/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatWhen, priorityLabel, priorityVariant } from "@/components/wl/format";
import { LeafyAvatar } from "@/components/wl/brand-mark";

export const Route = createFileRoute("/admin/")({ component: DashboardPage });

function DashboardPage() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const platform = useQuery({ queryKey: ["platform-snapshot"], queryFn: () => getPlatformSnapshot() });
  const gen = useMutation({
    mutationFn: () => generateBriefing(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Dagsbriefing opdateret.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke hente briefing."),
  });

  if (isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-32" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-destructive">Dashboardet kunne ikke indlæses.</p>;
  }

  const { profile, kpis } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">{data.todayLabel}</p>
          <h1 className="font-display text-3xl">{data.greeting}, {profile.displayName}</h1>
        </div>
        {can(profile.role, "run_routines") && (
          <Button variant="outline" onClick={() => gen.mutate()} disabled={gen.isPending}>
            {gen.isPending ? "Leafy skriver…" : "Opdater briefing med Grok"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-start gap-4">
          <LeafyAvatar size={64} />
          <div>
            <CardTitle>Dagsbriefing</CardTitle>
            <CardDescription>
              {data.briefing?.source === "leafy" ? "Skrevet af Leafy ud fra registrerede opgaver." : "Sammenfattet direkte fra dagsordenen — uden opdigtede tal."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-relaxed">{data.briefing?.content}</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Aktive medlemmer" value={String(kpis.activeMembers)} hint={`${kpis.newMembers} nye · ${kpis.leftMembers} udmeldte`} />
        <Kpi title="Salg (test)" value={formatDkk(kpis.salesOre)} hint={`${kpis.orders} ordrer`} />
        <Kpi title="WL-provision" value={formatDkk(kpis.commissionOre)} hint={`Medlemsbesparelse ${formatDkk(kpis.memberSavingsOre)}`} />
        <Kpi title="Åbne poster" value={String(kpis.openInvoices)} hint="Fakturaer, udgifter, provision" />
      </div>
      <p className="text-xs text-muted-foreground">{kpis.dataNote}</p>

      <Card>
        <CardHeader>
          <CardTitle>Platform</CardTitle>
          <CardDescription>Noder og status fra WeeLeaf — /api/command/snapshot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {platform.isPending && <p className="text-sm text-muted-foreground">Henter platformen…</p>}
          {platform.data && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={platform.data.ok ? "success" : "danger"}>{platform.data.statusLabel}</Badge>
                {platform.data.statusDetail && (
                  <span className="text-sm text-muted-foreground">{platform.data.statusDetail}</span>
                )}
              </div>
              {platform.data.nodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen noder fra platformen.</p>
              ) : (
                <ul className="space-y-2">
                  {platform.data.nodes.map((node) => (
                    <li key={node.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{node.label}</div>
                        {node.detail && <div className="text-xs text-muted-foreground">{node.detail}</div>}
                      </div>
                      <Badge variant="outline">{node.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {platform.error && (
            <p className="text-sm text-destructive">Platformstatus mangler.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Dagens opgaver</CardTitle>
              <CardDescription>Rutiner og åbne punkter</CardDescription>
            </div>
            <Link to="/admin/tasks" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Alle</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.todayTasks.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{ENTITY_LABELS[t.entity]} · {t.source}</div>
                </div>
                <Badge variant={priorityVariant(t.priority)}>{priorityLabel(t.priority)}</Badge>
              </div>
            ))}
            {data.todayTasks.length === 0 && <p className="text-sm text-muted-foreground">Ingen åbne opgaver.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Afventer godkendelse</CardTitle>
              <CardDescription>Leafys forslag</CardDescription>
            </div>
            <Link to="/admin/approvals" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Center</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.pendingProposals.map((p) => (
              <div key={p.id} className="rounded-lg bg-muted/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{p.title}</span>
                  <Badge variant={priorityVariant(p.priority)}>{priorityLabel(p.priority)}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              </div>
            ))}
            {data.pendingProposals.length === 0 && <p className="text-sm text-muted-foreground">Intet venter.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kommende frister</CardTitle>
            <CardDescription>Økonomi og myndighed — testdata indtil integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingDeadlines.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{d.title}</span>
                <span className="tabular text-muted-foreground">{formatDate(d.dueAt)}</span>
              </div>
            ))}
            {data.upcomingDeadlines.length === 0 && <p className="text-sm text-muted-foreground">Ingen frister registreret.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Seneste hændelser</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentEvents.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{e.action}</span>
                  {e.detail && <span className="block text-xs text-muted-foreground">{e.detail}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(e.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-1 font-display text-2xl tabular">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
