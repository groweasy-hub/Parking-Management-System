"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Database
} from "lucide-react";

interface ReconcileResult {
  allocationId: string;
  companyName: string;
  floorName: string;
  vehicleType: string;
  previousOccupied: number;
  actualOccupied: number;
  corrected: boolean;
}

export default function SettingsPage() {
  const { currentProjectId } = useProject();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ReconcileResult[] | null>(null);
  const [stats, setStats] = useState<{ checked: number; corrected: number } | null>(null);

  async function handleReconcile() {
    if (!currentProjectId) return;
    setRunning(true);
    try {
      const data = await apiFetch<{ checked: number; corrected: number; results: ReconcileResult[] }>(
        "/api/settings/reconcile-occupancy",
        { method: "POST", body: JSON.stringify({ projectId: currentProjectId }) }
      );
      setResults(data.results);
      setStats({ checked: data.checked, corrected: data.corrected });
      if (data.corrected > 0) {
        toast.success(`Successfully reconciled: ${data.corrected} out-of-sync allocations updated.`);
      } else {
        toast.success(`All ${data.checked} allocations are already in perfect sync!`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to reconcile occupancy.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Settings & System Maintenance"
        description="Data integrity utilities, automated occupancy counters, and project maintenance tools."
      />

      <Card className="border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-emerald-500 to-primary" />
        <CardHeader className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Recalculate &amp; Reconcile Occupancy Counters
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm leading-relaxed max-w-2xl">
                Recomputes each allocation&apos;s occupancy counter against active parking sessions (the authoritative ground truth).
                If unexpected system restarts or network interrupts ever caused drift, this instantly syncs counters and generates an audit log entry.
              </CardDescription>
            </div>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <RefreshCw className="h-6 w-6" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-0 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleReconcile}
              disabled={running}
              size="lg"
              className="h-11 rounded-xl px-5 font-bold shadow-md shadow-primary/20 gap-2"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {running ? "Scanning Active Sessions..." : "Run Occupancy Reconcile"}
            </Button>

            {stats && (
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-semibold text-foreground">
                  Checked: {stats.checked}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                    stats.corrected > 0
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {stats.corrected > 0 ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Corrected: {stats.corrected}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      100% In Sync
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {results && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  Reconciliation Results Breakdown
                </h3>
                <span className="text-xs text-muted-foreground">{results.length} allocations evaluated</span>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Vehicle Type</TableHead>
                      <TableHead>Previous Counter</TableHead>
                      <TableHead>Actual Active Sessions</TableHead>
                      <TableHead className="text-right">Sync Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.allocationId} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-foreground">{r.companyName}</TableCell>
                        <TableCell>
                          <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                            {r.floorName}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {r.vehicleType}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{r.previousOccupied}</TableCell>
                        <TableCell className="font-mono text-sm font-bold text-foreground">
                          {r.actualOccupied}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.corrected ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1">
                              <AlertTriangle className="h-3 w-3" /> Corrected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> In Sync
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile App Cards View */}
              <div className="space-y-2.5 md:hidden">
                {results.map((r) => (
                  <div
                    key={r.allocationId}
                    className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs space-y-2 transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{r.companyName}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.floorName} • <span className="font-semibold text-primary">{r.vehicleType}</span>
                        </p>
                      </div>
                      {r.corrected ? (
                        <Badge className="bg-amber-500 text-white text-[11px] gap-1 shrink-0">
                          <AlertTriangle className="h-3 w-3" /> Corrected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> In Sync
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-2 text-xs">
                      <span className="text-muted-foreground">Previous:</span>
                      <span className="font-mono font-semibold text-muted-foreground">{r.previousOccupied}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Actual:</span>
                      <span className="font-mono font-bold text-foreground">{r.actualOccupied}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
