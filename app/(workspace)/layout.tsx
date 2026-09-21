import { Suspense } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AppHeader } from "@/components/layout/app-header/app-header";
import { TeamSidebar } from "@/components/layout/app-sidebar/team-sidebar";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <div className="flex h-dvh min-h-dvh flex-col bg-background lg:flex-row">
        <Suspense fallback={null}>
          <TeamSidebar />
        </Suspense>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="min-h-0 flex-1 overflow-y-auto [&>main]:min-h-full">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
