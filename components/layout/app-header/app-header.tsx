"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationActivationAction } from "@/components/notifications/notification-activation-action";
import { InstallButton } from "@/components/pwa/install-button";
import { useAuth } from "@/hooks/auth/use-auth";
import { ThemeToggle } from "@/components/layout/app-header/theme-toggle";

export function AppHeader() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = user?.displayName.trim();

  async function handleSignOut(): Promise<void> {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOut();
      router.replace("/login");
    } catch {
      toast.error("تعذر تسجيل الخروج", {
        description: "حاول مرة أخرى.",
      });
      setIsSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0 sm:px-6 lg:px-8">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {displayName ? `مرحبًا، ${displayName}` : "مرحبًا"}
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          <NotificationBell />
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            aria-busy={isSigningOut}
          >
            {isSigningOut ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <LogOut aria-hidden="true" className="size-3.5" />
            )}
            تسجيل الخروج
          </Button>
        </div>

        <div className="order-3 flex basis-full gap-2 empty:hidden sm:contents">
          <NotificationActivationAction className="h-11 min-w-0 flex-1 justify-center text-sm sm:h-8 sm:flex-none" />
          <InstallButton
            className="h-11 min-w-0 flex-1 justify-center text-sm sm:h-8 sm:flex-none"
            showLabel
          />
        </div>
      </div>
    </header>
  );
}
