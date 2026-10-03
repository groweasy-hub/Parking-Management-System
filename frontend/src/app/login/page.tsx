"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { deferNavigation } from "@/lib/deferred-navigation";
import { gatekeeperSecurityPath } from "@/lib/gate-security";
import { landingPathForRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ParkingSquare,
  Loader2,
  Car,
  ShieldCheck,
  Radio,
  Eye,
  EyeOff,
} from "lucide-react";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      return deferNavigation(() => router.replace(gatekeeperSecurityPath(user) ?? landingPathForRole(user.role)));
    }
  }, [user, loading, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      router.replace(gatekeeperSecurityPath(loggedInUser) ?? landingPathForRole(loggedInUser.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100">
      {/* Left Branding panel (Desktop) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 p-12 lg:flex border-r border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <ParkingSquare className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white">ParkFlow</span>
            <span className="block text-xs text-slate-400">Intelligent Parking Cloud</span>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary">
            <SparkleIcon /> Multi-Project Parking Platform
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight text-balance">
            Real-time parking, engineered for precision gate operations.
          </h1>
          <p className="text-base text-slate-300 leading-relaxed text-balance">
            Instant live availability checks, atomic concurrency-safe transactions, and live occupancy across every
            floor and company — syncing across all screens instantaneously.
          </p>
          <div className="space-y-3.5 pt-2">
            <Feature icon={Radio} text="Sub-second WebSocket availability updates across all consoles" />
            <Feature icon={Car} text="Fast 2-3 step Entry & Exit workflows optimized for mobile" />
            <Feature icon={ShieldCheck} text="Role-based access control with comprehensive audit trail" />
          </div>
        </div>

        <p className="text-xs text-slate-500 font-medium">© {new Date().getFullYear()} ParkFlow Management System</p>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        />
      </div>

      {/* Right Form panel */}
      <div className="flex w-full flex-1 flex-col items-center justify-center bg-background px-4 py-8 text-foreground sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile branding header */}
          <div className="space-y-2 text-center lg:hidden">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <ParkingSquare className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">ParkFlow</h1>
            <p className="text-xs text-muted-foreground">Parking Management Terminal</p>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black tracking-tight">Operator Sign In</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Sign in with your assigned account to access your gate console or admin dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold">Work Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                className="h-12 rounded-xl border-2 bg-card text-sm font-medium text-foreground placeholder:text-muted-foreground"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@parking.local"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="h-12 rounded-xl border-2 bg-card pr-11 text-sm font-medium text-foreground placeholder:text-muted-foreground"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-13 rounded-2xl text-base font-bold shadow-md shadow-primary/20 tap-bounce"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Authenticating...
                </>
              ) : (
                "Sign In to Terminal"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Car; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-primary border border-slate-700">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm text-slate-300 font-medium">{text}</span>
    </div>
  );
}

function SparkleIcon() {
  return <span className="inline-block h-2 w-2 rounded-full bg-primary animate-ping" />;
}
