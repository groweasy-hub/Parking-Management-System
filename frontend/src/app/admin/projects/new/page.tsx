"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useProject } from "@/lib/project-context";
import { Floor, Gate, Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Bike, Building2, Car, DoorOpen, Loader2, ParkingSquare, Plus, Trash2 } from "lucide-react";

type ProjectForm = { name: string; address: string; totalFloors: number };
type ParkingSetupForm = { count: number; prefix: string };
type ParkingFloorDraft = { name: string; code: string; carCapacity: number; bikeCapacity: number };
type GateDraft = { name: string; type: "ENTRY" | "EXIT" };

const STEPS = ["Project", "Parking Floors", "Gates", "Review"] as const;

export default function NewProjectWizard() {
  const router = useRouter();
  const { setCurrentProjectId, refresh } = useProject();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [parkingFloors, setParkingFloors] = useState<Floor[]>([]);
  const [floorDrafts, setFloorDrafts] = useState<ParkingFloorDraft[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [gateDrafts, setGateDrafts] = useState<GateDraft[]>([
    { name: "Entry Gate 1", type: "ENTRY" },
    { name: "Exit Gate 1", type: "EXIT" },
  ]);

  const projectForm = useForm<ProjectForm>({ defaultValues: { name: "", address: "", totalFloors: 0 } });
  const parkingForm = useForm<ParkingSetupForm>({ defaultValues: { count: 3, prefix: "B" } });

  async function createProject(values: ProjectForm) {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          address: values.address || undefined,
          totalFloors: Number(values.totalFloors) || 0,
        }),
      });
      setProject(data.project);
      setStep(1);
      toast.success(`Project registered. Code: ${data.project.code}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to register project.");
    } finally {
      setSubmitting(false);
    }
  }

  function generateParkingFloors(values: ParkingSetupForm) {
    const count = Math.max(1, Number(values.count) || 1);
    const prefix = (values.prefix || "B").trim().toUpperCase();
    setFloorDrafts(
      Array.from({ length: count }, (_, index) => {
        const code = `${prefix}${index + 1}`;
        return { code, name: code, carCapacity: 0, bikeCapacity: 0 };
      })
    );
  }

  function updateFloorDraft(index: number, patch: Partial<ParkingFloorDraft>) {
    setFloorDrafts((current) => current.map((floor, itemIndex) => (itemIndex === index ? { ...floor, ...patch } : floor)));
  }

  async function saveParkingFloors() {
    if (!project || floorDrafts.length === 0) return;
    setSubmitting(true);
    try {
      const created: Floor[] = [];
      for (const [index, floor] of floorDrafts.entries()) {
        const data = await apiFetch<{ floor: Floor }>("/api/floors", {
          method: "POST",
          body: JSON.stringify({
            projectId: project._id,
            name: floor.name,
            code: floor.code,
            displayOrder: index,
            carCapacity: Number(floor.carCapacity) || 0,
            bikeCapacity: Number(floor.bikeCapacity) || 0,
            otherCapacity: 0,
          }),
        });
        created.push(data.floor);
      }
      setParkingFloors(created);
      setStep(2);
      toast.success("Parking floors and capacities saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save parking floors.");
    } finally {
      setSubmitting(false);
    }
  }

  function addGate(type: "ENTRY" | "EXIT") {
    const count = gateDrafts.filter((gate) => gate.type === type).length + 1;
    setGateDrafts((current) => [...current, { type, name: `${type === "ENTRY" ? "Entry" : "Exit"} Gate ${count}` }]);
  }

  async function saveGates() {
    if (!project || gateDrafts.length === 0) return;
    setSubmitting(true);
    try {
      const created: Gate[] = [];
      for (const gate of gateDrafts) {
        const data = await apiFetch<{ gate: Gate }>("/api/gates", {
          method: "POST",
          body: JSON.stringify({ projectId: project._id, name: gate.name, type: gate.type }),
        });
        created.push(data.gate);
      }
      setGates(created);
      setStep(3);
      toast.success("Entry and exit gates saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save gates.");
    } finally {
      setSubmitting(false);
    }
  }

  function finish() {
    if (project) setCurrentProjectId(project._id);
    refresh();
    toast.success("Project setup completed.");
    router.push("/admin/companies");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl">
          <ParkingSquare className="h-7 w-7 text-primary" />
          Register Project
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Create the building, parking floors, capacities, and gate names before adding companies.</p>
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-2xl border bg-card p-2">
        {STEPS.map((label, index) => (
          <div key={label} className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${index === step ? "bg-primary text-primary-foreground" : index < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Project code is generated automatically after registration.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={projectForm.handleSubmit(createProject)} className="space-y-4">
              <Field label="Project Name">
                <Input {...projectForm.register("name", { required: true })} placeholder="Example: Cyber Towers" />
                {projectForm.formState.errors.name && (
                  <p className="text-xs font-semibold text-destructive">Project name is required.</p>
                )}
              </Field>
              <Field label="Address">
                <Textarea {...projectForm.register("address")} placeholder="Building address" />
              </Field>
              <Field label="Total Building Floors Without Parking">
                <Input type="number" min={0} {...projectForm.register("totalFloors", { valueAsNumber: true })} />
              </Field>
              <Button type="submit" disabled={submitting} className="w-full font-bold">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Register Project
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Parking Floors and Capacity</CardTitle>
            <CardDescription>Generate floors like B1, B2, B3 or G1, G2, G3, then enter spaces for each floor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={parkingForm.handleSubmit(generateParkingFloors)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Total Parking Floors">
                <Input type="number" min={1} {...parkingForm.register("count", { valueAsNumber: true })} />
              </Field>
              <Field label="Floor Prefix">
                <Input {...parkingForm.register("prefix", { required: true })} placeholder="B or G" />
              </Field>
              <Button className="self-end font-bold" type="submit">Generate</Button>
            </form>

            <div className="space-y-3">
              {floorDrafts.map((floor, index) => (
                <div key={`${floor.code}-${index}`} className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[1fr_100px_120px_120px]">
                  <Field label="Floor Name">
                    <Input value={floor.name} onChange={(event) => updateFloorDraft(index, { name: event.target.value })} />
                  </Field>
                  <Field label="Code">
                    <Input value={floor.code} onChange={(event) => updateFloorDraft(index, { code: event.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Car Spaces">
                    <Input type="number" min={0} value={floor.carCapacity} onChange={(event) => updateFloorDraft(index, { carCapacity: Number(event.target.value) })} />
                  </Field>
                  <Field label="Bike Spaces">
                    <Input type="number" min={0} value={floor.bikeCapacity} onChange={(event) => updateFloorDraft(index, { bikeCapacity: Number(event.target.value) })} />
                  </Field>
                </div>
              ))}
            </div>

            <WizardActions onBack={() => setStep(0)} onNext={saveParkingFloors} disabled={submitting || floorDrafts.length === 0} nextLabel="Save Parking Floors" />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Entry and Exit Gates</CardTitle>
            <CardDescription>Add total gates with names. These are used for gatekeeper user assignment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => addGate("ENTRY")} className="font-bold"><Plus className="h-4 w-4" /> Entry Gate</Button>
              <Button variant="outline" onClick={() => addGate("EXIT")} className="font-bold"><Plus className="h-4 w-4" /> Exit Gate</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {gateDrafts.map((gate, index) => (
                <div key={`${gate.type}-${index}`} className="flex items-end gap-2 rounded-xl border bg-muted/20 p-3">
                  <Field label={gate.type === "ENTRY" ? "Entry Gate Name" : "Exit Gate Name"}>
                    <Input value={gate.name} onChange={(event) => setGateDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                  </Field>
                  <Button variant="outline" size="icon" onClick={() => setGateDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove gate">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <WizardActions onBack={() => setStep(1)} onNext={saveGates} disabled={submitting || gateDrafts.length === 0} nextLabel="Save Gates" />
          </CardContent>
        </Card>
      )}

      {step === 3 && project && (
        <Card>
          <CardHeader>
            <CardTitle>{project.name} is Ready</CardTitle>
            <CardDescription>Add companies next, then allocate parking spaces from the saved parking floors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryTile icon={Building2} label="Building Floors" value={project.totalFloors ?? 0} />
              <SummaryTile icon={ParkingSquare} label="Parking Floors" value={parkingFloors.length} />
              <SummaryTile icon={DoorOpen} label="Gates" value={gates.length} />
            </div>
            <div className="flex flex-wrap gap-2">
              {parkingFloors.map((floor) => (
                <Badge key={floor._id} variant="secondary" className="gap-2 rounded-lg px-3 py-1.5">
                  {floor.code}
                  <Car className="h-3.5 w-3.5" /> {floor.carCapacity}
                  <Bike className="h-3.5 w-3.5" /> {floor.bikeCapacity}
                </Badge>
              ))}
            </div>
            <Button onClick={finish} className="w-full font-bold">Continue to Add Companies <ArrowRight className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Label className="text-xs font-bold">{label}</Label>
      {children}
    </div>
  );
}

function WizardActions({ onBack, onNext, disabled, nextLabel }: { onBack: () => void; onNext: () => void; disabled?: boolean; nextLabel: string }) {
  return (
    <div className="flex justify-between border-t pt-4">
      <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <Button onClick={onNext} disabled={disabled} className="font-bold">{nextLabel} <ArrowRight className="h-4 w-4" /></Button>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}
