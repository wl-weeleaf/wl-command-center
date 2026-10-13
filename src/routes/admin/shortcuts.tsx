import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { deleteShortcut, getSessionProfile, listShortcuts, saveShortcut } from "@/lib/wl/fns";
import { CATEGORY_LABELS, ENTITY_LABELS, can } from "@/lib/wl/access";
import { SHORTCUT_CATEGORIES, type ShortcutCategory } from "@/lib/wl/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/shortcuts")({ component: ShortcutsPage });

function ShortcutsPage() {
  const qc = useQueryClient();
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: () => getSessionProfile() });
  const { data: items = [] } = useQuery({ queryKey: ["shortcuts"], queryFn: () => listShortcuts() });
  const role = profileData?.profile.role ?? "reader";
  const [editing, setEditing] = useState<null | { id?: string }>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Genvejscenter</h1>
          <p className="text-sm text-muted-foreground">Tjenester vi bruger. En genvej er ikke en integration.</p>
        </div>
        {can(role, "write_shortcuts") && <Button onClick={() => setEditing({})}>Ny genvej</Button>}
      </div>

      <Tabs defaultValue={SHORTCUT_CATEGORIES[0]}>
        <TabsList>
          {SHORTCUT_CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>{CATEGORY_LABELS[c]}</TabsTrigger>
          ))}
        </TabsList>
        {SHORTCUT_CATEGORIES.map((c) => (
          <TabsContent key={c} value={c} className="grid gap-3 md:grid-cols-2">
            {items.filter((i) => i.category === c).map((s) => (
              <article key={s.id} className="rounded-xl bg-card p-4 shadow-(--shadow-card)">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium">{s.title}</h2>
                    <p className="text-xs text-muted-foreground">{s.ownerName} · {s.entity ? ENTITY_LABELS[s.entity] : "—"}</p>
                  </div>
                  <Badge variant={s.integrationStatus === "shortcut" ? "accent" : s.integrationStatus === "connected" ? "success" : "danger"}>
                    {s.integrationStatus === "shortcut" ? "Kun genvej" : s.integrationStatus === "connected" ? "Tilsluttet" : "Mangler"}
                  </Badge>
                </div>
                {s.notes && <p className="mt-2 text-sm text-muted-foreground">{s.notes}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.url && s.url !== "#" ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={s.url} target="_blank" rel="noreferrer">Åbn</a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Ingen URL endnu</span>
                  )}
                  {can(role, "write_shortcuts") && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ id: s.id })}>Rediger</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          deleteShortcut({ data: s.id }).then(() => {
                            void qc.invalidateQueries({ queryKey: ["shortcuts"] });
                          })
                        }
                      >
                        Slet
                      </Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <ShortcutEditor
        key={editing?.id ?? (editing ? "new" : "closed")}
        open={editing !== null}
        initial={editing?.id ? items.find((i) => i.id === editing.id) : undefined}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["shortcuts"] });
          setEditing(null);
          toast.success("Genvej gemt.");
        }}
      />
    </div>
  );
}

function ShortcutEditor({
  open,
  initial,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  initial?: {
    id: string;
    title: string;
    url: string;
    category: ShortcutCategory;
    ownerName: string | null;
    entity: string | null;
    notes: string | null;
    integrationStatus: "shortcut" | "connected" | "missing";
  };
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [category, setCategory] = useState<ShortcutCategory>(initial?.category ?? "administration");
  const [ownerName, setOwnerName] = useState(initial?.ownerName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const save = useMutation({
    mutationFn: () =>
      saveShortcut({
        data: {
          id: initial?.id,
          title,
          url,
          category,
          ownerName,
          notes,
          integrationStatus: initial?.integrationStatus ?? "shortcut",
        },
      }),
    onSuccess: onSaved,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke gemme."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Rediger genvej" : "Ny genvej"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1"><Label>Titel</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>URL</Label><Input required value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Kategori</Label>
            <select className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value as ShortcutCategory)}>
              {SHORTCUT_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Ansvarlig</Label><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Note</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button type="submit" disabled={save.isPending}>Gem</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
