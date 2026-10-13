"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ThemeButton } from "./ThemeToggle";
import { BarChart3, CalendarDays, Map, MapPinned, Upload, UserRound } from "lucide-react";

const ITEMS = [
  { href: "/map", label: "Map", icon: Map },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/import", label: "Import", icon: Upload },
  // Settings opens from the profile page, so keep Profile highlighted there
  { href: "/profile", label: "Profile", icon: UserRound, also: "/settings" },
];

export function AppNav() {
  const pathname = usePathname();
  const isActive = (item: (typeof ITEMS)[number]) =>
    pathname.startsWith(item.href) || (!!item.also && pathname.startsWith(item.also));

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed inset-y-0 left-0 z-30 w-56 flex-col gap-1 border-r border-line bg-surface p-3">
        <Link href="/map" className="mb-4 flex items-center gap-2 px-3 py-2 font-semibold">
          <MapPinned className="size-5 text-accent" /> My Places
        </Link>
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 h-10 text-sm font-medium",
              isActive(item) ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            <item.icon className="size-4" /> {item.label}
          </Link>
        ))}
        <ThemeButton className="mt-auto self-start" />
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-safe">
        <div className="grid grid-cols-5">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                isActive(item) ? "text-accent" : "text-muted",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
