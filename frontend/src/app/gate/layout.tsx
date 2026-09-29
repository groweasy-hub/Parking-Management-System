"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Protected } from "@/components/auth/protected";
import { useAuth } from "@/lib/auth-context";
import { useProject } from "@/lib/project-context";
import { apiFetch } from "@/lib/api";
import { gatekeeperSecurityPath } from "@/lib/gate-security";
import { useProjectRealtime } from "@/hooks/useRealtime";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ParkingSquare,
  LogOut,
  Car,
  User,
  DoorOpen,
  CalendarDays,
} from "lucide-react";

type TodayDuty = {
  gateId: { _id: string; name: string; type: "ENTRY" | "EXIT" } | string;
  gateType: "ENTRY" | "EXIT";
  dutyDate: string;
  startedAt: string;
  entryCount: number;
  exitCount: number;
  endedAt?: string | null;
};

export default function GateLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { currentProject, currentProjectId } = useProject();
  const router = useRouter();
  const pathname = usePathname();

  const [parkedCount, setParkedCount] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [todayDuty, setTodayDuty] = useState<TodayDuty | null>(null);

  const loadParkedCount = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const data = await apiFetch<{ sessions: { _id: string }[] }>(
        `/api/parking/active?projectId=${currentProjectId}`
      );
      setParkedCount(data.sessions.length);
    } catch {
      // silent
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadParkedCount();
  }, [loadParkedCount]);

  const loadTodayDuty = useCallback(async () => {
    try {
      const data = await apiFetch<{ duty: TodayDuty | null }>("/api/gate-duty/today");
      setTodayDuty(data.duty);
    } catch {
      setTodayDuty(null);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "GATEKEEPER") loadTodayDuty();
  }, [loadTodayDuty, user?.role, pathname]);

  useProjectRealtime(currentProjectId, {
    onSessionEntry: () => {
      loadParkedCount();
    },
    onSessionExit: () => {
      loadParkedCount();
    },
  });

  async function handleSignOut() {
    await logout();
    router.replace("/login");
  }

  const isEntry = pathname?.includes("/entry");
  const isExit = pathname?.includes("/exit");
  const isSecurity = pathname?.includes("/security");

  useEffect(() => {
    if (!user || isSecurity) return;
    const securityPath = gatekeeperSecurityPath(user);
    if (securityPath) router.replace(securityPath);
  }, [isSecurity, router, user]);

  return (
    <Protected roles={["GATEKEEPER"]}>
      <div className="flex min-h-screen flex-col bg-[#eef3f8] text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        {/* Simple, Modern, Clean Gate App Bar */}
        <header className="sticky top-0 z-30 flex h-[76px] min-w-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 shadow-sm shadow-slate-200/60 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-none sm:h-14 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="gate-press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 sm:h-8 sm:w-8 sm:rounded-lg"
              aria-label="Open profile"
              title="Open profile"
            >
              <User className="h-6 w-6 sm:h-4 sm:w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-lg font-black tracking-tight sm:text-base">
                  {isEntry ? "Gate Entry" : isExit ? "Gate Exit" : "ParkFlow Gate"}
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="System Live" />
              </div>
              <p className="truncate text-[13px] font-semibold leading-tight text-slate-500 dark:text-slate-400 sm:text-[11px]">
                {todayDuty ? dutyGateName(todayDuty) : currentProject?.name ?? "Select Project"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {parkedCount !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-900 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:rounded-full sm:py-1">
                <Car className="h-4 w-4 text-primary sm:h-3.5 sm:w-3.5" />
                <span>{parkedCount} Parked</span>
              </span>
            )}

            <div className="flex items-center gap-1.5">
              <span className="hidden md:inline text-xs font-medium text-muted-foreground">
                {user?.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:inline-flex"
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="gate-screen mx-auto w-full min-w-0 max-w-7xl flex-1 px-0 py-0 sm:px-6 sm:py-6">
          {children}
        </main>

        <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl p-0 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-md sm:rounded-3xl sm:border">
            <SheetHeader className="border-b p-5 text-left">
              <SheetTitle className="text-xl font-black">Gatekeeper Profile</SheetTitle>
              <SheetDescription className="text-xs">Your account and today's selected gate.</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <User className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black">{user?.name}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <ProfileRow label="Project" value={currentProject?.name ?? "Not selected"} icon={ParkingSquare} />
              <ProfileRow label="Today Gate" value={todayDuty ? dutyGateName(todayDuty) : "No gate selected"} icon={DoorOpen} />
              <ProfileRow label="Duty Date" value={todayDuty?.dutyDate ?? new Date().toISOString().slice(0, 10)} icon={CalendarDays} />
              {todayDuty && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border bg-card p-3 text-center">
                    <p className="text-2xl font-black">{todayDuty.entryCount ?? 0}</p>
                    <p className="text-[11px] font-bold text-muted-foreground">Entries</p>
                  </div>
                  <div className="rounded-2xl border bg-card p-3 text-center">
                    <p className="text-2xl font-black">{todayDuty.exitCount ?? 0}</p>
                    <p className="text-[11px] font-bold text-muted-foreground">Exits</p>
                  </div>
                </div>
              )}
            </div>
            <SheetFooter className="border-t p-5">
              <Button
                variant="destructive"
                className="h-12 rounded-2xl font-bold"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </Protected>
  );
}

function dutyGateName(duty: TodayDuty) {
  const gateName = typeof duty.gateId === "object" ? duty.gateId.name : "Selected Gate";
  return `${gateName} (${duty.gateType})`;
}

function ProfileRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ParkingSquare;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-background p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}
