"use client";

import {
  ChevronDown,
  ChevronLeft,
  LoaderCircle,
  RefreshCw,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  useLeaderTeams,
  type LeaderTeamView,
} from "@/hooks/team/use-leader-teams";

function getInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name.charAt(0))
    .join("");

  return initials || "؟";
}

function TeamOverviewSection({
  team,
  members,
  defaultExpanded,
}: LeaderTeamView & { defaultExpanded: boolean }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const memberListId = `overview-team-members-${team.id}`;

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
      <h2>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl text-right outline-none transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/30"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
          aria-controls={memberListId}
        >
          <span className="truncate text-base font-bold text-foreground">
            {team.name}
          </span>
          {isExpanded ? (
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </h2>

      {isExpanded ? (
        <div id={memberListId}>
          {members.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {members.map(({ membership, user }) => (
                <Link
                  key={membership.id}
                  href={`/workspace/${user.uid}?teamId=${encodeURIComponent(team.id)}`}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-transparent bg-muted/50 px-3 py-2.5 text-sm text-foreground outline-none transition-colors hover:border-border hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="size-9 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {user.displayName ? (
                        getInitials(user.displayName)
                      ) : (
                        <UserRound aria-hidden="true" className="size-4" />
                      )}
                    </span>
                  )}
                  <span className="truncate font-medium">{user.displayName}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              لا يوجد أعضاء في هذا الفريق بعد
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function LeaderTeamOverview() {
  const { teams, isLoading, error, refresh } = useLeaderTeams();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-border/70 pb-5">
        <div className="flex items-center gap-2 text-primary">
          <UsersRound aria-hidden="true" className="size-5" />
          <h1 className="text-xl font-bold text-foreground">فرق العمل</h1>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          اختر أحد أعضاء فريقك لمتابعة المهام اليومية وخارطة الطريق.
        </p>
      </header>

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            جارٍ تحميل فرق العمل
          </div>
        </div>
      ) : error ? (
        <div className="flex min-h-48 flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-foreground">
            تعذر تحميل فرق العمل
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
            إعادة المحاولة
          </Button>
        </div>
      ) : teams.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">
            لا توجد فرق عمل مرتبطة بحسابك.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {teams.map(({ team, members }, index) => (
            <TeamOverviewSection
              key={team.id}
              team={team}
              members={members}
              defaultExpanded={index === 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
