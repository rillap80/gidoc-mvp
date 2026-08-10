import type { NotificationProvider, NotificationPayload } from "@/lib/notifications/types";
import { buildEventTitle } from "@/lib/notifications/format";

/**
 * SMS는 실제 발송사(알리고, NHN Toast, Solapi 등) API 계약이 있어야 동작한다.
 * 버튼을 지원하지 않으므로 링크는 짧은 URL 텍스트로만 전달한다.
 * 구조만 맞춰두었으니, 계약한 발송사의 API 스펙에 맞춰 send() 내부만 구현하면 된다.
 */
export class SmsNotificationProvider implements NotificationProvider {
  readonly name = "sms";

  async send(payload: NotificationPayload): Promise<void> {
    const apiKey = process.env.SMS_PROVIDER_API_KEY;
    const adminPhone = process.env.ADMIN_NOTIFICATION_PHONE;
    if (!apiKey || !adminPhone) {
      throw new Error("SMS_PROVIDER_API_KEY/ADMIN_NOTIFICATION_PHONE이 설정되지 않았습니다.");
    }

    const message = [
      buildEventTitle(payload),
      `${payload.companyName} / ${payload.ceoName}`,
      ...payload.links.map((l) => `${l.label}: ${l.url}`),
    ].join("\n");

    // TODO: 실제 SMS 발송사 API 연동. 예시(의사코드):
    // const res = await fetch("https://apis.aligo.in/send/", {
    //   method: "POST",
    //   body: new URLSearchParams({ key: apiKey, sender: process.env.SMS_PROVIDER_SENDER!, receiver: adminPhone, msg: message }),
    // });
    // if (!res.ok) throw new Error(`SMS 발송 실패: ${res.status}`);
    void message;
    throw new Error("SMS 알림 Provider가 아직 실제 발송사와 연동되지 않았습니다 (TODO).");
  }
}
