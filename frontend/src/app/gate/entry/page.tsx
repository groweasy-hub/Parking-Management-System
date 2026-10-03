"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { deferNavigation } from "@/lib/deferred-navigation";
import { AllocationAvailability, Company, Floor, Gate, ParkingSessionRecord, VehicleType } from "@/lib/types";
import { useProjectRealtime } from "@/hooks/useRealtime";
import {
  TwoWheelerIllustration,
  FourWheelerIllustration,
  OthersIllustration,
  BoomBarrierSceneIllustration,
  ParkingAvailableCenterIcon,
  ParkingNotAvailableCenterIcon,
} from "@/components/gate/GateVisuals";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Layers,
  LayoutGrid,
  Search,
  Check,
  X,
  Loader2,
  ChevronRight,
  Info,
  Car,
  Bike,
  Truck,
  RefreshCw,
  Clock,
  Copy,
  Printer,
  QrCode,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

interface AvailabilityState {
  available: boolean;
  totalAvailable: number;
  floorName: string;
  floorId: string;
  allocationId: string;
}

interface EntryReceipt {
  id: string;
  sessionCode: string;
  vehicleType: VehicleType;
  vehicleNumber: string | null;
  entryTime: string;
  status: string;
  entryGateName?: string;
  qrToken: string;
  qrImageUrl: string;
  qrPayload: {
    companyName: string;
    floorName: string;
    floorCode?: string;
  };
}

export default function EntryGatePage() {
  const router = useRouter();
  const { currentProjectId, currentProject } = useProject();

  // Mobile Step Wizard State (1: Vehicle, 2: Destination, 3: Clearance)
  const [step, setStep] = useState<Step>(1);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);

  // Destination State
  const [activeTab, setActiveTab] = useState<"company" | "floor" | "other">("company");
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [floorsLoading, setFloorsLoading] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");

  // Clearance / Availability State
  const [availability, setAvailability] = useState<AvailabilityState | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entryReceipt, setEntryReceipt] = useState<EntryReceipt | null>(null);

  // Gates & Live Active Sessions
  const [entryGates, setEntryGates] = useState<Gate[]>([]);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [sessions, setSessions] = useState<ParkingSessionRecord[]>([]);

  // Load live active sessions count and records
  const loadActiveSessions = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const data = await apiFetch<{ sessions: ParkingSessionRecord[] }>(
        `/api/parking/active?projectId=${currentProjectId}`
      );
      setSessions(data.sessions);
      setActiveCount(data.sessions.length);
    } catch {
      // silent
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadActiveSessions();
  }, [loadActiveSessions]);

  useProjectRealtime(currentProjectId, {
    onSessionEntry: () => loadActiveSessions(),
    onSessionExit: () => loadActiveSessions(),
  });

  // Calculate live breakdown by vehicle category
  const vehicleCounts = useMemo(() => {
    let car = 0;
    let bike = 0;
    let other = 0;
    for (const s of sessions) {
      if (s.vehicleType === "CAR") car++;
      else if (s.vehicleType === "BIKE") bike++;
      else other++;
    }
    return { car, bike, other };
  }, [sessions]);

  // Load entry gates
  useEffect(() => {
    if (!currentProjectId) return;
    apiFetch<{ gates: Gate[] }>(`/api/gates?projectId=${currentProjectId}&type=ENTRY`)
      .then((data) => {
        setEntryGates(data.gates);
      })
      .catch(() => undefined);
  }, [currentProjectId]);

  useEffect(() => {
    apiFetch<{ duty: { gateId: { _id: string; type: "ENTRY" | "EXIT" } | string; gateType: "ENTRY" | "EXIT"; endedAt?: string | null } | null }>("/api/gate-duty/today")
      .then((data) => {
        if (!data.duty || data.duty.endedAt || data.duty.gateType !== "ENTRY") {
          deferNavigation(() => router.replace("/gate/select"));
          return;
        }
        setSelectedGateId(typeof data.duty.gateId === "object" ? data.duty.gateId._id : data.duty.gateId);
      })
      .catch(() => deferNavigation(() => router.replace("/gate/select")));
  }, [router]);

  // Load companies
  useEffect(() => {
    if (!currentProjectId) return;
    setCompaniesLoading(true);
    apiFetch<{ companies: Company[] }>(
      `/api/companies?projectId=${currentProjectId}&search=${encodeURIComponent(search)}`
    )
      .then((d) => {
        setCompanies(d.companies);
        if (!selectedCompany && d.companies.length > 0) {
          setSelectedCompany(d.companies[0]);
        }
      })
      .catch(() => setCompanies([]))
      .finally(() => setCompaniesLoading(false));
  }, [currentProjectId, search, selectedCompany]);

  // Load floors
  useEffect(() => {
    if (!currentProjectId) return;
    setFloorsLoading(true);
    apiFetch<{ floors: Floor[] }>(`/api/floors?projectId=${currentProjectId}`)
      .then((d) => {
        setFloors(d.floors);
        if (!selectedFloor && d.floors.length > 0) {
          setSelectedFloor(d.floors[0]);
        }
      })
      .catch(() => setFloors([]))
      .finally(() => setFloorsLoading(false));
  }, [currentProjectId, selectedFloor]);

  // Vehicle Type human label
  const vehicleLabel = useMemo(() => {
    if (vehicleType === "BIKE") return "2 Wheeler";
    if (vehicleType === "CAR") return "4 Wheeler";
    if (vehicleType === "OTHER") return "Others";
    return "";
  }, [vehicleType]);

  // Unified Live Availability Check
  const checkLiveAvailability = useCallback(
    async (
      overrideVehicleType?: VehicleType,
      overrideCompany?: Company | null,
      overrideFloor?: Floor | null
    ) => {
      const vType = overrideVehicleType ?? vehicleType;
      const comp = overrideCompany !== undefined ? overrideCompany : selectedCompany;
      const flr = overrideFloor !== undefined ? overrideFloor : selectedFloor;

      if (!currentProjectId || !vType) {
        setAvailability(null);
        return;
      }

      setCheckingAvailability(true);
      try {
        const allocationVehicleType = vType === "OTHER" ? "CAR" : vType;
        let companyId = comp?._id;
        if (!companyId && companies.length > 0) {
          companyId = companies[0]._id;
        }

        if (!companyId) {
          setAvailability({
            available: false,
            totalAvailable: 0,
            floorName: "No Floor Assigned",
            floorId: "",
            allocationId: "",
          });
          return;
        }

        const data = await apiFetch<{ allocations: AllocationAvailability[] }>(
          `/api/parking/availability?projectId=${currentProjectId}&companyId=${companyId}&vehicleType=${allocationVehicleType}`
        );

        let targetAlloc: AllocationAvailability | undefined;
        if (activeTab === "floor" && flr) {
          targetAlloc = data.allocations.find((a) => a.floorId === flr._id);
        }
        if (!targetAlloc) {
          targetAlloc =
            data.allocations.find((a) => a.status !== "FULL" && a.available > 0) ??
            data.allocations[0];
        }

        if (targetAlloc && targetAlloc.available > 0 && targetAlloc.status !== "FULL") {
          setAvailability({
            available: true,
            totalAvailable: targetAlloc.available,
            floorName: targetAlloc.floorName,
            floorId: targetAlloc.floorId,
            allocationId: targetAlloc.allocationId,
          });
        } else {
          setAvailability({
            available: false,
            totalAvailable: 0,
            floorName: targetAlloc?.floorName ?? (flr?.name || "All Floors Full"),
            floorId: targetAlloc?.floorId ?? "",
            allocationId: targetAlloc?.allocationId ?? "",
          });
        }
      } catch {
        setAvailability({
          available: false,
          totalAvailable: 0,
          floorName: flr?.name ?? "Full / Unavailable",
          floorId: flr?._id ?? "",
          allocationId: "",
        });
      } finally {
        setCheckingAvailability(false);
      }
    },
    [currentProjectId, vehicleType, selectedCompany, selectedFloor, companies, activeTab]
  );

  // Mobile Step 2 -> Step 3 transition
  async function handleProceedToStep3() {
    await checkLiveAvailability();
    setStep(3);
  }

  // Handle final entry submission (Barrier Open)
  const handleConfirmEntry = useCallback(async () => {
    if (!currentProjectId || !vehicleType || !availability?.available || !selectedGateId) {
      if (!selectedGateId) toast.error("Please select an entry gate lane.");
      return;
    }

    let companyId = selectedCompany?._id;
    if (!companyId && companies.length > 0) companyId = companies[0]._id;
    if (!companyId) {
      toast.error("No valid tenant company found for entry.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<{ session: Omit<EntryReceipt, "qrImageUrl"> }>("/api/parking/entry", {
        method: "POST",
        body: JSON.stringify({
          projectId: currentProjectId,
          vehicleType,
          companyId,
          floorId: availability.floorId || undefined,
          allocationId: availability.allocationId || undefined,
          vehicleNumber: vehicleNumber.trim() || null,
          entryGateId: selectedGateId,
        }),
      });
      const qrImageUrl = await QRCode.toDataURL(data.session.qrToken, {
        margin: 1,
        width: 260,
        errorCorrectionLevel: "M",
      });
      setEntryReceipt({ ...data.session, qrImageUrl });

      toast.success("Entry Allowed · Barrier Opened", {
        description: `${selectedCompany?.name || "Visitor"} · ${vehicleLabel} · ${availability.floorName}`,
      });

      // Refresh list & reset state
      await loadActiveSessions();
      setVehicleNumber("");
      setStep(1);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to complete entry.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [
    currentProjectId,
    vehicleType,
    availability,
    selectedGateId,
    selectedCompany,
    companies,
    vehicleNumber,
    vehicleLabel,
    loadActiveSessions,
  ]);

  // Desktop Keyboard Shortcuts ([1] 2W, [2] 4W, [3] Others, [Enter] Confirm, [Esc] Reset)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

      if (isInput) {
        if (e.key === "Enter" && availability?.available && !submitting) {
          e.preventDefault();
          handleConfirmEntry();
        }
        return;
      }

      if (e.key === "1") {
        setVehicleType("BIKE");
        checkLiveAvailability("BIKE");
      } else if (e.key === "2") {
        setVehicleType("CAR");
        checkLiveAvailability("CAR");
      } else if (e.key === "3") {
        setVehicleType("OTHER");
        checkLiveAvailability("OTHER");
      } else if (e.key === "Enter" && availability?.available && !submitting) {
        e.preventDefault();
        handleConfirmEntry();
      } else if (e.key === "Escape") {
        setVehicleType(null);
        setAvailability(null);
        setVehicleNumber("");
        setStep(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [availability, submitting, checkLiveAvailability, handleConfirmEntry]);

  // Selected gate object
  const currentGate = useMemo(
    () => entryGates.find((g) => g._id === selectedGateId) ?? entryGates[0],
    [entryGates, selectedGateId]
  );

  return (
    <div className="gate-mobile-surface flex min-h-[calc(100dvh-76px)] w-full flex-col text-slate-900 dark:text-slate-100 lg:min-h-screen lg:bg-transparent">
      {/* ========================================================================= */}
      {/* 1. MOBILE APP VIEW (< lg) - Exact Match to User Screenshots               */}
      {/* ========================================================================= */}
      <div className="flex min-h-[calc(100dvh-76px)] w-full flex-col lg:hidden">
        {/* Clean Back navigation if in step 2 or 3 */}
        {step > 1 && (
          <div className="px-5 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : 1))}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary active:scale-95 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to {step === 3 ? "Company & Floor" : "Vehicle Selection"}</span>
            </button>
          </div>
        )}

        {/* Mobile Main Body */}
        <main className="ios-scroll flex-1 overflow-y-auto px-5 pb-32 pt-5 sm:py-6">
          {/* STEP 1: SELECT VEHICLE TYPE */}
          {step === 1 && (
            <div className="gate-card-rise flex min-h-full flex-col space-y-4">
              <div className="text-center pt-2">
                <span className="text-xs font-extrabold tracking-widest text-[#1565C0] uppercase">
                  WELCOME
                </span>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  Select Vehicle Type
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Please choose the type of vehicle arriving at the gate.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => setVehicleType("BIKE")}
                  className={cn(
                    "gate-press w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl transition-all text-left border shadow-2xs",
                    vehicleType === "BIKE"
                      ? "border-2 border-[#1565C0] bg-[#EFF6FF] shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF3FC] shrink-0 p-1">
                      <TwoWheelerIllustration className="h-10 w-12" />
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      2 Wheeler
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#1565C0]" />
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleType("CAR")}
                  className={cn(
                    "gate-press w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl transition-all text-left border shadow-2xs",
                    vehicleType === "CAR"
                      ? "border-2 border-[#1565C0] bg-[#EFF6FF] shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF3FC] shrink-0 p-1">
                      <FourWheelerIllustration className="h-9 w-12" />
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      4 Wheeler
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#1565C0]" />
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleType("OTHER")}
                  className={cn(
                    "gate-press w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl transition-all text-left border shadow-2xs",
                    vehicleType === "OTHER"
                      ? "border-2 border-[#1565C0] bg-[#EFF6FF] shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF3FC] shrink-0 p-1">
                      <OthersIllustration className="h-9 w-12" />
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      Others
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#1565C0]" />
                </button>
              </div>

              {/* Total Vehicles in Parking Area Badge */}
              <div className="flex items-center justify-between rounded-xl bg-blue-50/70 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Vehicles in Parking Area:
                  </span>
                </div>
                <span className="text-xs font-black text-[#1565C0] dark:text-blue-400 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-full shadow-2xs">
                  {activeCount} Total
                </span>
              </div>

              {/* Boom Barrier Graphic */}
              <div className="flex justify-center py-2">
                <BoomBarrierSceneIllustration className="w-full max-w-[280px] h-auto drop-shadow-sm" />
              </div>

              {/* Next Button */}
              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
                <button
                  type="button"
                  disabled={!vehicleType}
                  onClick={() => setStep(2)}
                  className={cn(
                    "gate-press flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-lg transition-all",
                    vehicleType
                      ? "bg-[#1565C0] hover:bg-blue-700 text-white shadow-blue-500/25"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800"
                  )}
                >
                  Next <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT COMPANY / FLOOR */}
          {step === 2 && (
            <div className="gate-card-rise flex min-h-full flex-col space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-slate-800 border border-blue-200/60 px-3 py-1">
                    <span className="text-xs font-bold text-[#1565C0]">{vehicleLabel}</span>
                  </div>
                  <span className="text-xs text-slate-400">Step 2 of 3</span>
                </div>

                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                    Select Company
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Tap the company card the vehicle came for.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search company..."
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:bg-white transition-all"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Company-first flow for gatekeepers */}
                <div className="hidden grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("company")}
                    className={cn(
                      "py-2 rounded-lg transition-all",
                      activeTab === "company"
                        ? "bg-white dark:bg-slate-900 text-[#1565C0] shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Company
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("floor")}
                    className={cn(
                      "py-2 rounded-lg transition-all",
                      activeTab === "floor"
                        ? "bg-white dark:bg-slate-900 text-[#1565C0] shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Floor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("other")}
                    className={cn(
                      "py-2 rounded-lg transition-all",
                      activeTab === "other"
                        ? "bg-white dark:bg-slate-900 text-[#1565C0] shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Other
                  </button>
                </div>

                {/* Content List */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {activeTab === "company" && (
                    <>
                      {companiesLoading ? (
                        <div className="flex justify-center py-6 text-slate-400">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : companies.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-6">No companies found</p>
                      ) : (
                        companies.map((comp) => {
                          const isSelected = selectedCompany?._id === comp._id;
                          return (
                            <button
                              key={comp._id}
                              type="button"
                              onClick={() => setSelectedCompany(comp)}
                              className={cn(
                                "gate-press w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                                isSelected
                                  ? "border-2 border-[#1565C0] bg-[#EFF6FF]"
                                  : "border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1565C0] font-bold text-xs uppercase">
                                  {comp.name.slice(0, 2)}
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                                    {comp.name}
                                  </p>
                                  <p className="text-[11px] text-slate-400">{comp.code}</p>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-[#1565C0]" />
                            </button>
                          );
                        })
                      )}
                    </>
                  )}

                  {activeTab === "floor" && (
                    <>
                      {floorsLoading ? (
                        <div className="flex justify-center py-6 text-slate-400">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : floors.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-6">No floors configured</p>
                      ) : (
                        floors.map((flr) => {
                          const isSelected = selectedFloor?._id === flr._id;
                          return (
                            <button
                              key={flr._id}
                              type="button"
                              onClick={() => setSelectedFloor(flr)}
                              className={cn(
                                "gate-press w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                                isSelected
                                  ? "border-2 border-[#1565C0] bg-[#EFF6FF]"
                                  : "border-slate-200 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs">
                                  {flr.code || flr.name.slice(0, 2)}
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                                    {flr.name}
                                  </p>
                                  <p className="text-[11px] text-slate-400">Zone {flr.code || flr.displayOrder}</p>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-[#1565C0]" />
                            </button>
                          );
                        })
                      )}
                    </>
                  )}

                  {activeTab === "other" && (
                    <div className="space-y-2">
                      {["Guest / Visitor", "Delivery / Courier", "Maintenance / Service"].map(
                        (item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              if (companies[0]) setSelectedCompany(companies[0]);
                            }}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-[#1565C0] text-left transition-all"
                          >
                            <span className="font-bold text-sm text-slate-800 dark:text-white">
                              {item}
                            </span>
                            <ChevronRight className="h-5 w-5 text-[#1565C0]" />
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Optional Vehicle Number Input */}
                <div className="pt-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Enter Vehicle Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="TG 09 GH 1234"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:bg-white"
                  />
                </div>
              </div>

              {/* Bottom Buttons: Back & Next */}
              <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="gate-press w-1/3 h-13 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-base flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-5 w-5" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleProceedToStep3}
                  disabled={checkingAvailability}
                  className="gate-press flex-1 h-13 rounded-2xl bg-[#1565C0] hover:bg-blue-700 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                >
                  {checkingAvailability ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Next <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PARKING AVAILABILITY & ENTRY CONFIRMATION */}
          {step === 3 && (
            <div className="gate-card-rise flex min-h-full flex-col space-y-4">
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-[#1565C0]">
                      {vehicleLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700 truncate max-w-[140px]">
                      {selectedCompany?.name || "Visitor"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">Step 3 of 3</span>
                </div>

                {/* GREEN CARD: PARKING SPACE AVAILABLE */}
                {availability?.available ? (
                  <div className="rounded-3xl border-2 border-emerald-400 bg-[#E8F5E9] dark:bg-emerald-950/40 p-6 text-center shadow-lg shadow-emerald-500/10 space-y-4">
                    <div className="flex justify-center pt-2">
                      <ParkingAvailableCenterIcon className="h-24 w-24 drop-shadow-sm" />
                    </div>

                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#1565C0] dark:text-emerald-400 tracking-tight">
                        Parking Space Available
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                        Allocated Floor:{" "}
                        <span className="font-bold text-slate-900 dark:text-white">
                          {availability.floorName}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-3 py-1">
                      <div className="h-px flex-1 bg-emerald-200" />
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                        <Check className="h-4 w-4 stroke-[3]" />
                      </div>
                      <div className="h-px flex-1 bg-emerald-200" />
                    </div>

                    <div className="inline-block rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                      {availability.totalAvailable} Slot
                      {availability.totalAvailable === 1 ? "" : "s"} Free
                    </div>
                  </div>
                ) : (
                  /* RED CARD: NO PARKING SPACE AVAILABLE */
                  <div className="rounded-3xl border-2 border-rose-400 bg-[#FFEBEE] dark:bg-rose-950/40 p-6 text-center shadow-lg shadow-rose-500/10 space-y-4">
                    <div className="flex justify-center pt-2">
                      <ParkingNotAvailableCenterIcon className="h-24 w-24 drop-shadow-sm" />
                    </div>

                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#D32F2F] tracking-tight">
                        No Parking Space Available
                      </h2>
                      <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-300 mt-1 font-medium">
                        Parking area is full. Vehicle entry is not allowed.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-3 py-1">
                      <div className="h-px flex-1 bg-rose-200" />
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs">
                        <X className="h-4 w-4 stroke-[3]" />
                      </div>
                      <div className="h-px flex-1 bg-rose-200" />
                    </div>

                    <div className="inline-block rounded-full bg-rose-100 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                      0 Slots Free · Entry Blocked
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-md safe-bottom dark:border-slate-800 dark:bg-slate-900/95">
                {availability?.available ? (
                  <button
                    type="button"
                    onClick={handleConfirmEntry}
                    disabled={submitting}
                    className="gate-press w-full h-13 rounded-2xl bg-[#1565C0] hover:bg-blue-700 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Confirm Entry <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled
                      className="w-full h-13 rounded-2xl bg-rose-100 border-2 border-rose-300 text-rose-600 font-black text-base flex items-center justify-center gap-2 cursor-not-allowed opacity-90 shadow-xs"
                    >
                      <X className="h-5 w-5 stroke-[2.5]" />
                      Entry Not Allowed (No Entry)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="w-full h-10 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      ← Choose another company or floor
                    </button>
                  </div>
                )}

                <p
                  className={cn(
                    "text-center text-xs flex items-center justify-center gap-1.5 pt-1",
                    availability?.available ? "text-slate-400" : "text-rose-600 font-semibold"
                  )}
                >
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  {availability?.available
                    ? "Please confirm entry only if the parking space is available."
                    : "Entry cannot be granted because there is no parking space available."}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 2. DESKTOP WORKSTATION TERMINAL (lg:) - Dedicated Operator Cockpit        */}
      {/* ========================================================================= */}
      <div className="hidden lg:grid grid-cols-12 gap-6 w-full max-w-[1600px] mx-auto">
        {/* =================================================================== */}
        {/* LEFT COLUMN: HIGH-SPEED INTAKE CONSOLE (Cols 1-7)                   */}
        {/* =================================================================== */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-7 2xl:col-span-8 flex flex-col gap-6">
          {/* Section 1: Vehicle Category Selector Cards (Hotkeys 1, 2, 3) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1565C0] text-white text-xs font-bold">
                    1
                  </span>
                  Select Vehicle Category
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click card or press keyboard hotkey [1], [2], or [3]
                </p>
              </div>
              <div className="flex items-center gap-2">
                {entryGates.length > 1 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-medium">Lane:</span>
                    <select
                      value={selectedGateId || ""}
                      onChange={(e) => setSelectedGateId(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200"
                    >
                      {entryGates.map((g) => (
                        <option key={g._id} value={g._id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {vehicleType && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-black text-[#1565C0]">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    {vehicleLabel} Selected
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3.5 pt-1">
                {/* 2 Wheeler Card */}
                <button
                  type="button"
                  onClick={() => {
                    setVehicleType("BIKE");
                    checkLiveAvailability("BIKE");
                  }}
                  className={cn(
                    "relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all text-center group",
                    vehicleType === "BIKE"
                      ? "border-[#1565C0] bg-[#EFF6FF] dark:bg-blue-950/40 shadow-md ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span className="absolute top-2.5 right-2.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 group-hover:text-[#1565C0]">
                    Key 1
                  </span>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EBF3FC] p-2 mb-2">
                    <TwoWheelerIllustration className="h-12 w-14" />
                  </div>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    2 Wheeler
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">Scooter, Bike</span>
                  <span className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    {vehicleCounts.bike} Parked Inside
                  </span>
                </button>

                {/* 4 Wheeler Card */}
                <button
                  type="button"
                  onClick={() => {
                    setVehicleType("CAR");
                    checkLiveAvailability("CAR");
                  }}
                  className={cn(
                    "relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all text-center group",
                    vehicleType === "CAR"
                      ? "border-[#1565C0] bg-[#EFF6FF] dark:bg-blue-950/40 shadow-md ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span className="absolute top-2.5 right-2.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 group-hover:text-[#1565C0]">
                    Key 2
                  </span>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EBF3FC] p-2 mb-2">
                    <FourWheelerIllustration className="h-11 w-14" />
                  </div>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    4 Wheeler
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">Sedan, SUV, EV</span>
                  <span className="mt-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                    {vehicleCounts.car} Parked Inside
                  </span>
                </button>

                {/* Others Card */}
                <button
                  type="button"
                  onClick={() => {
                    setVehicleType("OTHER");
                    checkLiveAvailability("OTHER");
                  }}
                  className={cn(
                    "relative flex flex-col items-center p-4 rounded-2xl border-2 transition-all text-center group",
                    vehicleType === "OTHER"
                      ? "border-[#1565C0] bg-[#EFF6FF] dark:bg-blue-950/40 shadow-md ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span className="absolute top-2.5 right-2.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 group-hover:text-[#1565C0]">
                    Key 3
                  </span>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EBF3FC] p-2 mb-2">
                    <OthersIllustration className="h-11 w-14" />
                  </div>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    Others
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">Delivery, Van</span>
                  <span className="mt-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                    {vehicleCounts.other} Parked Inside
                  </span>
                </button>
              </div>
            </div>

            {/* Section 2: Destination Company & Floor Selection */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1565C0] text-white text-xs font-bold">
                      2
                    </span>
                    Destination Company / Tenant
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select destination to verify allocated parking quota
                  </p>
                </div>

                {/* Segmented Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab("company")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      activeTab === "company"
                        ? "bg-white dark:bg-slate-900 text-[#1565C0] shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Companies ({companies.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("floor")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      activeTab === "floor"
                        ? "bg-white dark:bg-slate-900 text-[#1565C0] shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Floors ({floors.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("other")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      activeTab === "other"
                        ? "bg-white dark:bg-slate-900 text-[#1565C0] shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Visitor / Courier
                  </button>
                </div>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to filter companies or floor..."
                  className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Interactive Directory Grid */}
              <div className="max-h-[220px] overflow-y-auto pr-1">
                {activeTab === "company" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {companiesLoading ? (
                      <div className="col-span-2 flex justify-center py-6 text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : companies.length === 0 ? (
                      <p className="col-span-2 text-center text-xs text-slate-400 py-6">
                        No companies found matching search.
                      </p>
                    ) : (
                      companies.map((comp) => {
                        const isSelected = selectedCompany?._id === comp._id;
                        return (
                          <button
                            key={comp._id}
                            type="button"
                            onClick={() => {
                              setSelectedCompany(comp);
                              checkLiveAvailability(undefined, comp);
                            }}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                              isSelected
                                ? "border-2 border-[#1565C0] bg-[#EFF6FF] dark:bg-blue-950/40 shadow-xs"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-slate-800 text-[#1565C0] font-bold text-xs uppercase shrink-0">
                                {comp.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {comp.name}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{comp.code}</p>
                              </div>
                            </div>
                            {isSelected ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1565C0] text-white shrink-0">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {activeTab === "floor" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {floorsLoading ? (
                      <div className="col-span-2 flex justify-center py-6 text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : floors.length === 0 ? (
                      <p className="col-span-2 text-center text-xs text-slate-400 py-6">
                        No parking floors configured.
                      </p>
                    ) : (
                      floors.map((flr) => {
                        const isSelected = selectedFloor?._id === flr._id;
                        return (
                          <button
                            key={flr._id}
                            type="button"
                            onClick={() => {
                              setSelectedFloor(flr);
                              checkLiveAvailability(undefined, undefined, flr);
                            }}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                              isSelected
                                ? "border-2 border-[#1565C0] bg-[#EFF6FF] dark:bg-blue-950/40 shadow-xs"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-slate-800 text-emerald-600 font-bold text-xs shrink-0">
                                {flr.code || flr.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {flr.name}
                                </p>
                                <p className="text-[10px] text-slate-400">Zone {flr.code || flr.displayOrder}</p>
                              </div>
                            </div>
                            {isSelected ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1565C0] text-white shrink-0">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {activeTab === "other" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {["Guest / Visitor", "Courier / Delivery", "Vendor / Contractor", "Executive Guest"].map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            if (companies[0]) {
                              setSelectedCompany(companies[0]);
                              checkLiveAvailability(undefined, companies[0]);
                            }
                          }}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#1565C0] text-left transition-all"
                        >
                          <span className="font-bold text-xs text-slate-800 dark:text-white">
                            {item}
                          </span>
                          <ChevronRight className="h-4 w-4 text-[#1565C0]" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Vehicle License Plate Number (Optional Fast Entry) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1565C0] text-white text-xs font-bold">
                      3
                    </span>
                    Vehicle License Plate Number (Optional)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Type registration number for automatic parking receipt and tracking
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  Hotkey: [Tab]
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Text input */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="TG 09 GH 1234"
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-base font-mono font-bold tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#1565C0] focus:bg-white transition-all"
                  />
                  {vehicleNumber && (
                    <button
                      onClick={() => setVehicleNumber("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Graphical License Plate Preview Badge */}
                <div className="hidden sm:flex items-center border-2 border-slate-800 rounded-lg overflow-hidden bg-white shadow-xs">
                  <div className="flex flex-col items-center justify-center bg-[#1565C0] text-white px-2 py-1 text-[9px] font-black leading-tight">
                    <span>IND</span>
                  </div>
                  <div className="px-3.5 py-1.5 font-mono font-black text-base tracking-widest text-slate-900">
                    {vehicleNumber.trim() ? vehicleNumber : "MH 01 AB 0000"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* RIGHT COLUMN: REAL-TIME CLEARANCE & BOOM BARRIER OPERATIONS         */}
          {/* =================================================================== */}
          <div className="col-span-12 lg:col-span-5 xl:col-span-5 2xl:col-span-4 flex flex-col gap-6">
            {/* Real-Time Gate Clearance Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Live Gate Clearance
                  </h2>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {currentGate?.name ?? "Lane 01"}
                </span>
              </div>

              {/* Incoming Vehicle Summary Pill */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-[#1565C0] font-black">
                    {vehicleType === "BIKE" ? (
                      <Bike className="h-4 w-4" />
                    ) : vehicleType === "OTHER" ? (
                      <Truck className="h-4 w-4" />
                    ) : (
                      <Car className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {vehicleLabel || "Select Vehicle"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedCompany?.name || "General Visitor"}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                    {vehicleNumber.trim() ? vehicleNumber : "Plate Unset"}
                  </span>
                </div>
              </div>

              {/* LIVE AVAILABILITY DISPLAY */}
              {checkingAvailability ? (
                <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-[#1565C0]" />
                  <span className="text-xs font-semibold">Checking live parking space...</span>
                </div>
              ) : !vehicleType ? (
                /* AWAITING SELECTION STANDBY */
                <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-6 text-center space-y-3">
                  <div className="flex justify-center">
                    <BoomBarrierSceneIllustration className="w-48 h-auto opacity-80" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800 dark:text-white">
                      Lane 01 Ready for Arrival
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Select vehicle category on the left to verify parking slot availability.
                    </p>
                  </div>
                </div>
              ) : availability?.available ? (
                /* GREEN CARD: PARKING SPACE AVAILABLE */
                <div className="rounded-2xl border-2 border-emerald-500 bg-[#E8F5E9] dark:bg-emerald-950/40 p-5 text-center shadow-lg shadow-emerald-500/10 space-y-3.5 animate-in fade-in">
                  <div className="flex justify-center">
                    <ParkingAvailableCenterIcon className="h-20 w-20 drop-shadow-sm" />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-[#1565C0] dark:text-emerald-400 tracking-tight">
                      Parking Space Available
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                      Assigned:{" "}
                      <span className="font-bold text-slate-900 dark:text-white">
                        {availability.floorName}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 py-0.5">
                    <div className="h-px flex-1 bg-emerald-200" />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <div className="h-px flex-1 bg-emerald-200" />
                  </div>

                  <div className="inline-block rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
                    {availability.totalAvailable} Slot{availability.totalAvailable === 1 ? "" : "s"} Free
                  </div>

                  {/* Primary Confirm Action Button */}
                  <button
                    type="button"
                    onClick={handleConfirmEntry}
                    disabled={submitting}
                    className="w-full h-13 rounded-xl bg-[#1565C0] hover:bg-blue-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        CONFIRM ENTRY & OPEN BARRIER
                        <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
                          Enter ↵
                        </span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* RED CARD: NO PARKING SPACE AVAILABLE */
                <div className="rounded-2xl border-2 border-rose-500 bg-[#FFEBEE] dark:bg-rose-950/40 p-5 text-center shadow-lg shadow-rose-500/10 space-y-3.5 animate-in fade-in">
                  <div className="flex justify-center">
                    <ParkingNotAvailableCenterIcon className="h-20 w-20 drop-shadow-sm" />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-[#D32F2F] tracking-tight">
                      No Parking Space Available
                    </h3>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 font-semibold">
                      Parking area is full. Vehicle entry is not allowed.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 py-0.5">
                    <div className="h-px flex-1 bg-rose-200" />
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs">
                      <X className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <div className="h-px flex-1 bg-rose-200" />
                  </div>

                  <div className="inline-block rounded-full bg-rose-100 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                    0 Slots Free · Barrier Locked
                  </div>

                  {/* Disabled Red Action Button */}
                  <button
                    type="button"
                    disabled
                    className="w-full h-13 rounded-xl bg-rose-100 border-2 border-rose-300 text-rose-600 font-black text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90 shadow-xs"
                  >
                    <X className="h-4 w-4 stroke-[3]" />
                    Entry Not Allowed (No Entry)
                  </button>
                </div>
              )}
            </div>

            {/* Section 4: Today's Recent Gate Entries Live Feed */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#1565C0]" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Today&apos;s Gate Entries
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={loadActiveSessions}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="Refresh activity"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto max-h-[220px] pr-1">
                {sessions.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">
                    No vehicles entered through this gate today yet.
                  </p>
                ) : (
                  sessions.slice(0, 5).map((s) => (
                    <div
                      key={s._id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#1565C0] font-black shrink-0">
                          {s.vehicleType === "BIKE" ? (
                            <Bike className="h-3.5 w-3.5" />
                          ) : s.vehicleType === "OTHER" ? (
                            <Truck className="h-3.5 w-3.5" />
                          ) : (
                            <Car className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-slate-900 dark:text-white truncate">
                            {s.vehicleNumber ?? s.sessionCode}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {typeof s.companyId === "object" ? s.companyId?.name : "Visitor"} •{" "}
                            {typeof s.floorId === "object" ? s.floorId?.name : "General"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <Check className="h-3 w-3" /> In Park
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Fast Reset Action */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[11px]">Press [Esc] to reset form</span>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleType(null);
                    setAvailability(null);
                    setVehicleNumber("");
                    setStep(1);
                  }}
                  className="font-bold text-slate-500 hover:text-slate-800"
                >
                  Clear Selection
                </button>
              </div>
            </div>
        </div>
      </div>

      {entryReceipt && (
        <div className="entry-receipt-print-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[325px]">
            <div className="entry-receipt-print overflow-hidden rounded-[6px] bg-white shadow-2xl">
              <div className="relative bg-gradient-to-r from-[#18A765] to-[#279D5F] px-4 py-3 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#18A765]">
                    <Check className="h-6 w-6 stroke-[4]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-black uppercase leading-tight tracking-wide">
                      Parking QR Generated
                    </p>
                    <p className="text-xs font-medium leading-tight">Entry Receipt</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEntryReceipt(null)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                  title="Close receipt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-2 py-2">
                <div className="flex items-center justify-center gap-2 rounded-[5px] bg-[#E6F8EC] px-3 py-2 text-[10px] font-bold text-[#116C45]">
                  <Info className="h-3.5 w-3.5 shrink-0 fill-[#116C45] text-[#116C45]" />
                  <span>Show this QR at exit for quick vehicle lookup.</span>
                </div>
              </div>

              <div className="entry-receipt-project px-4 pb-1 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7890AF]">Project</p>
                <p className="text-xl font-black leading-tight text-[#143B73]">
                  {currentProject?.name ?? "Parking Project"}
                </p>
              </div>

              <div className="flex flex-col items-center px-4 pb-2 pt-1">
                <div className="w-[122px] bg-white p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entryReceipt.qrImageUrl} alt="Parking QR code" className="h-auto w-full" />
                </div>
                <div className="mt-1 w-[165px] rounded-[6px] bg-[#EAF4FF] py-2 text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#7890AF]">Session</p>
                  <p className="font-mono text-base font-black leading-none text-[#094C9B]">
                    {entryReceipt.sessionCode}
                  </p>
                </div>
              </div>

              <div className="entry-receipt-floor relative overflow-hidden bg-[#EAF6FF] px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1D5D9B] text-white">
                    <MapPin className="h-3.5 w-3.5 fill-white" />
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#5E769B]">
                    Park Vehicle At
                  </p>
                </div>
                <p className="mt-1 font-mono text-[34px] font-black leading-none text-[#083A8D]">
                  {entryReceipt.qrPayload.floorCode || entryReceipt.qrPayload.floorName}
                </p>
                <p className="mt-1 text-[11px] font-bold leading-tight text-[#3E4E6A]">
                  {entryReceipt.qrPayload.floorName}
                </p>
                <p className="text-[11px] font-black leading-tight text-[#143B73]">
                  {currentProject?.name ?? "Parking Project"}
                </p>
                <Car className="pointer-events-none absolute bottom-2 right-6 h-14 w-14 text-[#C9E3F6]" />
                <div className="pointer-events-none absolute right-4 top-5 rounded bg-white/45 px-2 py-1 text-xl font-black text-[#C9E3F6]">
                  P
                </div>
              </div>

              <div className="px-4 py-2">
                <ReceiptRow
                  icon={<Car className="h-4 w-4" />}
                  iconClassName="bg-[#E8F1FA] text-[#416A92]"
                  label="Vehicle"
                  value={`${entryReceipt.vehicleNumber || "No vehicle number recorded"} | ${entryReceipt.vehicleType}`}
                />
                <ReceiptRow
                  icon={<Building2 className="h-4 w-4" />}
                  iconClassName="bg-[#E1F7E9] text-[#20A160]"
                  label="Destination"
                  value={entryReceipt.qrPayload.companyName}
                  subValue={`Parking: ${entryReceipt.qrPayload.floorCode || entryReceipt.qrPayload.floorName}`}
                />
                <ReceiptRow
                  icon={<LayoutGrid className="h-4 w-4" />}
                  iconClassName="bg-[#FFE8D7] text-[#FF7A32]"
                  label="Entry Gate"
                  value={entryReceipt.entryGateName || "Entry Gate"}
                />
                <ReceiptRow
                  icon={<Clock className="h-4 w-4" />}
                  iconClassName="bg-[#F0EAFF] text-[#6B5FC7]"
                  label="Entry Time"
                  value={new Date(entryReceipt.entryTime)
                    .toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })
                    .replace(",", " |")}
                />
              </div>

              <div className="bg-[#DFF7EA] px-4 py-2 text-center">
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#116C45]">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#15945A] text-white">
                    <Check className="h-2.5 w-2.5 stroke-[4]" />
                  </span>
                  <span>Keep this QR ready while exiting.</span>
                </div>
              </div>
            </div>

            <div className="thermal-receipt">
              <div className="thermal-title">{currentProject?.name ?? "PARKNEST"}</div>
              <div className="thermal-subtitle">ENTRY RECEIPT</div>
              <div className="thermal-qr">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entryReceipt.qrImageUrl} alt="Parking QR code" />
              </div>
              <div className="thermal-session">SESSION: {entryReceipt.sessionCode}</div>
              <div className="thermal-rule" />
              <div className="thermal-center-label">PARK VEHICLE AT</div>
              <div className="thermal-floor">{entryReceipt.qrPayload.floorCode || entryReceipt.qrPayload.floorName}</div>
              <div className="thermal-floor-name">{entryReceipt.qrPayload.floorName}</div>
              <div className="thermal-project-name">{currentProject?.name ?? "Parking Project"}</div>
              <div className="thermal-rule" />
              <div className="thermal-field">
                <div className="thermal-label">VEHICLE</div>
                <div className="thermal-value">{entryReceipt.vehicleType}</div>
                <div className="thermal-muted">{entryReceipt.vehicleNumber || "No vehicle number recorded"}</div>
              </div>
              <div className="thermal-field">
                <div className="thermal-label">DESTINATION</div>
                <div className="thermal-value">{entryReceipt.qrPayload.companyName}</div>
                <div className="thermal-muted">Parking: {entryReceipt.qrPayload.floorCode || entryReceipt.qrPayload.floorName}</div>
              </div>
              <div className="thermal-field">
                <div className="thermal-label">ENTRY GATE</div>
                <div className="thermal-value">{entryReceipt.entryGateName || "Entry Gate"}</div>
              </div>
              <div className="thermal-field">
                <div className="thermal-label">ENTRY TIME</div>
                <div className="thermal-value">
                  {new Date(entryReceipt.entryTime)
                    .toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })
                    .replace(",", "  ")}
                </div>
              </div>
              <div className="thermal-rule" />
              <div className="thermal-footer">Scan this QR at exit</div>
              <div className="thermal-thanks">Thank You</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(entryReceipt.qrToken).then(
                    () => toast.success("QR token copied."),
                    () => toast.error("Unable to copy QR token.")
                  );
                }}
                className="entry-receipt-action flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={() => window.setTimeout(() => window.print(), 100)}
                className="entry-receipt-action flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1565C0] text-sm font-black text-white hover:bg-blue-700"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
          <div className="hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  <QrCode className="h-3.5 w-3.5" />
                  Parking QR Generated
                </div>
                <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                  Entry Receipt
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  Show this QR at exit for quick vehicle lookup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEntryReceipt(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-900"
                title="Close receipt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="entry-receipt-floor mt-4 rounded-2xl border-2 border-[#1565C0] bg-blue-50 p-4 text-center dark:bg-blue-950/30">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1565C0] dark:text-blue-300">
                Park Vehicle At
              </p>
              <p className="mt-1 font-mono text-4xl font-black leading-none tracking-wide text-slate-950 dark:text-white sm:text-5xl">
                {entryReceipt.qrPayload.floorCode || entryReceipt.qrPayload.floorName}
              </p>
              <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                {entryReceipt.qrPayload.floorName}
              </p>
            </div>

            <div className="entry-receipt-project mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-center text-white dark:bg-white dark:text-slate-950">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] opacity-70">
                Project
              </p>
              <p className="text-2xl font-black leading-tight tracking-tight">
                {currentProject?.name ?? "Parking Project"}
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr]">
              <div className="mx-auto w-36 rounded-2xl border-2 border-slate-900 bg-white p-2 sm:w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entryReceipt.qrImageUrl} alt="Parking QR code" className="h-auto w-full" />
              </div>

              <div className="space-y-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Session</p>
                  <p className="font-mono text-base font-black text-slate-950 dark:text-white">
                    {entryReceipt.sessionCode}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vehicle</p>
                  <p className="font-bold text-slate-950 dark:text-white">
                    {entryReceipt.vehicleNumber || "No vehicle number recorded"} · {entryReceipt.vehicleType}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Destination</p>
                  <p className="font-bold text-slate-950 dark:text-white">
                    {entryReceipt.qrPayload.companyName}
                  </p>
                  <p className="text-slate-500">
                    Parking: {entryReceipt.qrPayload.floorCode || entryReceipt.qrPayload.floorName}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Entry Gate</p>
                  <p className="font-bold text-slate-950 dark:text-white">
                    {entryReceipt.entryGateName || "Entry Gate"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Entry Time</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    {new Date(entryReceipt.entryTime).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(entryReceipt.qrToken).then(
                    () => toast.success("QR token copied."),
                    () => toast.error("Unable to copy QR token.")
                  );
                }}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={() => window.setTimeout(() => window.print(), 100)}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1565C0] text-sm font-black text-white hover:bg-blue-700"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptRow({
  icon,
  iconClassName,
  label,
  value,
  subValue,
}: {
  icon: ReactNode;
  iconClassName: string;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="flex gap-3 border-b border-[#E7EDF5] py-2 last:border-b-0">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] ${iconClassName}`}>
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#7890AF]">{label}</p>
        <p className="text-[11px] font-black leading-tight text-[#173D72]">{value}</p>
        {subValue && <p className="text-[11px] font-semibold leading-tight text-[#4A5D78]">{subValue}</p>}
      </div>
    </div>
  );
}
