"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Company, Floor, ParkingAllocation, VehicleType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Bike, Building2, Car, Loader2, Mail, MapPin, Phone, Plus, Search, Wrench } from "lucide-react";

type CompanyForm = {
  name: string;
  officeFloor: string;
  email: string;
  phone: string;
  serviceType: string;
  address: string;
};

type AllocationDraft = {
  floorId: string;
  carCapacity: number;
  bikeCapacity: number;
};

const emptyCompany: CompanyForm = {
  name: "",
  officeFloor: "",
  email: "",
  phone: "",
  serviceType: "",
  address: "",
};

export default function CompaniesPage() {
  const { currentProjectId, currentProject } = useProject();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdCompany, setCreatedCompany] = useState<Company | null>(null);
  const [detailsCompany, setDetailsCompany] = useState<Company | null>(null);
  const [companyAllocations, setCompanyAllocations] = useState<ParkingAllocation[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [allocation, setAllocation] = useState<AllocationDraft>({
    floorId: "",
    carCapacity: 0,
    bikeCapacity: 0,
  });

  const form = useForm<CompanyForm>({ defaultValues: emptyCompany });

  const buildingFloorOptions = Array.from({ length: currentProject?.totalFloors ?? 0 }, (_, index) => String(index + 1));

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const [companyData, floorData] = await Promise.all([
        apiFetch<{ companies: Company[] }>(`/api/companies?projectId=${currentProjectId}&search=${encodeURIComponent(search)}`),
        apiFetch<{ floors: Floor[] }>(`/api/floors?projectId=${currentProjectId}`),
      ]);
      setCompanies(companyData.companies);
      setFloors(floorData.floors);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, search]);

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
  }, [load]);

  function resetDialog() {
    form.reset({ ...emptyCompany, address: currentProject?.address ?? "" });
    setCreatedCompany(null);
    setAllocation({ floorId: "", carCapacity: 0, bikeCapacity: 0 });
  }

  async function createCompany(values: CompanyForm) {
    if (!currentProjectId) return;
    setSubmitting(true);
    try {
      const data = await apiFetch<{ company: Company }>("/api/companies", {
        method: "POST",
        body: JSON.stringify({
          projectId: currentProjectId,
          name: values.name,
          officeFloor: values.officeFloor,
          email: values.email || undefined,
          phone: values.phone || undefined,
          serviceType: values.serviceType || undefined,
          address: values.address || currentProject?.address || undefined,
        }),
      });
      setCreatedCompany(data.company);
      toast.success("Company registered. Allocate parking spaces now.");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to register company.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createAllocation(vehicleType: VehicleType, capacity: number) {
    if (!currentProjectId || !createdCompany || !allocation.floorId || capacity <= 0) return;
    await apiFetch("/api/parking-allocations", {
      method: "POST",
      body: JSON.stringify({
        projectId: currentProjectId,
        companyId: createdCompany._id,
        floorId: allocation.floorId,
        vehicleType,
        capacity,
      }),
    });
  }

  async function saveAllocation() {
    setSubmitting(true);
    try {
      await createAllocation("CAR", Number(allocation.carCapacity) || 0);
      await createAllocation("BIKE", Number(allocation.bikeCapacity) || 0);
      toast.success("Parking allocation saved.");
      setOpen(false);
      resetDialog();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to allocate parking.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openCompanyDetails(company: Company) {
    if (!currentProjectId) return;
    setDetailsCompany(company);
    setCompanyAllocations([]);
    setDetailsLoading(true);
    try {
      const data = await apiFetch<{ allocations: ParkingAllocation[] }>(
        `/api/parking-allocations?projectId=${currentProjectId}&companyId=${company._id}`
      );
      setCompanyAllocations(data.allocations.filter((item) => item.vehicleType !== "OTHER"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to load company details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Register companies under the active project, then allocate parking floor spaces."
        actions={
          <Dialog
            open={open}
            onOpenChange={(value) => {
              setOpen(value);
              if (value) resetDialog();
            }}
          >
            <DialogTrigger render={<Button className="gap-1.5 rounded-xl font-bold"><Plus className="h-4 w-4" /> Add Company</Button>} />
            <DialogContent className="max-w-2xl rounded-2xl">
              <DialogHeader>
                <DialogTitle>{createdCompany ? "Parking Space Allocation" : "Register Company"}</DialogTitle>
              </DialogHeader>

              {!createdCompany ? (
                <form onSubmit={form.handleSubmit(createCompany)} className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company Name">
                    <Input {...form.register("name", { required: true })} placeholder="Example: ABC Technologies" />
                  </Field>
                  <Field label="Company Floor">
                    <Select value={form.watch("officeFloor")} onValueChange={(value) => form.setValue("officeFloor", value ?? "")}>
                      <SelectTrigger><SelectValue placeholder="Select building floor" /></SelectTrigger>
                      <SelectContent>
                        {buildingFloorOptions.map((floor) => (
                          <SelectItem key={floor} value={floor}>Floor {floor}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Email Address Optional">
                    <Input type="email" {...form.register("email")} placeholder="admin@company.com" />
                  </Field>
                  <Field label="Contact Number Optional">
                    <Input {...form.register("phone")} placeholder="+91..." />
                  </Field>
                  <Field label="Service They Provide">
                    <Input {...form.register("serviceType")} placeholder="IT, Finance, Facility, Retail..." />
                  </Field>
                  <Field label="Address">
                    <Textarea {...form.register("address")} placeholder={currentProject?.address || "Building address"} />
                  </Field>
                  <Button disabled={submitting} className="sm:col-span-2 font-bold">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Register Company
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="font-bold">{createdCompany.name}</p>
                    <p className="text-xs text-muted-foreground">Code: {createdCompany.code}</p>
                  </div>
                  <Field label="Parking Floor">
                    <Select value={allocation.floorId} onValueChange={(value) => setAllocation((current) => ({ ...current, floorId: value ?? "" }))}>
                      <SelectTrigger><SelectValue placeholder="Select parking floor" /></SelectTrigger>
                      <SelectContent>
                        {floors.map((floor) => (
                          <SelectItem key={floor._id} value={floor._id}>
                            {floor.name} ({floor.code}) | Cars {floor.carCapacity} | Bikes {floor.bikeCapacity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CapacityField icon={Car} label="Car Spaces" value={allocation.carCapacity} onChange={(value) => setAllocation((current) => ({ ...current, carCapacity: value }))} />
                    <CapacityField icon={Bike} label="Bike Spaces" value={allocation.bikeCapacity} onChange={(value) => setAllocation((current) => ({ ...current, bikeCapacity: value }))} />
                  </div>
                  <Button disabled={submitting || !allocation.floorId} onClick={saveAllocation} className="w-full font-bold">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Parking Allocation
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search companies..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-xl border-2 pl-10 font-medium" />
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <Card
              key={company._id}
              onClick={() => openCompanyDetails(company)}
              className="cursor-pointer rounded-2xl border border-border/80 shadow-xs transition hover:border-primary/50 hover:shadow-md tap-bounce"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{company.name}</CardTitle>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{company.code}</p>
                  </div>
                  <Badge>{company.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {company.officeFloor && <Info icon={Building2} text={`Floor ${company.officeFloor}`} />}
                {company.email && <Info icon={Mail} text={company.email} />}
                {company.phone && <Info icon={Phone} text={company.phone} />}
                {company.serviceType && <Info icon={Wrench} text={company.serviceType} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!detailsCompany}
        onOpenChange={(value) => {
          if (!value) {
            setDetailsCompany(null);
            setCompanyAllocations([]);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{detailsCompany?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Company code: <span className="font-mono font-bold">{detailsCompany?.code}</span>
            </DialogDescription>
          </DialogHeader>

          {detailsCompany && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="Building Floor" value={detailsCompany.officeFloor ? `Floor ${detailsCompany.officeFloor}` : "Not added"} />
                <DetailItem label="Status" value={detailsCompany.status} />
                <DetailItem label="Email" value={detailsCompany.email || "Not added"} />
                <DetailItem label="Contact Number" value={detailsCompany.phone || "Not added"} />
                <DetailItem label="Service Type" value={detailsCompany.serviceType || "Not added"} />
                <DetailItem label="Address" value={detailsCompany.address || currentProject?.address || "Not added"} />
              </div>

              {detailsLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">Loading company parking details...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <SummaryCard icon={Car} label="Car Spaces" value={sumAllocation(companyAllocations, "CAR", "capacity")} />
                    <SummaryCard icon={Bike} label="Bike Spaces" value={sumAllocation(companyAllocations, "BIKE", "capacity")} />
                    <SummaryCard icon={Car} label="Cars Parked" value={sumAllocation(companyAllocations, "CAR", "occupied")} />
                    <SummaryCard icon={Bike} label="Bikes Parked" value={sumAllocation(companyAllocations, "BIKE", "occupied")} />
                  </div>

                  <section className="space-y-2">
                    <h3 className="text-sm font-black">Parking Allocations</h3>
                    {companyAllocations.length === 0 ? (
                      <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-4 text-center text-xs font-semibold text-muted-foreground">
                        No parking allocations added for this company.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {companyAllocations.map((item) => {
                          const floor = floors.find((floorItem) => floorItem._id === item.floorId);
                          const available = Math.max(0, item.capacity - (item.occupied ?? 0));
                          const Icon = item.vehicleType === "BIKE" ? Bike : Car;
                          return (
                            <div key={item._id} className="rounded-2xl border bg-background p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="flex items-center gap-1.5 text-sm font-black">
                                    <Icon className="h-4 w-4 text-primary" />
                                    {item.vehicleType === "BIKE" ? "Bike Parking" : "Car Parking"}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {floor ? `${floor.name} (${floor.code})` : "Unknown parking floor"}
                                  </p>
                                </div>
                                <Badge variant={item.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] font-bold">
                                  {item.status}
                                </Badge>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                <MiniMetric label="Capacity" value={item.capacity} />
                                <MiniMetric label="Occupied" value={item.occupied ?? 0} />
                                <MiniMetric label="Available" value={available} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold">{label}</Label>
      {children}
    </div>
  );
}

function CapacityField({ icon: Icon, label, value, onChange }: { icon: typeof Car; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-bold"><Icon className="h-3.5 w-3.5" /> {label}</Label>
      <Input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function Info({ icon: Icon, text }: { icon: typeof Building2; text: string }) {
  return (
    <p className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {text}
    </p>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Car; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1 text-xl font-black">{value}</p>
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/40 px-2 py-2">
      <p className="text-base font-black">{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function sumAllocation(
  allocations: ParkingAllocation[],
  vehicleType: "CAR" | "BIKE",
  field: "capacity" | "occupied"
) {
  return allocations
    .filter((allocation) => allocation.vehicleType === vehicleType)
    .reduce((sum, allocation) => sum + (field === "capacity" ? allocation.capacity : allocation.occupied ?? 0), 0);
}
