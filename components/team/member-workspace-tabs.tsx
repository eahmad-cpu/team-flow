"use client";

import { CalendarDays, Map } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { RoadmapBoard } from "@/components/roadmap/roadmap-board/roadmap-board";
import { DailyTasksView } from "@/components/tasks/daily-tasks-view";

type WorkspaceTab = "daily-tasks" | "roadmap";

function WorkspaceTabPanel({
  activeTab,
  teamId,
  memberId,
}: {
  activeTab: WorkspaceTab;
  teamId: string;
  memberId: string;
}) {
  return activeTab === "daily-tasks" ? (
    <DailyTasksView teamId={teamId} memberId={memberId} />
  ) : (
    <RoadmapBoard teamId={teamId} memberId={memberId} />
  );
}

export function MemberWorkspaceTabs({
  teamId,
  memberId,
}: {
  teamId: string;
  memberId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: WorkspaceTab =
    searchParams.get("tab") === "roadmap" ? "roadmap" : "daily-tasks";

  function selectTab(tab: WorkspaceTab): void {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tab === "roadmap" ? "roadmap" : "tasks");
    router.replace(`/workspace/${memberId}?${nextParams.toString()}`);
  }

  return (
    <section className="mt-6">
      <div
        className="flex w-full gap-1 overflow-x-auto rounded-2xl bg-muted/70 p-1"
        role="tablist"
        aria-label="محتوى مساحة العمل"
      >
        <button
          id="daily-tasks-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "daily-tasks"}
          aria-controls="daily-tasks-panel"
          className={`flex min-w-40 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 ${
            activeTab === "daily-tasks"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => selectTab("daily-tasks")}
        >
          <CalendarDays aria-hidden="true" className="size-4" />
          المهام اليومية
        </button>
        <button
          id="roadmap-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "roadmap"}
          aria-controls="roadmap-panel"
          className={`flex min-w-40 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 ${
            activeTab === "roadmap"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => selectTab("roadmap")}
        >
          <Map aria-hidden="true" className="size-4" />
          الرؤية / خارطة الطريق
        </button>
      </div>

      <div
        id={activeTab === "daily-tasks" ? "daily-tasks-panel" : "roadmap-panel"}
        role="tabpanel"
        aria-labelledby={activeTab === "daily-tasks" ? "daily-tasks-tab" : "roadmap-tab"}
        className="mt-5"
      >
        <WorkspaceTabPanel
          activeTab={activeTab}
          teamId={teamId}
          memberId={memberId}
        />
      </div>
    </section>
  );
}
