import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Landmark,
  Link2,
  Menu,
  MessageCircle,
  ScrollText,
  Settings,
  Shield,
  Users,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { getSessionProfile } from "@/lib/wl/fns";
import { ROLE_LABELS, can } from "@/lib/wl/access";
import { BrandMark } from "@/components/wl/brand-mark";
import { LeafyChat } from "@/components/wl/leafy-chat";
import { LeafyChatProvider } from "@/components/wl/leafy-widget";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminGate });

const NAV: Array<{
  to: "/admin" | "/admin/approvals" | "/admin/tasks" | "/admin/shortcuts" | "/admin/finance" | "/admin/members" | "/admin/projects" | "/admin/reports" | "/admin/users" | "/admin/audit" | "/admin/settings";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { to: "/admin", label: "Forside", icon: LayoutDashboard, exact: true },
  { to: "/admin/approvals", label: "Godkendelser", icon: ClipboardCheck },
  { to: "/admin/tasks", label: "Opgaver", icon: ListTodo },
  { to: "/admin/shortcuts", label: "Genveje", icon: Link2 },
  { to: "/admin/finance", label: "Økonomi", icon: Landmark },
  { to: "/admin/members", label: "Medlemmer", icon: UsersRound },
  { to: "/admin/projects", label: "Projekter", icon: FolderKanban },
  { to: "/admin/reports", label: "Rapporter", icon: ScrollText },
  { to: "/admin/users", label: "Brugere", icon: Users },
  { to: "/admin/audit", label: "Log", icon: Shield },
  { to: "/admin/settings", label: "Indstillinger", icon: Settings },
];

function AdminGate() {
  return <AdminShell />;
}

function AdminShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getSessionProfile(),
  });
  const [navOpen, setNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-sm text-muted-foreground">Henter din adgang…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <p className="text-sm text-destructive">Kunne ikke indlæse profilen. Prøv at logge ind igen.</p>
      </div>
    );
  }

  const profile = data.profile;
  if (profile.role === "pending") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6">
        <div className="max-w-md rounded-xl bg-card p-8 text-center shadow-(--shadow-card)">
          <BrandMark className="mx-auto size-12" />
          <h1 className="mt-4 font-display text-2xl">Adgang afventer</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hej {profile.displayName}. Din konto er oprettet, men en superadmin skal tildele en rolle, før Command Center åbner.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => void refetch()}>
            Prøv igen
          </Button>
        </div>
      </main>
    );
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setNavOpen(false)}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
              active
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <LeafyChatProvider open={() => setChatOpen(true)}>
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 px-4 py-5">
          <BrandMark className="size-8" />
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-accent uppercase">WeeLeaf</p>
            <p className="font-display text-sm leading-tight">Command Center</p>
          </div>
        </div>
        {nav}
        <div className="border-t border-white/10 p-4 text-xs text-sidebar-muted">
          <div className="text-sidebar-foreground">{profile.displayName}</div>
          <div>{ROLE_LABELS[profile.role]}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Menu">
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">Leafy forbereder · I godkender</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden"
            onClick={() => setChatOpen(true)}
            aria-label="Åbn Leafy"
          >
            <MessageCircle className="size-4" />
            Leafy
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-x-hidden p-4 lg:p-6">
            <Outlet />
          </main>
          {can(profile.role, "chat") && (
            <aside className="hidden w-[22rem] shrink-0 border-l border-border xl:block">
              <div className="sticky top-0 h-[calc(100dvh-3.6rem)]">
                <LeafyChat />
              </div>
            </aside>
          )}
        </div>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="bg-sidebar p-0 text-sidebar-foreground">
          <div className="flex items-center gap-2 px-4 py-5">
            <BrandMark className="size-8" />
            <span className="font-display">WL</span>
          </div>
          {nav}
        </SheetContent>
      </Sheet>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="font-display">Leafy</span>
          </div>
          <div className="h-[calc(85vh-3.5rem)]">
            <LeafyChat />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </LeafyChatProvider>
  );
}
