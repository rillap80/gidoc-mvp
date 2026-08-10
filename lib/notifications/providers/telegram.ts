import type { NotificationProvider, NotificationPayload } from "@/lib/notifications/types";
import { buildEventTitle } from "@/lib/notifications/format";

export class TelegramNotificationProvider implements NotificationProvider {
  readonly name = "telegram";

  async send(payload: NotificationPayload): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      throw new Error("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID가 설정되지 않았습니다.");
    }

    const lines = [
      `*${buildEventTitle(payload)}*`,
      `회사명: ${payload.companyName}`,
      `대표명: ${payload.ceoName}`,
      payload.phone ? `연락처: ${payload.phone}` : null,
      payload.bizRegNo ? `사업자번호: ${payload.bizRegNo}` : null,
      `접수시간: ${new Date(payload.receivedAt).toLocaleString("ko-KR")}`,
      `Application ID: \`${payload.applicationId}\``,
      payload.healthScore != null ? `건강점수: ${payload.healthScore}점 (${payload.riskGrade ?? "-"})` : null,
    ].filter(Boolean);

    const inlineKeyboard = payload.links.map((link) => [{ text: link.label, url: link.url }]);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : undefined,
      }),
    });

    if (!res.ok) {
      throw new Error(`Telegram 알림 발송 실패: ${res.status} ${await res.text()}`);
    }
  }
}
