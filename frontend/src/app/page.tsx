"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { deferNavigation } from "@/lib/deferred-navigation";
import { landingPathForRole } from "@/lib/roles";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    return deferNavigation(() => router.replace(user ? landingPathForRole(user.role) : "/login"));
  }, [user, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
