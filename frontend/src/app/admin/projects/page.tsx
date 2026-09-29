"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useProject } from "@/lib/project-context";
import { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { Plus, Building2, Trash2, Loader2, AlertTriangle, MapPin, CheckCircle2 } from "lucide-react";

export default function ProjectsPage() {
  const { currentProjectId, setCurrentProjectId, refresh } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ projects: Project[] }>("/api/projects");
      setProjects(data.projects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus(project: Project) {
    try {
      await apiFetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: project.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      load();
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update project.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget || confirmText !== deleteTarget.code) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/projects/${deleteTarget._id}`, { method: "DELETE" });
      toast.success(`"${deleteTarget.name}" and all of its data have been deleted.`);
      setDeleteTarget(null);
      setConfirmText("");
      load();
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete project.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buildings &amp; Projects"
        description="Every commercial campus or commercial facility isolated within this system."
        actions={
          <Button render={<Link href="/admin/projects/new" />} nativeButton={false} className="rounded-xl font-bold gap-1.5 tap-bounce shadow-xs">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        }
      />

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2 font-medium">Loading projects...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const isCurrent = p._id === currentProjectId;

            return (
              <Card
                key={p._id}
                className={`rounded-2xl border-2 transition-all tap-bounce ${
                  isCurrent ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border/80 bg-card hover:border-primary/50 shadow-xs"
                }`}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-extrabold leading-snug">{p.name}</p>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground font-bold">{p.code}</p>
                    </div>
                    <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px] font-bold">
                      {p.status}
                    </Badge>
                  </div>

                  {p.address && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                      <span className="truncate">{p.address}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t border-border/60 pt-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={p.status === "ACTIVE"} onCheckedChange={() => toggleStatus(p)} />
                      <span className="text-xs text-muted-foreground font-semibold">Active</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={isCurrent ? "secondary" : "default"}
                        size="sm"
                        className="rounded-xl font-bold text-xs h-8"
                        onClick={() => {
                          setCurrentProjectId(p._id);
                          toast.success(`Switched active context to ${p.name}`);
                        }}
                      >
                        {isCurrent ? "Selected" : "Switch To"}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => {
                          setDeleteTarget(p);
                          setConfirmText("");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {projects.length === 0 && (
            <Card className="col-span-full rounded-2xl border-dashed border-2">
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-bold text-foreground">No projects created yet</p>
                <p className="text-xs text-muted-foreground">Create your first campus or building project to begin.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Safe Delete Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-3xl p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Delete Project</DialogTitle>
            <DialogDescription className="text-xs">
              This action will permanently delete all data scoped to this project.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-4 py-2">
              <Alert variant="destructive" className="rounded-2xl">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs font-semibold leading-relaxed">
                  Permanently deleting <strong>{deleteTarget.name}</strong> will remove all floors, companies,
                  allocations, gates, project users, and parking session logs.
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  Type <span className="font-mono text-destructive">{deleteTarget.code}</span> to confirm
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder={deleteTarget.code}
                  className="h-11 rounded-xl font-mono uppercase font-bold"
                  autoFocus
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl font-bold">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || !deleteTarget || confirmText !== deleteTarget.code}
              className="rounded-xl font-bold"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
