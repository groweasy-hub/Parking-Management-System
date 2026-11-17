"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AvailabilityBadge } from "@/components/availability-badge";
import { PageHeader } from "@/components/page-header";
import { Loader2, Car, Activity, ArrowUpRight, ArrowDownLeft, Calendar, Layers, PieChart } from "lucide-react";

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
  const date = new Date(Date.now() - days * 86400000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const { currentProjectId } = useProject();
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("day");

  const [days, setDays] = useState<DayRow[]>([]);
  const [utilization, setUtilization] = useState<UtilizationRow[]>([]);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    if (!from || !to || from > to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: currentProjectId, from, to });
      const [entriesExits, util, active] = await Promise.all([
        apiFetch<{ days: DayRow[] }>(`/api/reports/entries-exits?${params}`),
        apiFetch<{ rows: UtilizationRow[] }>(`/api/reports/utilization?projectId=${currentProjectId}`),
        apiFetch<{ activeVehicles: number }>(`/api/reports/active-vehicles?projectId=${currentProjectId}`),
      ]);
      setDays(entriesExits.days);
      setUtilization(util.rows);
      setActiveCount(active.activeVehicles);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const reportRows = useMemo(() => {
    const grouped = new Map<string, DayRow>();
    for (const row of days) {
      const date = new Date(`${row.date}T00:00:00`);
      let key = row.date;
      if (period === "week") {
        date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        key = `Week of ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      } else if (period === "month") key = row.date.slice(0, 7);
      else if (period === "year") key = row.date.slice(0, 4);
      const current = grouped.get(key) ?? { date: key, entries: 0, exits: 0 };
      current.entries += row.entries;
      current.exits += row.exits;
      grouped.set(key, current);
    }
    return [...grouped.values()];
  }, [days, period]);
  const totalEntries = reportRows.reduce((acc, d) => acc + d.entries, 0);
  const totalExits = reportRows.reduce((acc, d) => acc + d.exits, 0);
  const barMax = Math.max(1, ...reportRows.flatMap((row) => [row.entries, row.exits]));
  const vehicleTotals = ["CAR", "BIKE", "OTHER"].map((type) => ({
    type,
    count: utilization.filter((row) => row.vehicleType === type).reduce((sum, row) => sum + row.occupied, 0),
  }));
  const vehicleTotal = vehicleTotals.reduce((sum, item) => sum + item.count, 0);
  const pieColors = ["#2563eb", "#10b981", "#f59e0b"];
  let piePosition = 0;
  const pieStops = vehicleTotals.map((item, index) => {
    const start = piePosition;
    piePosition += vehicleTotal ? (item.count / vehicleTotal) * 100 : 0;
    return `${pieColors[index]} ${start}% ${piePosition}%`;
  }).join(", ");

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Parking Reports"
        description="Vehicle entries, exits, and what is parked right now."
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
            <select aria-label="Report period" value={period} onChange={(event) => {
              const nextPeriod = event.target.value as typeof period;
              setPeriod(nextPeriod);
              const now = new Date();
              const start = new Date(now);
              if (nextPeriod === "day") start.setHours(0, 0, 0, 0);
              if (nextPeriod === "week") start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
              if (nextPeriod === "month") start.setDate(1);
              if (nextPeriod === "year") { start.setMonth(0, 1); }
              setFrom(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`);
              setTo(isoDaysAgo(0));
            }} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
              <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option><option value="year">Yearly</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Vehicles entered" value={totalEntries} caption="During the selected dates" color="text-blue-700" />
        <SummaryCard title="Vehicles exited" value={totalExits} caption="During the selected dates" color="text-amber-700" />
        <SummaryCard title="Parked right now" value={activeCount ?? 0} caption="Currently inside the parking area" color="text-emerald-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Vehicles in and out</CardTitle><CardDescription>Compare entries and exits for each {period}.</CardDescription></CardHeader>
          <CardContent>
            {reportRows.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">No vehicle movement in this date range.</p> : (
              <div className="flex min-h-56 items-end gap-3 overflow-x-auto border-b border-border px-2 pt-4">
                {reportRows.map((row) => (
                  <div key={row.date} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                    <div className="flex h-40 w-full items-end justify-center gap-1.5">
                      <div title={`${row.entries} entered`} className="w-3.5 rounded-t bg-blue-600" style={{ height: `${Math.max(row.entries ? 5 : 0, row.entries / barMax * 100)}%` }} />
                      <div title={`${row.exits} exited`} className="w-3.5 rounded-t bg-amber-500" style={{ height: `${Math.max(row.exits ? 5 : 0, row.exits / barMax * 100)}%` }} />
                    </div>
                    <span className="max-w-20 truncate text-[10px] text-muted-foreground">{shortPeriodLabel(row.date, period)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-5 text-xs"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-blue-600" />Entered</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Exited</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Parked by vehicle type</CardTitle><CardDescription>Vehicles inside right now.</CardDescription></CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
              <div role="img" aria-label={`Vehicle type breakdown: ${vehicleTotals.map((item) => `${item.type} ${item.count}`).join(", ")}`} className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: vehicleTotal ? `conic-gradient(${pieStops})` : "conic-gradient(#e5e7eb 0% 100%)" }}>
                <div className="absolute inset-8 flex items-center justify-center rounded-full bg-card text-center"><div><strong className="block text-2xl">{vehicleTotal}</strong><span className="text-[10px] text-muted-foreground">parked</span></div></div>
              </div>
              <div className="space-y-3">
                {vehicleTotals.map((item, index) => <div key={item.type} className="flex min-w-28 items-center justify-between gap-5 text-sm"><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ backgroundColor: pieColors[index] }} />{item.type === "OTHER" ? "Other" : item.type === "BIKE" ? "Bikes" : "Cars"}</span><strong>{item.count}</strong></div>)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="border border-border/80 bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Parking spaces by company
            </CardTitle>
            <CardDescription className="text-xs">
              Parked vehicles compared with spaces assigned to each company.
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

      <Card className="border border-border/80 bg-card shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Movement details
            </CardTitle>
            <CardDescription className="text-xs">
              Entry and exit totals for each selected {period}.
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
                <TableHead>Period</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Exits</TableHead>
                <TableHead className="text-right">Net Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportRows.map((d) => {
                const net = d.entries - d.exits;
                return (
                  <TableRow key={d.date} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">
                      {d.date.startsWith("Week of ") ? d.date : new Date(`${d.date.length === 4 ? `${d.date}-01-01` : d.date.length === 7 ? `${d.date}-01` : d.date}T00:00:00`).toLocaleDateString([], {
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
              {reportRows.length === 0 && (
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

function shortPeriodLabel(value: string, period: "day" | "week" | "month" | "year") {
  const dateText = value.startsWith("Week of ") ? value.slice(8) : value;
  if (period === "year") return dateText;
  const date = new Date(`${dateText.length === 4 ? `${dateText}-01-01` : dateText.length === 7 ? `${dateText}-01` : dateText}T00:00:00`);
  return date.toLocaleDateString([], period === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" });
}

function SummaryCard({ title, value, caption, color }: { title: string; value: number; caption: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-muted-foreground">{title}</span>
          <Car className={`h-4 w-4 ${color}`} />
        </div>
        <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}
