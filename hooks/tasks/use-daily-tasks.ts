"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getTaskGroupById,
  getTaskGroupsForMemberDay,
} from "@/lib/firestore/task-groups";
import {
  getTasksForMemberDay,
} from "@/lib/firestore/tasks";
import type { Task } from "@/types/task";
import type { TaskGroup } from "@/types/task-group";

export interface DailyTaskGroupView {
  group: TaskGroup;
  tasks: Task[];
  isHistorical: boolean;
}

export interface DailyTasksSummary {
  total: number;
  completed: number;
  inProgress: number;
  remaining: number;
}

const EMPTY_SUMMARY: DailyTasksSummary = {
  total: 0,
  completed: 0,
  inProgress: 0,
  remaining: 0,
};

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("Unable to load daily tasks.");
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((firstTask, secondTask) => {
    const orderDifference = firstTask.order - secondTask.order;

    return orderDifference !== 0
      ? orderDifference
      : firstTask.id.localeCompare(secondTask.id);
  });
}

function buildSummary(tasks: Task[]): DailyTasksSummary {
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const inProgress = tasks.filter(
    (task) => task.status === "IN_PROGRESS",
  ).length;

  return {
    total: tasks.length,
    completed,
    inProgress,
    remaining: tasks.length - completed,
  };
}

export function useDailyTasks(
  teamId: string,
  memberId: string,
  date = getTodayDate(),
) {
  const [groups, setGroups] = useState<DailyTaskGroupView[]>([]);
  const [ungroupedTasks, setUngroupedTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<DailyTasksSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const loadDailyTasks = useCallback(
    async (showLoading = true): Promise<void> => {
      const requestId = ++requestIdRef.current;

      if (showLoading) {
        setGroups([]);
        setUngroupedTasks([]);
        setSummary(EMPTY_SUMMARY);
        setIsLoading(true);
      }
      setError(null);

      try {
      const [visibleTasks, todayGroups] = await Promise.all([
        getTasksForMemberDay(teamId, memberId, date),
        getTaskGroupsForMemberDay(teamId, memberId, date),
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      const groupsById = new Map<string, TaskGroup>();

      for (const group of todayGroups) {
        groupsById.set(group.id, group);
      }

      const requiredGroupIds = [
        ...new Set(visibleTasks.map((task) => task.groupId)),
      ];
      const groupIdsToLoad = requiredGroupIds.filter(
        (groupId) => !groupsById.has(groupId),
      );
      const referencedGroups = await Promise.all(
        groupIdsToLoad.map((groupId) => getTaskGroupById(groupId)),
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      for (const group of referencedGroups) {
        if (
          group?.active &&
          group.teamId === teamId &&
          group.memberId === memberId
        ) {
          groupsById.set(group.id, group);
        }
      }

      const tasksByGroupId = new Map<string, Task[]>();
      const nextUngroupedTasks: Task[] = [];

      for (const task of visibleTasks) {
        if (!groupsById.has(task.groupId)) {
          nextUngroupedTasks.push(task);
          continue;
        }

        const groupTasks = tasksByGroupId.get(task.groupId) ?? [];
        groupTasks.push(task);
        tasksByGroupId.set(task.groupId, groupTasks);
      }

      const nextGroups = [...groupsById.values()]
        .map((group) => ({
          group,
          tasks: sortTasks(tasksByGroupId.get(group.id) ?? []),
          isHistorical: group.originalDate < date,
        }))
        .sort((firstGroup, secondGroup) => {
          const orderDifference = firstGroup.group.order - secondGroup.group.order;

          return orderDifference !== 0
            ? orderDifference
            : firstGroup.group.id.localeCompare(secondGroup.group.id);
        });

        setGroups(nextGroups);
        setUngroupedTasks(sortTasks(nextUngroupedTasks));
        setSummary(buildSummary(visibleTasks));
        setIsLoading(false);
      } catch (loadError) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setError(toError(loadError));
        setIsLoading(false);
      }
    },
    [date, memberId, teamId],
  );

  const refresh = useCallback(
    (): Promise<void> => loadDailyTasks(false),
    [loadDailyTasks],
  );

  const getNextTaskOrder = useCallback(
    (groupId: string): number => {
      const groupView = groups.find(
        ({ group }) => group.id === groupId,
      );

      return (
        Math.max(0, ...(groupView?.tasks ?? []).map((task) => task.order)) + 1
      );
    },
    [groups],
  );

  useEffect(() => {
    void loadDailyTasks();

    return () => {
      ++requestIdRef.current;
    };
  }, [loadDailyTasks]);

  return {
    date,
    groups,
    ungroupedTasks,
    summary,
    isLoading,
    error,
    refresh,
    getNextTaskOrder,
    nextGroupOrder:
      Math.max(
        0,
        ...groups
          .filter((groupView) => groupView.group.originalDate === date)
          .map((groupView) => groupView.group.order),
      ) + 1,
  };
}
