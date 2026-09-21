"use client";

import { BellRing, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth/use-auth";
import {
  getPushNotificationSetupStatus,
  requestAndSynchronizePushNotifications,
  subscribeToPushNotificationSetupStatus,
  synchronizePushNotifications,
  type PushNotificationSetupStatus,
} from "@/lib/notifications/fcm";

export function NotificationActivationAction({
  className,
}: {
  className?: string;
}) {
  const { hasAppAccess } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [setupStatus, setSetupStatus] = useState<PushNotificationSetupStatus>(
    getPushNotificationSetupStatus,
  );
  const [isActivating, setIsActivating] = useState(false);
  const shouldConfirmSuccessRef = useRef(false);

  useEffect(() => {
    function syncPermission(): void {
      setPermission(Notification.permission);
    }

    syncPermission();
    window.addEventListener("team-flow-notification-permission-change", syncPermission);

    return () => {
      window.removeEventListener(
        "team-flow-notification-permission-change",
        syncPermission,
      );
    };
  }, []);

  useEffect(
    () => subscribeToPushNotificationSetupStatus(setSetupStatus),
    [],
  );

  useEffect(() => {
    if (!shouldConfirmSuccessRef.current) {
      return;
    }

    if (setupStatus === "registered") {
      shouldConfirmSuccessRef.current = false;
      setIsActivating(false);
      toast.success("تم تفعيل الإشعارات");
    } else if (setupStatus === "error") {
      shouldConfirmSuccessRef.current = false;
      setIsActivating(false);
      toast.error("تعذر تفعيل الإشعارات");
    } else if (setupStatus === "unsupported") {
      shouldConfirmSuccessRef.current = false;
      setIsActivating(false);
    }
  }, [setupStatus]);

  const isStartupSynchronizing =
    permission === "granted" &&
    setupStatus === "registering" &&
    !isActivating;
  const shouldShow =
    hasAppAccess &&
    permission !== null &&
    permission !== "denied" &&
    setupStatus !== "registered" &&
    setupStatus !== "unsupported" &&
    !isStartupSynchronizing;

  if (!shouldShow) {
    return null;
  }

  async function activate(): Promise<void> {
    if (isActivating) {
      return;
    }

    shouldConfirmSuccessRef.current = true;
    setIsActivating(true);

    try {
      if (permission === "default") {
        const nextPermission = await requestAndSynchronizePushNotifications(
          (payload) => {
            toast(payload.data?.title ?? "إشعار جديد", {
              description: payload.data?.body,
            });
          },
        );
        setPermission(nextPermission);
        window.dispatchEvent(
          new Event("team-flow-notification-permission-change"),
        );

        if (nextPermission !== "granted") {
          shouldConfirmSuccessRef.current = false;
          setIsActivating(false);
        }
      } else {
        await synchronizePushNotifications((payload) => {
          toast(payload.data?.title ?? "إشعار جديد", {
            description: payload.data?.body,
          });
        });
      }
    } catch {
      shouldConfirmSuccessRef.current = false;
      setIsActivating(false);
      toast.error("تعذر تفعيل الإشعارات");
    }
  }

  const isRetry = permission === "granted" && setupStatus === "error";

  return (
    <Button
      type="button"
      size="sm"
      className={`gap-2 rounded-xl ${className ?? ""}`}
      onClick={() => void activate()}
      disabled={isActivating}
      aria-busy={isActivating}
    >
      {isActivating ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <BellRing aria-hidden="true" className="size-4" />
      )}
      {isActivating
        ? "جارٍ تفعيل الإشعارات..."
        : isRetry
          ? "إعادة تفعيل الإشعارات"
          : "تفعيل الإشعارات"}
    </Button>
  );
}
