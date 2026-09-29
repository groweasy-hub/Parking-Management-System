"use client";

import { useCallback, useEffect, useState } from "react";
import { useProject } from "@/lib/project-context";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AvailabilityBadge } from "@/components/availability-badge";
import { PageHeader } from "@/components/page-header";
import {
  Loader2,
  TrendingUp,
  Clock,
  Car,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Layers,
  PieChart
} from "lucide-react";

interface DayRow {
  date: string;
  entries: number;
  exits: number;
}

interface UtilizationRow {
  allocationId: string;
  company: string;
  floor: string;
  vehicleType: string;
  capacity: number;
  occupied: number;
  utilizationPct: number;
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hrs}h ${remainingMins}m`;
}

export default function ReportsPage() {
  const { currentProjectId } = useProject();
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));

  const [days, setDays] = useState<DayRow[]>([]);
  const [utilization, setUtilization] = useState<UtilizationRow[]>([]);
  const [peak, setPeak] = useState<{ peakOccupancy: number; peakTime: string | null } | null>(null);
  const [avgDuration, setAvgDuration] = useState<{ averageDurationMinutes: number; sampledSessions: number } | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: currentProjectId, from, to });
      const [entriesExits, util, peakData, duration, active] = await Promise.all([
        apiFetch<{ days: DayRow[] }>(`/api/reports/entries-exits?${params}`),
        apiFetch<{ rows: UtilizationRow[] }>(`/api/reports/utilization?projectId=${currentProjectId}`),
        apiFetch<{ peakOccupancy: number; peakTime: string | null }>(`/api/reports/peak-occupancy?${params}`),
        apiFetch<{ averageDurationMinutes: number; sampledSessions: number }>(`/api/reports/average-duration?${params}`),
        apiFetch<{ activeVehicles: number }>(`/api/reports/active-vehicles?projectId=${currentProjectId}`),
      ]);
      setDays(entriesExits.days);
      setUtilization(util.rows);
      setPeak(peakData);
      setAvgDuration(duration);
      setActiveCount(active.activeVehicles);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const totalEntries = days.reduce((acc, d) => acc + d.entries, 0);
  const totalExits = days.reduce((acc, d) => acc + d.exits, 0);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Analytics & Reports"
        description="Real-time occupancy metrics, vehicle turnover rates, and parking allocation utilization."
      />

      {/* Date Range Selector Bar */}
      <Card className="border border-border/80 bg-card/60 backdrop-blur-sm shadow-xs">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Quick Range:
            </span>
            <Button
              type="button"
              variant={from === isoDaysAgo(0) && to === isoDaysAgo(0) ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() => {
                setFrom(isoDaysAgo(0));
                setTo(isoDaysAgo(0));
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant={from === isoDaysAgo(7) && to === isoDaysAgo(0) ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() => {
                setFrom(isoDaysAgo(7));
                setTo(isoDaysAgo(0));
              }}
            >
              Last 7 Days
            </Button>
            <Button
              type="button"
              variant={from === isoDaysAgo(30) && to === isoDaysAgo(0) ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() => {
                setFrom(isoDaysAgo(30));
                setTo(isoDaysAgo(0));
              }}
            >
              Last 30 Days
            </Button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 w-36 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 w-36 rounded-lg text-xs"
              />
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Card className="border border-border/80 bg-gradient-to-br from-card to-card/60 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Now</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Car className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{activeCount ?? 0}</span>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Vehicles currently parked</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-gradient-to-br from-card to-card/60 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peak Load</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{peak?.peakOccupancy ?? 0}</span>
              <span className="text-xs text-muted-foreground font-medium">max</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {peak?.peakTime ? `Recorded ${new Date(peak.peakTime).toLocaleDateString([], { month: "short", day: "numeric" })}` : "Within selected range"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-gradient-to-br from-card to-card/60 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Duration</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {formatDuration(avgDuration?.averageDurationMinutes ?? 0)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {avgDuration?.sampledSessions ?? 0} sample sessions
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-gradient-to-br from-card to-card/60 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Throughput</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{totalEntries + totalExits}</span>
              <span className="text-xs text-muted-foreground font-medium">moves</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="text-emerald-600 font-medium">+{totalEntries} in</span> ·{" "}
              <span className="text-amber-600 font-medium">-{totalExits} out</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Allocation Utilization Breakdown */}
      <Card className="border border-border/80 bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Parking Space Utilization
            </CardTitle>
            <CardDescription className="text-xs">
              Live capacity breakdown grouped by company, parking level, and vehicle category.
            </CardDescription>
          </div>
          <span className="text-xs font-semibold rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
            {utilization.length} Allocations
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {utilization.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No allocations configured for this project.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <Table className="hidden md:table">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[200px]">Company</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Occupancy / Total</TableHead>
                    <TableHead className="w-[180px]">Usage Meter</TableHead>
                    <TableHead className="text-right">Availability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utilization.map((row) => {
                    const available = row.capacity - row.occupied;
                    const status = available <= 0 ? "FULL" : available <= 3 ? "LIMITED" : "AVAILABLE";
                    const meterColor =
                      row.utilizationPct >= 95
                        ? "bg-rose-500"
                        : row.utilizationPct >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500";

                    return (
                      <TableRow key={row.allocationId} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-foreground">{row.company}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-medium">
                            <Layers className="h-3 w-3 text-muted-foreground" />
                            {row.floor}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {row.vehicleType}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-baseline gap-1 text-sm">
                            <span className="font-bold text-foreground">{row.occupied}</span>
                            <span className="text-xs text-muted-foreground">/ {row.capacity} slots</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground font-medium">{row.utilizationPct}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className={`h-full transition-all duration-300 ${meterColor}`}
                                style={{ width: `${Math.min(100, Math.max(0, row.utilizationPct))}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <AvailabilityBadge status={status} available={available} size="sm" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Mobile Cards (App Style) */}
              <div className="space-y-3 p-3.5 md:hidden">
                {utilization.map((row) => {
                  const available = row.capacity - row.occupied;
                  const status = available <= 0 ? "FULL" : available <= 3 ? "LIMITED" : "AVAILABLE";
                  const meterColor =
                    row.utilizationPct >= 95
                      ? "bg-rose-500"
                      : row.utilizationPct >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500";

                  return (
                    <div
                      key={row.allocationId}
                      className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs space-y-2.5 transition active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">{row.company}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                              {row.floor}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-primary">{row.vehicleType}</span>
                          </div>
                        </div>
                        <AvailabilityBadge status={status} available={available} size="sm" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            <strong className="text-foreground">{row.occupied}</strong> of {row.capacity} slots filled
                          </span>
                          <span className="font-bold text-foreground">{row.utilizationPct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={`h-full transition-all duration-300 ${meterColor}`}
                            style={{ width: `${Math.min(100, Math.max(0, row.utilizationPct))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Daily Entries & Exits Activity Table */}
      <Card className="border border-border/80 bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Daily Entry &amp; Exit Activity
            </CardTitle>
            <CardDescription className="text-xs">
              Daily vehicle movement volume across the selected date range.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="h-3.5 w-3.5" /> {totalEntries} Entries
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <ArrowUpRight className="h-3.5 w-3.5" /> {totalExits} Exits
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Exits</TableHead>
                <TableHead className="text-right">Net Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => {
                const net = d.entries - d.exits;
                return (
                  <TableRow key={d.date} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">
                      {new Date(d.date).toLocaleDateString([], {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        <ArrowDownLeft className="h-3 w-3" />
                        {d.entries}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                        <ArrowUpRight className="h-3 w-3" />
                        {d.exits}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                          net > 0
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : net < 0
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {net > 0 ? `+${net}` : net}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {days.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No activity recorded in this date range.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
