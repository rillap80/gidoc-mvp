import type { NotificationPayload } from "@/lib/notifications/types";

/**
 * 알림 제목을 이벤트별로 생성한다. 회사명을 제목에 직접 포함해
 * (예: "한국고무 AI 보고서 생성 완료") 관리자가 목록/푸시 미리보기만 보고도
 * 어느 회사 건인지 바로 알 수 있게 한다.
 */
export function buildEventTitle(payload: NotificationPayload): string {
  switch (payload.event) {
    case "new_application":
      return `🆕 ${payload.companyName} 기업 건강검진 접수`;
    case "report_completed":
      return `✅ ${payload.companyName} AI 보고서 생성 완료`;
    case "deep_report_completed":
      return `📄 ${payload.companyName} 심층 보고서 생성 완료`;
    default:
      return `${payload.companyName} 알림`;
  }
}
