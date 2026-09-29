"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProject } from "@/lib/project-context";
import { apiFetch } from "@/lib/api";
import { AvailabilityStatus, Company, VehicleType } from "@/lib/types";
import { useProjectRealtime } from "@/hooks/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ParkingSquare,
  Car,
  Bike,
  Truck,
  Layers,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import Link from "next/link";

interface Summary {
  totalCapacity: number;
  totalOccupied: number;
  totalAvailable: number;
  activeVehicles: number;
}

interface FloorVehicleBreakdown {
  vehicleType: VehicleType;
  capacity: number;
  occupied: number;
  available: number;
  status: AvailabilityStatus;
}

interface FloorDashboardEntry {
  floorId: string;
  name: string;
  code: string;
  status: string;
  vehicleTypes: FloorVehicleBreakdown[];
}

interface CompanyAllocationRow {
  floorId: string;
  floorName: string;
  floorCode: string;
  vehicleType: VehicleType;
  capacity: number;
  occupied: number;
  available: number;
  status: AvailabilityStatus;
}

const VEHICLE_ICONS: Record<VehicleType, typeof Car> = { CAR: Car, BIKE: Bike, OTHER: Truck };
const VEHICLE_LABELS: Record<VehicleType, string> = { CAR: "Cars", BIKE: "Bikes", OTHER: "Other Vehicles" };

const STATUS_STYLES: Record<
  AvailabilityStatus,
  { tile: string; iconBox: string; bar: string; chip: string; Icon: typeof CheckCircle2; word: string; headline: string }
> = {
  AVAILABLE: {
    tile: "bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/20",
    iconBox: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    chip: "bg-emerald-600 text-white font-bold",
    Icon: CheckCircle2,
    word: "Available",
    headline: "Parking Available",
  },
  LIMITED: {
    tile: "bg-amber-500/5 border-amber-500/30 dark:bg-amber-950/20",
    iconBox: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    chip: "bg-amber-600 text-white font-bold",
    Icon: AlertTriangle,
    word: "Almost Full",
    headline: "Limited Spaces Left",
  },
  FULL: {
    tile: "bg-rose-500/5 border-rose-500/30 dark:bg-rose-950/20",
    iconBox: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    chip: "bg-rose-600 text-white font-bold",
    Icon: XCircle,
    word: "Full",
    headline: "Facility at Capacity",
  },
};

function overallStatus(available: number, capacity: number): AvailabilityStatus {
  if (available <= 0) return "FULL";
  if (available <= Math.max(3, Math.round(capacity * 0.1))) return "LIMITED";
  return "AVAILABLE";
}

export default function AdminDashboardPage() {
  const { currentProjectId, currentProject } = useProject();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [floors, setFloors] = useState<FloorDashboardEntry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companyRows, setCompanyRows] = useState<CompanyAllocationRow[]>([]);

  const loadAll = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const [summaryData, floorData] = await Promise.all([
        apiFetch<Summary>(`/api/dashboard/summary?projectId=${currentProjectId}`),
        apiFetch<{ floors: FloorDashboardEntry[] }>(`/api/dashboard/floors?projectId=${currentProjectId}`),
      ]);
      setSummary(summaryData);
      setFloors(floorData.floors);
    } catch (err) {
      console.error("Failed to load dashboard summary", err);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!currentProjectId) return;
    setCompanies([]);
    setSelectedCompanyId("");
    setCompanyRows([]);
    apiFetch<{ companies: Company[] }>(`/api/companies?projectId=${currentProjectId}`)
      .then((d) => {
        setCompanies(d.companies);
        setSelectedCompanyId(d.companies[0]?._id ?? "");
      })
      .catch((err) => console.error("Failed to load companies", err));
  }, [currentProjectId]);

  const loadCompany = useCallback(async () => {
    if (!currentProjectId || !selectedCompanyId) return;
    try {
      const data = await apiFetch<{ allocations: CompanyAllocationRow[] }>(
        `/api/dashboard/company?projectId=${currentProjectId}&companyId=${selectedCompanyId}`
      );
      setCompanyRows(data.allocations);
    } catch (err) {
      console.error("Failed to load company parking", err);
      setCompanyRows([]);
    }
  }, [currentProjectId, selectedCompanyId]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      loadAll();
      loadCompany();
    }, 300);
  }, [loadAll, loadCompany]);

  useProjectRealtime(currentProjectId, { onAvailabilityUpdate: scheduleRefetch });

  const capacity = summary?.totalCapacity ?? 0;
  const available = summary?.totalAvailable ?? 0;
  const parked = summary?.totalOccupied ?? 0;
  const occupancyPercent = capacity > 0 ? Math.min(100, Math.round((parked / capacity) * 100)) : 0;
  const banner = capacity > 0 ? STATUS_STYLES[overallStatus(available, capacity)] : null;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Live Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Overview Dashboard</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time parking availability and occupancy for <span className="font-bold text-foreground">{currentProject?.name}</span>.
          </p>
        </div>

        {/* Quick Gate Launchers */}
        <div className="flex items-center gap-2">
          <Link
            href="/gate/entry"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition tap-bounce shadow-xs"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Entry Terminal
          </Link>
          <Link
            href="/gate/exit"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold transition tap-bounce shadow-xs"
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Exit Terminal
          </Link>
        </div>
      </div>

      {/* Main Status Hero Banner */}
      {capacity === 0 ? (
        <Card className="border-dashed border-2 bg-card/60">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ParkingSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-bold">No parking allocations configured yet</p>
              <p className="text-xs text-muted-foreground">
                Set up parking floors and allocate spaces to companies to activate real-time tracking.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        banner && (
          <div className={cn("rounded-2xl border-2 p-4 sm:p-5 shadow-sm transition-all", banner.tile)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-xs", banner.iconBox)}>
                  <banner.Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg sm:text-xl font-black tracking-tight">{banner.headline}</p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", banner.chip)}>
                      {available} Spots Free
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {parked} vehicles currently parked across the building · {occupancyPercent}% occupied.
                  </p>
                </div>
              </div>

              {/* Visual meter bar */}
              <div className="w-full sm:w-64 space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-muted-foreground">Occupancy</span>
                  <span className="text-foreground">{occupancyPercent}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", banner.bar)}
                    style={{ width: `${occupancyPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* 3 Elevated Stat Metric Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <ModernStatCard
          label="Total Capacity"
          hint="All allocated spots"
          value={capacity}
          icon={ParkingSquare}
          color="text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
        />
        <ModernStatCard
          label="Vehicles Parked"
          hint="Currently inside"
          value={parked}
          icon={Car}
          color="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
        />
        <ModernStatCard
          label="Free Spots"
          hint="Available right now"
          value={available}
          icon={CheckCircle2}
          color="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        />
      </div>

      {/* Parking Breakdown by Floor */}
      <Card className="rounded-2xl border border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Parking Status by Floor</CardTitle>
              <p className="text-xs text-muted-foreground">Live breakdown across all basement &amp; parking levels</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-3">
          {floors.map((floor) =>
            floor.vehicleTypes.length === 0 ? (
              <div
                key={floor.floorId}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <Badge variant="outline" className="font-mono font-bold text-xs">
                    {floor.code}
                  </Badge>
                  <p className="text-sm font-bold">{floor.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">No parking allocations configured</p>
              </div>
            ) : (
              <div key={floor.floorId} className="rounded-xl border border-border/70 bg-card p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 font-black text-xs">
                      {floor.code}
                    </div>
                    <span className="text-sm sm:text-base font-extrabold">{floor.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {floor.vehicleTypes.reduce((s, vt) => s + vt.available, 0)} total free spots
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {floor.vehicleTypes.map((vt) => (
                    <VehicleTile
                      key={vt.vehicleType}
                      vehicleType={vt.vehicleType}
                      capacity={vt.capacity}
                      occupied={vt.occupied}
                      available={vt.available}
                      status={vt.status}
                    />
                  ))}
                </div>
              </div>
            )
          )}

          {floors.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No parking floors created yet. Go to Floors to add parking levels.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Parking Inspection Card */}
      <Card className="rounded-2xl border border-border/80 shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Company Specific Allocations</CardTitle>
              <p className="text-xs text-muted-foreground">Check real-time slot usage for a specific tenant</p>
            </div>
          </div>

          <Select value={selectedCompanyId} onValueChange={(v) => v && setSelectedCompanyId(v)}>
            <SelectTrigger className="w-full sm:w-64 h-10 rounded-xl font-bold border-2">
              <SelectValue placeholder="Choose a company">
                {(v: string | null) => companies.find((c) => c._id === v)?.name ?? "Choose a company"}
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
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {companyRows.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {companyRows.map((row) => (
                <VehicleTile
                  key={`${row.floorId}-${row.vehicleType}`}
                  vehicleType={row.vehicleType}
                  capacity={row.capacity}
                  occupied={row.occupied}
                  available={row.available}
                  status={row.status}
                  floorLabel={`${row.floorName} (${row.floorCode})`}
                />
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground text-sm">
              This company currently does not have any active parking allocations.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModernStatCard({
  label,
  hint,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  hint: string;
  value: number;
  icon: typeof ParkingSquare;
  color: string;
}) {
  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs hover:shadow-md transition-all tap-bounce">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground truncate">{label}</span>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl border", color)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl sm:text-3xl font-black tracking-tight">{value.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5 hidden sm:block">{hint}</p>
      </CardContent>
    </Card>
  );
}

function VehicleTile({
  vehicleType,
  capacity,
  occupied,
  available,
  status,
  floorLabel,
}: {
  vehicleType: VehicleType;
  capacity: number;
  occupied: number;
  available: number;
  status: AvailabilityStatus;
  floorLabel?: string;
}) {
  const Icon = VEHICLE_ICONS[vehicleType];
  const style = STATUS_STYLES[status];
  const pct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;

  return (
    <div className={cn("rounded-xl border-2 p-3 sm:p-4 transition-all tap-bounce shadow-xs", style.tile)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", style.iconBox)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">{VEHICLE_LABELS[vehicleType]}</p>
            {floorLabel && <p className="text-[10px] text-muted-foreground truncate">{floorLabel}</p>}
          </div>
        </div>

        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", style.chip)}>
          {style.word}
        </span>
      </div>

      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-lg font-black tracking-tight">
          {available > 0 ? `${available} free` : "Full"}
        </span>
        <span className="text-xs text-muted-foreground font-semibold">
          {occupied} / {capacity} taken
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className={cn("h-full rounded-full transition-all duration-500", style.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
