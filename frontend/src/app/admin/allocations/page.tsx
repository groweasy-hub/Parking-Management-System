"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Company, Floor, ParkingAllocation, VEHICLE_TYPES, VehicleType } from "@/lib/types";
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
import { Plus, Loader2, Star, Car, Bike, Truck } from "lucide-react";

const VEHICLE_ICONS: Record<VehicleType, typeof Car> = { CAR: Car, BIKE: Bike, OTHER: Truck };

export default function AllocationsPage() {
  const { currentProjectId } = useProject();
  const [allocations, setAllocations] = useState<ParkingAllocation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [companyId, setCompanyId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("CAR");
  const [capacity, setCapacity] = useState("");
  const [preferred, setPreferred] = useState(false);

  const loadAll = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const [a, c, f] = await Promise.all([
        apiFetch<{ allocations: ParkingAllocation[] }>(`/api/parking-allocations?projectId=${currentProjectId}`),
        apiFetch<{ companies: Company[] }>(`/api/companies?projectId=${currentProjectId}`),
        apiFetch<{ floors: Floor[] }>(`/api/floors?projectId=${currentProjectId}`),
      ]);
      setAllocations(a.allocations);
      setCompanies(c.companies);
      setFloors(f.floors);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function companyName(id: string) {
    return companies.find((c) => c._id === id)?.name ?? "Unknown";
  }

  function floorLabel(id: string) {
    const f = floors.find((fl) => fl._id === id);
    return f ? `${f.name} (${f.code})` : "Unknown";
  }

  async function handleCreate() {
    if (!currentProjectId || !companyId || !floorId || !capacity) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/parking-allocations", {
        method: "POST",
        body: JSON.stringify({
          projectId: currentProjectId,
          companyId,
          floorId,
          vehicleType,
          capacity: Number(capacity),
          preferred,
        }),
      });
      toast.success("Allocation created successfully");
      setOpen(false);
      setCompanyId("");
      setFloorId("");
      setCapacity("");
      setPreferred(false);
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create allocation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateAllocation(id: string, patch: Record<string, unknown>) {
    try {
      await apiFetch(`/api/parking-allocations/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      loadAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update allocation.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking Allocations"
        description="Quota of reserved parking spaces allotted to each company per floor and vehicle type."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="rounded-xl font-bold gap-1.5 tap-bounce shadow-xs">
                  <Plus className="h-4 w-4" /> Add Allocation
                </Button>
              }
            />
            <DialogContent className="rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Add Parking Allocation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Company</Label>
                  <Select value={companyId} onValueChange={(v) => v && setCompanyId(v)}>
                    <SelectTrigger className="w-full h-11 rounded-xl font-medium">
                      <SelectValue placeholder="Select company">
                        {(v: string | null) => companies.find((c) => c._id === v)?.name ?? "Select company"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Parking Floor</Label>
                  <Select value={floorId} onValueChange={(v) => v && setFloorId(v)}>
                    <SelectTrigger className="w-full h-11 rounded-xl font-medium">
                      <SelectValue placeholder="Select floor">
                        {(v: string | null) => {
                          const f = floors.find((fl) => fl._id === v);
                          return f ? `${f.name} (${f.code})` : "Select floor";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {floors.map((f) => (
                        <SelectItem key={f._id} value={f._id}>
                          {f.name} ({f.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Vehicle Type</Label>
                    <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
                      <SelectTrigger className="w-full h-11 rounded-xl font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Total Capacity</Label>
                    <Input
                      type="number"
                      min={0}
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="e.g. 20"
                      className="h-11 rounded-xl font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl border">
                  <Switch checked={preferred} onCheckedChange={setPreferred} />
                  <div className="text-xs">
                    <p className="font-bold">Preferred Parking Floor</p>
                    <p className="text-muted-foreground">Prioritized for entry checks and displays.</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={submitting || !companyId || !floorId || !capacity}
                  className="rounded-xl font-bold h-11 w-full sm:w-auto"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Allocation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2 font-medium">Loading allocations...</p>
        </div>
      ) : allocations.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2">
          <CardContent className="py-16 text-center text-muted-foreground space-y-2">
            <Car className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-bold text-foreground">No parking allocations configured yet</p>
            <p className="text-xs">Allocate slot counts per company and floor to begin gate checks.</p>
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
                    <TableHead>Company</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Vehicle Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Current Occupancy</TableHead>
                    <TableHead>Preferred</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((a) => {
                    const Icon = VEHICLE_ICONS[a.vehicleType];
                    const percent = a.capacity > 0 ? Math.min(100, Math.round(((a.occupied ?? 0) / a.capacity) * 100)) : 0;

                    return (
                      <TableRow key={a._id} className="hover:bg-muted/30 transition">
                        <TableCell className="font-bold text-sm">{companyName(a.companyId)}</TableCell>
                        <TableCell className="text-sm font-medium">{floorLabel(a.floorId)}</TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-muted/40 text-xs font-bold">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            {a.vehicleType}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            defaultValue={a.capacity}
                            className="w-24 h-9 rounded-lg font-bold"
                            onBlur={(e) => {
                              const value = Number(e.target.value);
                              if (value !== a.capacity) updateAllocation(a._id, { capacity: value });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>{a.occupied ?? 0}</span>
                              <span className="text-muted-foreground">{percent}%</span>
                            </div>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => updateAllocation(a._id, { preferred: !a.preferred })}
                            className="p-1 rounded-lg hover:bg-muted transition"
                            title="Toggle preferred floor"
                          >
                            <Star
                              className={
                                a.preferred
                                  ? "h-5 w-5 fill-amber-400 text-amber-400"
                                  : "h-5 w-5 text-muted-foreground/50"
                              }
                            />
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={a.status === "ACTIVE"}
                              onCheckedChange={(checked) =>
                                updateAllocation(a._id, { status: checked ? "ACTIVE" : "INACTIVE" })
                              }
                            />
                            <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] font-bold">
                              {a.status}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Native App Cards */}
          <div className="space-y-2.5 md:hidden">
            {allocations.map((a) => {
              const Icon = VEHICLE_ICONS[a.vehicleType];
              const percent = a.capacity > 0 ? Math.min(100, Math.round(((a.occupied ?? 0) / a.capacity) * 100)) : 0;

              return (
                <div key={a._id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-3 tap-bounce">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold">{companyName(a.companyId)}</p>
                      <p className="truncate text-xs text-muted-foreground">{floorLabel(a.floorId)}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border bg-muted/40 text-xs font-bold">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        {a.vehicleType}
                      </div>
                      <button
                        type="button"
                        onClick={() => updateAllocation(a._id, { preferred: !a.preferred })}
                        aria-label="Toggle preferred"
                        className="p-1"
                      >
                        <Star
                          className={
                            a.preferred
                              ? "h-4 w-4 fill-amber-400 text-amber-400"
                              : "h-4 w-4 text-muted-foreground/50"
                          }
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground font-semibold">Cap:</Label>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={a.capacity}
                        className="h-8 w-16 text-center font-bold text-xs rounded-lg"
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value !== a.capacity) updateAllocation(a._id, { capacity: value });
                        }}
                      />
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-foreground">
                        {a.occupied ?? 0} / {a.capacity}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-semibold">{percent}% occupied</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={a.status === "ACTIVE"}
                        onCheckedChange={(checked) =>
                          updateAllocation(a._id, { status: checked ? "ACTIVE" : "INACTIVE" })
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
