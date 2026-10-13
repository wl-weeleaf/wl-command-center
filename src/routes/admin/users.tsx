import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSessionProfile, listAdmins, updateAdminRole } from "@/lib/wl/fns";
import { ENTITY_LABELS, ROLE_LABELS, can } from "@/lib/wl/access";
import { ENTITIES, ROLES, type Entity, type Role } from "@/lib/wl/types";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

function UsersPage() {
  const qc = useQueryClient();
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: () => getSessionProfile() });
  const { data: users = [] } = useQuery({ queryKey: ["admins"], queryFn: () => listAdmins() });
  const role = profileData?.profile.role ?? "reader";
  const manage = can(role, "manage_users");
  const update = useMutation({
    mutationFn: (input: { userId: string; role: Role; entity?: Entity | null }) =>
      updateAdminRole({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Rolle opdateret.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunne ikke opdatere."),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Brugeradministration</h1>
        <p className="text-sm text-muted-foreground">
          Rettigheder håndhæves på serveren. Superadmin, økonomi, projekt, teknik og læseadgang.
        </p>
      </div>
      <div className="space-y-3">
        {users.map((u) => (
          <article key={u.userId} className="rounded-xl bg-card p-4 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">{u.displayName}</h2>
                <p className="text-xs text-muted-foreground">{u.email ?? u.userId}</p>
              </div>
              <Badge>{ROLE_LABELS[u.role]}</Badge>
            </div>
            {manage && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  className="h-11 rounded-md border border-input bg-card px-3 text-sm"
                  value={u.role}
                  onChange={(e) => update.mutate({ userId: u.userId, role: e.target.value as Role, entity: u.entity })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-md border border-input bg-card px-3 text-sm"
                  value={u.entity ?? ""}
                  onChange={(e) =>
                    update.mutate({
                      userId: u.userId,
                      role: u.role,
                      entity: (e.target.value || null) as Entity | null,
                    })
                  }
                >
                  <option value="">Ingen enhed</option>
                  {ENTITIES.map((ent) => (
                    <option key={ent} value={ent}>{ENTITY_LABELS[ent]}</option>
                  ))}
                </select>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
