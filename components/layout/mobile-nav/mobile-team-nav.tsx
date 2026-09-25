"use client";

import { Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { TeamSidebarSection } from "@/components/layout/app-sidebar/team-sidebar-section";
import type { LeaderTeamView } from "@/hooks/team/use-leader-teams";

export function MobileTeamNav({
  teams,
  isLoading,
  hasError,
  activeMemberId,
  showAdminLink,
}: {
  teams: LeaderTeamView[];
  isLoading: boolean;
  hasError: boolean;
  activeMemberId?: string;
  showAdminLink: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="border-b border-border/70 bg-card px-4 py-3 lg:hidden">
      <button
        type="button"
        className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="mobile-team-navigation"
      >
        <Menu aria-hidden="true" className="size-4" />
        فرق العمل
      </button>

      {isOpen && (
        <div
          id="mobile-team-navigation"
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="فرق العمل"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="إغلاق قائمة فرق العمل"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-80 max-w-[calc(100vw-2rem)] flex-col border-l border-border bg-card shadow-2xl">
            <header className="flex items-center justify-between border-b border-border/70 px-4 py-4">
              <h2>
                <Link
                  href="/workspace"
                  className="rounded-lg px-1 py-0.5 font-semibold text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/30"
                  onClick={() => setIsOpen(false)}
                >
                  فرق العمل
                </Link>
              </h2>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
                aria-label="إغلاق قائمة فرق العمل"
                onClick={() => setIsOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {showAdminLink ? (
                <Link
                  href="/workspace/admin"
                  className="mb-3 flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings aria-hidden="true" className="size-4 text-primary" />
                  إدارة الفرق والمستخدمين
                </Link>
              ) : null}
              {isLoading ? (
                <p className="px-2.5 py-3 text-sm text-muted-foreground">
                  جارٍ تحميل فرق العمل
                </p>
              ) : hasError ? (
                <p className="px-2.5 py-3 text-sm text-muted-foreground">
                  تعذر تحميل فرق العمل
                </p>
              ) : teams.length === 0 ? (
                <p className="px-2.5 py-3 text-sm text-muted-foreground">
                  لا توجد فرق قيادية متاحة
                </p>
              ) : (
                teams.map(({ team, members }, index) => (
                  <TeamSidebarSection
                    key={team.id}
                    team={team}
                    members={members}
                    activeMemberId={activeMemberId}
                    defaultExpanded={index === 0}
                    onMemberSelect={() => setIsOpen(false)}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
