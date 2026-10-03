"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { deferNavigation } from "@/lib/deferred-navigation";
import { Gate, ParkingSessionRecord, VehicleType } from "@/lib/types";
import { useProjectRealtime } from "@/hooks/useRealtime";
import {
  TwoWheelerIllustration,
  FourWheelerIllustration,
  OthersIllustration,
} from "@/components/gate/GateVisuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Car,
  Search,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Building2,
  Layers,
  Sparkles,
  ChevronRight,
  RefreshCw,
  X,
  Camera,
  QrCode,
} from "lucide-react";

interface VehicleTypeConfig {
  type: VehicleType;
  label: string;
  sub: string;
  icon: ComponentType<{ className?: string }>;
  gradient: string;
  activeBorder: string;
  badgeBg: string;
}

const VEHICLE_TYPES_CONFIG: VehicleTypeConfig[] = [
  {
    type: "BIKE",
    label: "BIKE / 2W",
    sub: "Motorcycle, Scooter",
    icon: TwoWheelerIllustration,
    gradient: "from-emerald-600/10 via-teal-600/5 to-transparent border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    activeBorder: "border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-500/10",
    badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    type: "CAR",
    label: "CAR",
    sub: "Sedan, SUV, Hatchback",
    icon: FourWheelerIllustration,
    gradient: "from-blue-600/10 via-indigo-600/5 to-transparent border-blue-500/30 text-blue-600 dark:text-blue-400",
    activeBorder: "border-blue-600 ring-2 ring-blue-500/20 bg-blue-500/10",
    badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  {
    type: "OTHER",
    label: "OTHER",
    sub: "Van, Delivery, Truck",
    icon: OthersIllustration,
    gradient: "from-amber-600/10 via-orange-600/5 to-transparent border-amber-500/30 text-amber-600 dark:text-amber-400",
    activeBorder: "border-amber-600 ring-2 ring-amber-500/20 bg-amber-500/10",
    badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
];

function fieldName(value: { name: string } | string | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.name;
}

function fieldId(value: { _id: string } | string | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value._id;
}

function formatDuration(entryTime: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(entryTime).getTime());
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins} min${mins === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${mins} min${mins === 1 ? "" : "s"}`;
}

function VehicleTypeIllustration({ type, className }: { type: VehicleType; className?: string }) {
  if (type === "BIKE") return <TwoWheelerIllustration className={className} />;
  if (type === "CAR") return <FourWheelerIllustration className={className} />;
  return <OthersIllustration className={className} />;
}

export default function ExitGatePage() {
  const router = useRouter();
  const { currentProjectId } = useProject();

  const [exitGates, setExitGates] = useState<Gate[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ParkingSessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Workflow State:
  // Step 1: Default / Home screen (Enter Vehicle number OR Select Vehicle Type)
  // Step 2: Vehicle Type selected -> Shows Company List & Floors List
  // Step 3 (or Modal): Confirm Exit Dialog (2-3 steps total!)
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType | null>(null);
  const [viewTab, setViewTab] = useState<"companies" | "floors">("companies");

  // Selected company or floor to show sub-list if multiple vehicles
  const [activeCompanyFilter, setActiveCompanyFilter] = useState<string | null>(null);
  const [activeFloorFilter, setActiveFloorFilter] = useState<string | null>(null);

  // Direct Vehicle Plate / Code Search
  const [plateQuery, setPlateQuery] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrScanSupported, setQrScanSupported] = useState(true);
  const [qrSession, setQrSession] = useState<ParkingSessionRecord | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);

  // Target session for Exit Confirmation (renders in high-visibility ticket dialog)
  const [confirmSession, setConfirmSession] = useState<ParkingSessionRecord | null>(null);

  const loadSessions = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ sessions: ParkingSessionRecord[] }>(
        `/api/parking/active?projectId=${currentProjectId}`
      );
      setSessions(data.sessions);
    } catch {
      toast.error("Unable to load active vehicles.");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!currentProjectId) return;
    apiFetch<{ gates: Gate[] }>(`/api/gates?projectId=${currentProjectId}&type=EXIT`)
      .then((d) => {
        setExitGates(d.gates);
      })
      .catch(() => undefined);
  }, [currentProjectId]);

  useEffect(() => {
    apiFetch<{ duty: { gateId: { _id: string; type: "ENTRY" | "EXIT" } | string; gateType: "ENTRY" | "EXIT"; endedAt?: string | null } | null }>("/api/gate-duty/today")
      .then((data) => {
        if (!data.duty || data.duty.endedAt || data.duty.gateType !== "EXIT") {
          deferNavigation(() => router.replace("/gate/select"));
          return;
        }
        setSelectedGateId(typeof data.duty.gateId === "object" ? data.duty.gateId._id : data.duty.gateId);
      })
      .catch(() => deferNavigation(() => router.replace("/gate/select")));
  }, [router]);

  useProjectRealtime(currentProjectId, {
    onSessionEntry: () => loadSessions(),
    onSessionExit: (payload) => {
      setSessions((prev) => prev.filter((s) => s._id !== payload.sessionId));
      if (confirmSession?._id === payload.sessionId) {
        setConfirmSession(null);
      }
    },
  });

  const resetSelection = useCallback(() => {
    setSelectedVehicleType(null);
    setActiveCompanyFilter(null);
    setActiveFloorFilter(null);
    setPlateQuery("");
  }, []);

  const stopQrScanner = useCallback(() => {
    qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    qrStreamRef.current = null;
    setQrScanning(false);
  }, []);

  useEffect(() => {
    return () => stopQrScanner();
  }, [stopQrScanner]);

  const fetchQrSession = useCallback(
    async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed) {
        toast.error("Scan or paste a parking QR first.");
        return;
      }
      setQrLoading(true);
      try {
        const data = await apiFetch<{ session: ParkingSessionRecord }>(
          `/api/parking/qr?token=${encodeURIComponent(trimmed)}`
        );
        setQrSession(data.session);
        setConfirmSession(data.session);
        setQrToken("");
        stopQrScanner();
        toast.success("QR details loaded.", {
          description: `${data.session.vehicleNumber || data.session.sessionCode} is ready for exit confirmation.`,
        });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Unable to read this parking QR.");
      } finally {
        setQrLoading(false);
      }
    },
    [stopQrScanner]
  );

  const startQrScanner = useCallback(async () => {
    const BarcodeDetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!BarcodeDetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setQrScanSupported(false);
      toast.error("Camera QR scan is not supported on this browser. Paste the QR token instead.");
      return;
    }

    try {
      setQrScanSupported(true);
      setQrScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      qrStreamRef.current = stream;
      const video = qrVideoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      let active = true;
      const scan = async () => {
        if (!active || !qrStreamRef.current || !qrVideoRef.current) return;
        try {
          const codes = await detector.detect(qrVideoRef.current);
          const value = codes[0]?.rawValue;
          if (value) {
            active = false;
            setQrToken(value);
            await fetchQrSession(value);
            return;
          }
        } catch {
          // Keep the scan loop alive; camera frames can fail while focusing.
        }
        window.setTimeout(scan, 350);
      };
      scan();
    } catch {
      setQrScanning(false);
      toast.error("Unable to start camera. Paste the QR token instead.");
    }
  }, [fetchQrSession]);

  // Filtered active sessions for the currently selected vehicle type
  const activeSessionsForType = useMemo(() => {
    if (!selectedVehicleType) return [];
    return sessions.filter((s) => s.vehicleType === selectedVehicleType);
  }, [sessions, selectedVehicleType]);

  // Counts by vehicle type
  const vehicleCounts = useMemo(() => {
    return {
      CAR: sessions.filter((s) => s.vehicleType === "CAR").length,
      BIKE: sessions.filter((s) => s.vehicleType === "BIKE").length,
      OTHER: sessions.filter((s) => s.vehicleType === "OTHER").length,
    };
  }, [sessions]);

  // Direct plate search results
  const searchResults = useMemo(() => {
    const q = plateQuery.trim().toUpperCase().replace(/\s+/g, "");
    if (!q) return [];
    return sessions.filter((s) => {
      const plate = (s.vehicleNumber || "").toUpperCase().replace(/\s+/g, "");
      const code = s.sessionCode.toUpperCase();
      return plate.includes(q) || code.includes(q);
    });
  }, [sessions, plateQuery]);

  // Companies list for the selected vehicle type
  const companyList = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        logoUrl?: string;
        vehicles: ParkingSessionRecord[];
      }
    >();

    for (const s of activeSessionsForType) {
      const cId = fieldId(s.companyId);
      const cName = fieldName(s.companyId) || "General Tenant";
      const logo = typeof s.companyId === "object" ? s.companyId?.logoUrl : undefined;

      if (!map.has(cId)) {
        map.set(cId, { id: cId, name: cName, logoUrl: logo, vehicles: [] });
      }
      map.get(cId)!.vehicles.push(s);
    }

    return Array.from(map.values()).sort((a, b) => b.vehicles.length - a.vehicles.length);
  }, [activeSessionsForType]);

  // Floors list for the selected vehicle type
  const floorList = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        code?: string;
        vehicles: ParkingSessionRecord[];
      }
    >();

    for (const s of activeSessionsForType) {
      const fId = fieldId(s.floorId);
      const fName = fieldName(s.floorId) || "General Floor";
      const code = typeof s.floorId === "object" ? s.floorId?.code : undefined;

      if (!map.has(fId)) {
        map.set(fId, { id: fId, name: fName, code, vehicles: [] });
      }
      map.get(fId)!.vehicles.push(s);
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeSessionsForType]);

  // When operator clicks on a vehicle type (Step 1)
  function handleSelectVehicleType(type: VehicleType) {
    setSelectedVehicleType(type);
    setActiveCompanyFilter(null);
    setActiveFloorFilter(null);
    setPlateQuery("");
  }

  // When operator clicks on a company:
  // If exactly 1 vehicle: DIRECT CONFIRM! (2 STEPS TOTAL!)
  // If multiple vehicles: expand to pick vehicle (3 STEPS TOTAL!)
  function handleSelectCompany(item: { id: string; vehicles: ParkingSessionRecord[] }) {
    if (item.vehicles.length === 1) {
      setConfirmSession(item.vehicles[0]);
    } else {
      setActiveCompanyFilter(item.id);
    }
  }

  // When operator clicks on a floor:
  // If exactly 1 vehicle: DIRECT CONFIRM! (2 STEPS TOTAL!)
  // If multiple vehicles: expand to pick vehicle (3 STEPS TOTAL!)
  function handleSelectFloor(item: { id: string; vehicles: ParkingSessionRecord[] }) {
    if (item.vehicles.length === 1) {
      setConfirmSession(item.vehicles[0]);
    } else {
      setActiveFloorFilter(item.id);
    }
  }

  // Confirm Exit Execution
  async function handleConfirmExit() {
    if (!confirmSession || !selectedGateId) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/parking/exit", {
        method: "POST",
        body: JSON.stringify({ sessionId: confirmSession._id, exitGateId: selectedGateId }),
      });

      toast.success("Exit Confirmed · Barrier Opening", {
        description: `${confirmSession.vehicleNumber ?? confirmSession.sessionCode} marked as exited.`,
      });

      setSessions((prev) => prev.filter((s) => s._id !== confirmSession._id));
      setQrSession((current) => (current?._id === confirmSession._id ? null : current));
      setConfirmSession(null);

      // Return to main screen ready for next vehicle
      resetSelection();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to complete exit.");
      loadSessions();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gate-mobile-surface min-h-[calc(100svh-76px)] w-full space-y-4 px-5 py-5 text-slate-900 sm:mx-auto sm:min-h-0 sm:max-w-7xl sm:bg-transparent sm:px-0 sm:py-0 sm:space-y-6 dark:text-slate-100">
      {/* TOTAL VEHICLES IN PARKING AREA HERO CARD */}
      <div className="gate-card-rise rounded-3xl border-2 border-blue-100 bg-white p-4 shadow-sm space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EBF3FC] text-[#1565C0] font-black shadow-xs">
              <Car className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#1565C0]">
                  Total Vehicles in Parking Area
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {sessions.length}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  vehicle{sessions.length === 1 ? "" : "s"} currently parked inside
                </span>
              </div>
            </div>
          </div>

          {/* Category Breakdown & Gate Selector & Manual Sync */}
          <div className="flex items-center gap-2 self-start sm:self-auto overflow-x-auto no-scrollbar">
            <span className="inline-flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-bold text-[#1565C0]">
              <TwoWheelerIllustration className="h-4 w-5" />
              <span>{vehicleCounts.BIKE} Bikes</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-bold text-[#1565C0]">
              <FourWheelerIllustration className="h-4 w-5" />
              <span>{vehicleCounts.CAR} Cars</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-bold text-[#1565C0]">
              <OthersIllustration className="h-4 w-5" />
              <span>{vehicleCounts.OTHER} Other</span>
            </span>

            {exitGates.length > 0 ? (
              <Badge variant="outline" className="font-semibold text-xs h-7 px-2 rounded-lg">
                {exitGates.find((g) => g._id === selectedGateId)?.name ?? "Exit Gate"}
              </Badge>
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground shrink-0"
              onClick={loadSessions}
              disabled={loading}
              title="Refresh live count"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <div className="gate-card-rise rounded-3xl border-2 border-blue-100 bg-white p-3.5 shadow-sm space-y-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1565C0]">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">Optional QR Scan</h2>
              <p className="text-xs text-slate-500">
                Manual vehicle search below remains the main exit flow.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={qrScanning ? stopQrScanner : startQrScanner}
              className="gate-press h-10 rounded-xl border-2 border-slate-200 bg-white font-bold gap-2 text-slate-700 hover:bg-slate-50"
            >
              <Camera className="h-4 w-4" />
              {qrScanning ? "Stop Scan" : "Scan QR"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => fetchQrSession(qrToken)}
              disabled={qrLoading}
              className="gate-press h-10 rounded-xl bg-[#1565C0] font-bold gap-2 text-white hover:bg-blue-700"
            >
              {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Fetch Details
            </Button>
          </div>
        </div>

        {qrScanning && (
          <div className="overflow-hidden rounded-2xl border bg-black">
            <video ref={qrVideoRef} className="h-56 w-full object-cover" muted playsInline />
          </div>
        )}

        {!qrScanSupported && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Camera scanning is unavailable in this browser. Paste the QR token below.
          </p>
        )}

        <Input
          value={qrToken}
          onChange={(e) => setQrToken(e.target.value)}
          placeholder="Paste parking QR token here if camera scan is not available"
          className="h-11 rounded-xl border-slate-200 bg-slate-50 font-mono text-xs focus-visible:border-[#1565C0] focus-visible:ring-[#1565C0]"
        />

        {qrSession && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-[#E8F5E9] p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  QR Details Found
                </p>
                <p className="font-mono text-base font-black tracking-wide text-slate-900">
                  {qrSession.vehicleNumber || qrSession.sessionCode}
                </p>
              </div>
              <Badge className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white hover:bg-emerald-600">
                ACTIVE
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-xl bg-white/85 p-2.5">
                <p className="font-bold uppercase tracking-wider text-slate-500">Company</p>
                <p className="mt-1 font-black text-slate-900">{fieldName(qrSession.companyId) || "-"}</p>
              </div>
              <div className="rounded-xl bg-white/85 p-2.5">
                <p className="font-bold uppercase tracking-wider text-slate-500">Floor</p>
                <p className="mt-1 font-black text-slate-900">{fieldName(qrSession.floorId) || "-"}</p>
              </div>
              <div className="rounded-xl bg-white/85 p-2.5">
                <p className="font-bold uppercase tracking-wider text-slate-500">Vehicle</p>
                <p className="mt-1 font-black text-slate-900">{qrSession.vehicleType}</p>
              </div>
              <div className="rounded-xl bg-white/85 p-2.5">
                <p className="font-bold uppercase tracking-wider text-slate-500">Entry</p>
                <p className="mt-1 font-black text-slate-900">
                  {new Date(qrSession.entryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setConfirmSession(qrSession)}
              className="gate-press mt-3 h-11 w-full rounded-xl bg-[#1565C0] font-black text-white hover:bg-blue-700"
            >
              Confirm Exit for This Vehicle
            </Button>
          </div>
        )}
      </div>

      {/* 2-Column Responsive Layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Primary Exit Actions: Option A & Option B) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4 sm:space-y-6">
          {/* ========================================================================= */}
          {/* OPTION A: SEARCH BY VEHICLE NUMBER (2-STEP ULTRA FAST EXIT)               */}
          {/* ========================================================================= */}
          <div className="gate-card-rise rounded-3xl border-2 border-blue-100 bg-white p-3.5 shadow-sm space-y-2.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-[#1565C0]" />
            Enter Vehicle Number
          </Label>
          <span className="text-[11px] text-[#1565C0] font-bold">Fast 2-Step Exit</span>
        </div>

        <div className="relative">
          <Input
            placeholder="Type vehicle plate (TG 09 GH 1234) or session code..."
            className="h-13 pl-11 pr-10 text-sm uppercase font-mono tracking-wider font-extrabold rounded-xl border-2 border-slate-200 bg-slate-50 focus-visible:border-[#1565C0] focus-visible:ring-[#1565C0]"
            value={plateQuery}
            onChange={(e) => {
              setPlateQuery(e.target.value.toUpperCase());
              if (selectedVehicleType) setSelectedVehicleType(null);
            }}
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          {plateQuery && (
            <button
              onClick={() => setPlateQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs bg-muted hover:bg-muted/80 text-muted-foreground p-1 rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Live Search Instant Matches */}
        {plateQuery.trim().length > 0 && (
          <div className="space-y-2 pt-1 animate-in fade-in duration-150">
            {searchResults.length > 0 ? (
              searchResults.slice(0, 5).map((match) => (
                <button
                  key={match._id}
                  onClick={() => setConfirmSession(match)}
                  className="gate-press w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-[#1565C0] bg-[#EFF6FF] text-left transition shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {match.vehicleNumber ? (
                      <span className="license-plate px-3 py-1 text-xs shrink-0">{match.vehicleNumber}</span>
                    ) : (
                      <Badge variant="outline" className="text-xs shrink-0 font-bold">No Plate</Badge>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate leading-tight">{fieldName(match.companyId)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {match.vehicleType} · {fieldName(match.floorId)} · {formatDuration(match.entryTime)} inside
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="text-xs font-black text-primary">Confirm Exit →</span>
                    <ChevronRight className="h-4 w-4 text-primary" />
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground bg-muted/30 rounded-xl">
                No active vehicle found matching &quot;{plateQuery}&quot;. Please check the number or select by vehicle type below.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Separator */}
      <div className="relative flex items-center justify-center my-2">
        <div className="w-full border-t border-border/80" />
        <span className="absolute bg-background px-3 text-[11px] font-black text-muted-foreground uppercase tracking-wider">
          Or Exit by Vehicle Type (2-3 Steps)
        </span>
      </div>

      {/* ========================================================================= */}
      {/* OPTION B: VEHICLE TYPE SELECTOR (BIKE, CAR, OTHER)                        */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {VEHICLE_TYPES_CONFIG.map(({ type, label, icon: Icon }) => {
            const count = vehicleCounts[type];
            const isSelected = selectedVehicleType === type;

            return (
              <button
                key={type}
                onClick={() => handleSelectVehicleType(type)}
                className={cn(
                    "gate-press relative flex flex-col items-center justify-center p-3.5 sm:p-5 rounded-2xl border text-center transition-all shadow-xs",
                    isSelected
                      ? "border-2 border-[#1565C0] bg-[#EFF6FF] shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                  )}
                >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF3FC] text-[#1565C0] shadow-xs mb-1.5">
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>

                <p className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 dark:text-white">{label}</p>

                {/* Count Badge */}
                <span
                  className={cn(
                    "mt-1 rounded-full px-2 py-0.5 text-[11px] font-black tracking-tight",
                    count > 0 ? "bg-blue-50 text-[#1565C0]" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count} Inside
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 2: SHOW COMPANIES LIST & FLOORS LIST FOR THE CHOSEN VEHICLE TYPE     */}
      {/* ========================================================================= */}
      {selectedVehicleType && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Subheader with Active Type & Reset */}
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#1565C0] px-2.5 py-1 text-xs font-black uppercase text-white hover:bg-[#1565C0]">
                {selectedVehicleType}
              </Badge>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Select Company or Floor to Exit
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetSelection}
              className="h-8 text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Clear
            </Button>
          </div>

          {/* If a company is clicked with MULTIPLE vehicles -> show that company's vehicles */}
          {activeCompanyFilter ? (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm animate-in fade-in dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-2 border-b">
                <div>
                  <h3 className="text-xs font-extrabold sm:text-sm">
                    {companyList.find((c) => c.id === activeCompanyFilter)?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Select vehicle to confirm exit ({activeSessionsForType.filter((s) => fieldId(s.companyId) === activeCompanyFilter).length} vehicles)
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveCompanyFilter(null)}
                  className="rounded-xl font-bold h-8 text-xs gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
              </div>

              <div className="space-y-2 pt-1">
                {activeSessionsForType
                  .filter((s) => fieldId(s.companyId) === activeCompanyFilter)
                  .map((session) => (
                    <button
                      key={session._id}
                      onClick={() => setConfirmSession(session)}
                      className="gate-press w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-[#1565C0] hover:bg-[#EFF6FF] text-left transition shadow-xs dark:bg-slate-800 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        {session.vehicleNumber ? (
                          <span className="license-plate px-2.5 py-1 text-xs shrink-0">
                            {session.vehicleNumber}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs shrink-0 font-bold">
                            No Plate
                          </Badge>
                        )}
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Floor: {fieldName(session.floorId)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            Parked for {formatDuration(session.entryTime)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#1565C0] flex items-center gap-1">
                        Exit →
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : activeFloorFilter ? (
            /* If a floor is clicked with MULTIPLE vehicles -> show that floor's vehicles */
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm animate-in fade-in dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-2 border-b">
                <div>
                  <h3 className="text-xs font-extrabold sm:text-sm">
                    {floorList.find((f) => f.id === activeFloorFilter)?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Select vehicle to confirm exit ({activeSessionsForType.filter((s) => fieldId(s.floorId) === activeFloorFilter).length} vehicles)
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveFloorFilter(null)}
                  className="rounded-xl font-bold h-8 text-xs gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
              </div>

              <div className="space-y-2 pt-1">
                {activeSessionsForType
                  .filter((s) => fieldId(s.floorId) === activeFloorFilter)
                  .map((session) => (
                    <button
                      key={session._id}
                      onClick={() => setConfirmSession(session)}
                      className="gate-press w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-[#1565C0] hover:bg-[#EFF6FF] text-left transition shadow-xs dark:bg-slate-800 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        {session.vehicleNumber ? (
                          <span className="license-plate px-2.5 py-1 text-xs shrink-0">
                            {session.vehicleNumber}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs shrink-0 font-bold">
                            No Plate
                          </Badge>
                        )}
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Company: {fieldName(session.companyId)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            Parked for {formatDuration(session.entryTime)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#1565C0] flex items-center gap-1">
                        Exit →
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            /* Main List: Company List AND Floor List */
            <div className="space-y-3">
              {/* Segmented Switcher for Mobile & Desktop */}
              <div className="flex rounded-xl bg-slate-100 p-1 gap-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setViewTab("companies")}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all tap-bounce",
                    viewTab === "companies"
                      ? "bg-white text-[#1565C0] shadow-xs dark:bg-slate-900"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  <span>Companies ({companyList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab("floors")}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all tap-bounce",
                    viewTab === "floors"
                      ? "bg-white text-[#1565C0] shadow-xs dark:bg-slate-900"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <Layers className="h-4 w-4" />
                  <span>Floors ({floorList.length})</span>
                </button>
              </div>

              {/* View 1: By Company */}
              {viewTab === "companies" && (
                <div className="space-y-2">
                  {companyList.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground bg-card rounded-2xl border p-4">
                      <p className="text-xs font-bold">No {selectedVehicleType}s currently parked.</p>
                      <p className="text-xs mt-1">All {selectedVehicleType} slots for all companies are empty.</p>
                    </div>
                  ) : (
                    companyList.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => handleSelectCompany(company)}
                        className="gate-press w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white hover:border-[#1565C0] hover:bg-[#EFF6FF] text-left transition shadow-xs dark:bg-slate-800 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {company.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={company.logoUrl}
                              alt={company.name}
                              className="h-10 w-10 rounded-xl object-cover border shrink-0"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1565C0] font-black text-sm">
                              {company.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-xs font-extrabold leading-tight truncate sm:text-sm">
                              {company.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {company.vehicles.length === 1 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  1 vehicle · Tap to Confirm Exit
                                </span>
                              ) : (
                                <span>{company.vehicles.length} parked vehicles</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={company.vehicles.length === 1 ? "default" : "secondary"}
                            className="font-bold text-xs"
                          >
                            {company.vehicles.length} {selectedVehicleType}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-[#1565C0]" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* View 2: By Floor */}
              {viewTab === "floors" && (
                <div className="space-y-2">
                  {floorList.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground bg-card rounded-2xl border p-4">
                      <p className="text-xs font-bold">No {selectedVehicleType}s currently parked on any floor.</p>
                    </div>
                  ) : (
                    floorList.map((floor) => (
                      <button
                        key={floor.id}
                        type="button"
                        onClick={() => handleSelectFloor(floor)}
                        className="gate-press w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white hover:border-[#1565C0] hover:bg-[#EFF6FF] text-left transition shadow-xs dark:bg-slate-800 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1565C0] font-black text-sm border border-blue-100">
                            {floor.code || floor.name.slice(0, 2)}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-extrabold leading-tight truncate sm:text-sm">
                              {floor.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {floor.vehicles.length === 1 ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  1 vehicle · Tap to Confirm Exit
                                </span>
                              ) : (
                                <span>{floor.vehicles.length} parked vehicles</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={floor.vehicles.length === 1 ? "default" : "secondary"}
                            className="font-bold text-xs"
                          >
                            {floor.vehicles.length} {selectedVehicleType}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-[#1565C0]" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>

        {/* Right Column (Desktop Only): Live Parked Vehicles Queue & Quick 1-Click Exit */}
        <div className="hidden lg:flex lg:flex-col lg:col-span-5 xl:col-span-5 space-y-4 sticky top-20">
          <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 shadow-sm space-y-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-black tracking-tight">Active Parked Vehicles Queue</h2>
              </div>
              <Badge variant="secondary" className="font-mono text-xs font-bold">
                {sessions.length} parked
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Click any active vehicle to instantly open the exit clearance confirmation.
            </p>

            {/* Scrollable list of currently parked vehicles */}
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {sessions.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl p-4">
                  No vehicles currently parked inside the campus facility.
                </div>
              ) : (
                sessions.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => setConfirmSession(item)}
                    className="gate-press w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-[#EFF6FF] hover:border-[#1565C0] text-left transition group dark:bg-slate-800 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1565C0] font-black shrink-0">
                        <VehicleTypeIllustration type={item.vehicleType} className="h-5 w-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.vehicleNumber ? (
                            <span className="font-mono font-black text-xs text-foreground">
                              {item.vehicleNumber}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {item.sessionCode}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {fieldName(item.companyId)} • {fieldName(item.floorId)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="text-[11px] font-bold text-[#1565C0] flex items-center gap-0.5">
                        Exit →
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {formatDuration(item.entryTime)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FINAL STEP: CONFIRM EXIT MODAL / DIALOG (TOTAL 2 TO 3 STEPS)               */}
      {/* ========================================================================= */}
      <Dialog open={!!confirmSession} onOpenChange={(open) => !open && setConfirmSession(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-5 sm:p-6 border-2">
          <DialogHeader className="text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#1565C0] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                Exit Authorization
              </span>
              <span className="font-mono text-xs text-muted-foreground font-bold">
                {confirmSession?.sessionCode}
              </span>
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">
              Confirm Vehicle Exit
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review details below to open barrier and complete session.
            </DialogDescription>
          </DialogHeader>

          {confirmSession && (
            <div className="space-y-4 my-2">
              {/* Plate Banner */}
              <div className="text-center py-3 bg-[#EFF6FF] rounded-2xl border border-dashed border-blue-100">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                  Vehicle License Plate
                </p>
                {confirmSession.vehicleNumber ? (
                  <span className="license-plate px-4 py-1.5 text-sm sm:text-base">
                    {confirmSession.vehicleNumber}
                  </span>
                ) : (
                  <Badge variant="outline" className="text-xs py-1 px-3 font-bold">
                    No Plate Recorded at Entry
                  </Badge>
                )}
              </div>

              {/* Detail Items */}
              <div className="space-y-2.5 rounded-2xl bg-slate-50 p-3.5 border border-slate-200 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Company
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {fieldName(confirmSession.companyId)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5" /> Vehicle Type
                  </span>
                  <Badge variant="secondary" className="font-bold">
                    {confirmSession.vehicleType}
                  </Badge>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Parking Floor
                  </span>
                  <span className="font-bold text-foreground">
                    {fieldName(confirmSession.floorId)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Entry Time
                  </span>
                  <span className="font-medium text-muted-foreground">
                    {new Date(confirmSession.entryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> Parked Duration
                  </span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {formatDuration(confirmSession.entryTime)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
            <Button
              size="lg"
              disabled={submitting || !selectedGateId}
              onClick={handleConfirmExit}
              className="gate-press w-full h-14 text-sm font-black tracking-wide rounded-2xl bg-[#1565C0] hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  COMPLETING EXIT &amp; OPENING GATE...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  CONFIRM EXIT &amp; OPEN GATE
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmSession(null)}
              className="w-full h-10 rounded-xl font-bold"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
