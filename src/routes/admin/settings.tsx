import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { envStatus } from "@/lib/wl/fns";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data } = useQuery({ queryKey: ["env"], queryFn: () => envStatus() });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Indstillinger og ansvar</h1>
        <p className="text-sm text-muted-foreground">Nøgler ligger på serveren. Aldrig i browseren, GitHub eller chat.</p>
      </div>

      <section className="rounded-xl bg-card p-5 shadow-(--shadow-card)">
        <h2 className="font-display text-xl">Kørsel</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Grok / xAI</dt>
            <dd className="mt-1 flex items-center gap-2">
              <Badge variant={data?.aiAvailable ? "success" : "danger"}>
                {data?.aiAvailable ? "Tilgængelig" : "Ikke tilgængelig"}
              </Badge>
              <span className="tabular">{data?.model}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tidszone</dt>
            <dd className="mt-1">{data?.timezone}</dd>
          </div>
        </dl>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">XAI_API_KEY</span> — server, injiceret af platformen. Bruges kun i backend-servicen til Leafy.
          </p>
          <p>
            <span className="font-medium text-foreground">XAI_MODEL</span> — valgfri. Standard er grok-4.5. Skift uden kodeændring.
          </p>
          <p>
            <span className="font-medium text-foreground">DATABASE_URL</span> — Postgres i produktion, lokal database i forhåndsvisning.
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-card p-5 shadow-(--shadow-card) space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-xl">Data og GDPR</h2>
        <p>
          Første version bruger testdata for medlemmer, ordrer og økonomi. Den eksisterende WeeLeaf-platform (Vite, PHP og MySQL) er ikke tilkoblet som live-kilde endnu.
        </p>
        <p>
          Personoplysninger, løn og bankdetaljer sendes ikke til Grok. Leafy får et afgrænset udsnit: opgavetitler, projektstatus og aggregerede tal.
        </p>
        <p>
          Grok har ikke direkte databaseadgang. Function calling går gennem vores integrationslag, og eksterne handlinger kræver godkendelse. En godkendelse logges først som udført, når backend har kørt handlingen og gemt resultatet.
        </p>
        <p>
          Backup: skemaet ligger i migreringer og kan genskabes. Produktion bruger den provisionerede database.
        </p>
      </section>
    </div>
  );
}
