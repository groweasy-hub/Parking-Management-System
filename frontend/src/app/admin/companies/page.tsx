"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Company } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { Plus, Loader2, Upload, Search, Building2, MapPin } from "lucide-react";

export default function CompaniesPage() {
  const { currentProjectId } = useProject();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [officeFloor, setOfficeFloor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ companies: Company[] }>(
        `/api/companies?projectId=${currentProjectId}&search=${encodeURIComponent(search)}`
      );
      setCompanies(data.companies);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, search]);

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
  }, [load]);

  async function handleCreate() {
    if (!currentProjectId) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/companies", {
        method: "POST",
        body: JSON.stringify({ projectId: currentProjectId, name, officeFloor: officeFloor || undefined }),
      });
      toast.success("Company created");
      setOpen(false);
      setName("");
      setOfficeFloor("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create company.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(company: Company) {
    try {
      await apiFetch(`/api/companies/${company._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: company.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update company.");
    }
  }

  async function handleLogoUpload(company: Company, file: File) {
    const formData = new FormData();
    formData.append("logo", file);
    try {
      await apiFetch(`/api/companies/${company._id}/logo`, { method: "POST", body: formData });
      toast.success("Logo updated successfully");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to upload logo.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Tenants and companies occupying office spaces in this building."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="rounded-xl font-bold gap-1.5 tap-bounce shadow-xs">
                  <Plus className="h-4 w-4" /> Add Company
                </Button>
              }
            />
            <DialogContent className="rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">Add Company</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Company Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. ABC Technologies"
                    className="h-11 rounded-xl font-medium"
                  />
                  <p className="text-[11px] text-muted-foreground">A unique code will automatically be generated.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Office Floor</Label>
                  <Input
                    value={officeFloor}
                    onChange={(e) => setOfficeFloor(e.target.value)}
                    placeholder="e.g. 5th Floor, Suite 501"
                    className="h-11 rounded-xl font-medium"
                  />
                  <p className="text-[11px] text-muted-foreground">The office level in the building (not a parking basement).</p>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={submitting || !name}
                  className="rounded-xl font-bold h-11 w-full sm:w-auto"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Company
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by company name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 pl-10 rounded-xl border-2 font-medium"
        />
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2 font-medium">Loading companies...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => (
            <Card key={c._id} className="rounded-2xl border border-border/80 shadow-xs hover:shadow-md transition-all tap-bounce">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-3.5">
                  {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.logoUrl}
                      alt={c.name}
                      className="h-12 w-12 rounded-2xl object-cover ring-1 ring-border shrink-0 shadow-xs"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-base font-black text-primary border border-primary/20 shadow-xs">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-extrabold leading-snug">{c.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] font-bold">{c.code}</span>
                      {c.officeFloor && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {c.officeFloor}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"} className="font-bold text-[10px] shrink-0">
                    {c.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={c.status === "ACTIVE"} onCheckedChange={() => toggleStatus(c)} />
                    <span className="text-xs text-muted-foreground font-semibold">Active</span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputs.current[c._id]?.click()}
                    className="h-8 rounded-xl font-bold text-xs gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" /> Logo
                  </Button>

                  <input
                    ref={(el) => {
                      fileInputs.current[c._id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(c, file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {companies.length === 0 && (
            <Card className="col-span-full rounded-2xl border-dashed border-2">
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-bold text-foreground">No companies found</p>
                <p className="text-xs text-muted-foreground">Add your first tenant to begin configuring parking allocations.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
