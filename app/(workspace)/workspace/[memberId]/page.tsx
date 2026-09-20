"use client";

import { LoaderCircle, ShieldAlert, TriangleAlert, UserRoundX } from "lucide-react";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { MemberWorkspaceHeader } from "@/components/team/member-workspace-header";
import { MemberWorkspaceTabs } from "@/components/team/member-workspace-tabs";
import { useMemberWorkspace } from "@/hooks/team/use-member-workspace";

function WorkspaceStatus({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-6 text-center shadow-xl shadow-black/10 sm:p-8">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </section>
    </main>
  );
}

function MemberWorkspaceContent() {
  const { memberId } = useParams<{ memberId: string }>();
  const searchParams = useSearchParams();
  const requestedTeamId = searchParams.get("teamId");
  const { member, canAccess, error, isLoading, workspaceTeamId } =
    useMemberWorkspace(memberId, requestedTeamId);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
          جارٍ تحميل مساحة العمل
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <WorkspaceStatus
        icon={<TriangleAlert aria-hidden="true" className="size-6" />}
        title="تعذر تحميل مساحة العمل"
        description="حدثت مشكلة أثناء تجهيز بيانات العضو. حاول مرة أخرى لاحقًا."
      />
    );
  }

  if (!member || !member.active) {
    return (
      <WorkspaceStatus
        icon={<UserRoundX aria-hidden="true" className="size-6" />}
        title="مساحة العمل غير متاحة"
        description="تعذر العثور على العضو أو أن الحساب غير مفعل."
      />
    );
  }

  if (!canAccess) {
    return (
      <WorkspaceStatus
        icon={<ShieldAlert aria-hidden="true" className="size-6" />}
        title="لا يمكنك الوصول إلى هذه المساحة"
        description="لا تملك صلاحية لعرض بيانات هذا العضو."
      />
    );
  }

  if (!workspaceTeamId) {
    return (
      <WorkspaceStatus
        icon={<ShieldAlert aria-hidden="true" className="size-6" />}
        title="تعذر تحديد الفريق"
        description="تحتاج مساحة العمل إلى فريق محدد لعرض البيانات دون خلط بيانات الفرق."
      />
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <MemberWorkspaceHeader member={member} />
        <MemberWorkspaceTabs teamId={workspaceTeamId} memberId={memberId} />
      </div>
    </main>
  );
}

export default function MemberWorkspacePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
            جارٍ تحميل مساحة العمل
          </div>
        </main>
      }
    >
      <MemberWorkspaceContent />
    </Suspense>
  );
}
