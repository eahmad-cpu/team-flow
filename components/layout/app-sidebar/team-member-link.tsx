"use client";

import Link from "next/link";

import type { User } from "@/types/user";

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

export function TeamMemberLink({
  teamId,
  user,
  isActive,
  onSelect,
}: {
  teamId: string;
  user: User;
  isActive: boolean;
  onSelect?: () => void;
}) {
  return (
    <Link
      href={`/workspace/${user.uid}?teamId=${encodeURIComponent(teamId)}`}
      aria-current={isActive ? "page" : undefined}
      onClick={() => onSelect?.()}
      className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 ${
        isActive
          ? "bg-primary/15 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {user.photoURL ? (
        <img
          src={user.photoURL}
          alt=""
          className="size-7 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {getInitials(user.displayName)}
        </span>
      )}
      <span className="truncate font-medium">{user.displayName}</span>
    </Link>
  );
}
