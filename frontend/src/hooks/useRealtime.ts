"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { AllocationAvailability } from "@/lib/types";

export interface SessionEventPayload {
  sessionId: string;
  sessionCode: string;
  [key: string]: unknown;
}

interface RealtimeHandlers {
  onAvailabilityUpdate?: (availability: AllocationAvailability) => void;
  onSessionEntry?: (payload: SessionEventPayload) => void;
  onSessionExit?: (payload: SessionEventPayload) => void;
}

/**
 * Joins the given project's real-time room for the lifetime of the
 * component and wires up availability/session broadcast handlers. Handlers
 * are held in a ref so callers can pass fresh closures each render without
 * re-subscribing the socket listeners.
 */
export function useProjectRealtime(projectId: string | null | undefined, handlers: RealtimeHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!projectId) return;
    const socket = getSocket();

    const join = () => socket.emit("join:project", projectId);
    if (socket.connected) join();
    socket.on("connect", join);

    const onAvailability = (payload: AllocationAvailability) =>
      handlersRef.current.onAvailabilityUpdate?.(payload);
    const onEntry = (payload: SessionEventPayload) => handlersRef.current.onSessionEntry?.(payload);
    const onExit = (payload: SessionEventPayload) => handlersRef.current.onSessionExit?.(payload);

    socket.on("availability:update", onAvailability);
    socket.on("session:entry", onEntry);
    socket.on("session:exit", onExit);

    return () => {
      socket.emit("leave:project", projectId);
      socket.off("connect", join);
      socket.off("availability:update", onAvailability);
      socket.off("session:entry", onEntry);
      socket.off("session:exit", onExit);
    };
  }, [projectId]);
}
