"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Floor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { Plus, Loader2, ChevronUp, ChevronDown, Trash2, Layers } from "lucide-react";

export default function FloorsPage() {
  const { currentProjectId } = useProject();
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ floors: Floor[] }>(`/api/floors?projectId=${currentProjectId}`);
      setFloors(data.floors);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!currentProjectId) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/floors", {
        method: "POST",
        body: JSON.stringify({ projectId: currentProjectId, name, code }),
      });
      toast.success("Floor created");
      setOpen(false);
      setName("");
      setCode("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create floor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(floor: Floor) {
    try {
      await apiFetch(`/api/floors/${floor._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: floor.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update floor.");
    }
  }

  async function handleDelete(floor: Floor) {
    if (!window.confirm(`Delete floor "${floor.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/floors/${floor._id}`, { method: "DELETE" });
      toast.success("Floor deleted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete floor.");
    }
  }

  async function move(floor: Floor, direction: -1 | 1) {
    const sorted = [...floors].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = sorted.findIndex((f) => f._id === floor._id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const order = sorted.map((f, i) => ({
      floorId: f._id,
      displayOrder: i === idx ? sorted[swapIdx].displayOrder : i === swapIdx ? sorted[idx].displayOrder : f.displayOrder,
    }));
    try {
      await apiFetch("/api/floors/reorder", {
        method: "PATCH",
        body: JSON.stringify({ projectId: currentProjectId, order }),
      });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to reorder floors.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking Floors"
        description="The basements and parking levels where companies are allocated capacity."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="rounded-xl font-bold gap-1.5 tap-bounce shadow-xs">
                  <Plus className="h-4 w-4" /> Add Floor
                </Button>
              }
            />
            <DialogContent className="rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Add Parking Floor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Floor Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Basement 1 or Level 2"
                    className="h-11 rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Floor Code</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. B1 or L2"
                    className="h-11 rounded-xl font-mono uppercase font-bold"
                  />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={submitting || !name || !code}
                  className="rounded-xl font-bold h-11 w-full sm:w-auto"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Floor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground mt-2 font-medium">Loading parking floors...</p>
            </div>
          ) : floors.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground space-y-2">
              <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="font-bold text-foreground">No parking floors created yet</p>
              <p className="text-xs">Add your first parking level to begin allocating slots to tenants.</p>
            </div>
          ) : (
            <>
              {/* Desktop: full table */}
              <Table className="hidden md:table">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-16">Reorder</TableHead>
                    <TableHead>Floor Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Display Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...floors]
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((f) => (
                      <TableRow key={f._id} className="hover:bg-muted/40 transition">
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => move(f, -1)}
                              aria-label={`Move ${f.name} up`}
                              className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => move(f, 1)}
                              aria-label={`Move ${f.name} down`}
                              className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-sm">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 font-black text-xs border border-indigo-500/20">
                              {f.code}
                            </div>
                            {f.name}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-xs">{f.code}</TableCell>
                        <TableCell className="font-mono text-xs">{f.displayOrder}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={f.status === "ACTIVE"} onCheckedChange={() => toggleStatus(f)} />
                            <Badge variant={f.status === "ACTIVE" ? "default" : "secondary"} className="font-bold text-[11px]">
                              {f.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => handleDelete(f)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                            aria-label={`Delete ${f.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              {/* Mobile: Native App Style Cards */}
              <div className="space-y-2.5 p-3.5 md:hidden">
                {[...floors]
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((f) => (
                    <div
                      key={f._id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs tap-bounce"
                    >
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() => move(f, -1)}
                          aria-label={`Move ${f.name} up`}
                          className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => move(f, 1)}
                          aria-label={`Move ${f.name} down`}
                          className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 font-black text-sm border border-indigo-500/20">
                          {f.code}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">{f.name}</p>
                          <p className="text-[11px] text-muted-foreground">Order: {f.displayOrder}</p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Switch checked={f.status === "ACTIVE"} onCheckedChange={() => toggleStatus(f)} />
                        <button
                          onClick={() => handleDelete(f)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          aria-label={`Delete ${f.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
