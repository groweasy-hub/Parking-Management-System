"use client";

import { useCallback, useEffect, useState } from "react";
import { useProject } from "@/lib/project-context";
import { apiFetch } from "@/lib/api";
import { AuditLogEntry } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Clock,
  User as UserIcon,
  Tag,
  FileCode
} from "lucide-react";

export default function AuditLogsPage() {
  const { currentProjectId } = useProject();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 50;

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ logs: AuditLogEntry[]; total: number }>(
        `/api/audit-logs?projectId=${currentProjectId}&page=${page}&pageSize=${pageSize}`
      );
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, page]);

  useEffect(() => {
    load();
  }, [load]);

  function getActionBadgeVariant(action: string) {
    const act = action.toUpperCase();
    if (act.includes("CREATE") || act.includes("INSERT")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (act.includes("DELETE") || act.includes("REMOVE")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    }
    if (act.includes("UPDATE") || act.includes("EDIT")) {
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
    if (act.includes("RECONCILE") || act.includes("CORRECT")) {
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    }
    return "bg-secondary text-secondary-foreground border-border";
  }

  function renderMetadataBadges(metadata: Record<string, unknown> | undefined) {
    if (!metadata || Object.keys(metadata).length === 0) {
      return <span className="text-muted-foreground italic text-xs">—</span>;
    }
    const entries = Object.entries(metadata).slice(0, 3);
    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([key, val]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
          >
            <span className="font-semibold text-foreground">{key}:</span>
            <span className="truncate max-w-[140px]">
              {typeof val === "object" ? JSON.stringify(val) : String(val)}
            </span>
          </span>
        ))}
        {Object.keys(metadata).length > 3 && (
          <span className="text-[10px] text-muted-foreground self-center">
            +{Object.keys(metadata).length - 3} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Audit Trail"
        description="Immutable record of system activities, configuration changes, gate actions, and security events."
      />

      {loading ? (
        <Card className="border border-border/80">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-sm">Fetching audit entries...</p>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card className="border border-dashed border-border/80">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-bold text-foreground">No Audit Records Yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              User actions, gate passes, floor modifications, and allocation updates will be preserved here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block border border-border/80 shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[160px]">Operator / Actor</TableHead>
                    <TableHead className="w-[140px]">Action</TableHead>
                    <TableHead className="w-[140px]">Target Entity</TableHead>
                    <TableHead>Metadata &amp; Parameters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log._id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                          <span className="font-semibold text-foreground">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {log.userId?.name ?? "System Engine"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[11px] ${getActionBadgeVariant(log.action)}`}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                          <Tag className="h-3 w-3 text-primary" />
                          {log.entityType}
                        </span>
                      </TableCell>
                      <TableCell>
                        {renderMetadataBadges(log.metadata)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile App Cards View */}
          <div className="space-y-3 md:hidden">
            {logs.map((log) => (
              <div
                key={log._id}
                className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs space-y-2.5 transition active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`font-mono text-xs ${getActionBadgeVariant(log.action)}`}>
                    {log.action}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-sm">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {log.userId?.name ?? "System Engine"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-primary">
                    <Tag className="h-3 w-3" />
                    {log.entityType}
                  </span>
                </div>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="rounded-lg bg-muted/40 p-2 text-xs font-mono">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1 text-[11px]">
                      <FileCode className="h-3 w-3" /> Event Payload:
                    </div>
                    {renderMetadataBadges(log.metadata)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground pt-2">
        <span className="font-medium">
          Showing <span className="text-foreground font-bold">{logs.length}</span> of{" "}
          <span className="text-foreground font-bold">{total}</span> total entries
        </span>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-8 rounded-lg gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="px-2 font-semibold text-foreground">
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page * pageSize >= total || loading}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 rounded-lg gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
