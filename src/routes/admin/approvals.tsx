import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createProposalManual,
  decideProposal,
  editProposal,
  getProposal,
  listAdmins,
  listProposals,
} from "@/lib/wl/fns";
import { ACTION_LABELS, ENTITY_LABELS, can } from "@/lib/wl/access";
import { ACTION_TYPES, ENTITIES, PRIORITIES, type ActionType, type Entity, type JsonObject, type Priority, type ProposalRow } from "@/lib/wl/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen, priorityLabel, priorityVariant, statusLabel, statusVariant } from "@/components/wl/format";
import { getSessionProfile } from "@/lib/wl/fns";

export const Route = createFileRoute("/admin/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const qc = useQueryClient();
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: () => getSessionProfile() });
  const { data: proposals = [] } = useQuery({ queryKey: ["proposals"], queryFn: () => listProposals() });
  const { data: admins = [] } = useQuery({ queryKey: ["admins"], queryFn: () => listAdmins() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const role = profileData?.profile.role ?? "reader";

  const selected = useMemo(
    () => proposals.find((p) => p.id === selectedId) ?? null,
    [proposals, selectedId],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Godkendelsescenter</h1>
          <p className="text-sm text-muted-foreground">Leafy forbereder. En handling udføres først efter godkendelse og et konkret resultat.</p>
        </div>
        {can(role, "propose") && (
          <Button onClick={() => setCreating(true)}>Nyt forslag</Button>
        )}
      </div>

      <div className="grid gap-3">
        {proposals.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedId(p.id)}
            className="rounded-xl bg-card p-4 text-left shadow-(--shadow-card) hover:bg-muted/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{p.title}</h2>
              <Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>
              <Badge variant={priorityVariant(p.priority)}>{priorityLabel(p.priority)}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {ENTITY_LABELS[p.entity]} · {ACTION_LABELS[p.actionType] ?? p.actionType} · {formatWhen(p.createdAt)}
            </p>
          </button>
        ))}
        {proposals.length === 0 && <p className="text-sm text-muted-foreground">Ingen forslag endnu.</p>}
      </div>

      <ProposalDialog
        id={selectedId}
        fallback={selected}
        open={Boolean(selectedId)}
        onOpenChange={(o) => !o && setSelectedId(null)}
        canDecide={can(role, "decide")}
        admins={admins}
        onChanged={() => {
          void qc.invalidateQueries({ queryKey: ["proposals"] });
          void qc.invalidateQueries({ queryKey: ["dashboard"] });
          void qc.invalidateQueries({ queryKey: ["tasks"] });
          void qc.invalidateQueries({ queryKey: ["reports"] });
        }}
      />

      <CreateDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["proposals"] });
          setCreating(false);
        }}
      />
    </div>
  );
}

function ProposalDialog({
  id,
  fallback,
  open,
  onOpenChange,
  canDecide,
  admins,
  onChanged,
}: {
  id: string | null;
  fallback: ProposalRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canDecide: boolean;
  admins: Array<{ userId: string; displayName: string }>;
  onChanged: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["proposal", id],
    queryFn: () => getProposal({ data: id as string }),
    enabled: Boolean(id),
  });
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const p = data?.proposal ?? fallback;
  useEffect(() => {
    setNote("");
    setEditing(false);
  }, [id]);
  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject" | "defer") =>
      decideProposal({ data: { id: p!.id, decision, note } }),
    onSuccess: (res) => {
      toast.success(
        res.status === "executed"
          ? `Gennemført: ${res.result?.summary ?? "Handling udført."}`
          : res.status === "rejected"
            ? "Forslaget er afvist. Intet blev udført."
            : res.status === "deferred"
              ? "Udsat."
              : "Godkendt.",
      );
      onChanged();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Handlingen kunne ikke gennemføres."),
  });

  if (!p) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          <DialogDescription>
            {ENTITY_LABELS[p.entity]} · {ACTION_LABELS[p.actionType]} · {statusLabel(p.status)}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <EditForm
            proposal={p}
            onDone={(needs) => {
              setEditing(false);
              onChanged();
              toast.success(needs ? "Ændringen kræver ny godkendelse." : "Forslaget er opdateret.");
            }}
          />
        ) : (
          <div className="space-y-4 text-sm">
            <p className="leading-relaxed">{p.description}</p>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Begrundelse</p>
              <p className="mt-1">{p.rationale}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Foreslået handling</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify({ type: p.actionType, ...p.actionPayload }, null, 2)}
              </pre>
            </div>
            {p.attachments.length > 0 && (
              <ul className="text-xs">{p.attachments.map((a) => <li key={a.name}>{a.name}</li>)}</ul>
            )}
            <p className="text-xs text-muted-foreground">
              Kilde {p.source} · oprettet {formatWhen(p.createdAt)}
              {p.assigneeUserId ? ` · tildelt ${admins.find((a) => a.userId === p.assigneeUserId)?.displayName ?? p.assigneeUserId}` : ""}
            </p>
            {data?.events && (
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Historik</p>
                <ul className="mt-1 space-y-1">
                  {data.events.map((e) => (
                    <li key={e.id} className="text-xs text-muted-foreground">
                      {formatWhen(e.createdAt)} · {e.eventType}
                      {e.detail ? ` — ${e.detail}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data?.executions?.map((ex) => (
              <div key={ex.id} className="rounded-md bg-muted p-3 text-xs">
                Udførsel {ex.status}: {String(ex.result.summary ?? "")}
              </div>
            ))}
          </div>
        )}

        {canDecide && !editing && (p.status === "pending" || p.status === "approved") && (
          <div className="space-y-3 border-t border-border pt-4">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            <div className="flex flex-wrap gap-2">
              {p.status === "pending" && (
                <>
                  <Button onClick={() => decide.mutate("approve")} disabled={decide.isPending}>Godkend og udfør</Button>
                  <Button variant="outline" onClick={() => decide.mutate("defer")} disabled={decide.isPending}>Udsæt</Button>
                  <Button variant="destructive" onClick={() => decide.mutate("reject")} disabled={decide.isPending}>Afvis</Button>
                </>
              )}
              {p.status === "approved" && (
                <Button onClick={() => decide.mutate("approve")} disabled={decide.isPending}>Udfør godkendt handling</Button>
              )}
              <Button variant="ghost" onClick={() => setEditing(true)}>Rediger</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ proposal, onDone }: { proposal: ProposalRow; onDone: (reapproval: boolean) => void }) {
  const [title, setTitle] = useState(proposal.title);
  const [description, setDescription] = useState(proposal.description);
  const [rationale, setRationale] = useState(proposal.rationale);
  const [priority, setPriority] = useState<Priority>(proposal.priority);
  const [entity, setEntity] = useState<Entity>(proposal.entity);
  const [payload, setPayload] = useState(JSON.stringify(proposal.actionPayload, null, 2));
  const edit = useMutation({
    mutationFn: () => {
      let actionPayload: JsonObject = {};
      try {
        actionPayload = JSON.parse(payload) as JsonObject;
      } catch {
        throw new Error("Handlingsdata skal være gyldig JSON.");
      }
      return editProposal({
        data: {
          id: proposal.id,
          title,
          description,
          rationale,
          priority,
          entity,
          actionType: proposal.actionType,
          actionPayload,
        },
      });
    },
    onSuccess: (res) => onDone(res.requiresReapproval),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke gemme."),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        edit.mutate();
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      <Textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} />
      <div className="grid grid-cols-2 gap-2">
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          {PRIORITIES.map((x) => <option key={x} value={x}>{priorityLabel(x)}</option>)}
        </select>
        <select className="h-11 rounded-md border border-input bg-card px-3 text-sm" value={entity} onChange={(e) => setEntity(e.target.value as Entity)}>
          {ENTITIES.map((x) => <option key={x} value={x}>{ENTITY_LABELS[x]}</option>)}
        </select>
      </div>
      <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={6} className="font-mono text-xs" />
      <Button type="submit" disabled={edit.isPending}>Gem ændringer</Button>
    </form>
  );
}

function CreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [actionType, setActionType] = useState<ActionType>("log_internal_event");
  const [payload, setPayload] = useState('{\n  "message": "Intern testhandling"\n}');
  const create = useMutation({
    mutationFn: () => {
      let actionPayload: JsonObject = {};
      try {
        actionPayload = JSON.parse(payload) as JsonObject;
      } catch {
        throw new Error("Handlingsdata skal være gyldig JSON.");
      }
      return createProposalManual({
        data: { title, description, rationale, actionType, actionPayload },
      });
    },
    onSuccess: () => {
      toast.success("Forslag oprettet.");
      setTitle("");
      setDescription("");
      setRationale("");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke oprette."),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nyt forslag</DialogTitle>
          <DialogDescription>Oprettes som afventende. Udføres først efter godkendelse.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input required placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea required placeholder="Beskrivelse" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Textarea required placeholder="Begrundelse" value={rationale} onChange={(e) => setRationale(e.target.value)} />
          <select className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)}>
            {ACTION_TYPES.map((t) => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
          </select>
          <Textarea className="font-mono text-xs" value={payload} onChange={(e) => setPayload(e.target.value)} rows={5} />
          <Button type="submit" disabled={create.isPending}>Opret</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
