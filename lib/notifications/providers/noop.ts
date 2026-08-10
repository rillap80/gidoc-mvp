import type { NotificationProvider, NotificationPayload } from "@/lib/notifications/types";

/** NOTIFICATION_PROVIDER가 설정되지 않았을 때 사용 — 조용히 아무 것도 하지 않는다. */
export class NoopNotificationProvider implements NotificationProvider {
  readonly name = "none";

  async send(_payload: NotificationPayload): Promise<void> {
    // 의도적으로 아무 것도 하지 않음 (알림 미설정 상태)
    return;
  }
}
