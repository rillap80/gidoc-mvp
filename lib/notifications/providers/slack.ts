import type { NotificationProvider, NotificationPayload } from "@/lib/notifications/types";
import { buildEventTitle } from "@/lib/notifications/format";

export class SlackNotificationProvider implements NotificationProvider {
  readonly name = "slack";

  async send(payload: NotificationPayload): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL이 설정되지 않았습니다.");

    const fields = [
      `*회사명*\n${payload.companyName}`,
      `*대표명*\n${payload.ceoName}`,
      payload.phone ? `*연락처*\n${payload.phone}` : null,
      payload.bizRegNo ? `*사업자번호*\n${payload.bizRegNo}` : null,
      `*접수시간*\n${new Date(payload.receivedAt).toLocaleString("ko-KR")}`,
      `*Application ID*\n\`${payload.applicationId}\``,
      payload.healthScore != null ? `*건강점수*\n${payload.healthScore}점 (${payload.riskGrade ?? "-"})` : null,
    ].filter((v): v is string => v != null);

    const blocks: Record<string, unknown>[] = [
      { type: "header", text: { type: "plain_text", text: buildEventTitle(payload) } },
      {
        type: "section",
        fields: fields.map((text) => ({ type: "mrkdwn", text })),
      },
    ];

    if (payload.links.length > 0) {
      blocks.push({
        type: "actions",
        elements: payload.links.map((link) => ({
          type: "button",
          text: { type: "plain_text", text: link.label },
          url: link.url,
        })),
      });
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!res.ok) {
      throw new Error(`Slack 알림 발송 실패: ${res.status} ${await res.text()}`);
    }
  }
}
