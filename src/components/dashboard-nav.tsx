"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CalendarDays, Code2, LayoutDashboard, MessagesSquare, Users } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  overview: LayoutDashboard,
  customers: Users,
  conversations: MessagesSquare,
  appointments: CalendarDays,
  agent: Bot,
  widget: Code2,
} as const;

export function DashboardNav({
  items,
}: {
  items: { href: string; label: string; icon: keyof typeof ICONS }[];
}) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 border-l-2 px-3 py-2 text-sm whitespace-nowrap",
              active
                ? "border-[#e10600] bg-[#fafafa] text-foreground"
                : "border-transparent text-[#6d6d6d] hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
