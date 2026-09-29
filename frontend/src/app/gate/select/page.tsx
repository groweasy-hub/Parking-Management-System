"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useProject } from "@/lib/project-context";
import { Gate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowUpFromLine, DoorOpen, Loader2, LogOut } from "lucide-react";

type Duty = {
  _id: string;
  gateId: { _id: string; name: string; type: "ENTRY" | "EXIT" } | string;
  gateType: "ENTRY" | "EXIT";
  entryCount: number;
  exitCount: number;
  endedAt?: string | null;
};

export default function GateSelectPage() {
  const router = useRouter();
  const { currentProjectId, currentProject } = useProject();
  const [gates, setGates] = useState<Gate[]>([]);
  const [duty, setDuty] = useState<Duty | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const [gateData, dutyData] = await Promise.all([
        apiFetch<{ gates: Gate[] }>(`/api/gates?projectId=${currentProjectId}`),
        apiFetch<{ duty: Duty | null }>("/api/gate-duty/today"),
      ]);
      setGates(gateData.gates.filter((gate) => gate.status === "ACTIVE"));
      setDuty(dutyData.duty);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function selectGate(gate: Gate) {
    if (!currentProjectId) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/gate-duty/start", {
        method: "POST",
        body: JSON.stringify({ projectId: currentProjectId, gateId: gate._id }),
      });
      toast.success(`${gate.name} selected for today.`);
      router.replace(gate.type === "ENTRY" ? "/gate/entry" : "/gate/exit");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to select gate.");
    } finally {
      setSubmitting(false);
    }
  }

  async function windUp() {
    setSubmitting(true);
    try {
      await apiFetch("/api/gate-duty/end", { method: "POST" });
      toast.success("Duty wound up for today.");
      setDuty(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to wind up duty.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeGateName =
    duty && typeof duty.gateId === "object" ? duty.gateId.name : duty ? "Selected Gate" : null;

  return (
    <div className="gate-mobile-surface min-h-[calc(100svh-76px)] px-5 py-5 sm:min-h-0 sm:bg-transparent sm:px-0 sm:py-0">
      <div className="mx-auto max-w-xl space-y-4">
      <div className="gate-card-rise rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Gatekeeper Duty</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-2xl">Select Today&apos;s Gate</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{currentProject?.name}</p>
      </div>

      {duty && !duty.endedAt && (
        <Card className="gate-card-rise rounded-3xl border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold">Today you are working at</p>
              <p className="text-xl font-black">{activeGateName}</p>
              <Badge className="mt-2">{duty.gateType}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push(duty.gateType === "ENTRY" ? "/gate/entry" : "/gate/exit")} className="font-bold">
                Open Work
              </Button>
              <Button variant="outline" onClick={windUp} disabled={submitting}>
                <LogOut className="h-4 w-4" /> Wind Up
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

        <Card className="gate-card-rise rounded-3xl shadow-sm">
        <CardHeader>
          <CardTitle>Available Gates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : (
            gates.map((gate) => {
              const Icon = gate.type === "ENTRY" ? ArrowDownToLine : ArrowUpFromLine;
              return (
                <button
                  key={gate._id}
                  type="button"
                  onClick={() => selectGate(gate)}
                  disabled={submitting || Boolean(duty && !duty.endedAt)}
                  className="gate-press flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left shadow-xs transition hover:border-primary/40 hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black">{gate.name}</p>
                      <p className="text-xs text-muted-foreground">{gate.type} operation only</p>
                    </div>
                  </div>
                  <DoorOpen className="h-5 w-5 text-muted-foreground" />
                </button>
              );
            })
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
