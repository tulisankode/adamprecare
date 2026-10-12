"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ListCollapse, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavItem } from "./nav";

export interface SidebarProps {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Rendered as an off-canvas drawer (< 1024px). */
  drawer?: boolean;
  onNavigate?: () => void;
  showGridIcon?: boolean;
}

export function Sidebar({ title, items, collapsed, onToggleCollapsed, drawer, onNavigate, showGridIcon = true }: SidebarProps) {
  const pathname = usePathname();
  const compact = collapsed && !drawer;

  return (
    <nav
      aria-label={title}
      className={cn(
        "flex h-full flex-col rounded-lg bg-primary px-5 py-6 text-white transition-[width] duration-200",
        drawer ? "w-[260px]" : compact ? "w-[76px] px-3" : "w-[240px]",
      )}
    >
      <div className={cn("flex items-center gap-3 border-b border-white/80 pb-6", compact && "flex-col")}>
        {showGridIcon && <LayoutGrid className="size-5 shrink-0 fill-white" aria-hidden />}
        {!compact && <span className="flex-1 text-xl font-medium">{title}</span>}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={drawer ? "Tutup menu" : compact ? "Perluas menu" : "Ciutkan menu"}
          aria-expanded={drawer ? true : !compact}
          className="grid size-8 place-items-center rounded-md hover:bg-white/20"
        >
          {drawer ? (
            <X className="size-5" aria-hidden />
          ) : (
            <ListCollapse className={cn("size-5", !compact && "-scale-x-100")} aria-hidden />
          )}
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className={cn(item.dividerAfter && "mb-2 border-b border-white/80 pb-3")}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={compact ? item.label : undefined}
                className={cn(
                  "flex h-[30px] items-center gap-3 rounded-md px-2.5 text-xs font-semibold transition-colors",
                  active ? "bg-white/30" : "hover:bg-white/15",
                  compact && "justify-center px-0",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {compact ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
