"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Loader2, ParkingSquare } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordRecoveryForm({ mode }: { mode: "request" | "reset" }) {
  const [resetToken, setResetToken] = useState<string | null>(null);
  const isReset = mode === "reset" || Boolean(resetToken);
  const { logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (isReset && password !== confirmation) {
      setError("Passwords do not match. Please enter the same password in both fields.");
      return;
    }
    const token = isReset ? resetToken ?? new URLSearchParams(window.location.hash.slice(1)).get("token") : null;
    if (isReset && !token) {
      setError("Your reset session is invalid. Please check your email address again using the link below.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ message: string; resetToken?: string }>(
        `/api/auth/${isReset ? "reset-password" : "forgot-password"}`,
        {
          method: "POST",
          skipRefreshRetry: true,
          body: JSON.stringify(isReset ? { token, newPassword: password } : { email }),
        }
      );
      setMessage(result.message);
      if (isReset) {
        await logout();
        window.history.replaceState(null, "", window.location.pathname);
        setPassword("");
        setConfirmation("");
        setCompleted(true);
        setResetToken(null);
      } else {
        if (!result.resetToken) throw new Error("Missing reset session");
        setResetToken(result.resetToken);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Cannot connect to ParkFlow. Check your connection and try again, or contact your administrator.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ParkingSquare className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-sm font-bold text-muted-foreground">ParkFlow</p>
          <h1 className="text-2xl font-black tracking-tight">{completed ? "Password updated" : isReset ? "Create a new password" : "Forgot password?"}</h1>
          <p className="text-sm text-muted-foreground">
            {completed
              ? "Sign in to your account using your new password."
              : isReset
                ? "Your email matches an active account. Enter and confirm your new password below."
                : "Enter your registered work email. If it matches an active account, you can create a new password."}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert role="status">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {!completed && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isReset ? (
              <>
                {email && <p className="text-sm text-muted-foreground">Account: <span className="font-semibold text-foreground">{email.trim().toLowerCase()}</span></p>}
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" autoComplete="new-password" required
                    minLength={8} maxLength={128} value={password} disabled={submitting}
                    onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-xl" />
                  <p className="text-xs text-muted-foreground">Use between 8 and 128 characters.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input id="confirm-password" type="password" autoComplete="new-password" required
                    minLength={8} maxLength={128} value={confirmation} disabled={submitting}
                    onChange={(event) => setConfirmation(event.target.value)} className="h-12 rounded-xl" />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Work email</Label>
                <Input id="reset-email" type="email" autoComplete="email" required maxLength={254}
                  value={email} disabled={submitting} onChange={(event) => setEmail(event.target.value)}
                  placeholder="operator@parking.local" className="h-12 rounded-xl" />
              </div>
            )}
            <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl font-bold">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitting ? (isReset ? "Updating password..." : "Checking email...") : (isReset ? "Save new password" : "Check email")}
            </Button>
          </form>
        )}
        <div className="flex flex-col items-center gap-3 text-sm font-semibold text-primary">
          {isReset && !completed && (resetToken
            ? <button type="button" disabled={submitting} className="hover:underline" onClick={() => {
                setResetToken(null); setPassword(""); setConfirmation(""); setError(null); setMessage(null);
              }}>Use a different email</button>
            : <Link href="/forgot-password" className="hover:underline">Check your email address again</Link>)}
          <Link href="/login" className="hover:underline">Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
