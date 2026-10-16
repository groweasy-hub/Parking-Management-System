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
  const isReset = mode === "reset";
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
    const token = isReset ? new URLSearchParams(window.location.hash.slice(1)).get("token") : null;
    if (isReset && !token) {
      setError("This reset link is invalid. Please request a new one using the link below.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ message: string }>(
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
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to connect. Please try again.");
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
          <h1 className="text-2xl font-black tracking-tight">{isReset ? "Create a new password" : "Forgot password?"}</h1>
          <p className="text-sm text-muted-foreground">
            {isReset
              ? "Choose a new password for your account. Your email link is valid for 15 minutes and can be used once."
              : "Enter your registered work email. We will check your account and email you a link to create a new password."}
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
              {submitting ? (isReset ? "Updating password..." : "Sending email...") : (isReset ? "Save new password" : "Send reset link")}
            </Button>
          </form>
        )}
        <div className="flex flex-col items-center gap-3 text-sm font-semibold text-primary">
          {isReset && !completed && <Link href="/forgot-password" className="hover:underline">Request a new reset link</Link>}
          <Link href="/login" className="hover:underline">Back to sign in</Link>
        </div>
      </div>
    </main>
  );
}
