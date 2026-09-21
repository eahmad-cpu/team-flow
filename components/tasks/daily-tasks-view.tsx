"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ClipboardList, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DailyDateNavigation } from "@/components/tasks/daily-date-navigation";
import { TaskGroupForm } from "@/components/tasks/task-group/task-group-form";
import { TaskGroupSection } from "@/components/tasks/task-group/task-group-section";
import { TaskItemRow } from "@/components/tasks/task-item/task-item-row";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth/use-auth";
import {
  type DailyTaskGroupView,
  useDailyTasks,
} from "@/hooks/tasks/use-daily-tasks";
import { updateTaskGroupOrder } from "@/lib/firestore/task-groups";

interface DailyTasksViewProps {
  teamId: string;
  memberId: string;
}

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shiftDate(dateValue: string, days: number): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function DailyTasksView({ teamId, memberId }: DailyTasksViewProps) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getTodayDate);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [orderedVisibleGroupIds, setOrderedVisibleGroupIds] = useState<string[]>([]);
  const [isReorderingGroups, setIsReorderingGroups] = useState(false);
  const {
    date,
    groups,
    ungroupedTasks,
    summary,
    isLoading,
    error,
    refresh,
    nextGroupOrder,
    getNextTaskOrder,
  } = useDailyTasks(teamId, memberId, selectedDate);
  const groupSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const visibleGroupKey = groups
    .map((groupView) => `${groupView.group.id}:${groupView.group.order}`)
    .join("|");
  const visibleGroupsById = useMemo(
    () => new Map(groups.map((groupView) => [groupView.group.id, groupView])),
    [groups],
  );
  const displayedGroups = orderedVisibleGroupIds
    .map((groupId) => visibleGroupsById.get(groupId))
    .filter(
      (groupView): groupView is DailyTaskGroupView => groupView !== undefined,
    );
  const todayDate = getTodayDate();

  useEffect(() => {
    setOrderedVisibleGroupIds(groups.map((groupView) => groupView.group.id));
  }, [groups, visibleGroupKey]);

  async function handleGroupDragEnd({ active, over }: DragEndEvent): Promise<void> {
    if (!over || active.id === over.id || !user || isReorderingGroups) {
      return;
    }

    const activeGroupId = String(active.id).replace(/^group:/, "");
    const overGroupId = String(over.id).replace(/^group:/, "");
    const oldIndex = displayedGroups.findIndex(
      (groupView) => groupView.group.id === activeGroupId,
    );
    const newIndex = displayedGroups.findIndex(
      (groupView) => groupView.group.id === overGroupId,
    );

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reorderedGroups = arrayMove(displayedGroups, oldIndex, newIndex);
    const updates = reorderedGroups
      .map((groupView, index) => ({
        group: groupView.group,
        order: index + 1,
      }))
      .filter(({ group, order }) => group.order !== order);

    if (updates.length === 0) {
      return;
    }

    setOrderedVisibleGroupIds(reorderedGroups.map((groupView) => groupView.group.id));
    setIsReorderingGroups(true);

    try {
      await Promise.all(
        updates.map(({ group, order }) =>
          updateTaskGroupOrder(group.id, order, user.uid),
        ),
      );
      await refresh();
    } catch {
      setOrderedVisibleGroupIds(groups.map((groupView) => groupView.group.id));
      toast.error("تعذر حفظ الترتيب");
    } finally {
      setIsReorderingGroups(false);
    }
  }

  const sectionHeader = (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">المهام اليومية</h2>
          {!isLoading && !error ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.total} مهام · {summary.completed} منجزة · {summary.inProgress} جاري العمل عليها · {summary.remaining} متبقية
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          className="rounded-xl"
          onClick={() => setIsCreatingGroup(true)}
          disabled={isLoading || error !== null}
        >
          <Plus aria-hidden="true" className="size-3.5" />
          إضافة مجموعة مهام
        </Button>
      </div>
      <DailyDateNavigation
        date={date}
        isToday={date === todayDate}
        onPreviousDay={() => setSelectedDate((currentDate) => shiftDate(currentDate, -1))}
        onNextDay={() => setSelectedDate((currentDate) => shiftDate(currentDate, 1))}
        onToday={() => setSelectedDate(getTodayDate())}
      />
    </header>
  );

  const createGroupForm = (
    <TaskGroupForm
      open={isCreatingGroup}
      mode="create"
      teamId={teamId}
      memberId={memberId}
      originalDate={date}
      order={nextGroupOrder}
      onClose={() => setIsCreatingGroup(false)}
      onSuccess={refresh}
    />
  );

  if (isLoading) {
    return (
      <section className="space-y-4">
        {sectionHeader}
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            جارٍ تحميل المهام
          </div>
        </div>
        {createGroupForm}
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        {sectionHeader}
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-border/70 bg-card p-5 text-center">
          <p className="text-sm font-semibold text-foreground">
            تعذر تحميل مهام اليوم
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
        {createGroupForm}
      </section>
    );
  }

  if (groups.length === 0 && ungroupedTasks.length === 0) {
    return (
      <section className="space-y-4">
        {sectionHeader}
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/60 p-5 text-center">
          <ClipboardList aria-hidden="true" className="size-6 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-bold text-foreground">
            لا توجد مهام لهذا اليوم
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            ستظهر مهام هذا اليوم هنا.
          </p>
        </div>
        {createGroupForm}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {sectionHeader}

      <DndContext sensors={groupSensors} onDragEnd={handleGroupDragEnd}>
        <SortableContext
          items={displayedGroups.map(
            (groupView) => `group:${groupView.group.id}`,
          )}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {displayedGroups.map((groupView) => (
              <TaskGroupSection
                key={groupView.group.id}
                groupView={groupView}
                selectedDate={date}
                groups={groups}
                getNextTaskOrder={getNextTaskOrder}
                onChanged={refresh}
                sortable={!isReorderingGroups}
                isGroupReordering={isReorderingGroups}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {ungroupedTasks.length > 0 ? (
        <section className="rounded-2xl border border-amber-500/20 bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">مهام بدون مجموعة</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            تعذر ربط هذه المهام بمجموعة نشطة.
          </p>
          <div className="mt-3 divide-y divide-border/60">
            {ungroupedTasks.map((task) => (
              <TaskItemRow
                key={task.id}
                task={task}
                selectedDate={date}
                onChanged={refresh}
              />
            ))}
          </div>
        </section>
      ) : null}
      {createGroupForm}
    </section>
  );
}
