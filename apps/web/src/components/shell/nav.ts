import { Ambulance, ChartArea, FileChartColumn, UserPlus, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Draw a divider after this item (mockup grouping). */
  dividerAfter?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: ChartArea },
  { href: "/kasus", label: "Data Kasus Masuk", icon: UserPlus, dividerAfter: true },
  { href: "/tracking", label: "Tracking Ambulans", icon: Ambulance, dividerAfter: true },
  { href: "/laporan", label: "Laporan", icon: FileChartColumn },
];

export const PROFILE_NAV: NavItem[] = [{ href: "/profil", label: "Profil Saya", icon: UserRound }];
