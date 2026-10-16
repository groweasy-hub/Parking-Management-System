import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { env } from "../config/env";
import { verifyAccessToken } from "../utils/jwt";
import { User } from "../models";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers.cookie
          ?.split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("accessToken="))
          ?.split("=")[1];

      if (!token) return next(new Error("UNAUTHORIZED"));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).lean();
      if (!user || user.status !== "ACTIVE" || user.mustChangePassword || (user.sessionVersion ?? 0) !== (payload.sessionVersion ?? 0)) {
        return next(new Error("UNAUTHORIZED"));
      }
      payload.role = user.role;
      payload.projectId = user.projectId ? String(user.projectId) : null;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as { sub: string; role: string; projectId: string | null };
    socket.join(`user:${user.sub}`);

    socket.on("join:project", (projectId: string) => {
      if (!projectId) return;
      // SUPER_ADMIN may join any project room; everyone else only their own.
      if (user.role !== "SUPER_ADMIN" && user.projectId !== projectId) return;
      socket.join(`project:${projectId}`);
    });

    socket.on("leave:project", (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO server has not been initialized yet");
  return io;
}

export function broadcastToProject(projectId: string, event: string, payload: unknown): void {
  io?.to(`project:${projectId}`).emit(event, payload);
}

export function disconnectUserSessions(userId: string): void {
  io?.in(`user:${userId}`).disconnectSockets(true);
}
