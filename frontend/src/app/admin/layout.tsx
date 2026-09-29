"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Protected } from "@/components/auth/protected";
import { useAuth } from "@/lib/auth-context";
import { useProject } from "@/lib/project-context";
import { ADMIN_NAV } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ParkingSquare,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Car,
  History,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { DASHBOARD_ROLES } from "@/lib/roles";

function initials(name: string | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { projects, currentProjectId, setCurrentProjectId, currentProject } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Filter items by user role
  const navItems = ADMIN_NAV.filter((item) => !user || item.roles.includes(user.role));

  const mobilePrimaryNav = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/allocations", label: "Allocations", icon: Car },
    { href: "/admin/history", label: "History", icon: History },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  ];

  async function handleSignOut() {
    await logout();
    router.replace("/login");
  }

  // Sidebar content shared between desktop and mobile sheet
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 px-4 sm:px-5">
        <div className="flex items-center gap-2.5 text-base font-black tracking-tight text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
            <ParkingSquare className="h-5 w-5" />
          </div>
          <span>ParkFlow</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {user?.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
          </span>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation List of All Options */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobile && setMobileSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all tap-bounce",
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-bold"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Sign Out Footer */}
      <div className="shrink-0 border-t border-slate-800/80 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 p-2">
          <Avatar className="h-8 w-8 border border-slate-700 shrink-0">
            <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary-foreground">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-bold text-white">{user?.name}</p>
            <p className="truncate text-[10px] text-slate-400 uppercase tracking-wide">
              {user?.role.replace("_", " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 shrink-0 rounded-lg"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Protected roles={DASHBOARD_ROLES}>
      <div className="flex min-h-screen bg-slate-50/70 dark:bg-slate-950">
        {/* =================================================================== */}
        {/* DESKTOP SIDEBAR (Permanent on >= md screens)                         */}
        {/* =================================================================== */}
        <aside className="hidden md:sticky md:top-0 md:flex md:h-screen w-68 shrink-0 flex-col border-r border-slate-800/80 shadow-md">
          {renderSidebarContent(false)}
        </aside>

        {/* =================================================================== */}
        {/* MOBILE SLIDE-OUT SIDEBAR DRAWER (< md screens)                      */}
        {/* =================================================================== */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-[300px] sm:w-[320px] p-0 border-r border-slate-800">
            <SheetHeader className="sr-only">
              <SheetTitle>Admin Navigation Sidebar</SheetTitle>
            </SheetHeader>
            {renderSidebarContent(true)}
          </SheetContent>
        </Sheet>

        {/* =================================================================== */}
        {/* MAIN APPLICATION WORKSPACE                                          */}
        {/* =================================================================== */}
        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          {/* Top Bar Header */}
          <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-6 md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              {/* Mobile Sidebar Hamburger Toggle */}
              <Button
                variant="outline"
                size="icon"
                className="flex md:hidden h-9 w-9 shrink-0 rounded-xl border-border/80"
                onClick={() => setMobileSidebarOpen(true)}
                title="Open Sidebar"
                aria-label="Open Sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="flex md:hidden items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ParkingSquare className="h-4 w-4" />
                </div>
              </div>

              {/* Project / Campus Selector */}
              {user?.role === "SUPER_ADMIN" ? (
                <Select
                  value={currentProjectId}
                  onValueChange={(v) => v && setCurrentProjectId(v)}
                >
                  <SelectTrigger className="w-full min-w-0 sm:w-72 h-10 rounded-xl font-bold border-2">
                    <SelectValue placeholder="Select a project">
                      {(value: string | null) =>
                        projects.find((p) => p._id === value)?.name ?? "Select a project"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name} ({p.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="truncate text-base font-extrabold tracking-tight">
                  {currentProject?.name}
                </span>
              )}
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex md:hidden">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl h-9 w-9"
                  onClick={handleSignOut}
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          {/* Page Body */}
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-4 p-4 sm:space-y-6 sm:p-6 md:p-8">
              {children}
            </div>
          </main>
        </div>

        {/* =================================================================== */}
        {/* MOBILE BOTTOM NAVIGATION BAR (< md screens)                         */}
        {/* =================================================================== */}
        <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-background/95 px-1 backdrop-blur-xl md:hidden safe-bottom shadow-lg shadow-black/10">
          {mobilePrimaryNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[11px] font-semibold tap-bounce transition-all",
                  active
                    ? "text-primary font-black bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* 5th Button: Open Full Sidebar Drawer */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[11px] font-semibold text-muted-foreground hover:text-foreground tap-bounce"
            title="Open all admin options in sidebar"
          >
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            <span>Sidebar</span>
          </button>
        </nav>
      </div>
    </Protected>
  );
}
