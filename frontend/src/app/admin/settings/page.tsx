"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { useProject } from "@/lib/project-context";
import { useAuth } from "@/lib/auth-context";
import { AuthUser } from "@/lib/types";
import { apiFetch, ApiError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Database,
  UserRound,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Save
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ReconcileResult {
  allocationId: string;
  companyName: string;
  floorName: string;
  vehicleType: string;
  previousOccupied: number;
  actualOccupied: number;
  corrected: boolean;
}

interface ProfileFormValues {
  name: string;
  email: string;
  phone: string;
  currentPassword: string;
  newPassword: string;
}

export default function SettingsPage() {
  const { currentProjectId } = useProject();
  const { user, refreshUser } = useAuth();
  const [running, setRunning] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [results, setResults] = useState<ReconcileResult[] | null>(null);
  const [stats, setStats] = useState<{ checked: number; corrected: number } | null>(null);
  const profileForm = useForm<ProfileFormValues>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      currentPassword: "",
      newPassword: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    profileForm.reset({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      currentPassword: "",
      newPassword: "",
    });
  }, [profileForm, user]);

  async function handleProfileUpdate(values: ProfileFormValues) {
    if (!user || user.role !== "SUPER_ADMIN") return;
    if (values.newPassword && !values.currentPassword) {
      toast.error("Enter current password to set a new password.");
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        currentPassword: values.currentPassword || undefined,
        newPassword: values.newPassword || undefined,
      };
      const data = await apiFetch<{ user: AuthUser }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      profileForm.reset({
        name: data.user.name,
        email: data.user.email,
        phone: data.user.phone ?? "",
        currentPassword: "",
        newPassword: "",
      });
      await refreshUser();
      toast.success("Profile updated successfully.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleReconcile() {
    if (!currentProjectId) return;
    setRunning(true);
    try {
      const data = await apiFetch<{ checked: number; corrected: number; results: ReconcileResult[] }>(
        "/api/settings/reconcile-occupancy",
        { method: "POST", body: JSON.stringify({ projectId: currentProjectId }) }
      );
      setResults(data.results);
      setStats({ checked: data.checked, corrected: data.corrected });
      if (data.corrected > 0) {
        toast.success(`Successfully reconciled: ${data.corrected} out-of-sync allocations updated.`);
      } else {
        toast.success(`All ${data.checked} allocations are already in perfect sync!`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to reconcile occupancy.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Settings & System Maintenance"
        description="Super admin profile, security details, data integrity utilities, and maintenance tools."
      />

      {user?.role === "SUPER_ADMIN" && (
        <Card className="border border-border/80 bg-card shadow-xs overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-sky-500 to-emerald-500" />
          <CardHeader className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  Super Admin Profile
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm leading-relaxed max-w-2xl">
                  Update your account details, contact number, login email, and password from one place.
                </CardDescription>
              </div>
              <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                <Lock className="h-6 w-6" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-0">
            <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display Name" icon={UserRound}>
                  <Input
                    {...profileForm.register("name", { required: true, minLength: 2 })}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email Address" icon={Mail}>
                  <Input
                    type="email"
                    {...profileForm.register("email", { required: true })}
                    placeholder="admin@example.com"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Contact Number" icon={Phone}>
                  <Input
                    {...profileForm.register("phone")}
                    placeholder="+91..."
                    autoComplete="tel"
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-black text-foreground">Change Password</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leave these fields empty if you only want to update profile details.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <PasswordField
                    label="Current Password"
                    valueKey="currentPassword"
                    form={profileForm}
                    visible={showCurrentPassword}
                    onToggle={() => setShowCurrentPassword((value) => !value)}
                  />
                  <PasswordField
                    label="New Password"
                    valueKey="newPassword"
                    form={profileForm}
                    visible={showNewPassword}
                    onToggle={() => setShowNewPassword((value) => !value)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={savingProfile} className="h-10 rounded-xl gap-2 font-bold">
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingProfile ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-emerald-500 to-primary" />
        <CardHeader className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Recalculate &amp; Reconcile Occupancy Counters
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm leading-relaxed max-w-2xl">
                Recomputes each allocation&apos;s occupancy counter against active parking sessions (the authoritative ground truth).
                If unexpected system restarts or network interrupts ever caused drift, this instantly syncs counters and generates an audit log entry.
              </CardDescription>
            </div>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <RefreshCw className="h-6 w-6" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-0 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleReconcile}
              disabled={running}
              size="lg"
              className="h-11 rounded-xl px-5 font-bold shadow-md shadow-primary/20 gap-2"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {running ? "Scanning Active Sessions..." : "Run Occupancy Reconcile"}
            </Button>

            {stats && (
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-semibold text-foreground">
                  Checked: {stats.checked}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold ${
                    stats.corrected > 0
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {stats.corrected > 0 ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Corrected: {stats.corrected}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      100% In Sync
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {results && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  Reconciliation Results Breakdown
                </h3>
                <span className="text-xs text-muted-foreground">{results.length} allocations evaluated</span>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-border/80 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Vehicle Type</TableHead>
                      <TableHead>Previous Counter</TableHead>
                      <TableHead>Actual Active Sessions</TableHead>
                      <TableHead className="text-right">Sync Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.allocationId} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-foreground">{r.companyName}</TableCell>
                        <TableCell>
                          <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                            {r.floorName}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {r.vehicleType}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{r.previousOccupied}</TableCell>
                        <TableCell className="font-mono text-sm font-bold text-foreground">
                          {r.actualOccupied}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.corrected ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1">
                              <AlertTriangle className="h-3 w-3" /> Corrected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> In Sync
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile App Cards View */}
              <div className="space-y-2.5 md:hidden">
                {results.map((r) => (
                  <div
                    key={r.allocationId}
                    className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs space-y-2 transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{r.companyName}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.floorName} • <span className="font-semibold text-primary">{r.vehicleType}</span>
                        </p>
                      </div>
                      {r.corrected ? (
                        <Badge className="bg-amber-500 text-white text-[11px] gap-1 shrink-0">
                          <AlertTriangle className="h-3 w-3" /> Corrected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> In Sync
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-2 text-xs">
                      <span className="text-muted-foreground">Previous:</span>
                      <span className="font-mono font-semibold text-muted-foreground">{r.previousOccupied}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Actual:</span>
                      <span className="font-mono font-bold text-foreground">{r.actualOccupied}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {children}
    </div>
  );
}

function PasswordField({
  label,
  valueKey,
  form,
  visible,
  onToggle,
}: {
  label: string;
  valueKey: "currentPassword" | "newPassword";
  form: UseFormReturn<ProfileFormValues>;
  visible: boolean;
  onToggle: () => void;
}) {
  const ToggleIcon = visible ? EyeOff : Eye;
  return (
    <div className="space-y-2">
      <Label className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        {label}
      </Label>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          {...form.register(valueKey)}
          placeholder={label}
          autoComplete={valueKey === "currentPassword" ? "current-password" : "new-password"}
          className="pr-11"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg"
          onClick={onToggle}
          title={visible ? "Hide password" : "Show password"}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <ToggleIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
