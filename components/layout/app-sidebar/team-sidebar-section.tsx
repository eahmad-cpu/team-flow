"use client";

import { ChevronDown, ChevronLeft } from "lucide-react";
import { useState } from "react";

import { TeamMemberLink } from "@/components/layout/app-sidebar/team-member-link";
import type { LeaderTeamMember } from "@/hooks/team/use-leader-teams";
import type { Team } from "@/types/team";

export function TeamSidebarSection({
  team,
  members,
  activeMemberId,
  defaultExpanded,
  onMemberSelect,
}: {
  team: Team;
  members: LeaderTeamMember[];
  activeMemberId?: string;
  defaultExpanded: boolean;
  onMemberSelect?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const memberListId = `team-members-${team.id}`;

  return (
    <section className="border-b border-border/60 py-2 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-right text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        aria-controls={memberListId}
      >
        <span className="truncate">أعضاء {team.name}</span>
        {isExpanded ? (
          <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div id={memberListId} className="mt-1 space-y-0.5 px-1">
          {members.length > 0 ? (
            members.map(({ membership, user }) => (
              <TeamMemberLink
                key={membership.id}
                teamId={team.id}
                user={user}
                isActive={user.uid === activeMemberId}
                onSelect={onMemberSelect}
              />
            ))
          ) : (
            <p className="px-2.5 py-3 text-xs leading-5 text-muted-foreground">
              لا يوجد أعضاء في هذا الفريق بعد
            </p>
          )}
        </div>
      )}
    </section>
  );
}
