"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useProject } from "@/lib/project-context";
import { Company, Floor, Gate, Project, VEHICLE_TYPES, VehicleType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Car,
  Bike,
  Truck,
  Building2,
  Layers,
  Sparkles,
  ShieldCheck,
  DoorOpen
} from "lucide-react";

const STEPS = ["Project Details", "Floors", "Companies", "Allocations", "Gates", "Review"] as const;

const VEHICLE_ICONS: Record<VehicleType, typeof Car> = { CAR: Car, BIKE: Bike, OTHER: Truck };

interface AddedAllocation {
  id: string;
  companyName: string;
  floorName: string;
  vehicleType: VehicleType;
  capacity: number;
}

export default function NewProjectWizard() {
  const router = useRouter();
  const { setCurrentProjectId, refresh } = useProject();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [totalFloors, setTotalFloors] = useState("");

  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorName, setFloorName] = useState("");
  const [floorCode, setFloorCode] = useState("");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companyOfficeFloor, setCompanyOfficeFloor] = useState("");

  const [allocCompanyId, setAllocCompanyId] = useState("");
  const [allocFloorId, setAllocFloorId] = useState("");
  const [allocVehicleType, setAllocVehicleType] = useState<VehicleType>("CAR");
  const [allocCapacity, setAllocCapacity] = useState("");
  const [addedAllocations, setAddedAllocations] = useState<AddedAllocation[]>([]);

  const [gates, setGates] = useState<Gate[]>([]);
  const [entryGateCount, setEntryGateCount] = useState("2");
  const [exitGateCount, setExitGateCount] = useState("1");

  async function handleCreateProject() {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          address: address || undefined,
          totalFloors: totalFloors ? Number(totalFloors) : undefined,
        }),
      });
      setProject(data.project);
      toast.success(`Project created: ${data.project.name} (${data.project.code}). Next, add parking floors.`);
      setStep(1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create project.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddFloor() {
    if (!project || !floorName || !floorCode) return;
    setSubmitting(true);
    try {
      const data = await apiFetch<{ floor: Floor }>("/api/floors", {
        method: "POST",
        body: JSON.stringify({ projectId: project._id, name: floorName, code: floorCode.toUpperCase() }),
      });
      setFloors((prev) => [...prev, data.floor]);
      setFloorName("");
      setFloorCode("");
      toast.success(`Added ${data.floor.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to add floor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteFloor(floor: Floor) {
    setSubmitting(true);
    try {
      await apiFetch(`/api/floors/${floor._id}`, { method: "DELETE" });
      setFloors((prev) => prev.filter((f) => f._id !== floor._id));
      toast.success(`Removed ${floor.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete floor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddCompany() {
    if (!project || !companyName) return;
    setSubmitting(true);
    try {
      const data = await apiFetch<{ company: Company }>("/api/companies", {
        method: "POST",
        body: JSON.stringify({
          projectId: project._id,
          name: companyName,
          officeFloor: companyOfficeFloor || undefined,
        }),
      });
      setCompanies((prev) => [...prev, data.company]);
      setCompanyName("");
      setCompanyOfficeFloor("");
      toast.success(`Added ${data.company.name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to add company.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddAllocation() {
    if (!project || !allocCompanyId || !allocFloorId || !allocCapacity) return;
    setSubmitting(true);
    try {
      const data = await apiFetch<{ allocation: { _id: string } }>("/api/parking-allocations", {
        method: "POST",
        body: JSON.stringify({
          projectId: project._id,
          companyId: allocCompanyId,
          floorId: allocFloorId,
          vehicleType: allocVehicleType,
          capacity: Number(allocCapacity),
        }),
      });
      setAddedAllocations((prev) => [
        ...prev,
        {
          id: data.allocation._id,
          companyName: companies.find((c) => c._id === allocCompanyId)?.name ?? "Unknown",
          floorName: floors.find((f) => f._id === allocFloorId)?.name ?? "Unknown",
          vehicleType: allocVehicleType,
          capacity: Number(allocCapacity),
        },
      ]);
      setAllocCapacity("");
      toast.success("Parking allocation registered");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to add allocation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateGates() {
    if (!project) return;
    const entryCount = Math.max(0, Number(entryGateCount) || 0);
    const exitCount = Math.max(0, Number(exitGateCount) || 0);
    if (entryCount === 0 && exitCount === 0) return;

    setSubmitting(true);
    try {
      const created: Gate[] = [];
      for (let i = 1; i <= entryCount; i++) {
        const data = await apiFetch<{ gate: Gate }>("/api/gates", {
          method: "POST",
          body: JSON.stringify({ projectId: project._id, name: `Entry Gate ${i}`, type: "ENTRY" }),
        });
        created.push(data.gate);
      }
      for (let i = 1; i <= exitCount; i++) {
        const data = await apiFetch<{ gate: Gate }>("/api/gates", {
          method: "POST",
          body: JSON.stringify({ projectId: project._id, name: `Exit Gate ${i}`, type: "EXIT" }),
        });
        created.push(data.gate);
      }
      setGates((prev) => [...prev, ...created]);
      toast.success(`${created.length} gate(s) generated`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create gates.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinish() {
    if (project) setCurrentProjectId(project._id);
    refresh();
    toast.success("Project setup complete! Switching to new project dashboard.");
    router.push("/admin/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          Setup New Project
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Follow the step-by-step wizard to configure buildings, parking levels, tenants, and gates.
        </p>
      </div>

      {/* Responsive Stepper */}
      <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs">
        {/* Desktop Stepper */}
        <div className="hidden sm:flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                  i < step
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                    : i === step
                    ? "border-2 border-primary bg-primary/10 text-primary font-black"
                    : "border border-border/80 text-muted-foreground bg-muted/30"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs ${i === step ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        {/* Mobile Stepper */}
        <div className="sm:hidden space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-primary">Step {step + 1} of {STEPS.length}</span>
            <span className="font-bold text-foreground">{STEPS[step]}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step 0: Project Details */}
      {step === 0 && (
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">1. Project Information</CardTitle>
            <CardDescription className="text-xs">
              Enter the campus or building name. A unique project code will be created automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Project Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cyber Towers Campus"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Total Building Floors (Optional)</Label>
              <Input
                type="number"
                min={0}
                value={totalFloors}
                onChange={(e) => setTotalFloors(e.target.value)}
                placeholder="e.g. 15"
                className="h-10 rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Total building floors for tenant offices (parking levels are added in Step 2).
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Address / Location</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="HITEC City, Madhapur, Hyderabad"
                className="rounded-xl min-h-[80px]"
              />
            </div>
            <Button
              onClick={handleCreateProject}
              disabled={submitting || !name.trim()}
              size="lg"
              className="w-full h-11 rounded-xl font-bold gap-2 mt-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Save &amp; Continue to Floors
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Floors */}
      {step === 1 && (
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">2. Parking Floors</CardTitle>
            <CardDescription className="text-xs">
              Add basement or podium levels dedicated to parking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Input
                placeholder="Floor Name (e.g. Basement 1)"
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
                className="h-10 rounded-xl"
              />
              <Input
                placeholder="Code (e.g. B1)"
                value={floorCode}
                onChange={(e) => setFloorCode(e.target.value)}
                className="h-10 sm:w-28 rounded-xl font-mono uppercase"
              />
              <Button
                onClick={handleAddFloor}
                disabled={submitting || !floorName || !floorCode}
                className="h-10 rounded-xl font-bold shrink-0"
              >
                Add Floor
              </Button>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold text-muted-foreground">Added Parking Floors:</Label>
              <div className="flex flex-wrap gap-2">
                {floors.map((f) => (
                  <Badge key={f._id} variant="secondary" className="gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>{f.name}</span>
                    <span className="font-mono font-bold text-muted-foreground">({f.code})</span>
                    <button
                      onClick={() => handleDeleteFloor(f)}
                      disabled={submitting}
                      className="ml-1 rounded-full p-0.5 hover:bg-rose-500/20 hover:text-rose-500"
                      aria-label={`Delete ${f.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {floors.length === 0 && (
                  <p className="text-xs italic text-muted-foreground">No parking floors added yet.</p>
                )}
              </div>
            </div>

            <WizardNav onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={floors.length === 0} />
          </CardContent>
        </Card>
      )}

      {/* Step 2: Companies */}
      {step === 2 && (
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">3. Companies &amp; Tenants</CardTitle>
            <CardDescription className="text-xs">
              Add corporate occupants leasing office spaces in the building.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Company Name (e.g. Acme Corp)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-10 rounded-xl"
              />
              <Input
                placeholder="Office Floor (e.g. 5th Floor)"
                value={companyOfficeFloor}
                onChange={(e) => setCompanyOfficeFloor(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <Button
              onClick={handleAddCompany}
              disabled={submitting || !companyName.trim()}
              className="h-10 rounded-xl font-bold"
            >
              Add Company
            </Button>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold text-muted-foreground">Added Companies:</Label>
              <div className="flex flex-wrap gap-2">
                {companies.map((c) => (
                  <Badge key={c._id} variant="secondary" className="gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <span>{c.name}</span>
                    {c.officeFloor && <span className="text-[11px] text-muted-foreground">({c.officeFloor})</span>}
                  </Badge>
                ))}
                {companies.length === 0 && (
                  <p className="text-xs italic text-muted-foreground">No companies registered yet.</p>
                )}
              </div>
            </div>

            <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={companies.length === 0} />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Allocations */}
      {step === 3 && (
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">4. Parking Space Allocations</CardTitle>
            <CardDescription className="text-xs">
              Allocate slot counts on specific floors for each tenant and vehicle type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={allocCompanyId} onValueChange={(v) => v && setAllocCompanyId(v)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select Company">
                    {(v: string | null) => companies.find((c) => c._id === v)?.name ?? "Select Company"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={allocFloorId} onValueChange={(v) => v && setAllocFloorId(v)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select Floor">
                    {(v: string | null) => floors.find((f) => f._id === v)?.name ?? "Select Floor"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {floors.map((f) => (
                    <SelectItem key={f._id} value={f._id}>{f.name} ({f.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={allocVehicleType} onValueChange={(v) => v && setAllocVehicleType(v as VehicleType)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min={1}
                placeholder="Slot Capacity (e.g. 50)"
                value={allocCapacity}
                onChange={(e) => setAllocCapacity(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>

            <Button
              onClick={handleAddAllocation}
              disabled={submitting || !allocCompanyId || !allocFloorId || !allocCapacity}
              className="h-10 rounded-xl font-bold"
            >
              Add Allocation
            </Button>

            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Added Allocations</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-bold text-primary">
                  {addedAllocations.length}
                </span>
              </div>
              {addedAllocations.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No allocations added yet.</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {addedAllocations.map((a) => {
                    const Icon = VEHICLE_ICONS[a.vehicleType];
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-lg bg-card p-2 text-xs border border-border/60"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          <strong className="text-foreground">{a.companyName}</strong>
                          <span className="text-muted-foreground">· {a.floorName} ({a.vehicleType})</span>
                        </span>
                        <span className="font-bold font-mono text-foreground">{a.capacity} slots</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <WizardNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={addedAllocations.length === 0} />
          </CardContent>
        </Card>
      )}

      {/* Step 4: Gates */}
      {step === 4 && (
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">5. Entry &amp; Exit Gates</CardTitle>
            <CardDescription className="text-xs">
              Quickly generate entry and exit gates for vehicle access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Number of Entry Gates</Label>
                <Input
                  type="number"
                  min={0}
                  value={entryGateCount}
                  onChange={(e) => setEntryGateCount(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Number of Exit Gates</Label>
                <Input
                  type="number"
                  min={0}
                  value={exitGateCount}
                  onChange={(e) => setExitGateCount(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <Button
              onClick={handleCreateGates}
              disabled={submitting}
              className="h-10 rounded-xl font-bold"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Gates
            </Button>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold text-muted-foreground">Created Gates:</Label>
              <div className="flex flex-wrap gap-2">
                {gates.map((g) => (
                  <Badge
                    key={g._id}
                    variant="secondary"
                    className={`gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium ${
                      g.type === "ENTRY"
                        ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                        : "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                    }`}
                  >
                    <DoorOpen className="h-3.5 w-3.5" />
                    <span>{g.name}</span>
                    <span className="font-bold">({g.type})</span>
                  </Badge>
                ))}
                {gates.length === 0 && (
                  <p className="text-xs italic text-muted-foreground">No gates created yet.</p>
                )}
              </div>
            </div>

            <WizardNav onBack={() => setStep(3)} onNext={() => setStep(5)} nextDisabled={gates.length === 0} />
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review & Complete */}
      {step === 5 && project && (
        <Card className="border border-border/80 bg-card shadow-xs overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-primary to-emerald-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              6. Setup Ready for Launch!
            </CardTitle>
            <CardDescription className="text-xs">
              Review configuration summary before opening the operations dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
              <div>
                <p className="text-base font-black text-foreground">{project.name}</p>
                <p className="text-xs font-mono text-muted-foreground">Code: {project.code}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                <div className="rounded-lg bg-card p-2.5 border border-border/60">
                  <p className="text-muted-foreground">Parking Floors</p>
                  <p className="text-lg font-bold text-foreground">{floors.length}</p>
                </div>
                <div className="rounded-lg bg-card p-2.5 border border-border/60">
                  <p className="text-muted-foreground">Companies</p>
                  <p className="text-lg font-bold text-foreground">{companies.length}</p>
                </div>
                <div className="rounded-lg bg-card p-2.5 border border-border/60">
                  <p className="text-muted-foreground">Allocations</p>
                  <p className="text-lg font-bold text-foreground">{addedAllocations.length}</p>
                </div>
                <div className="rounded-lg bg-card p-2.5 border border-border/60">
                  <p className="text-muted-foreground">Gates</p>
                  <p className="text-lg font-bold text-foreground">{gates.length}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/5 rounded-xl p-3 border border-primary/20">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>
                Gate operators and staff credentials can be created at any time from the Users management screen.
              </span>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(4)} className="rounded-xl h-10">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleFinish}
                size="lg"
                className="h-10 rounded-xl font-bold bg-primary text-primary-foreground shadow-md shadow-primary/25 gap-2"
              >
                Launch Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WizardNav({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex justify-between pt-3 border-t border-border/60">
      <Button variant="outline" onClick={onBack} className="rounded-xl h-9 text-xs">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Button>
      <Button onClick={onNext} disabled={nextDisabled} className="rounded-xl h-9 text-xs font-bold">
        Next Step <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
