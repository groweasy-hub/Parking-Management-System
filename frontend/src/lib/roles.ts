import { Role } from "./types";

export function landingPathForRole(role: Role): string {
  switch (role) {
    case "ENTRY_GATEMAN":
      return "/gate/entry";
    case "EXIT_GATEMAN":
      return "/gate/exit";
    case "SUPER_ADMIN":
    case "PROJECT_ADMIN":
      return "/admin/dashboard";
    case "VIEWER":
      return "/admin/dashboard";
    default:
      return "/login";
  }
}

export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "PROJECT_ADMIN"];
export const DASHBOARD_ROLES: Role[] = ["SUPER_ADMIN", "PROJECT_ADMIN", "VIEWER"];
