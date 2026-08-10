import type { NotificationProvider, NotificationPayload } from "@/lib/notifications/types";
import { buildEventTitle } from "@/lib/notifications/format";

const EVENT_COLOR: Record<NotificationPayload["event"], number> = {
  new_application: 0x2fae6b,
  report_completed: 0x0b1220,
  deep_report_completed: 0xdb8f1f,
};

export class DiscordNotificationProvider implements NotificationProvider {
  readonly name = "discord";

  async send(payload: NotificationPayload): Promise<void> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("DISCORD_WEBHOOK_URL이 설정되지 않았습니다.");

    const fields = [
      { name: "회사명", value: payload.companyName, inline: true },
      { name: "대표명", value: payload.ceoName, inline: true },
      payload.phone ? { name: "연락처", value: payload.phone, inline: true } : null,
      payload.bizRegNo ? { name: "사업자번호", value: payload.bizRegNo, inline: true } : null,
      { name: "접수시간", value: new Date(payload.receivedAt).toLocaleString("ko-KR"), inline: true },
      { name: "Application ID", value: `\`${payload.applicationId}\``, inline: false },
      payload.healthScore != null
        ? { name: "건강점수", value: `${payload.healthScore}점 (${payload.riskGrade ?? "-"})`, inline: true }
        : null,
    ].filter((v): v is { name: string; value: string; inline: boolean } => v != null);

    // Discord Webhook은 실제 클릭형 버튼(Components)을 지원하지 않으므로 마크다운 링크로 표시
    const linksText = payload.links.map((l) => `[${l.label}](${l.url})`).join("  ·  ");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: buildEventTitle(payload),
            color: EVENT_COLOR[payload.event],
            fields,
            description: linksText || undefined,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Discord 알림 발송 실패: ${res.status} ${await res.text()}`);
    }
  }
}
