"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { AppUser, Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, Plus, Loader2, Users } from "lucide-react";

const CREATABLE_ROLES: Role[] = ["PROJECT_ADMIN", "GATEKEEPER", "VIEWER"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type AttendanceDay = { date: string; worked: boolean; visited: boolean };
type AttendanceSlideDirection = "previous" | "next";
type AttendanceSlidePhase = "idle" | "exit" | "enter";

function roleLabel(role: Role, customRoleLabel?: string) {
  if (customRoleLabel) return customRoleLabel;
  if (role === "GATEKEEPER") return "Gate Keeper";
  if (role === "PROJECT_ADMIN") return "Manager";
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "VIEWER") return "Other";
  return role;
}

export default function UsersPage() {
  const { currentProjectId, currentProject } = useProject();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceUser, setAttendanceUser] = useState<AppUser | null>(null);
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceMonth, setAttendanceMonth] = useState(() => monthKey(new Date()));
  const [attendanceSlideDirection, setAttendanceSlideDirection] = useState<AttendanceSlideDirection>("next");
  const [attendanceSlidePhase, setAttendanceSlidePhase] = useState<AttendanceSlidePhase>("idle");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("GATEKEEPER");
  const [customRoleLabel, setCustomRoleLabel] = useState("");

  const loadAll = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const u = await apiFetch<{ users: AppUser[] }>(`/api/users?projectId=${currentProjectId}`);
      setUsers(u.users);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function fetchAttendanceDays(user: AppUser, month: string) {
    if (!currentProjectId) return;
    const data = await apiFetch<{ days: AttendanceDay[] }>(
      `/api/gate-duty/users/${user._id}/attendance?projectId=${currentProjectId}&month=${month}`
    );
    return data.days;
  }

  async function loadAttendance(user: AppUser, month: string) {
    setAttendanceLoading(true);
    try {
      const days = await fetchAttendanceDays(user, month);
      if (days) setAttendanceDays(days);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to load attendance.");
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function openAttendance(user: AppUser) {
    const month = monthKey(new Date());
    setAttendanceUser(user);
    setAttendanceMonth(month);
    setAttendanceSlideDirection("next");
    setAttendanceSlidePhase("idle");
    await loadAttendance(user, month);
  }

  async function changeAttendanceMonth(delta: number) {
    if (!attendanceUser || attendanceSlidePhase !== "idle") return;
    const next = addMonths(attendanceMonth, delta);
    const direction = delta < 0 ? "previous" : "next";
    setAttendanceSlideDirection(direction);
    setAttendanceSlidePhase("exit");
    const daysPromise = fetchAttendanceDays(attendanceUser, next);

    window.setTimeout(async () => {
      try {
        const days = await daysPromise;
        if (days) setAttendanceDays(days);
        setAttendanceMonth(next);
        setAttendanceSlidePhase("enter");
        window.setTimeout(() => setAttendanceSlidePhase("idle"), 280);
      } catch (err) {
        setAttendanceSlidePhase("idle");
        toast.error(err instanceof ApiError ? err.message : "Unable to load attendance.");
      }
    }, 180);
  }

  async function handleCreate() {
    if (!currentProjectId || !name || !email || !password) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          password,
          role,
          customRoleLabel: role === "VIEWER" ? customRoleLabel || undefined : undefined,
          projectId: currentProjectId,
        }),
      });
      toast.success("User account created");
      setOpen(false);
      setName("");
      setPhone("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setRole("GATEKEEPER");
      setCustomRoleLabel("");
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(user: AppUser) {
    try {
      await apiFetch(`/api/users/${user._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update user.");
    }
  }

  function initials(name: string) {
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  const firstAttendanceWeekday = new Date(`${attendanceMonth}-01T00:00:00`).getDay();
  const currentMonth = monthKey(new Date());
  const canGoNextMonth = attendanceMonth < currentMonth;
  const workedCount = attendanceDays.filter((day) => day.worked).length;
  const nonWorkedCount = attendanceDays.length - workedCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff &amp; Operators"
        description="User accounts authorized to manage parking settings or operate entry and exit gates."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="rounded-xl font-bold gap-1.5 tap-bounce shadow-xs">
                  <Plus className="h-4 w-4" /> Add User
                </Button>
              }
            />
            <DialogContent className="rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Create Operator Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Full Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="h-11 rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Contact Number</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91..."
                    className="h-11 rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Work Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ramesh@parking.local"
                    className="h-11 rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Password</Label>
                  <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-11 rounded-xl pr-11 font-medium"
                  />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Assigned Project</Label>
                  <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm font-bold">
                    {currentProject?.name ?? "Select a project from header"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Role Assignment</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger className="w-full h-11 rounded-xl font-medium">
                      <SelectValue>{(v: Role | null) => (v ? roleLabel(v) : "")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CREATABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {role === "VIEWER" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Custom Role Name</Label>
                    <Input
                      value={customRoleLabel}
                      onChange={(e) => setCustomRoleLabel(e.target.value)}
                      placeholder="Example: Security, Supervisor, Housekeeping"
                      className="h-11 rounded-xl font-medium"
                    />
                  </div>
                )}
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={submitting || !name || !email || !password}
                  className="rounded-xl font-bold h-11 w-full sm:w-auto"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2 font-medium">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2">
          <CardContent className="py-16 text-center text-muted-foreground space-y-2">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-bold text-foreground">No users created yet</p>
            <p className="text-xs">Add an operator to allow gate check-in and check-out access.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block rounded-2xl border border-border/80 shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u._id} className="hover:bg-muted/30 transition cursor-pointer" onClick={() => openAttendance(u)}>
                      <TableCell className="font-bold text-sm">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-primary/20">
                            <AvatarFallback className="bg-primary/10 text-xs font-black text-primary">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold text-xs">
                          {roleLabel(u.role, u.customRoleLabel)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={u.status === "ACTIVE"} onCheckedChange={() => toggleStatus(u)} />
                          <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] font-bold">
                            {u.status}
                          </Badge>
                          {u.role === "GATEKEEPER" && <CalendarDays className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Native App Cards */}
          <div className="space-y-2.5 md:hidden">
            {users.map((u) => (
              <div
                key={u._id}
                className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs space-y-3 tap-bounce"
                onClick={() => openAttendance(u)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0 border border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-xs font-black text-primary">
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{u.name}</p>
                    <p className="truncate text-xs text-muted-foreground font-mono">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="font-bold text-[10px] shrink-0">
                    {roleLabel(u.role, u.customRoleLabel)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                  <span className="text-muted-foreground">
                    Daily gate selected by keeper at login
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch checked={u.status === "ACTIVE"} onCheckedChange={() => toggleStatus(u)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!attendanceUser} onOpenChange={(open) => !open && setAttendanceUser(null)}>
        <DialogContent className="rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              {attendanceUser?.name} Attendance
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-2xl border bg-muted/30 px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => changeAttendanceMonth(-1)}
              disabled={attendanceLoading || attendanceSlidePhase !== "idle"}
              title="Previous month"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-black">{formatMonthTitle(attendanceMonth)}</p>
              <p className="text-[11px] font-semibold text-muted-foreground">Daily attendance calendar</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={() => changeAttendanceMonth(1)}
              disabled={attendanceLoading || attendanceSlidePhase !== "idle" || !canGoNextMonth}
              title="Next month"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {attendanceLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div
              key={attendanceMonth}
              className={`space-y-3 ${attendanceSlideClass(attendanceSlidePhase, attendanceSlideDirection)}`}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                  <p className="text-2xl font-black text-emerald-700">{workedCount}</p>
                  <p className="text-[11px] font-bold text-emerald-700/80">Worked Days</p>
                </div>
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-center">
                  <p className="text-2xl font-black text-rose-700">{nonWorkedCount}</p>
                  <p className="text-[11px] font-bold text-rose-700/80">Non-Worked Days</p>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="text-center text-[11px] font-black text-muted-foreground">
                    {day}
                  </div>
                ))}
                {Array.from({ length: firstAttendanceWeekday }).map((_, index) => (
                  <div key={`blank-${index}`} className="h-10 rounded-xl border border-transparent" />
                ))}
                {attendanceDays.map((day) => (
                  <div
                    key={day.date}
                    className={`rounded-xl border p-2 text-center text-xs font-black ${
                      day.worked
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-700"
                    }`}
                    title={day.worked ? "Worked with entry/exit activity" : day.visited ? "Visited but no activity" : "No visit"}
                  >
                    {Number(day.date.slice(-2))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500/60" /> Worked</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-500/60" /> No entry/exit</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return monthKey(date);
}

function formatMonthTitle(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(year, monthIndex - 1, 1)
  );
}

function attendanceSlideClass(phase: AttendanceSlidePhase, direction: AttendanceSlideDirection) {
  if (phase === "exit") {
    return direction === "previous" ? "calendar-slide-exit-right" : "calendar-slide-exit-left";
  }
  if (phase === "enter") {
    return direction === "previous" ? "calendar-slide-enter-left" : "calendar-slide-enter-right";
  }
  return "";
}
