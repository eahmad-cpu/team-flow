"use client";

import { LoaderCircle, Settings, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TeamSidebarSection } from "@/components/layout/app-sidebar/team-sidebar-section";
import { MobileTeamNav } from "@/components/layout/mobile-nav/mobile-team-nav";
import { isAdminEmail } from "@/lib/admin/access";
import { useAuth } from "@/hooks/auth/use-auth";
import { useLeaderTeams } from "@/hooks/team/use-leader-teams";

function getActiveMemberId(pathname: string): string | undefined {
  const workspacePrefix = "/workspace/";

  if (!pathname.startsWith(workspacePrefix)) {
    return undefined;
  }

  return pathname.slice(workspacePrefix.length).split("/")[0] || undefined;
}

export function TeamSidebar() {
  const pathname = usePathname();
  const { firebaseUser, leadsAnyTeam } = useAuth();
  const { teams, isLoading, error } = useLeaderTeams();
  const showAdminLink = isAdminEmail(firebaseUser?.email);

  if (!leadsAnyTeam && !showAdminLink) {
    return null;
  }

  const activeMemberId = getActiveMemberId(pathname);

  return (
    <>
      <MobileTeamNav
        teams={teams}
        isLoading={isLoading}
        hasError={error !== null}
        activeMemberId={activeMemberId}
        showAdminLink={showAdminLink}
      />

      <aside className="hidden w-72 shrink-0 flex-col border-l border-border/70 bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <header className="flex items-center gap-2 border-b border-border/70 px-5 py-5">
          <h2>
            <Link
              href="/workspace"
              className="-mx-2 flex items-center gap-2 rounded-xl px-2 py-1 font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <UsersRound aria-hidden="true" className="size-5 text-primary" />
              <span>فرق العمل</span>
            </Link>
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {showAdminLink ? (
            <Link
              href="/workspace/admin"
              className="mb-3 flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <Settings aria-hidden="true" className="size-4 text-primary" />
              إدارة الفرق والمستخدمين
            </Link>
          ) : null}
          {isLoading ? (
            <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              جارٍ تحميل فرق العمل
            </div>
          ) : error ? (
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
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}
