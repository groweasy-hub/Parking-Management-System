"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Gate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { Plus, Loader2, DoorOpen, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";

export default function GatesPage() {
  const { currentProjectId } = useProject();
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ gates: Gate[] }>(`/api/gates?projectId=${currentProjectId}`);
      setGates(data.gates);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!currentProjectId || !name) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/gates", {
        method: "POST",
        body: JSON.stringify({ projectId: currentProjectId, name, type }),
      });
      toast.success("Gate created successfully");
      setOpen(false);
      setName("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create gate.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(gate: Gate) {
    try {
      await apiFetch(`/api/gates/${gate._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: gate.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update gate.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gates &amp; Terminals"
        description="Physical barrier gates where entry and exit attendants record vehicle movements."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="rounded-xl font-bold gap-1.5 tap-bounce shadow-xs">
                  <Plus className="h-4 w-4" /> Add Gate
                </Button>
              }
            />
            <DialogContent className="rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Add Gate Terminal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Gate Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. North Entry Gate 1"
                    className="h-11 rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Terminal Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as "ENTRY" | "EXIT")}>
                    <SelectTrigger className="w-full h-11 rounded-xl font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENTRY">ENTRY GATE</SelectItem>
                      <SelectItem value="EXIT">EXIT GATE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={submitting || !name}
                  className="rounded-xl font-bold h-11 w-full sm:w-auto"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Gate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2 font-medium">Loading gates...</p>
        </div>
      ) : gates.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2">
          <CardContent className="py-16 text-center text-muted-foreground space-y-2">
            <DoorOpen className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-bold text-foreground">No gates configured</p>
            <p className="text-xs">Add an Entry or Exit gate to enable gate operator logins.</p>
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
                    <TableHead>Gate Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28 text-right">Console</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gates.map((g) => (
                    <TableRow key={g._id} className="hover:bg-muted/30 transition">
                      <TableCell className="font-bold text-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                            <DoorOpen className="h-4 w-4" />
                          </div>
                          <span>{g.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            g.type === "ENTRY"
                              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-black text-xs"
                              : "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 font-black text-xs"
                          }
                        >
                          {g.type === "ENTRY" ? (
                            <ArrowDownToLine className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowUpFromLine className="h-3 w-3 mr-1" />
                          )}
                          {g.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={g.status === "ACTIVE"} onCheckedChange={() => toggleStatus(g)} />
                          <Badge variant={g.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] font-bold">
                            {g.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={g.type === "ENTRY" ? "/gate/entry" : "/gate/exit"}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Native App Cards */}
          <div className="space-y-2.5 md:hidden">
            {gates.map((g) => (
              <div
                key={g._id}
                className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-card shadow-xs tap-bounce"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <DoorOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{g.name}</p>
                    <Badge
                      variant="outline"
                      className={
                        g.type === "ENTRY"
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold text-[10px] mt-0.5"
                          : "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 font-bold text-[10px] mt-0.5"
                      }
                    >
                      {g.type}
                    </Badge>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <Switch checked={g.status === "ACTIVE"} onCheckedChange={() => toggleStatus(g)} />
                  <Link
                    href={g.type === "ENTRY" ? "/gate/entry" : "/gate/exit"}
                    className="p-2 rounded-xl bg-muted text-foreground text-xs font-bold hover:bg-muted/80"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
