import { Role } from "./enums";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        projectId: string | null;
        gateId: string | null;
      };
    }
  }
}

export {};
