import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getSessionProfile, listProjects, updateProject } from "@/lib/wl/fns";
import { can } from "@/lib/wl/access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, statusLabel, statusVariant } from "@/components/wl/format";

export const Route = createFileRoute("/admin/projects")({ component: ProjectsPage });

function ProjectsPage() {
  const qc = useQueryClient();
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: () => getSessionProfile() });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const role = profileData?.profile.role ?? "reader";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Projekter</h1>
        <p className="text-sm text-muted-foreground">Milepæle, status og næste handling. Leafy kan forberede opfølgning — I godkender.</p>
      </div>
      <div className="grid gap-4">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            canEdit={can(role, "write_projects")}
            onSaved={() => {
              void qc.invalidateQueries({ queryKey: ["projects"] });
              toast.success("Projekt opdateret.");
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  canEdit,
  onSaved,
}: {
  project: {
    id: string;
    title: string;
    summary: string;
    ownerName: string | null;
    status: string;
    nextAction: string | null;
    milestones: Array<{ id: string; title: string; dueAt: string | null; status: string }>;
  };
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [next, setNext] = useState(project.nextAction ?? "");
  const [status, setStatus] = useState(project.status);
  const save = useMutation({
    mutationFn: () => updateProject({ data: { id: project.id, nextAction: next, status } }),
    onSuccess: onSaved,
  });
  return (
    <article className="rounded-xl bg-card p-5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">{project.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{project.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">Ansvarlig: {project.ownerName ?? "—"}</p>
        </div>
        <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
      </div>
      <ul className="mt-4 space-y-1 text-sm">
        {project.milestones.map((m) => (
          <li key={m.id} className="flex justify-between gap-3">
            <span>{m.title}</span>
            <span className="text-xs text-muted-foreground">{formatDate(m.dueAt)} · {statusLabel(m.status)}</span>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Input value={next} onChange={(e) => setNext(e.target.value)} placeholder="Næste handling" />
          <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Aktiv</option>
            <option value="blocked">Blokeret</option>
            <option value="planned">Planlagt</option>
            <option value="done">Færdig</option>
          </select>
          <Button type="submit" disabled={save.isPending}>Gem</Button>
        </form>
      )}
    </article>
  );
}
