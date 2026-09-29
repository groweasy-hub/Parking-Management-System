"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { hashMpin, hasMpinForUser, markMpinUnlocked, mpinHashKey } from "@/lib/gate-security";

type SecurityStep = "password" | "setup-mpin" | "verify-mpin" | "ready";

export default function GateSecurityPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<SecurityStep>("password");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mpin, setMpin] = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.mustChangePassword) {
      setStep("password");
      return;
    }
    if (!hasMpinForUser(user.id)) {
      setStep("setup-mpin");
      return;
    }
    setStep("verify-mpin");
  }, [user]);

  const title = useMemo(() => {
    if (step === "password") return "Change Password";
    if (step === "setup-mpin") return "Set Device MPIN";
    return "Enter MPIN";
  }, [step]);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshUser();
      if (user && !hasMpinForUser(user.id)) setStep("setup-mpin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to change password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetupMpin(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!/^\d{4}$/.test(mpin)) {
      setError("MPIN must be exactly 4 digits.");
      return;
    }
    if (mpin !== confirmMpin) {
      setError("MPIN and confirm MPIN must match.");
      return;
    }
    if (!rememberDevice) {
      setError("Please select Remember this device before saving MPIN.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const hashed = await hashMpin(user.id, mpin);
      window.localStorage.setItem(mpinHashKey(user.id), hashed);
      markMpinUnlocked(user.id);
      setStep("ready");
      router.replace("/gate/select");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyMpin(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!rememberDevice) {
      setError("Please select Remember this device before unlocking.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const expected = window.localStorage.getItem(mpinHashKey(user.id));
      const actual = await hashMpin(user.id, mpin);
      if (!expected || actual !== expected) {
        setError("Incorrect MPIN.");
        return;
      }
      markMpinUnlocked(user.id);
      setStep("ready");
      router.replace("/gate/select");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-md items-center">
      <Card className="w-full rounded-2xl border-border/70 shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            {step === "password" ? <ShieldCheck className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
          </div>
          <div>
            <CardTitle className="text-xl font-black">{title}</CardTitle>
            <CardDescription>
              {step === "password"
                ? "Use the password given by super admin once, then create your own."
                : step === "setup-mpin"
                  ? "This MPIN unlocks gate operations on this device."
                  : "Enter your device MPIN to continue gate operations."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4 rounded-xl">
              <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
            </Alert>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <PasswordField
                id="old-password"
                label="Old Password"
                value={oldPassword}
                show={showPassword}
                onChange={setOldPassword}
              />
              <PasswordField
                id="new-password"
                label="New Password"
                value={newPassword}
                show={showPassword}
                onChange={setNewPassword}
              />
              <PasswordField
                id="confirm-password"
                label="Confirm Password"
                value={confirmPassword}
                show={showPassword}
                onChange={setConfirmPassword}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPassword ? "Hide passwords" : "Show passwords"}
              </button>
              <Button type="submit" className="h-12 w-full rounded-xl font-bold" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Change Password
              </Button>
            </form>
          )}

          {step === "setup-mpin" && (
            <form onSubmit={handleSetupMpin} className="space-y-4">
              <MpinField id="mpin" label="New MPIN" value={mpin} onChange={setMpin} />
              <MpinField id="confirm-mpin" label="Confirm MPIN" value={confirmMpin} onChange={setConfirmMpin} />
              <RememberDeviceCheckbox checked={rememberDevice} onChange={setRememberDevice} />
              <Button type="submit" className="h-12 w-full rounded-xl font-bold" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Save MPIN
              </Button>
            </form>
          )}

          {step === "verify-mpin" && (
            <form onSubmit={handleVerifyMpin} className="space-y-4">
              <MpinField id="verify-mpin" label="MPIN" value={mpin} onChange={setMpin} autoFocus />
              <RememberDeviceCheckbox checked={rememberDevice} onChange={setRememberDevice} />
              <Button type="submit" className="h-12 w-full rounded-xl font-bold" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                Unlock Gate App
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RememberDeviceCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-left">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <span className="text-xs font-semibold leading-relaxed text-muted-foreground">
        Remember this device. This MPIN will be used to unlock gate operations on this device.
      </span>
    </label>
  );
}

function PasswordField({
  id,
  label,
  value,
  show,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-bold">{label}</Label>
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete="current-password"
        required
        className="h-12 rounded-xl border-2 bg-card text-sm font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function MpinField({
  id,
  label,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-bold">{label}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        minLength={4}
        maxLength={4}
        required
        autoFocus={autoFocus}
        className="h-14 rounded-xl border-2 bg-card text-center text-2xl font-black tracking-[0.4em]"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      />
    </div>
  );
}
