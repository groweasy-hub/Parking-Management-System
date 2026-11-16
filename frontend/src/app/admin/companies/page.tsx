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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Bike, Building2, Car, Loader2, Mail, Phone, Plus, Search, Trash2, Wrench } from "lucide-react";

type CompanyForm = {
  name: string;
  officeFloors: string[];
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

type CompanyEditDraft = {
  name: string;
  officeFloors: string[];
  email: string;
  phone: string;
  serviceType: string;
  address: string;
};

function emptyAllocationDraft(): AllocationDraft {
  return { floorId: "", carCapacity: 0, bikeCapacity: 0 };
}

const emptyCompany: CompanyForm = {
  name: "",
  officeFloors: [],
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
  const [allocationDrafts, setAllocationDrafts] = useState<AllocationDraft[]>([emptyAllocationDraft()]);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [savingCompanyAllocations, setSavingCompanyAllocations] = useState(false);
  const [editingCompanyDetails, setEditingCompanyDetails] = useState<Company | null>(null);
  const [companyEditDraft, setCompanyEditDraft] = useState<CompanyEditDraft | null>(null);
  const [savingCompanyDetails, setSavingCompanyDetails] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [deletingCompany, setDeletingCompany] = useState(false);

  const form = useForm<CompanyForm>({ defaultValues: emptyCompany });
  const officeFloors = form.watch("officeFloors");

  const buildingFloorOptions = Array.from({ length: currentProject?.totalFloors ?? 0 }, (_, index) => String(index + 1));
  const floorOrderedCompanies = [...companies].sort((left, right) => {
    const floorDifference = firstOfficeFloorNumber(left) - firstOfficeFloorNumber(right);
    return floorDifference || left.name.localeCompare(right.name);
  });

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
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to load companies. Please try again.");
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
    setAllocationDrafts([emptyAllocationDraft()]);
  }

  async function createCompany(values: CompanyForm) {
    if (!currentProjectId) {
      toast.error("Select a project before registering a company.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiFetch<{ company: Company }>("/api/companies", {
        method: "POST",
        body: JSON.stringify({
          projectId: currentProjectId,
          name: values.name.trim(),
          officeFloors: values.officeFloors,
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

  async function persistCompanyAllocations(
    company: Company,
    drafts: AllocationDraft[]
  ) {
    if (!currentProjectId) throw new Error("Select a project before changing parking allocations.");
    const response = await apiFetch<{ allocations: ParkingAllocation[] }>(
      `/api/parking-allocations?projectId=${currentProjectId}&companyId=${company._id}`
    );
    const existingAllocations = response.allocations;

    for (const draft of drafts) {
      for (const vehicleType of ["CAR", "BIKE"] as const) {
        const capacity = Math.max(0, Math.floor(Number(vehicleType === "CAR" ? draft.carCapacity : draft.bikeCapacity) || 0));
        const existing = existingAllocations.find(
          (item) => item.floorId === draft.floorId && item.vehicleType === vehicleType
        );

        if (existing) {
          if (capacity > 0) {
            await apiFetch(`/api/parking-allocations/${existing._id}`, {
              method: "PATCH",
              body: JSON.stringify({ capacity, status: "ACTIVE" }),
            });
            existing.capacity = capacity;
            existing.status = "ACTIVE";
          } else if (existing.status === "ACTIVE") {
            await apiFetch(`/api/parking-allocations/${existing._id}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "INACTIVE" }),
            });
            existing.status = "INACTIVE";
          }
        } else if (capacity > 0) {
          const created = await apiFetch<{ allocation: ParkingAllocation }>("/api/parking-allocations", {
            method: "POST",
            body: JSON.stringify({
              projectId: currentProjectId,
              companyId: company._id,
              floorId: draft.floorId,
              vehicleType,
              capacity,
            }),
          });
          existingAllocations.push(created.allocation);
        }
      }
    }
  }

  async function saveAllocation() {
    const configured = allocationDrafts.filter((draft) => draft.floorId && (Number(draft.carCapacity) > 0 || Number(draft.bikeCapacity) > 0));
    if (!createdCompany || configured.length === 0) {
      toast.error("Choose at least one parking floor and enter a car or bike capacity.");
      return;
    }
    if (new Set(allocationDrafts.filter((draft) => draft.floorId).map((draft) => draft.floorId)).size !== allocationDrafts.filter((draft) => draft.floorId).length) {
      toast.error("Choose each parking floor only once.");
      return;
    }
    setSubmitting(true);
    try {
      await persistCompanyAllocations(createdCompany, configured);
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

  function beginEditAllocations(company: Company) {
    const byFloor = new Map<string, AllocationDraft>();
    for (const item of companyAllocations) {
      const draft = byFloor.get(item.floorId) ?? { ...emptyAllocationDraft(), floorId: item.floorId };
      const capacity = item.status === "ACTIVE" ? item.capacity : 0;
      if (item.vehicleType === "CAR") draft.carCapacity = capacity;
      if (item.vehicleType === "BIKE") draft.bikeCapacity = capacity;
      byFloor.set(item.floorId, draft);
    }
    setEditingCompany(company);
    setAllocationDrafts([...byFloor.values(), emptyAllocationDraft()]);
  }

  async function saveEditedAllocations() {
    if (!editingCompany) return;
    const selectedFloors = allocationDrafts.filter((draft) => draft.floorId);
    if (new Set(selectedFloors.map((draft) => draft.floorId)).size !== selectedFloors.length) {
      toast.error("Choose each parking floor only once.");
      return;
    }
    setSavingCompanyAllocations(true);
    try {
      await persistCompanyAllocations(editingCompany, selectedFloors);
      toast.success("Company parking allocations updated.");
      setEditingCompany(null);
      await openCompanyDetails(editingCompany);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update parking allocations.");
    } finally {
      setSavingCompanyAllocations(false);
    }
  }

  function updateAllocationDraft(index: number, changes: Partial<AllocationDraft>) {
    setAllocationDrafts((current) => current.map((draft, draftIndex) => draftIndex === index ? { ...draft, ...changes } : draft));
  }

  function beginEditCompany(company: Company) {
    setEditingCompanyDetails(company);
    setCompanyEditDraft({
      name: company.name,
      officeFloors: company.officeFloors?.length ? company.officeFloors : company.officeFloor ? [company.officeFloor] : [],
      email: company.email ?? "",
      phone: company.phone ?? "",
      serviceType: company.serviceType ?? "",
      address: company.address ?? "",
    });
  }

  async function saveCompanyDetails() {
    if (!editingCompanyDetails || !companyEditDraft) return;
    if (!companyEditDraft.name.trim()) {
      toast.error("Company name is required.");
      return;
    }
    setSavingCompanyDetails(true);
    try {
      const data = await apiFetch<{ company: Company }>(`/api/companies/${editingCompanyDetails._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: companyEditDraft.name.trim(),
          officeFloors: companyEditDraft.officeFloors,
          email: companyEditDraft.email,
          phone: companyEditDraft.phone,
          serviceType: companyEditDraft.serviceType,
          address: companyEditDraft.address,
        }),
      });
      setCompanies((current) => current.map((company) => company._id === data.company._id ? data.company : company));
      setDetailsCompany(data.company);
      setEditingCompanyDetails(null);
      toast.success("Company details updated.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update company details.");
    } finally {
      setSavingCompanyDetails(false);
    }
  }

  async function deleteCompany() {
    if (!deleteTarget || deleteConfirmCode !== deleteTarget.code) return;
    setDeletingCompany(true);
    try {
      await apiFetch(`/api/companies/${deleteTarget._id}`, { method: "DELETE" });
      setCompanies((current) => current.filter((company) => company._id !== deleteTarget._id));
      setDetailsCompany(null);
      setCompanyAllocations([]);
      setDeleteTarget(null);
      setDeleteConfirmCode("");
      toast.success(`${deleteTarget.name} was deleted.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete company.");
    } finally {
      setDeletingCompany(false);
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
                <form
                  noValidate
                  onSubmit={form.handleSubmit(createCompany, () => {
                    toast.error("Enter a company name and correct any highlighted fields.");
                  })}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <Field label="Company Name">
                    <Input
                      {...form.register("name", {
                        validate: (value) => value.trim().length > 0 || "Company name is required.",
                      })}
                      aria-invalid={!!form.formState.errors.name}
                      aria-describedby={form.formState.errors.name ? "company-name-error" : undefined}
                      placeholder="Example: ABC Technologies"
                    />
                    {form.formState.errors.name && (
                      <p id="company-name-error" className="text-xs font-medium text-destructive" role="alert">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </Field>
                  <Field label="Company Office Floors (Optional — select all that apply)">
                    {buildingFloorOptions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-3">
                        {buildingFloorOptions.map((floor) => {
                          const selected = (officeFloors ?? []).includes(floor);
                          return (
                            <label key={floor} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(checked) => {
                                  const next = checked
                                    ? [...(officeFloors ?? []), floor]
                                    : (officeFloors ?? []).filter((item) => item !== floor);
                                  form.setValue("officeFloors", next, { shouldDirty: true, shouldTouch: true });
                                }}
                              />
                              <span>Floor {floor}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">No building floors configured for this project.</p>
                    )}
                  </Field>
                  <Field label="Email Address Optional">
                    <Input type="email" {...form.register("email", {
                      pattern: { value: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address." },
                    })} aria-invalid={!!form.formState.errors.email} placeholder="admin@company.com" />
                    {form.formState.errors.email && <p className="text-xs font-medium text-destructive" role="alert">{form.formState.errors.email.message}</p>}
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
                  <Button type="submit" disabled={submitting} className="sm:col-span-2 font-bold">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Register Company
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="font-bold">{createdCompany.name}</p>
                    <p className="text-xs text-muted-foreground">Code: {createdCompany.code} · Add parking on one or more floors.</p>
                  </div>
                  <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                    {allocationDrafts.map((draft, index) => (
                      <AllocationFloorDraft
                        key={index}
                        index={index}
                        draft={draft}
                        floors={floors}
                        floorDisabled={false}
                        unavailableFloorIds={new Set(allocationDrafts.filter((_, draftIndex) => draftIndex !== index).map((item) => item.floorId).filter(Boolean))}
                        onChange={(changes) => updateAllocationDraft(index, changes)}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={allocationDrafts.some((draft) => !draft.floorId) || allocationDrafts.filter((draft) => draft.floorId).length >= floors.length}
                    onClick={() => setAllocationDrafts((current) => [...current, emptyAllocationDraft()])}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4" /> Add Another Floor
                  </Button>
                  <Button disabled={submitting || floors.length === 0} onClick={saveAllocation} className="w-full font-bold">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Company and Parking
                  </Button>
                  {floors.length === 0 && <p className="text-center text-xs text-muted-foreground">Add parking floors to this project before assigning spaces.</p>}
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
          {floorOrderedCompanies.map((company) => (
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
                {companyOfficeFloorLabel(company) && <Info icon={Building2} text={companyOfficeFloorLabel(company)} />}
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
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">Building Floors</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">{companyOfficeFloorLabel(detailsCompany) || "Not added"}</p>
                  </div>
                </div>
                <DetailItem label="Status" value={detailsCompany.status} />
                <DetailItem label="Email" value={detailsCompany.email || "Not added"} />
                <DetailItem label="Contact Number" value={detailsCompany.phone || "Not added"} />
                <DetailItem label="Service Type" value={detailsCompany.serviceType || "Not added"} />
                <DetailItem label="Address" value={detailsCompany.address || currentProject?.address || "Not added"} />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => beginEditCompany(detailsCompany)}>Edit Company</Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => { setDeleteTarget(detailsCompany); setDeleteConfirmCode(""); }}
                >
                  <Trash2 className="h-4 w-4" /> Delete Company
                </Button>
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
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black">Parking Allocations</h3>
                      <Button type="button" size="sm" variant="outline" onClick={() => beginEditAllocations(detailsCompany)}>
                        Edit Floors & Spaces
                      </Button>
                    </div>
                    {companyAllocations.length === 0 ? (
                      <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-4 text-center text-xs font-semibold text-muted-foreground">
                        No parking allocations added for this company.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {companyAllocations.map((item) => {
                          const floor = floors.find((floorItem) => floorItem._id === item.floorId);
                          const capacity = item.status === "ACTIVE" ? item.capacity : 0;
                          const available = Math.max(0, capacity - (item.occupied ?? 0));
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
                                <MiniMetric label="Capacity" value={capacity} />
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

      <Dialog open={!!editingCompany} onOpenChange={(value) => { if (!value) setEditingCompany(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Parking Allocations</DialogTitle>
            <DialogDescription>{editingCompany?.name}: set car and bike spaces on each parking floor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {allocationDrafts.map((draft, index) => (
              <AllocationFloorDraft
                key={index}
                index={index}
                draft={draft}
                floors={floors}
                floorDisabled={companyAllocations.some((item) => item.floorId === draft.floorId)}
                unavailableFloorIds={new Set(allocationDrafts.filter((_, draftIndex) => draftIndex !== index).map((item) => item.floorId).filter(Boolean))}
                onChange={(changes) => updateAllocationDraft(index, changes)}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={allocationDrafts.some((draft) => !draft.floorId) || allocationDrafts.filter((draft) => draft.floorId).length >= floors.length}
              onClick={() => setAllocationDrafts((current) => [...current, emptyAllocationDraft()])}
              className="w-full"
            >
              <Plus className="h-4 w-4" /> Add Another Floor
            </Button>
            <Button disabled={savingCompanyAllocations} onClick={saveEditedAllocations} className="w-full font-bold">
              {savingCompanyAllocations && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Parking Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCompanyDetails} onOpenChange={(value) => { if (!value) setEditingCompanyDetails(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update company details and select every building floor it occupies.</DialogDescription>
          </DialogHeader>
          {companyEditDraft && (
            <div className="space-y-4">
              <Field label="Company Name">
                <Input value={companyEditDraft.name} onChange={(event) => setCompanyEditDraft((current) => current ? { ...current, name: event.target.value } : current)} />
              </Field>
              <Field label="Company Office Floors (select all that apply)">
                {buildingFloorOptions.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-3">
                    {buildingFloorOptions.map((floor) => (
                      <label key={floor} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                        <Checkbox
                          checked={companyEditDraft.officeFloors.includes(floor)}
                          onCheckedChange={(checked) => setCompanyEditDraft((current) => current ? {
                            ...current,
                            officeFloors: checked
                              ? current.officeFloors.includes(floor) ? current.officeFloors : [...current.officeFloors, floor]
                              : current.officeFloors.filter((item) => item !== floor),
                          } : current)}
                        />
                        <span>Floor {floor}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">No building floors configured for this project.</p>
                )}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email">
                  <Input type="email" value={companyEditDraft.email} onChange={(event) => setCompanyEditDraft((current) => current ? { ...current, email: event.target.value } : current)} />
                </Field>
                <Field label="Contact Number">
                  <Input value={companyEditDraft.phone} onChange={(event) => setCompanyEditDraft((current) => current ? { ...current, phone: event.target.value } : current)} />
                </Field>
                <Field label="Service Type">
                  <Input value={companyEditDraft.serviceType} onChange={(event) => setCompanyEditDraft((current) => current ? { ...current, serviceType: event.target.value } : current)} />
                </Field>
                <Field label="Address">
                  <Textarea value={companyEditDraft.address} onChange={(event) => setCompanyEditDraft((current) => current ? { ...current, address: event.target.value } : current)} />
                </Field>
              </div>
              <Button disabled={savingCompanyDetails} onClick={saveCompanyDetails} className="w-full font-bold">
                {savingCompanyDetails && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Company Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(value) => { if (!value) { setDeleteTarget(null); setDeleteConfirmCode(""); } }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
            <DialogDescription>
              This permanently removes {deleteTarget?.name}, its parking allocations, and its parking session history. Companies with vehicles still parked must have those vehicles exited first.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-2">
              <Label htmlFor="delete-company-code" className="text-xs font-bold">
                Type company code <span className="font-mono text-destructive">{deleteTarget.code}</span> to confirm.
              </Label>
              <Input
                id="delete-company-code"
                value={deleteConfirmCode}
                onChange={(event) => setDeleteConfirmCode(event.target.value.toUpperCase())}
                placeholder={deleteTarget.code}
                className="font-mono uppercase"
                autoFocus
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deletingCompany || !deleteTarget || deleteConfirmCode !== deleteTarget.code} onClick={deleteCompany}>
              {deletingCompany && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AllocationFloorDraft({
  index,
  draft,
  floors,
  floorDisabled,
  unavailableFloorIds,
  onChange,
}: {
  index: number;
  draft: AllocationDraft;
  floors: Floor[];
  floorDisabled: boolean;
  unavailableFloorIds: Set<string>;
  onChange: (changes: Partial<AllocationDraft>) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <Field label={`Parking Floor ${index + 1}`}>
        <Select value={draft.floorId || null} onValueChange={(value) => onChange({ floorId: value ?? "" })}>
          <SelectTrigger disabled={floorDisabled}><SelectValue placeholder="Select parking floor" /></SelectTrigger>
          <SelectContent>
            {floors.map((floor) => (
              <SelectItem key={floor._id} value={floor._id} disabled={unavailableFloorIds.has(floor._id)}>
                {floor.name} ({floor.code}) · Cars {floor.carCapacity} · Bikes {floor.bikeCapacity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <CapacityField icon={Car} label="Car Spaces" value={draft.carCapacity} onChange={(value) => onChange({ carCapacity: value })} />
        <CapacityField icon={Bike} label="Bike Spaces" value={draft.bikeCapacity} onChange={(value) => onChange({ bikeCapacity: value })} />
      </div>
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
        <Input type="number" min={0} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))} />
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

function companyOfficeFloorLabel(company: Company): string {
  const floors = company.officeFloors?.length
    ? company.officeFloors
    : company.officeFloor
      ? [company.officeFloor]
      : [];
  return floors.map((floor) => `Floor ${floor}`).join(", ");
}

function firstOfficeFloorNumber(company: Company): number {
  const floors = company.officeFloors?.length
    ? company.officeFloors
    : company.officeFloor
      ? [company.officeFloor]
      : [];
  const numbers = floors
    .map((floor) => Number(floor.match(/\d+/)?.[0]))
    .filter(Number.isFinite);
  return numbers.length ? Math.min(...numbers) : Number.POSITIVE_INFINITY;
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
    .filter((allocation) => allocation.vehicleType === vehicleType && allocation.status === "ACTIVE")
    .reduce((sum, allocation) => sum + (field === "capacity" ? allocation.capacity : allocation.occupied ?? 0), 0);
}
