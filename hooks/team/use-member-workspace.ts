"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getTeamMembers } from "@/lib/firestore/memberships";
import { getUserById } from "@/lib/firestore/users";
import { useAuth } from "@/hooks/auth/use-auth";
import type { Membership } from "@/types/membership";
import type { User } from "@/types/user";

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("Unable to load member workspace.");
}

function hasActiveLeaderMembershipForTeam(
  memberships: Membership[],
  teamId: string,
): boolean {
  return memberships.some(
    (membership) =>
      membership.teamId === teamId &&
      membership.role === "LEADER" &&
      membership.active,
  );
}

export function useMemberWorkspace(
  memberId: string,
  requestedTeamId: string | null,
) {
  const { user: currentUser, memberships, leaderMemberships } = useAuth();
  const [member, setMember] = useState<User | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [canAccess, setCanAccess] = useState(false);
  const [workspaceTeamId, setWorkspaceTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const loadMemberWorkspace = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    const currentUserId = currentUser?.uid;
    const accessingSelf = currentUserId === memberId;

    setMember(null);
    setIsSelf(accessingSelf);
    setCanAccess(false);
    setWorkspaceTeamId(null);
    setIsLoading(true);
    setError(null);

    if (!currentUserId) {
      setIsLoading(false);
      return;
    }

    try {
      const targetMember = await getUserById(memberId);

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!targetMember || !targetMember.active) {
        setMember(targetMember);
        setIsLoading(false);
        return;
      }

      const activeTeamIds = [
        ...new Set(
          memberships
            .filter((membership) => membership.active)
            .map((membership) => membership.teamId),
        ),
      ];
      const selfTeamId =
        requestedTeamId && activeTeamIds.includes(requestedTeamId)
          ? requestedTeamId
          : activeTeamIds.length === 1
            ? activeTeamIds[0]
            : null;

      if (accessingSelf) {
        setMember(targetMember);
        setCanAccess(true);
        setWorkspaceTeamId(selfTeamId);
        setIsLoading(false);
        return;
      }

      const leaderTeamIds = [
        ...new Set(
          leaderMemberships
            .filter((membership) => membership.active)
            .map((membership) => membership.teamId),
        ),
      ];
      const candidateTeamIds = requestedTeamId
        ? hasActiveLeaderMembershipForTeam(
            leaderMemberships,
            requestedTeamId,
          )
          ? [requestedTeamId]
          : []
        : leaderTeamIds;
      let validWorkspaceTeamId: string | null = null;

      for (const teamId of candidateTeamIds) {
        const teamMembers = await getTeamMembers(teamId);

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (teamMembers.some((membership) => membership.userId === memberId)) {
          validWorkspaceTeamId = teamId;
          break;
        }
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setMember(targetMember);
      setCanAccess(validWorkspaceTeamId !== null);
      setWorkspaceTeamId(validWorkspaceTeamId);
      setIsLoading(false);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setMember(null);
      setCanAccess(false);
      setWorkspaceTeamId(null);
      setError(toError(loadError));
      setIsLoading(false);
    }
  }, [
    currentUser?.uid,
    leaderMemberships,
    memberId,
    memberships,
    requestedTeamId,
  ]);

  useEffect(() => {
    void loadMemberWorkspace();

    return () => {
      ++requestIdRef.current;
    };
  }, [loadMemberWorkspace]);

  return {
    member,
    isSelf,
    canAccess,
    workspaceTeamId,
    isLoading,
    error,
    refresh: loadMemberWorkspace,
  };
}
