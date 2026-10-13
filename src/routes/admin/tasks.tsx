import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createTask, getSessionProfile, listTasks, updateTaskStatus } from "@/lib/wl/fns";
import { ENTITY_LABELS, can } from "@/lib/wl/access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, priorityLabel, priorityVariant, statusLabel, statusVariant } from "@/components/wl/format";

export const Route = createFileRoute("/admin/tasks")({ component: TasksPage });

function TasksPage() {
  const qc = useQueryClient();
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: () => getSessionProfile() });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => listTasks() });
  const role = profileData?.profile.role ?? "reader";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () => createTask({ data: { title, description } }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Opgave oprettet.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke oprette."),
  });
  const update = useMutation({
    mutationFn: (input: { id: string; status: "open" | "doing" | "done" | "cancelled" }) =>
      updateTaskStatus({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Opgaver</h1>
        <p className="text-sm text-muted-foreground">Daglige rutiner i Europe/Copenhagen plus manuelle punkter.</p>
      </div>

      {can(role, "write_tasks") && (
        <form
          className="grid gap-2 rounded-xl bg-card p-4 shadow-(--shadow-card) md:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input required placeholder="Ny opgave" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea rows={1} placeholder="Beskrivelse" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit" disabled={create.isPending}>Tilføj</Button>
        </form>
      )}

      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className="rounded-xl bg-card p-4 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{t.title}</h2>
              <Badge variant={statusVariant(t.status)}>{statusLabel(t.status)}</Badge>
              <Badge variant={priorityVariant(t.priority)}>{priorityLabel(t.priority)}</Badge>
            </div>
            {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {ENTITY_LABELS[t.entity]} · {t.source}
              {t.dueAt ? ` · ${formatDate(t.dueAt)}` : ""}
            </p>
            {can(role, "write_tasks") && t.status !== "done" && t.status !== "cancelled" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {t.status !== "doing" && (
                  <Button size="sm" variant="outline" onClick={() => update.mutate({ id: t.id, status: "doing" })}>I gang</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => update.mutate({ id: t.id, status: "done" })}>Udført</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
