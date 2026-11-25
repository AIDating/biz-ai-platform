"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Code2, LayoutDashboard, Megaphone, MessagesSquare, ShoppingBag, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  overview: LayoutDashboard,
  customers: Users,
  conversations: MessagesSquare,
  appointments: CalendarDays,
  agent: ShoppingBag,
  widget: Code2,
  marketing: Megaphone,
  analytics: BarChart3,
  billing: CreditCard,
} as const;

export function DashboardNav({
  items,
}: {
  items: { href: string; label: string; icon: keyof typeof ICONS; badge?: string }[];
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
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-sm bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#e10600] uppercase ring-1 ring-[#e10600]">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
