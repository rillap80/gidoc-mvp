import type { NotificationProvider, NotificationPayload } from "@/lib/notifications/types";
import { SlackNotificationProvider } from "@/lib/notifications/providers/slack";
import { DiscordNotificationProvider } from "@/lib/notifications/providers/discord";
import { TelegramNotificationProvider } from "@/lib/notifications/providers/telegram";
import { SmsNotificationProvider } from "@/lib/notifications/providers/sms";
import { KakaoNotificationProvider } from "@/lib/notifications/providers/kakao";
import { NoopNotificationProvider } from "@/lib/notifications/providers/noop";
import { withTimeout } from "@/lib/timeout";
import { logStep } from "@/lib/logger";

export type { NotificationPayload, NotificationLink, NotificationEvent } from "@/lib/notifications/types";

const NOTIFICATION_TIMEOUT_MS = 10_000;

/**
 * NOTIFICATION_PROVIDER 환경변수 하나로 알림 채널을 통째로 교체할 수 있다.
 * 값: "slack" | "discord" | "telegram" | "sms" | "kakao" (미설정 시 아무 것도 보내지 않음)
 *
 * 새 채널을 추가하려면 NotificationProvider 인터페이스(lib/notifications/types.ts)를 구현하는
 * 클래스를 providers/ 아래에 추가하고, 여기 switch에 한 줄만 더하면 된다.
 */
function getNotificationProvider(): NotificationProvider {
  switch (process.env.NOTIFICATION_PROVIDER) {
    case "slack":
      return new SlackNotificationProvider();
    case "discord":
      return new DiscordNotificationProvider();
    case "telegram":
      return new TelegramNotificationProvider();
    case "sms":
      return new SmsNotificationProvider();
    case "kakao":
      return new KakaoNotificationProvider();
    default:
      return new NoopNotificationProvider();
  }
}

/**
 * 알림 발송 — 절대로 예외를 던지지 않는다 (호출부가 await 하더라도 파이프라인이 멈추지 않음).
 * 실패는 logs 테이블에 step='notification', status='error'로만 남긴다.
 */
export async function notify(payload: NotificationPayload): Promise<void> {
  const provider = getNotificationProvider();
  if (provider.name === "none") return; // 미설정 상태 — 로그도 남기지 않고 조용히 종료

  try {
    await withTimeout(() => provider.send(payload), NOTIFICATION_TIMEOUT_MS, `${provider.name} 알림 발송`);
    await logStep({
      application_id: payload.applicationId,
      step: "notification",
      status: "success",
      message: `${provider.name} 알림 발송 성공 (${payload.event})`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[notifications] 발송 실패 (${provider.name}, ${payload.event}):`, message);
    // 로깅 자체가 실패해도(예: DB 장애) 알림 실패가 상위로 전파되지 않도록 한 번 더 감싼다.
    await logStep({
      application_id: payload.applicationId,
      step: "notification",
      status: "error",
      message: `${provider.name} 발송 실패 (${payload.event}): ${message}`,
    }).catch(() => undefined);
  }
}
