"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAdminDirectory } from "@/lib/admin/admin-functions";
import type { AdminDirectory } from "@/lib/admin/types";

const EMPTY_DIRECTORY: AdminDirectory = {
  teams: [],
  users: [],
  memberships: [],
};

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("Unable to load the admin directory.");
}

export function useAdminDirectory(enabled: boolean) {
  const [directory, setDirectory] = useState<AdminDirectory>(EMPTY_DIRECTORY);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;

    if (!enabled) {
      setDirectory(EMPTY_DIRECTORY);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextDirectory = await getAdminDirectory();

      if (requestId !== requestIdRef.current) {
        return;
      }

      setDirectory({
        teams: [...nextDirectory.teams].sort((first, second) =>
          first.name.localeCompare(second.name, "ar"),
        ),
        users: [...nextDirectory.users].sort((first, second) =>
          first.displayName.localeCompare(second.displayName, "ar"),
        ),
        memberships: nextDirectory.memberships,
      });
      setIsLoading(false);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError(toError(loadError));
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();

    return () => {
      ++requestIdRef.current;
    };
  }, [refresh]);

  return {
    ...directory,
    isLoading,
    error,
    refresh,
  };
}
