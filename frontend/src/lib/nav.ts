import { Role } from "./types";
import {
  LayoutDashboard,
  Building2,
  Layers,
  Car,
  DoorOpen,
  Users,
  History,
  BarChart3,
  ShieldCheck,
  Settings,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

export const ADMIN_NAV: NavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN", "VIEWER"],
  },
  {
    href: "/admin/projects",
    label: "Projects",
    icon: Building2,
    roles: ["SUPER_ADMIN"],
  },
  {
    href: "/admin/floors",
    label: "Parking Floors",
    icon: Layers,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN"],
  },
  {
    href: "/admin/companies",
    label: "Companies",
    icon: Building2,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN"],
  },
  {
    href: "/admin/allocations",
    label: "Allocations",
    icon: Car,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN"],
  },
  {
    href: "/admin/gates",
    label: "Gates",
    icon: DoorOpen,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN"],
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN"],
  },
  {
    href: "/admin/history",
    label: "History",
    icon: History,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN", "VIEWER"],
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN", "VIEWER"],
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN"],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    roles: ["SUPER_ADMIN", "PROJECT_ADMIN"],
  },
];
