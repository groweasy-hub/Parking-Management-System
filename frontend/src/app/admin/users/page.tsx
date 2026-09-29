"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { AppUser, Gate, Role } from "@/lib/types";
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
import { Plus, Loader2, Users } from "lucide-react";

const CREATABLE_ROLES: Role[] = ["PROJECT_ADMIN", "ENTRY_GATEMAN", "EXIT_GATEMAN", "VIEWER"];

export default function UsersPage() {
  const { currentProjectId } = useProject();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("ENTRY_GATEMAN");
  const [gateId, setGateId] = useState<string>("none");

  const loadAll = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const [u, g] = await Promise.all([
        apiFetch<{ users: AppUser[] }>(`/api/users?projectId=${currentProjectId}`),
        apiFetch<{ gates: Gate[] }>(`/api/gates?projectId=${currentProjectId}`),
      ]);
      setUsers(u.users);
      setGates(g.gates);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const relevantGates = gates.filter((g) => (role === "ENTRY_GATEMAN" ? g.type === "ENTRY" : g.type === "EXIT"));

  async function handleCreate() {
    if (!currentProjectId || !name || !email || !password) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          projectId: currentProjectId,
          gateId: gateId === "none" ? null : gateId,
        }),
      });
      toast.success("User account created");
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setGateId("none");
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

  function gateName(id: string | null) {
    if (!id) return "Unassigned";
    return gates.find((g) => g._id === id)?.name ?? "Unassigned";
  }

  function initials(name: string) {
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

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
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-11 rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Role Assignment</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                    <SelectTrigger className="w-full h-11 rounded-xl font-medium">
                      <SelectValue>{(v: string | null) => v?.replace("_", " ") ?? ""}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CREATABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(role === "ENTRY_GATEMAN" || role === "EXIT_GATEMAN") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Assigned Physical Gate</Label>
                    <Select value={gateId} onValueChange={(v) => v && setGateId(v)}>
                      <SelectTrigger className="w-full h-11 rounded-xl font-medium">
                        <SelectValue placeholder="Select gate">
                          {(v: string | null) =>
                            v === "none"
                              ? "Unassigned"
                              : relevantGates.find((g) => g._id === v)?.name ?? "Select gate"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {relevantGates.map((g) => (
                          <SelectItem key={g._id} value={g._id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <TableHead>Assigned Gate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u._id} className="hover:bg-muted/30 transition">
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
                          {u.role.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-foreground bg-muted px-2 py-1 rounded-md">
                          {gateName(u.gateId)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={u.status === "ACTIVE"} onCheckedChange={() => toggleStatus(u)} />
                          <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] font-bold">
                            {u.status}
                          </Badge>
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
                    {u.role.replace("_", " ")}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                  <span className="text-muted-foreground">
                    Gate: <span className="font-bold text-foreground">{gateName(u.gateId)}</span>
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
    </div>
  );
}
