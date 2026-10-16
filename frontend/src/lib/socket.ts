"use client";

import { io, Socket } from "socket.io-client";
import { API_URL, getAccessToken, refreshAccessToken } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      auth: (callback) => callback({ token: getAccessToken() }),
      withCredentials: true,
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
    const current = socket;
    current.on("connect_error", async (error) => {
      if (socket === current && error.message === "UNAUTHORIZED" && await refreshAccessToken() && socket === current) current.connect();
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
