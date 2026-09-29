"use client";

import { useCallback, useEffect, useState } from "react";
import { useProject } from "@/lib/project-context";
import { apiFetch, apiUrl } from "@/lib/api";
import { Company, Floor, ParkingSessionRecord, VEHICLE_TYPES } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Download, Loader2, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";

function fieldName(value: { name: string } | string | null | undefined): string {
  if (!value) return "—";
  return typeof value === "string" ? value : value.name;
}

export default function HistoryPage() {
  const { currentProjectId } = useProject();
  const [sessions, setSessions] = useState<ParkingSessionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);

  const [companyId, setCompanyId] = useState("all");
  const [floorId, setFloorId] = useState("all");
  const [vehicleType, setVehicleType] = useState("all");
  const [status, setStatus] = useState("all");
  const [vehicleNumber, setVehicleNumber] = useState("");

  const pageSize = 25;

  useEffect(() => {
    if (!currentProjectId) return;
    apiFetch<{ companies: Company[] }>(`/api/companies?projectId=${currentProjectId}`).then((d) => setCompanies(d.companies));
    apiFetch<{ floors: Floor[] }>(`/api/floors?projectId=${currentProjectId}`).then((d) => setFloors(d.floors));
  }, [currentProjectId]);

  const buildParams = useCallback(() => {
    if (!currentProjectId) return null;
    const params = new URLSearchParams({ projectId: currentProjectId, page: String(page), pageSize: String(pageSize) });
    if (companyId !== "all") params.set("companyId", companyId);
    if (floorId !== "all") params.set("floorId", floorId);
    if (vehicleType !== "all") params.set("vehicleType", vehicleType);
    if (status !== "all") params.set("status", status);
    if (vehicleNumber.trim()) params.set("vehicleNumber", vehicleNumber.trim());
    return params;
  }, [currentProjectId, page, companyId, floorId, vehicleType, status, vehicleNumber]);

  const load = useCallback(async () => {
    const params = buildParams();
    if (!params) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ sessions: ParkingSessionRecord[]; total: number }>(`/api/parking/history?${params}`);
      setSessions(data.sessions);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
  }, [load]);

  function handleExport() {
    const params = buildParams();
    if (!params) return;
    window.open(apiUrl(`/api/reports/history/export?${params}`), "_blank");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking Activity History"
        description="Historical log of every vehicle entry and exit transaction across all gates."
        actions={
          <Button variant="outline" onClick={handleExport} className="rounded-xl font-bold gap-1.5 h-10 tap-bounce shadow-xs">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {/* Filter Card */}
      <Card className="rounded-2xl border border-border/80 shadow-xs">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plate number..."
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              className="pl-9 h-10 rounded-xl font-mono text-xs uppercase"
            />
          </div>

          <Select value={companyId} onValueChange={(v) => v && setCompanyId(v)}>
            <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
              <SelectValue placeholder="Company">
                {(v: string | null) => (v === "all" || !v ? "All companies" : companies.find((c) => c._id === v)?.name ?? "Company")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={floorId} onValueChange={(v) => v && setFloorId(v)}>
            <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
              <SelectValue placeholder="Floor">
                {(v: string | null) => (v === "all" || !v ? "All floors" : floors.find((f) => f._id === v)?.name ?? "Floor")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All floors</SelectItem>
              {floors.map((f) => (
                <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={vehicleType} onValueChange={(v) => v && setVehicleType(v)}>
            <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
              <SelectValue placeholder="Vehicle type">
                {(v: string | null) => (v === "all" || !v ? "All vehicle types" : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vehicle types</SelectItem>
              {VEHICLE_TYPES.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className="h-10 rounded-xl text-xs font-semibold">
              <SelectValue placeholder="Session status">
                {(v: string | null) => (v === "all" || !v ? "All statuses" : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">ACTIVE (Parked)</SelectItem>
              <SelectItem value="COMPLETED">COMPLETED (Exited)</SelectItem>
              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2 font-medium">Filtering parking history...</p>
        </div>
      ) : sessions.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2">
          <CardContent className="py-16 text-center text-muted-foreground space-y-2">
            <Filter className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="font-bold text-foreground">No sessions match these filters</p>
            <p className="text-xs">Adjust your search parameters or check another company or date.</p>
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
                    <TableHead>Session ID</TableHead>
                    <TableHead>Vehicle Plate</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Entry Time</TableHead>
                    <TableHead>Exit Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s._id} className="hover:bg-muted/30 transition">
                      <TableCell className="font-mono text-xs font-bold text-muted-foreground">{s.sessionCode}</TableCell>
                      <TableCell>
                        {s.vehicleNumber ? (
                          <span className="license-plate px-2.5 py-0.5 text-xs">{s.vehicleNumber}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-semibold">Not Provided</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold text-[11px]">{s.vehicleType}</Badge>
                      </TableCell>
                      <TableCell className="font-bold text-sm">{fieldName(s.companyId)}</TableCell>
                      <TableCell className="text-sm">{fieldName(s.floorId)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(s.entryTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.exitTime
                          ? new Date(s.exitTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={s.status === "ACTIVE" ? "default" : s.status === "COMPLETED" ? "secondary" : "destructive"}
                          className="font-bold text-[10px]"
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Native App Cards */}
          <div className="space-y-2.5 md:hidden">
            {sessions.map((s) => (
              <div key={s._id} className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs space-y-2.5 tap-bounce">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {s.vehicleNumber ? (
                      <span className="license-plate px-3 py-1 text-xs">{s.vehicleNumber}</span>
                    ) : (
                      <p className="font-bold text-sm text-foreground">No Plate Recorded</p>
                    )}
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">{s.sessionCode}</p>
                  </div>
                  <Badge
                    variant={s.status === "ACTIVE" ? "default" : s.status === "COMPLETED" ? "secondary" : "destructive"}
                    className="font-bold text-[10px]"
                  >
                    {s.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/50 pt-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Company</span>
                    <span className="font-bold text-foreground truncate block">{fieldName(s.companyId)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Floor &amp; Type</span>
                    <span className="font-medium text-foreground truncate block">{fieldName(s.floorId)} · {s.vehicleType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Entry</span>
                    <span className="text-muted-foreground text-[11px] block">
                      {new Date(s.entryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Exit</span>
                    <span className="text-muted-foreground text-[11px] block">
                      {s.exitTime ? new Date(s.exitTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active Inside"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground p-1">
        <span className="font-bold">{total.toLocaleString()} total record{total === 1 ? "" : "s"}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl h-9 font-bold"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl h-9 font-bold"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
