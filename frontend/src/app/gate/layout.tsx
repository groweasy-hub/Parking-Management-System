"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Protected } from "@/components/auth/protected";
import { useAuth } from "@/lib/auth-context";
import { useProject } from "@/lib/project-context";
import { apiFetch } from "@/lib/api";
import { useProjectRealtime } from "@/hooks/useRealtime";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ParkingSquare,
  LogOut,
  ArrowDownToLine,
  ArrowUpFromLine,
  LayoutDashboard,
  Car,
} from "lucide-react";

export default function GateLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { currentProject, currentProjectId } = useProject();
  const router = useRouter();
  const pathname = usePathname();

  const [parkedCount, setParkedCount] = useState<number | null>(null);

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
  const canSwitchGates = user?.role === "SUPER_ADMIN" || user?.role === "PROJECT_ADMIN";

  return (
    <Protected roles={["ENTRY_GATEMAN", "EXIT_GATEMAN", "SUPER_ADMIN", "PROJECT_ADMIN"]}>
      <div className={cn("flex min-h-screen flex-col bg-slate-50/70 dark:bg-slate-950", canSwitchGates && "pb-16 md:pb-0")}>
        {/* Simple, Modern, Clean Gate App Bar */}
        <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <ParkingSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm sm:text-base font-bold tracking-tight">
                  {isEntry ? "Gate Entry" : isExit ? "Gate Exit" : "ParkFlow Gate"}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="System Live" />
              </div>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">
                {currentProject?.name ?? "Select Project"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {parkedCount !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 border border-border/80 px-2.5 py-1 text-xs font-bold text-foreground">
                <Car className="h-3.5 w-3.5 text-primary" />
                <span>{parkedCount} Parked</span>
              </span>
            )}

            {canSwitchGates && (
              <div className="hidden sm:flex items-center rounded-lg border bg-muted/60 p-0.5 text-xs font-semibold">
                <Link
                  href="/gate/entry"
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 transition-all",
                    isEntry
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
                  Entry
                </Link>
                <Link
                  href="/gate/exit"
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1 transition-all",
                    isExit
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ArrowUpFromLine className="h-3 w-3 text-rose-500" />
                  Exit
                </Link>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="hidden md:inline text-xs font-medium text-muted-foreground">
                {user?.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
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
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
          {children}
        </main>

        {/* Mobile Switcher for Admins */}
        {canSwitchGates && (
          <nav className="fixed bottom-0 inset-x-0 z-40 flex h-14 items-center justify-around border-t border-border/80 bg-background/95 px-2 backdrop-blur-xl md:hidden safe-bottom shadow-lg shadow-black/5">
            <Link
              href="/gate/entry"
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[11px] font-semibold tap-bounce",
                isEntry
                  ? "text-primary font-bold bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownToLine className={cn("h-4 w-4", isEntry ? "text-primary" : "text-muted-foreground")} />
              Entry
            </Link>
            <Link
              href="/gate/exit"
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[11px] font-semibold tap-bounce",
                isExit
                  ? "text-primary font-bold bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpFromLine className={cn("h-4 w-4", isExit ? "text-primary" : "text-muted-foreground")} />
              Exit
            </Link>
            <Link
              href="/admin/dashboard"
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[11px] font-semibold text-muted-foreground hover:text-foreground tap-bounce"
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              Admin
            </Link>
          </nav>
        )}
      </div>
    </Protected>
  );
}

